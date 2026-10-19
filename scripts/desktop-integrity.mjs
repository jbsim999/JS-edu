import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, readdir, mkdir, lstat, stat, open, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { createInflateRaw } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

export function safeRelativePath(value) {
  if (typeof value !== 'string' || !value || value.length > 1024 || value.includes('\\') || value.endsWith('/')) throw new Error(`Unsafe archive path: ${value}`);
  for (const part of value.split('/')) {
    if (!part || part === '.' || part === '..' || /[\u0000-\u001f<>:"|?*]/u.test(part) || /[. ]$/u.test(part)
      || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part)) throw new Error(`Unsafe archive path: ${value}`);
  }
  return value;
}

export function assertDistinctPaths(entries) {
  const names = new Map();
  const components = new Map();
  for (const entry of entries) {
    const name = safeRelativePath(entry.path);
    const lower = name.toLowerCase();
    if (names.has(lower)) throw new Error(`Duplicate or case-colliding path: ${name}`);
    names.set(lower, entry.type);
    const segments = name.split('/');
    for (let index = 1; index <= segments.length; index++) {
      const prefix = segments.slice(0, index).join('/');
      const previous = components.get(prefix.toLowerCase());
      if (previous && previous !== prefix) throw new Error(`Case-colliding directory component: ${prefix}`);
      components.set(prefix.toLowerCase(), prefix);
    }
  }
  for (const entry of entries) {
    const parts = entry.path.toLowerCase().split('/');
    for (let index = 1; index < parts.length; index++) if (names.get(parts.slice(0, index).join('/')) === 'file') throw new Error(`File is also a parent directory: ${entry.path}`);
  }
}

export async function sha256File(filename) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

