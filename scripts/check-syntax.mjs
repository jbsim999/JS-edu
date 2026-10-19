import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
let checked = 0;
let failed = false;
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'work', 'artifacts', 'build', 'dist', 'coverage'].includes(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(filename);
    else if (entry.isFile() && ['.mjs', '.js', '.cjs'].includes(path.extname(entry.name))) {
      const result = spawnSync(process.execPath, ['--check', filename], { encoding: 'utf8' });
      checked++;
      if (result.status !== 0) {
        failed = true;
        console.error(path.relative(root, filename), result.error?.message ?? result.stderr);
      }
    }
  }
}
await visit(root);
if (checked === 0) failed = true;
console.log(JSON.stringify({ status: failed ? 'FAIL' : 'PASS', scope: 'syntax-only', checked }));
process.exitCode = failed ? 1 : 0;
