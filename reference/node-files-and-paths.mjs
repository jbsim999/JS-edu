import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export async function createTextStore(root, {
  writeContent = (handle, text) => handle.writeFile(text, 'utf8')
} = {}) {
  if (root instanceof URL) {
    if (root.protocol !== 'file:') throw new TypeError('file URL required');
    root = fileURLToPath(root);
  }
  if (typeof root !== 'string' || root === '' || typeof writeContent !== 'function') throw new TypeError('invalid store configuration');
  const base = await fs.realpath(root);
  if (!(await fs.stat(base)).isDirectory()) throw new TypeError('directory root required');
  async function resolveName(name, allowMissing) {
    if (typeof name !== 'string' || name.trim() === '' || name.includes('\0') ||
        name.includes(':') || path.isAbsolute(name) || name.split(/[\\/]/).includes('..')) throw new TypeError('relative name required');
    const target = path.resolve(base, name);
    const relative = path.relative(base, target);
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new TypeError('outside root');
    const parts = relative.split(path.sep);
    let current = base;
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i]);
      try {
        const info = await fs.lstat(current);
        if (info.isSymbolicLink()) throw new TypeError('symbolic link not supported');
        if (i < parts.length - 1 && !info.isDirectory()) throw new TypeError('parent must be a directory');
        if (i === parts.length - 1 && !info.isFile()) throw new TypeError('target must be a file');
      } catch (error) {
        if (allowMissing && i === parts.length - 1 && error.code === 'ENOENT') break;
        throw error;
      }
    }
    return target;
  }
  return Object.freeze({
    async readText(name) {
      return fs.readFile(await resolveName(name, false), 'utf8');
    },
    async writeText(name, text) {
      if (typeof text !== 'string') throw new TypeError('text must be a string');
      const target = await resolveName(name, true);
      const temporary = path.join(path.dirname(target), '.' + path.basename(target) + '.' + randomUUID() + '.tmp');
      let handle;
      try {
        handle = await fs.open(temporary, 'wx');
        await writeContent(handle, text);
        await handle.close();
        handle = undefined;
        await fs.rename(temporary, target);
        return {bytes: Buffer.byteLength(text, 'utf8')};
      } finally {
        if (handle) await handle.close();
        await fs.rm(temporary, {force: true});
      }
    }
  });
}