export async function gitBlobHash(filename) {
  const size = (await stat(filename)).size;
  const hash = createHash('sha1').update(`blob ${size}\0`);
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

export async function assertHeadSourceBytes(root, entries, headBlobs, { allowDirty = false } = {}) {
  const changed = [];
  for (const item of entries.filter(item => item.type === 'file')) {
    if (headBlobs.get(item.path) !== await gitBlobHash(path.join(root, safeRelativePath(item.path)))) changed.push(item.path);
  }
  if (changed.length && !allowDirty) throw new Error(`Source bytes differ from HEAD (including hidden index flags): ${changed.slice(0, 8).join(', ')}`);
  return changed;
}

export async function inventory(root) {
  const entries = [];
  const base = await lstat(root);
  if (!base.isDirectory() || base.isSymbolicLink()) throw new Error('Inventory root must be a real directory.');
  async function visit(relative) {
    const children = await readdir(path.join(root, relative), { withFileTypes: true });
    for (const child of children.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const item = relative ? `${relative}/${child.name}` : child.name;
      safeRelativePath(item);
      const filename = path.join(root, item);
      const metadata = await lstat(filename);
      if (metadata.isSymbolicLink()) throw new Error(`Links/reparse points are not allowed in the Windows package: ${item}`);
      if (metadata.isDirectory()) { entries.push({ path: item, type: 'directory' }); await visit(item); }
      else if (metadata.isFile()) entries.push({ path: item, type: 'file', size: metadata.size, sha256: await sha256File(filename) });
      else throw new Error(`Unsupported entry: ${item}`);
    }
  }
  await visit('');
  assertDistinctPaths(entries);
  return entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

export function compareInventories(expected, actual, label = 'package') {
  assertDistinctPaths(expected);
  assertDistinctPaths(actual);
  const byPath = new Map(actual.map(item => [item.path, item]));
  const errors = [];
  for (const item of expected) {
    const other = byPath.get(item.path);
    if (!other || other.type !== item.type || (item.type === 'file' && (other.size !== item.size || other.sha256 !== item.sha256))) errors.push(item.path);
    byPath.delete(item.path);
  }
  errors.push(...byPath.keys());
  if (errors.length) throw new Error(`${label} inventory mismatch (${errors.length}): ${errors.slice(0, 8).join(', ')}`);
  return { entries: actual.length, files: actual.filter(item => item.type === 'file').length };
}

export async function copyInventory(from, to, entries) {
  await mkdir(to, { recursive: false });
  for (const item of entries) {
    const destination = path.join(to, safeRelativePath(item.path));
    if (item.type === 'directory') await mkdir(destination, { recursive: true });
    else { await mkdir(path.dirname(destination), { recursive: true }); await copyFile(path.join(from, item.path), destination); }
  }
  compareInventories(entries, await inventory(to), 'Copied distribution');
}

// Windows distributions currently fit ordinary ZIP. ZIP64/encryption/links are rejected,
// rather than guessed. A format change requires an explicit parser + extraction review.
export async function readZipEntries(filename) {
  const file = await open(filename, 'r');
  try {
    const size = (await file.stat()).size;
    const tailLength = Math.min(size, 65557);
    const tail = Buffer.alloc(tailLength);
    await file.read(tail, 0, tailLength, size - tailLength);
    let eocd = -1;
    for (let offset = tail.length - 22; offset >= 0; offset--) if (tail.readUInt32LE(offset) === 0x06054b50 && offset + 22 + tail.readUInt16LE(offset + 20) === tail.length) { eocd = offset; break; }
    if (eocd < 0) throw new Error('ZIP end record is missing.');
    const disk = tail.readUInt16LE(eocd + 4);
    const count = tail.readUInt16LE(eocd + 10);
    const directorySize = tail.readUInt32LE(eocd + 12);
    const directoryOffset = tail.readUInt32LE(eocd + 16);
    if (disk || tail.readUInt16LE(eocd + 6) || tail.readUInt16LE(eocd + 8) !== count || count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff || directorySize > 16 * 1024 * 1024 || directoryOffset + directorySize > size - tailLength + eocd) throw new Error('Unsupported ZIP64/multidisk or invalid central directory.');
    const directory = Buffer.alloc(directorySize);
    await file.read(directory, 0, directorySize, directoryOffset);
    const entries = [];
    let offset = 0;
    let uncompressedTotal = 0;
    const decoder = new TextDecoder('utf-8', { fatal: true });
    while (offset < directory.length) {
      if (offset + 46 > directory.length || directory.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP central entry.');
      const flags = directory.readUInt16LE(offset + 8);
      const method = directory.readUInt16LE(offset + 10);
      const compressedSize = directory.readUInt32LE(offset + 20);
      const uncompressedSize = directory.readUInt32LE(offset + 24);
      const nameLength = directory.readUInt16LE(offset + 28);
      const extraLength = directory.readUInt16LE(offset + 30);
      const commentLength = directory.readUInt16LE(offset + 32);
      const external = directory.readUInt32LE(offset + 38);
      const localOffset = directory.readUInt32LE(offset + 42);
      const end = offset + 46 + nameLength + extraLength + commentLength;
      if (end > directory.length || (flags & 1) || ![0, 8].includes(method) || localOffset === 0xffffffff || uncompressedSize === 0xffffffff || compressedSize === 0xffffffff || localOffset >= directoryOffset || uncompressedSize > 1024 * 1024 * 1024) throw new Error('Unsupported or invalid ZIP entry.');
      const rawName = decoder.decode(directory.subarray(offset + 46, offset + 46 + nameLength));
      const directoryEntry = rawName.endsWith('/');
      const name = safeRelativePath(directoryEntry ? rawName.slice(0, -1) : rawName);
      const unixType = (external >>> 16) & 0xf000;
      if (![0, 0x4000, 0x8000].includes(unixType) || (external & 0x400)) throw new Error(`Unsupported ZIP link/reparse entry: ${name}`);
      if ((directoryEntry && uncompressedSize !== 0) || (unixType === 0x4000 && !directoryEntry)) throw new Error('ZIP directory metadata mismatch.');
      uncompressedTotal += uncompressedSize;
      if (uncompressedTotal > 2 * 1024 * 1024 * 1024) throw new Error('ZIP uncompressed total is too large.');
      const header = Buffer.alloc(30);
      await file.read(header, 0, 30, localOffset);
      if (header.readUInt32LE(0) !== 0x04034b50 || header.readUInt16LE(6) !== flags || header.readUInt16LE(8) !== method) throw new Error('ZIP local header mismatch.');
      const localNameLength = header.readUInt16LE(26);
      const localName = Buffer.alloc(localNameLength);
      await file.read(localName, 0, localNameLength, localOffset + 30);
      if (decoder.decode(localName) !== rawName) throw new Error('ZIP local/central path mismatch.');
      const dataOffset = localOffset + 30 + localNameLength + header.readUInt16LE(28);
      if (dataOffset + compressedSize > directoryOffset) throw new Error('ZIP data exceeds central directory boundary.');
      entries.push({ path: name, type: directoryEntry ? 'directory' : 'file', size: uncompressedSize, compressedSize, dataOffset, method });
      offset = end;
    }
    if (entries.length !== count) throw new Error('ZIP entry count mismatch.');
    assertDistinctPaths(entries);
    return entries;
  } finally { await file.close(); }
}

export async function extractZip(filename, destination) {
  const entries = await readZipEntries(filename);
  // Fresh directories only. Never merge an archive into pre-existing user files.
  await mkdir(destination, { recursive: false });
  for (const item of entries) {
    const target = path.join(destination, item.path);
    if (item.type === 'directory') { await mkdir(target, { recursive: true }); continue; }
    await mkdir(path.dirname(target), { recursive: true });
    if (!item.compressedSize) {
      if (item.size) throw new Error('ZIP empty compressed stream has nonempty output.');
      const output = await open(target, 'wx'); await output.close();
      continue;
    }
    let bytes = 0;
    const limit = new Transform({ transform(chunk, encoding, done) { bytes += chunk.length; done(bytes > item.size ? new Error(`ZIP size exceeded: ${item.path}`) : null, chunk); } });
    const input = createReadStream(filename, { start: item.dataOffset, end: item.dataOffset + item.compressedSize - 1 });
    const streams = item.method === 8 ? [input, createInflateRaw(), limit, createWriteStream(target, { flags: 'wx' })] : [input, limit, createWriteStream(target, { flags: 'wx' })];
    await pipeline(...streams);
    if (bytes !== item.size) throw new Error(`ZIP output size mismatch: ${item.path}`);
  }
  return inventory(destination);
}

export async function verifyArchive(filename, vendor) {
  if (path.basename(filename) !== vendor.archive || await sha256File(filename) !== vendor.sha256) throw new Error(`Official archive checksum mismatch: ${vendor.archive}`);
  return { archive: vendor.archive, size: (await stat(filename)).size, sha256: vendor.sha256 };
}

export function selectPackageSource(entries, { folder, trackedPaths, allowDirty = false, candidatePaths = new Set() }) {
  const extensions = new Set(['.mjs', '.cjs', '.js', '.json', '.html', '.css', '.md', '.svg', '.png', '.woff2']);
  const files = entries.filter(item => item.type === 'file');
  for (const item of files) {
    const relative = `${folder}/${item.path}`;
    if (!extensions.has(path.posix.extname(item.path)) || item.path.split('/').some(part => part.startsWith('.'))) throw new Error(`Unapproved package source file: ${relative}`);
    if (!trackedPaths.has(relative) && !(allowDirty && candidatePaths.has(relative))) throw new Error(`Untracked or ignored package source file: ${relative}`);
  }
  const present = new Set(files.map(item => `${folder}/${item.path}`));
  const missing = [...trackedPaths].filter(relative => relative.startsWith(`${folder}/`) && !present.has(relative));
  if (missing.length) throw new Error(`Tracked package source is missing: ${missing.slice(0, 8).join(', ')}`);
  return entries.filter(item => item.type === 'file' || files.some(file => file.path.startsWith(`${item.path}/`)));
}

export async function verifyFinalPackage(packageRoot, manifestFile) {
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  if (manifest.status !== 'PASS' || manifest.scope !== 'final-zip-extraction-and-byte-integrity-only' || !Array.isArray(manifest.inventory)
    || !/^[a-f0-9]{40}$/.test(manifest.sourceCommit || '') || !/^[a-f0-9]{64}$/.test(manifest.sha256 || '')
    || typeof manifest.package !== 'string' || path.basename(manifest.package) !== manifest.package || !manifest.package.endsWith('.zip')) throw new Error('External final-package manifest is invalid.');
  const archive = path.join(path.dirname(path.resolve(manifestFile)), manifest.package);
  if (await sha256File(archive) !== manifest.sha256 || (await stat(archive)).size !== manifest.bytes) throw new Error('Final ZIP no longer matches the external manifest.');
  compareInventories(manifest.inventory, await inventory(packageRoot), 'Verified final-package baseline');
  const build = JSON.parse(await readFile(path.join(packageRoot, 'BUILD-INFO.json'), 'utf8'));
  if (build.sourceCommit !== manifest.sourceCommit || build.sourceDirty !== manifest.sourceDirty || build.sourceFilesSha256 !== manifest.sourceFilesSha256) throw new Error('Final package source identity differs from the external manifest.');
  const source = JSON.parse(await readFile(path.join(packageRoot, 'integrity', 'source.json'), 'utf8'));
  if (source.sourceCommit !== manifest.sourceCommit || source.digest !== manifest.sourceFilesSha256) throw new Error('Packaged source manifest identity mismatch.');
  for (const item of source.files.filter(item => item.type === 'file')) {
    const filename = path.join(packageRoot, 'resources', 'app', safeRelativePath(item.path));
    if ((await stat(filename)).size !== item.size || await sha256File(filename) !== item.sha256) throw new Error(`Packaged source bytes do not match: ${item.path}`);
  }
  return manifest;
}
