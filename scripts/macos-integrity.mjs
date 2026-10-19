import { lstat, readdir, readlink, mkdir, copyFile, chmod, lchmod, symlink, readFile, writeFile, stat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInflateRaw, inflateRawSync, gunzipSync } from 'node:zlib';
import path from 'node:path';
import { safeRelativePath, assertDistinctPaths, sha256File, compareInventories, readZipEntries } from './desktop-integrity.mjs';

// Unix links are recorded, never traversed while enumerating. Resolve every path
// component against the recorded archive to reject dangling, escaping or cyclic
// links before any link is created. Hard links and special files remain unsupported.
export function validateUnixLinks(entries) {
  assertDistinctPaths(entries);
  const table = new Map(entries.map(item => [item.path, item]));
  for (const item of entries) {
    const parts = item.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const name = parts.slice(0, i).join('/');
      if (!table.has(name)) table.set(name, { path: name, type: 'directory' });
    }
  }
  function resolve(parts, visited = new Set()) {
    const resolved = [];
    for (const [index, part] of parts.entries()) {
      if (!part || part === '.') continue;
      if (part === '..') { if (!resolved.length) throw new Error('Unix link escapes its distribution.'); resolved.pop(); continue; }
      resolved.push(part);
      const name = resolved.join('/');
      const item = table.get(name);
      if (!item) throw new Error(`Dangling Unix link target: ${name}`);
      if (item.type === 'symlink') {
        if (visited.has(name)) throw new Error(`Cyclic Unix link: ${name}`);
        const seen = new Set(visited).add(name);
        const target = item.target;
        if (typeof target !== 'string' || !target || target.length > 4096 || target.startsWith('/') || target.includes('\\') || /[\u0000-\u001f:]/u.test(target)) throw new Error(`Unsafe Unix link: ${name}`);
        const replacement = resolve([...resolved.slice(0, -1), ...target.split('/')], seen);
        resolved.splice(0, resolved.length, ...replacement);
      }
      if (table.get(resolved.join('/'))?.type === 'file' && index < parts.length - 1) throw new Error(`Unix link traverses through a file: ${name}`);
    }
    return resolved;
  }
  for (const item of entries.filter(item => item.type === 'symlink')) {
    const resolved = resolve(item.path.split('/'));
    if (!resolved.length || !table.has(resolved.join('/'))) throw new Error(`Unix link has no final target: ${item.path}`);
  }
  return entries;
}

