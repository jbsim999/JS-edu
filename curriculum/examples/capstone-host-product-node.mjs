import http from 'node:http';
import { queryProducts, serializeReport } from './capstone-host-product-node/reader/core.mjs';
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
async function close(server) {
  if (!server?.listening) return;
  await new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();});
}
async function listen(server) {
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve();});});
}
async function request(server, route='/products') {
  return new Promise((resolve,reject)=>{
    const outgoing=http.get({host:'127.0.0.1',port:server.address().port,path:route,agent:false},incoming=>{
      let body='';incoming.setEncoding('utf8');incoming.on('data',chunk=>body+=chunk);
      incoming.on('end',()=>{try{resolve(JSON.parse(body));}catch(error){reject(error);}});incoming.on('error',reject);
    });outgoing.on('error',reject);
  });
}

// 정상 fixture의 합성 예제. 실습에서는 경로·바이트·오류·취소 계약을 더한다.
const rows=[{id:'b',name:'Pistachio',price:230},{id:'a',name:'Pistachio mini',price:100},{id:'z',name:'Lemon',price:120}];
const load=async query=>queryProducts((await fs.readFile(path.join(directory,'products.ndjson'),'utf8')).trim().split('\n').map(JSON.parse),{query,limit:1});
let server;
try {
  await fs.writeFile(path.join(directory,'products.ndjson'),rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
  const cliLine=serializeReport(await load('PISTA'));
  console.log(cliLine);
  server=http.createServer((req,res)=>{void load(new URL(req.url,'http://localhost').searchParams.get('query')??'').then(report=>{res.setHeader('content-type','application/json');res.end(serializeReport(report));},()=>{res.statusCode=500;res.end('{"error":"FILE"}');});});
  await listen(server);
  const fromHttp=await request(server,'/products?query=PISTA');
  console.log(JSON.stringify({same:JSON.stringify(fromHttp)===cliLine,count:fromHttp.count,shown:fromHttp.items.length}));
} finally {await close(server);await cleanup();}
console.log(JSON.stringify({listening:server.listening}));
