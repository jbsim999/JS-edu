import { queryProducts } from './capstone-failure-and-scale-node/reader/core.mjs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
const context = globalThis.__javascriptEduExampleContext;
if (!context?.workspaceRoot) throw new Error('ENVIRONMENT_UNSUPPORTED: Node example data workspace is required');
const base = await fs.realpath(context.workspaceRoot);
const directory = await fs.mkdtemp(path.join(base, 'capstone-example-'));
async function cleanup() {
  const relative = path.relative(base, directory);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Fixture escaped data root');
  await fs.rm(directory, {recursive:true,force:true});
}

// 정상 파일 두 개로 측정 경로만 설명한다. tick은 실측 성능이 아닌 주입 시계다.
let tick=0,active=0,peakActive=0,next=0;
const tasks=[{id:'products',file:'products.ndjson'},{id:'empty',file:'empty.ndjson'}];
const results=new Array(tasks.length);
try {
  await fs.writeFile(path.join(directory,'products.ndjson'),'{"id":"a","name":"Lemon","price":120}\n{"id":"b","name":"Pistachio","price":230}\n');
  await fs.writeFile(path.join(directory,'empty.ndjson'),'');
  const startedAt=tick;
  async function worker(){while(next<tasks.length){const index=next++;const task=tasks[index];active++;peakActive=Math.max(peakActive,active);try{const text=await fs.readFile(path.join(directory,task.file),'utf8');const rows=text.trim()?text.trim().split('\n').map(JSON.parse):[];results[index]={id:task.id,report:queryProducts(rows,{limit:1})};tick+=5;}finally{active--;}}}
  await Promise.all([worker(),worker()]);
  console.log(JSON.stringify({status:'done',ids:results.map(row=>row.id),returnedItems:results.reduce((sum,row)=>sum+row.report.items.length,0),elapsedMs:tick-startedAt,peakActive}));
} finally {await cleanup();}
