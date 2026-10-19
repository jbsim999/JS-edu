import { queryProducts, serializeReport } from './reader/core.mjs';

export async function queryProductFile(workspaceRoot, fileName, options = {}) {
  // TODO: 제한된 실제 NDJSON을 읽고 고정 core를 호출하세요.
}

export async function runProductCli(argv, { workspaceRoot, stdout, stderr, signal } = {}) {
  // TODO: 한 줄 JSON과 종료 값을 반환하고 process.exit()를 호출하지 마세요.
}

export function createProductServer({ workspaceRoot } = {}) {
  // TODO: 같은 조회를 사용하는, 아직 listen하지 않은 node:http 서버를 반환하세요.
}
