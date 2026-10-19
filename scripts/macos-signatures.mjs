import { open, readFile, writeFile, mkdir, mkdtemp, copyFile, chmod, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { sha256File } from './desktop-integrity.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const unsignedMessage = 'code object is not signed at all';
const unsealedBundleMessage = 'code has no resources but signature indicates they must be present';
const supportedMagic = 0xfeedfacf;
const otherMachOMagic = new Set([0xfeedface, 0xcefaedfe, 0xcffaedfe, 0xbebafeca, 0xcafebabe, 0xbfbafeca, 0xcafebabf]);

// This is a deliberately narrow description of the immutable Electron 44.9.0
// archives, not a general-purpose signature verifier or an unsigned fallback.
// Native codesign additionally verifies every byte-identical standalone image.
export function inspectPinnedElectronMachO(bytes, architecture) {
  if (bytes.length < 4) return undefined;
  const magic = bytes.readUInt32LE(0);
  if (otherMachOMagic.has(magic)) throw new Error('Unexpected Mach-O format in the pinned Electron archive.');
  if (magic !== supportedMagic) return undefined;
  const expectedCpu = architecture === 'arm64' ? 0x0100000c : architecture === 'x64' ? 0x01000007 : undefined;
  if (!expectedCpu || bytes.length < 32 || bytes.readUInt32LE(4) !== expectedCpu) throw new Error('Pinned Electron Mach-O CPU mismatch.');
  const commands = bytes.readUInt32LE(16), end = 32 + bytes.readUInt32LE(20);
  if (commands > 4096 || end > bytes.length) throw new Error('Invalid Mach-O load command bounds.');
  let cursor = 32, signature;
  for (let index = 0; index < commands; index++) {
    if (cursor + 8 > end) throw new Error('Truncated Mach-O load command.');
    const command = bytes.readUInt32LE(cursor), length = bytes.readUInt32LE(cursor + 4);
    if (length < 8 || length % 8 || cursor + length > end) throw new Error('Invalid Mach-O load command length.');
    if (command === 0x1d) {
      if (signature || length !== 16) throw new Error('Ambiguous Mach-O code signature.');
      signature = { offset: bytes.readUInt32LE(cursor + 8), size: bytes.readUInt32LE(cursor + 12) };
    }
    cursor += length;
  }
  if (cursor !== end) throw new Error('Unaccounted Mach-O load commands.');
  if (architecture === 'x64') {
    if (signature) throw new Error('The pinned x64 Electron distribution must retain its original unsigned images.');
    return { architecture, signed: false, kind: 'original-unsigned' };
  }
  if (!signature || signature.offset < end || signature.size < 20 || signature.offset + signature.size !== bytes.length) throw new Error('Missing or invalid pinned ARM code signature.');
  const blob = bytes.subarray(signature.offset), blobLength = blob.readUInt32BE(4);
  if (blob.readUInt32BE(0) !== 0xfade0cc0 || blobLength > blob.length || blobLength < 20 || blob.readUInt32BE(8) !== 1 || blob.readUInt32BE(12) !== 0) throw new Error('Unexpected pinned ARM signature container.');
  const directoryOffset = blob.readUInt32BE(16);
  if (directoryOffset < 20 || directoryOffset + 88 > blobLength) throw new Error('Invalid CodeDirectory offset.');
  const directory = blob.subarray(directoryOffset, blobLength), length = directory.readUInt32BE(4);
  if (length !== directory.length || directory.readUInt32BE(0) !== 0xfade0c02 || directory.readUInt32BE(8) !== 0x20400 || directory.readUInt32BE(12) !== 0x20002 || directory.readUInt32BE(24) !== 0 || directory[36] !== 32 || directory[37] !== 2 || directory[38] !== 0 || directory[39] !== 12) throw new Error('Electron ARM image is not the pinned linker-only ad-hoc signature with no resource slots.');
  const hashOffset = directory.readUInt32BE(16), identifierOffset = directory.readUInt32BE(20), slots = directory.readUInt32BE(28), codeLimit = directory.readUInt32BE(32);
  if (codeLimit !== signature.offset || slots !== Math.ceil(codeLimit / 4096) || hashOffset + slots * 32 !== length || identifierOffset < 88 || identifierOffset >= hashOffset || directory.subarray(identifierOffset, hashOffset).indexOf(0) < 1) throw new Error('Invalid pinned CodeDirectory hash ranges.');
  if (blob.subarray(blobLength).some(byte => byte !== 0)) throw new Error('Unexpected trailing signature data.');
  for (let slot = 0; slot < slots; slot++) {
    const page = bytes.subarray(slot * 4096, Math.min((slot + 1) * 4096, codeLimit));
    if (sha256(page) !== directory.subarray(hashOffset + slot * 32, hashOffset + (slot + 1) * 32).toString('hex')) throw new Error(`Embedded Mach-O code-page hash mismatch at slot ${slot}.`);
  }
  return { architecture, signed: true, kind: 'original-linker-ad-hoc-code-only', flags: '0x20002', specialSlots: 0, codeSlots: slots, codeDirectorySha256: sha256(directory), codePagesVerified: true, ...signature };
}

function codesign(args) {
  const result = spawnSync('/usr/bin/codesign', args, { encoding: 'utf8', env: { ...process.env, LANG: 'C', LC_ALL: 'C' }, maxBuffer: 1024 * 1024, timeout: 30000 });
  return { command: '/usr/bin/codesign', args, exitCode: result.status, signal: result.signal, stdout: result.stdout || '', stderr: result.stderr || '', ...(result.error ? { error: result.error.message } : {}) };
}
const text = result => `${result.stdout}${result.stderr}`;
const ordinaryFailure = result => result.exitCode === 1 && !result.signal && !result.error;
const exactFailure = (result, message) => ordinaryFailure(result) && text(result).trim() === `${result.args.at(-1)}: ${message}`;

export function assertPinnedBundleResult(architecture, display, verification) {
  if (architecture === 'x64') {
    if (!exactFailure(display, unsignedMessage) || !exactFailure(verification, unsignedMessage)) throw new Error('Pinned x64 bundle no longer has the observed original unsigned state.');
    return 'UNSIGNED';
  }
  if (architecture !== 'arm64' || display.exitCode !== 0 || display.signal || display.error || !/^Signature=adhoc$/mu.test(text(display)) || !/^Info.plist=not bound$/mu.test(text(display)) || !/^Sealed Resources=none$/mu.test(text(display)) || !exactFailure(verification, unsealedBundleMessage)) throw new Error('Pinned ARM bundle signature differs from the observed unsealed upstream bundle; inspect the raw diagnostic.');
  return 'FAIL_UNSEALED_ORIGINAL_BUNDLE';
}

export async function inspectOriginalElectronSignatures(vendorRoot, { architecture, version, files, scratchParent, reportPath }) {
  if (process.platform !== 'darwin' || version !== '44.9.0' || !['x64', 'arm64'].includes(architecture)) throw new Error('Original Electron signature inspection is limited to native Mac and the pinned 44.9.0 archives.');
  const report = { status: 'RUNNING', scope: 'Original upstream bytes and individual Mach-O signatures; complete bundle signature is NOT verified', architecture, version, vendorRoot, bundleSignatureVerified: false, images: [] };
  let scratch;
  try {
    const bundle = path.join(vendorRoot, 'Electron.app');
    report.bundle = { display: codesign(['--display', '--verbose=4', bundle]), verification: codesign(['--verify', '--deep', '--strict', '--all-architectures', '--verbose=2', bundle]) };
    report.bundle.status = assertPinnedBundleResult(architecture, report.bundle.display, report.bundle.verification);
    if (files.some(item => item.path.split('/').some(part => part === '_CodeSignature' || part === 'CodeResources'))) throw new Error('The pinned upstream Electron archives must not gain or lose an unrecorded resource envelope.');
    scratch = await mkdtemp(path.join(scratchParent, 'electron-signature-blobs-'));
    for (const entry of files.filter(item => item.type === 'file')) {
      const filename = path.join(vendorRoot, entry.path), handle = await open(filename, 'r');
      const prefix = Buffer.alloc(4);
      let count;
      try { count = (await handle.read(prefix, 0, 4, 0)).bytesRead; } finally { await handle.close(); }
      if (count < 4 || (prefix.readUInt32LE(0) !== supportedMagic && !otherMachOMagic.has(prefix.readUInt32LE(0)))) continue;
      const bytes = await readFile(filename), metadata = inspectPinnedElectronMachO(bytes, architecture), hash = sha256(bytes);
      if (hash !== entry.sha256 || bytes.length !== entry.size) throw new Error(`Mach-O differs from the verified original inventory: ${entry.path}`);
      // Keep the original basename but remove bundle context. The exact binary
      // bytes are not re-signed or transformed; no copy enters the product ZIP.
      const copyDirectory = path.join(scratch, String(report.images.length));
      await mkdir(copyDirectory);
      const copied = path.join(copyDirectory, path.basename(filename));
      await copyFile(filename, copied); await chmod(copied, entry.mode);
      if (await sha256File(copied) !== hash) throw new Error('Signature inspection copy changed the original binary.');
      const image = { path: entry.path, sha256: hash, ...metadata, display: codesign(['--display', '--verbose=4', copied]), verification: codesign(['--verify', '--strict', '--all-architectures', '--verbose=2', copied]) };
      report.images.push(image);
      if (architecture === 'arm64') {
        if (image.display.exitCode !== 0 || image.display.error || image.display.signal || !/^Signature=adhoc$/mu.test(text(image.display)) || image.verification.exitCode !== 0 || image.verification.error || image.verification.signal) throw new Error(`Native code-only signature verification failed: ${entry.path}`);
        image.status = 'PASS_CODE_SIGNATURE_ONLY';
      } else {
        if (!exactFailure(image.display, unsignedMessage) || !exactFailure(image.verification, unsignedMessage)) throw new Error(`Original unsigned image changed state: ${entry.path}`);
        image.status = 'UNSIGNED';
      }
      if (await sha256File(filename) !== hash || await sha256File(copied) !== hash) throw new Error('Original or inspection copy changed during codesign verification.');
    }
    if (report.images.length !== 14) throw new Error('Expected all 14 Mach-O images from the pinned original Electron archive.');
    report.status = 'PASS_ORIGINAL_BYTES_AND_CODE_SIGNATURE_SCOPE';
    return report;
  } catch (error) {
    report.status = 'FAIL'; report.error = error.stack || error.message;
    throw error;
  } finally {
    // mkdtemp created this exact owned path; no vendor/source path is deleted.
    if (scratch) {
      try { await rm(scratch, { recursive: true, force: true }); } catch (error) { report.status = 'FAIL'; report.cleanupError = error.message; await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`); throw error; }
    }
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
}
