import http from 'node:http';
import { queryProducts, serializeReport } from './capstone-acceptance-review-node/reader/core.mjs';
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

const identity={contentRevision:'draft-1',sourceRevision:'example-a',environmentFingerprint:'node-'+process.version,graderRevision:'example-checks-v1'};
const load=async()=>queryProducts(JSON.parse(await fs.readFile(path.join(directory,'products.json'),'utf8')));
let server;
try {
  await fs.writeFile(path.join(directory,'products.json'),JSON.stringify([{id:'a',name:'Pistachio',price:230}]));
  const tests=[{id:'file',check:async()=>{const report=await load();return report.total===230&&report.count===1;}},
    {id:'http',check:async()=>{server=http.createServer((req,res)=>{void load().then(value=>res.end(serializeReport(value)),()=>{res.statusCode=500;res.end('{}');});});await listen(server);try{return (await request(server)).total===230;}finally{await close(server);}}}];
  const checks=[];
  for(const test of tests){let passed=false;try{passed=(await test.check())===true;}catch{}checks.push({id:test.id,passed});}
  console.log(JSON.stringify({status:checks.length>0&&checks.every(check=>check.passed)?'PASS':'FAIL',checks:checks.map(check=>check.id),sourceRevision:identity.sourceRevision,runtime:process.version}));
  const invalidated={status:'STALE',identity:{...identity,sourceRevision:'example-b'},checks:[]};
  console.log(JSON.stringify({status:invalidated.status,checks:invalidated.checks.length,sourceRevision:invalidated.identity.sourceRevision}));
} finally {await close(server);await cleanup();}
