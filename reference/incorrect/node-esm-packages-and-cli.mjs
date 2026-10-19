import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import format from 'summary-workshop/format';

export function inspectPackageBoundary() {
  return {publicType: typeof format.formatSummary, privateError: ''};
}

export async function runSummaryCli(argv, {cwd = process.cwd(), env = process.env, stdout = process.stdout, stderr = process.stderr} = {}) {
  try {
    const values = JSON.parse(await readFile(resolve(cwd, argv[1]), 'utf8'));
    stdout.write(format.formatSummary({label: 'summary', count: values.length, total: values.reduce((sum, value) => sum + Number(value), 0)}));
    return 0;
  } catch {
    stdout.write('입력 파일을 처리할 수 없습니다.\n');
    return 0;
  }
}
