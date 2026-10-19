import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createPublicKey, createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { sealArtifact, unsealArtifact } from '../scripts/desktop-artifact-transfer.mjs';

const pair = generateKeyPairSync('rsa', {modulusLength:3072, publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
const hash = value => createHash('sha256').update(value).digest('hex');
async function fixture(t) {
  const root=await mkdtemp(path.join(os.tmpdir(),'js-edu-transfer-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const bytes=Buffer.from('private package bytes\0한글');
  const manifest={status:'PASS',sourceDirty:false,sourceCommit:'a'.repeat(40),target:{platform:'darwin',architecture:'arm64'},package:'JavaScript-edu-test.zip',bytes:bytes.length,sha256:hash(bytes)};
  const manifestFile=path.join(root,'manifest.json'), recipient=path.join(root,'recipient.json'), key=path.join(root,'private.pem');
  await writeFile(path.join(root,manifest.package),bytes);
  await writeFile(manifestFile,JSON.stringify(manifest));
  await writeFile(recipient,JSON.stringify({publicKey:pair.publicKey,fingerprint:hash(createPublicKey(pair.publicKey).export({type:'spki',format:'der'}))}));
  await writeFile(key,pair.privateKey,{mode:0o600});
  return {root,bytes,manifest,manifestFile,recipient,key};
}

test('sealed transfer round trips exact bytes only for its recipient and independently matched source manifest', async t=>{
  const f=await fixture(t);
  const sealed=await sealArtifact(f.manifestFile,f.recipient,path.join(f.root,'sealed'));
  const output=path.join(f.root,'verified.zip');
  const result=await unsealArtifact(sealed.file,f.key,f.manifestFile,output);
  assert.equal(result.status,'PASS');
  assert.deepEqual(await readFile(output),f.bytes);
  assert.notDeepEqual(await readFile(sealed.file),f.bytes);
  await assert.rejects(unsealArtifact(sealed.file,f.key,f.manifestFile,output),/EEXIST/);
  const metadata=JSON.parse(await readFile(sealed.metadata,'utf8'));
  assert.equal(Buffer.from(metadata.nonce,'base64').length,12);
  assert.equal(Buffer.from(metadata.tag,'base64').length,16);
  assert.equal(Buffer.from(metadata.encryptedKey,'base64').length,384);
});

test('new keys/nonces are used per artifact; changed AAD and authentication tag expose no verified output', async t=>{
  const f=await fixture(t);
  const first=await sealArtifact(f.manifestFile,f.recipient,path.join(f.root,'first'));
  const second=await sealArtifact(f.manifestFile,f.recipient,path.join(f.root,'second'));
  const a=JSON.parse(await readFile(first.metadata,'utf8')), b=JSON.parse(await readFile(second.metadata,'utf8'));
  assert.notEqual(a.nonce,b.nonce); assert.notEqual(a.encryptedKey,b.encryptedKey);
  const output=path.join(f.root,'untrusted.zip');
  a.tag=Buffer.alloc(16).toString('base64');
  await writeFile(first.metadata,JSON.stringify(a));
  await assert.rejects(unsealArtifact(first.file,f.key,f.manifestFile,output));
  await assert.rejects(stat(output),{code:'ENOENT'});
  assert.deepEqual((await readdir(f.root)).filter(name=>name.endsWith('.unverified')),[]);
  b.header.sourceCommit='b'.repeat(40);
  await writeFile(second.metadata,JSON.stringify(b));
  await assert.rejects(unsealArtifact(second.file,f.key,f.manifestFile,output),/independently retrieved/);
  await writeFile(f.manifestFile,JSON.stringify({...f.manifest,sourceCommit:b.header.sourceCommit}));
  await assert.rejects(unsealArtifact(second.file,f.key,f.manifestFile,output),/authenticate|authenticating/);
});

test('dirty sources, changed payloads and replaced recipient identities are refused', async t=>{
  const f=await fixture(t);
  await writeFile(f.manifestFile,JSON.stringify({...f.manifest,sourceDirty:true}));
  await assert.rejects(sealArtifact(f.manifestFile,f.recipient,path.join(f.root,'dirty')),/clean verified/);
  await writeFile(f.manifestFile,JSON.stringify(f.manifest));
  const sealed=await sealArtifact(f.manifestFile,f.recipient,path.join(f.root,'sealed'));
  await writeFile(sealed.file,'changed');
  await assert.rejects(unsealArtifact(sealed.file,f.key,f.manifestFile,path.join(f.root,'untrusted.zip')),/Ciphertext (size|checksum)/);
  await writeFile(f.recipient,JSON.stringify({publicKey:pair.publicKey,fingerprint:'0'.repeat(64)}));
  await assert.rejects(sealArtifact(f.manifestFile,f.recipient,path.join(f.root,'wrong-recipient')),/matching recipient/);
});

test('build-only transfer requires explicit opt-in at both ends and cannot be relabelled verified', async t => {
  const f = await fixture(t);
  const skipped = { ...f.manifest, status: 'BUILT_UNVERIFIED', scope: 'build-only-final-package-verification-skipped', finalArchiveVerification: 'SKIPPED_BY_REQUEST', nativeApplicationTest: 'SKIPPED_BY_REQUEST' };
  await writeFile(f.manifestFile, JSON.stringify(skipped));
  await assert.rejects(sealArtifact(f.manifestFile, f.recipient, path.join(f.root, 'default')), /clean verified/);
  const options = { allowUnverified: true };
  const sealed = await sealArtifact(f.manifestFile, f.recipient, path.join(f.root, 'explicit'), options);
  const output = path.join(f.root, 'build-only.zip');
  await assert.rejects(unsealArtifact(sealed.file, f.key, f.manifestFile, output), /independently retrieved/);
  await writeFile(f.manifestFile, JSON.stringify(f.manifest));
  await assert.rejects(unsealArtifact(sealed.file, f.key, f.manifestFile, output, options), /independently retrieved/);
  await writeFile(f.manifestFile, JSON.stringify(skipped));
  const result = await unsealArtifact(sealed.file, f.key, f.manifestFile, output, options);
  assert.equal(result.packageStatus, 'BUILT_UNVERIFIED');
  assert.equal(result.scope, 'authenticated-artifact-transfer-only');
  assert.deepEqual(await readFile(output), f.bytes);
  for (const [field, value] of [['sourceDirty', true], ['finalArchiveVerification', 'PASS'], ['scope', 'unrecognized']]) {
    await writeFile(f.manifestFile, JSON.stringify({ ...skipped, [field]: value }));
    await assert.rejects(sealArtifact(f.manifestFile, f.recipient, path.join(f.root, `invalid-${field}`), options), /clean verified/);
  }
});
