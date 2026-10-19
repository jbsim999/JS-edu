import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import format from 'summary-workshop/format';

export function inspectPackageBoundary() {
  const require = createRequire(import.meta.url);
  let privateError = '';
  try { require('summary-workshop/private.cjs'); } catch (error) { privateError = error.code; }
  return {publicType: typeof format.formatSummary, privateError};
}

export async function runSummaryCli(argv, {
  cwd = process.cwd(), env = process.env,
  stdout = process.stdout, stderr = process.stderr
} = {}) {
  const usage = () => { stderr.write('사용법: --file <JSON 파일> [--label <이름>]\n'); return 2; };
  if (!Array.isArray(argv) || argv.length === 0 || argv.some(value => typeof value !== 'string')) return usage();
  const options = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!['--file', '--label'].includes(key) || options.has(key) ||
        value === undefined || value.trim() === '' || value.startsWith('--')) return usage();
    options.set(key, value);
  }
  if (!options.has('--file')) return usage();
  const label = options.get('--label') ?? env.SUMMARY_LABEL ?? format.defaultLabel;
  if (typeof label !== 'string' || label.trim() === '') return usage();
  try {
    const file = pathToFileURL(resolve(cwd, options.get('--file')));
    const values = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(values) || values.some(value => !Number.isSafeInteger(value))) throw new TypeError('invalid data');
    let total = 0;
    for (const value of values) {
      if (!Number.isSafeInteger(total + value)) throw new RangeError('unsafe total');
      total += value;
    }
    stdout.write(format.formatSummary({label: label.trim(), count: values.length, total}));
    return 0;
  } catch {
    stderr.write('입력 파일을 처리할 수 없습니다.\n');
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await runSummaryCli(process.argv.slice(2));
}
