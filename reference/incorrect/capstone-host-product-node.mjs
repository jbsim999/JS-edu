import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { queryProducts } from './reader/core.mjs';

// 대표 오답: 파싱 실패를 빈 성공으로 삼고, 출력 limit를 집계 전에 적용한다.
export async function queryProductFile(root, file, {query = '', limit = 100} = {}) {
  try { return queryProducts((await readFile(path.join(root,file),'utf8')).trim().split('\n').map(JSON.parse).slice(0,limit),{query}); }
  catch { return queryProducts([]); }
}
export async function runProductCli(argv,{workspaceRoot,stdout}={}) {
  stdout(JSON.stringify(await queryProductFile(workspaceRoot,argv[0]))+'\n'); return 0;
}
export function createProductServer({workspaceRoot}={}) {
  return createServer(async (request,response)=>response.end(JSON.stringify(await queryProductFile(workspaceRoot,'products.ndjson'))));
}
