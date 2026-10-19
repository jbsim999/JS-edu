import { createReadStream, createWriteStream, constants } from 'node:fs';
import { readFile, writeFile, mkdir, stat, copyFile, rm } from 'node:fs/promises';
import { createHash, createCipheriv, createDecipheriv, createPublicKey, createPrivateKey, publicEncrypt, privateDecrypt, randomBytes, randomUUID, constants as cryptoConstants } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const fingerprint = key => createHash('sha256').update(createPublicKey(key).export({ type: 'spki', format: 'der' })).digest('hex');
async function fileHash(file) {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
}
function checkHeader(header) {
  if (header.schemaVersion !== 1 || header.algorithm !== 'RSA-OAEP-SHA256+AES-256-GCM'
    || !/^[a-f\d]{40}$/u.test(header.sourceCommit) || !/^[a-f\d]{64}$/u.test(header.sha256)
    || !/^[a-f\d]{64}$/u.test(header.recipientFingerprint) || !Number.isSafeInteger(header.bytes) || header.bytes < 1
    || !['win32', 'darwin'].includes(header.platform) || !['x64', 'arm64'].includes(header.architecture)
    || !/^[A-Za-z\d._-]+\.zip$/u.test(header.filename)) throw new Error('Invalid artifact transfer identity.');
}

export async function sealArtifact(manifestPath, recipientPath, outputDirectory) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const recipient = JSON.parse(await readFile(recipientPath, 'utf8'));
  const publicKey = createPublicKey(recipient.publicKey);
  if (publicKey.asymmetricKeyType !== 'rsa' || publicKey.asymmetricKeyDetails.modulusLength < 3072) throw new Error('RSA public key must be at least 3072 bits.');
  const header = { schemaVersion: 1, algorithm: 'RSA-OAEP-SHA256+AES-256-GCM', sourceCommit: manifest.sourceCommit,
    platform: manifest.target?.platform, architecture: manifest.target?.architecture, filename: manifest.package,
    bytes: manifest.bytes, sha256: manifest.sha256, recipientFingerprint: fingerprint(recipient.publicKey) };
  checkHeader(header);
  if (manifest.status !== 'PASS' || manifest.sourceDirty !== false || recipient.fingerprint !== header.recipientFingerprint) throw new Error('A clean verified archive and matching recipient are required.');
  const source = path.join(path.dirname(manifestPath), header.filename);
  if ((await stat(source)).size !== header.bytes || await fileHash(source) !== header.sha256) throw new Error('Verified archive no longer matches the manifest.');
  await mkdir(outputDirectory, { recursive: true });
  const destination = path.join(outputDirectory, `${header.filename}.sealed`);
  const key = randomBytes(32), nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(JSON.stringify(header)));
  try {
    await pipeline(createReadStream(source), cipher, createWriteStream(destination, { flags: 'wx' }));
    const metadata = { header, encryptedKey: publicEncrypt({ key: publicKey, padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, key).toString('base64'),
      nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertextSha256: await fileHash(destination) };
    await writeFile(`${destination}.json`, JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' });
    return { file: destination, metadata: `${destination}.json`, ...header };
  } finally { key.fill(0); }
}

// Encryption is not a publisher signature. The caller must obtain the expected
// manifest from the exact trusted CI run/commit and compare it independently.
export async function unsealArtifact(sealedFile, privateKeyFile, expectedManifestFile, outputFile) {
  const metadata = JSON.parse(await readFile(`${sealedFile}.json`, 'utf8'));
  const expected = JSON.parse(await readFile(expectedManifestFile, 'utf8'));
  checkHeader(metadata.header);
  const header = metadata.header;
  if (expected.status !== 'PASS' || expected.sourceDirty !== false || header.sourceCommit !== expected.sourceCommit
    || header.filename !== expected.package || header.sha256 !== expected.sha256 || header.bytes !== expected.bytes
    || header.platform !== expected.target?.platform || header.architecture !== expected.target?.architecture) throw new Error('Envelope does not match the independently retrieved CI manifest.');
  const privateKey = createPrivateKey(await readFile(privateKeyFile));
  if (privateKey.asymmetricKeyType !== 'rsa' || privateKey.asymmetricKeyDetails.modulusLength < 3072 || fingerprint(privateKey) !== header.recipientFingerprint) throw new Error('Wrong artifact recipient.');
  if ((await stat(sealedFile)).size !== header.bytes) throw new Error('Ciphertext size mismatch.');
  if (await fileHash(sealedFile) !== metadata.ciphertextSha256) throw new Error('Ciphertext checksum mismatch.');
  const nonce = Buffer.from(metadata.nonce, 'base64'), tag = Buffer.from(metadata.tag, 'base64');
  if (nonce.length !== 12 || tag.length !== 16) throw new Error('Invalid authenticated encryption parameters.');
  const key = privateDecrypt({ key: privateKey, padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(metadata.encryptedKey, 'base64'));
  const temporary = `${outputFile}.${randomUUID()}.unverified`;
  let created = false;
  try {
    const cipher = createDecipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
    cipher.setAAD(Buffer.from(JSON.stringify(header)));
    cipher.setAuthTag(tag);
    const hash = createHash('sha256');
    let bytes = 0;
    const meter = new Transform({ transform(chunk, encoding, done) {
      bytes += chunk.length;
      if (bytes > header.bytes) return done(new Error('Decrypted payload exceeds the verified size.'));
      hash.update(chunk); done(null, chunk);
    } });
    const output = createWriteStream(temporary, { flags: 'wx', mode: 0o600 });
    output.once('open', () => { created = true; });
    await pipeline(createReadStream(sealedFile), cipher, meter, output);
    if (bytes !== header.bytes || hash.digest('hex') !== header.sha256) throw new Error('Authenticated plaintext differs from the verified CI archive.');
    await copyFile(temporary, outputFile, constants.COPYFILE_EXCL);
    return { status: 'PASS', file: outputFile, ...header };
  } finally {
    key.fill(0);
    if (created) await rm(temporary, { force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'seal' && args.length === 3) console.log(JSON.stringify(await sealArtifact(...args)));
  else if (mode === 'unseal' && args.length === 4) console.log(JSON.stringify(await unsealArtifact(...args)));
  else throw new Error('Usage: seal <manifest> <public-recipient.json> <output-directory> | unseal <sealed-file> <private-key-file> <expected-manifest> <output-zip>');
}