export async function unixInventory(root) {
  const metadata = await lstat(root);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error('Unix inventory requires a real directory.');
  const entries = [];
  async function visit(relative) {
    for (const name of (await readdir(path.join(root, relative))).sort()) {
      const item = safeRelativePath(relative ? `${relative}/${name}` : name);
      const filename = path.join(root, item), info = await lstat(filename);
      const mode = info.mode & 0o777;
      if (info.mode & 0o7000) throw new Error(`Unsupported special Unix permissions: ${item}`);
      if (info.isSymbolicLink()) entries.push({ path: item, type: 'symlink', mode, target: await readlink(filename) });
      else if (info.isDirectory()) { entries.push({ path: item, type: 'directory', mode }); await visit(item); }
      else if (info.isFile()) entries.push({ path: item, type: 'file', mode, size: info.size, sha256: await sha256File(filename) });
      else throw new Error(`Unsupported Unix entry: ${item}`);
    }
  }
  await visit('');
  return validateUnixLinks(entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export function compareUnixInventories(expected, actual, label = 'Unix package') {
  const result = compareInventories(expected, actual, label);
  const other = new Map(actual.map(item => [item.path, item]));
  for (const item of expected) {
    const entry = other.get(item.path);
    if (item.mode !== entry.mode || (item.type === 'symlink' && item.target !== entry.target)) throw new Error(`${label} mode/link mismatch: ${item.path}`);
  }
  return result;
}

async function finishLinksAndModes(destination, entries) {
  for (const item of entries.filter(item => item.type === 'symlink')) {
    const filename = path.join(destination, item.path);
    await symlink(item.target, filename);
    if (process.platform === 'darwin') await lchmod(filename, item.mode);
  }
  for (const item of [...entries].reverse()) if (item.type !== 'symlink') await chmod(path.join(destination, item.path), item.mode);
}

async function verifyExtractedMetadata(destination, entries) {
  const actual = await unixInventory(destination);
  const table = new Map(actual.map(item => [item.path, item]));
  if (actual.length !== entries.length) throw new Error('Unix archive contains unrecorded implicit entries.');
  for (const item of entries) {
    const found = table.get(item.path);
    if (!found || item.type !== found.type || item.mode !== found.mode || (item.type === 'file' && item.size !== found.size)
      || (item.type === 'symlink' && item.target !== found.target)) throw new Error(`Unix archive metadata was not preserved: ${item.path}`);
  }
  return actual;
}

export async function copyUnixInventory(from, to, entries) {
  validateUnixLinks(entries);
  await mkdir(to, { recursive: false });
  for (const item of entries) {
    const target = path.join(to, item.path);
    await mkdir(path.dirname(target), { recursive: true });
    if (item.type === 'directory') await mkdir(target, { recursive: true });
    else if (item.type === 'file') await copyFile(path.join(from, item.path), target);
  }
  await finishLinksAndModes(to, entries);
  compareUnixInventories(entries, await unixInventory(to), 'Copied Unix distribution');
}

export async function extractUnixZip(filename, destination) {
  if (process.platform === 'win32') throw new Error('Unix archive extraction requires a Unix filesystem; Windows cross-extraction is not equivalent.');
  const entries = await readZipEntries(filename, { unix: true });
  const archive = await readFile(filename);
  for (const item of entries.filter(item => item.type === 'symlink')) {
    if (item.size > 4096) throw new Error('Unix ZIP link is too long.');
    const data = archive.subarray(item.dataOffset, item.dataOffset + item.compressedSize);
    const content = item.method === 8 ? inflateRawSync(data, { maxOutputLength: 4096 }) : data;
    if (content.length !== item.size) throw new Error('Unix ZIP link size mismatch.');
    item.target = new TextDecoder('utf-8', { fatal: true }).decode(content);
  }
  validateUnixLinks(entries);
  await mkdir(destination, { recursive: false });
  for (const item of entries) {
    const target = path.join(destination, item.path);
    await mkdir(path.dirname(target), { recursive: true });
    if (item.type === 'directory') { await mkdir(target, { recursive: true }); continue; }
    if (item.type === 'symlink') continue;
    if (!item.compressedSize) { if (item.size) throw new Error('Unix ZIP stream is empty.'); await writeFile(target, '', { flag: 'wx' }); continue; }
    let bytes = 0;
    const limit = new Transform({ transform(chunk, encoding, done) { bytes += chunk.length; done(bytes > item.size ? new Error('Unix ZIP exceeded declared size.') : null, chunk); } });
    const input = createReadStream(filename, { start: item.dataOffset, end: item.dataOffset + item.compressedSize - 1 });
    await pipeline(...(item.method === 8 ? [input, createInflateRaw(), limit, createWriteStream(target, { flags: 'wx' })] : [input, limit, createWriteStream(target, { flags: 'wx' })]));
    if (bytes !== item.size) throw new Error('Unix ZIP output size mismatch.');
  }
  await finishLinksAndModes(destination, entries);
  return verifyExtractedMetadata(destination, entries);
}

export function readTarEntries(data) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const text = buffer => decoder.decode(buffer.subarray(0, buffer.indexOf(0) < 0 ? buffer.length : buffer.indexOf(0)));
  const octal = buffer => { const value = text(buffer).trim(); if (!/^[0-7]+$/.test(value)) throw new Error('Invalid tar numeric field.'); return Number.parseInt(value, 8); };
  const entries = [];
  let offset = 0, longPath, longLink;
  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) {
      if (data.length - offset < 1024 || !data.subarray(offset).every(byte => byte === 0) || longPath || longLink) throw new Error('Invalid tar end marker.');
      return validateUnixLinks(entries);
    }
    const checksum = octal(header.subarray(148, 156));
    const actual = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    if (actual !== checksum) throw new Error('Tar header checksum mismatch.');
    const size = octal(header.subarray(124, 136)), mode = octal(header.subarray(100, 108));
    if (mode & ~0o777 || size > 512 * 1024 * 1024 || offset + 512 + size > data.length) throw new Error('Unsafe tar size or mode.');
    const type = header[156] ? String.fromCharCode(header[156]) : '0';
    const prefix = text(header.subarray(345, 500));
    const rawName = text(header.subarray(0, 100));
    const name = longPath || (prefix ? `${prefix}/${rawName}` : rawName);
    const link = longLink || text(header.subarray(157, 257));
    const dataOffset = offset + 512;
    if (['L', 'K'].includes(type)) {
      if (size > 4096) throw new Error('GNU tar long name is too long.');
      if (type === 'L') { if (longPath) throw new Error('Duplicate GNU tar long name.'); longPath = text(data.subarray(dataOffset, dataOffset + size)); }
      else { if (longLink) throw new Error('Duplicate GNU tar long link.'); longLink = text(data.subarray(dataOffset, dataOffset + size)); }
    } else {
      if (!['0', '2', '5'].includes(type)) throw new Error(`Unsupported tar entry type: ${type}`);
      if (type !== '0' && size !== 0) throw new Error('Tar non-file has data.');
      entries.push({ path: safeRelativePath(type === '5' && name.endsWith('/') ? name.slice(0, -1) : name), type: type === '5' ? 'directory' : type === '2' ? 'symlink' : 'file', mode, size, dataOffset, ...(type === '2' ? { target: link } : {}) });
      longPath = undefined; longLink = undefined;
    }
    offset = dataOffset + Math.ceil(size / 512) * 512;
  }
  throw new Error('Tar end marker is missing.');
}

