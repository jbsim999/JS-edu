import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import format from 'summary-workshop/format';

export function inspectPackageBoundary() {
  // TODO: import.meta.url을 기준으로 공개 formatter와 비공개 경로의 실제 resolve 결과를 관찰하세요.
}

export async function runSummaryCli(argv, {
  cwd = process.cwd(), env = process.env,
  stdout = process.stdout, stderr = process.stderr
} = {}) {
  // TODO: 인수 검증 → cwd 기준 파일 읽기 → 안전한 정수 집계 → 출력과 종료 코드 분리.
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await runSummaryCli(process.argv.slice(2));
}