export async function extractUnixTarGz(filename, destination) {
  if (process.platform === 'win32') throw new Error('Unix archive extraction requires a Unix filesystem.');
  const data = gunzipSync(await readFile(filename), { maxOutputLength: 512 * 1024 * 1024 });
  const entries = readTarEntries(data);
  await mkdir(destination, { recursive: false });
  for (const item of entries) {
    const target = path.join(destination, item.path);
    await mkdir(path.dirname(target), { recursive: true });
    if (item.type === 'directory') await mkdir(target, { recursive: true });
    else if (item.type === 'file') await writeFile(target, data.subarray(item.dataOffset, item.dataOffset + item.size), { flag: 'wx' });
  }
  await finishLinksAndModes(destination, entries);
  return verifyExtractedMetadata(destination, entries);
}

export async function verifyMacFinalPackage(packageRoot, manifestFile) {
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  if (manifest.status !== 'PASS' || manifest.scope !== 'final-zip-extraction-and-byte-integrity-only' || manifest.target?.platform !== 'darwin'
    || !['x64', 'arm64'].includes(manifest.target.architecture) || !Array.isArray(manifest.inventory) || !/^[a-f0-9]{40}$/.test(manifest.sourceCommit || '')
    || !/^[a-f0-9]{64}$/.test(manifest.sha256 || '') || typeof manifest.package !== 'string' || path.basename(manifest.package) !== manifest.package || !manifest.package.endsWith('.zip')) throw new Error('External Mac manifest is invalid.');
  const archive = path.join(path.dirname(path.resolve(manifestFile)), manifest.package);
  if (await sha256File(archive) !== manifest.sha256 || (await stat(archive)).size !== manifest.bytes) throw new Error('Final Mac ZIP no longer matches the external manifest.');
  compareUnixInventories(manifest.inventory, await unixInventory(packageRoot), 'Verified final Mac package');
  const build = JSON.parse(await readFile(path.join(packageRoot, 'BUILD-INFO.json'), 'utf8'));
  if (build.sourceCommit !== manifest.sourceCommit || build.sourceDirty !== manifest.sourceDirty || build.sourceFilesSha256 !== manifest.sourceFilesSha256
    || build.target.platform !== 'darwin' || build.target.architecture !== manifest.target.architecture || build.appRelativePath !== 'JavaScript-edu.app/Contents/Resources/app') throw new Error('Mac source/target identity mismatch.');
  const source = JSON.parse(await readFile(path.join(packageRoot, 'integrity', 'source.json'), 'utf8'));
  if (source.sourceCommit !== manifest.sourceCommit || source.digest !== manifest.sourceFilesSha256) throw new Error('Mac source manifest identity mismatch.');
  for (const item of source.files.filter(item => item.type === 'file')) {
    const filename = path.join(packageRoot, build.appRelativePath, safeRelativePath(item.path));
    if ((await stat(filename)).size !== item.size || await sha256File(filename) !== item.sha256) throw new Error(`Mac packaged source bytes differ: ${item.path}`);
  }
  return manifest;
}
