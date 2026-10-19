import http from 'node:http';
import { once } from 'node:events';

const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  res.writeHead(200,{'content-type':'application/json; charset=utf-8'});
  res.end(JSON.stringify({id:url.searchParams.get('id')}));
});
server.listen(0,'127.0.0.1');
await once(server,'listening');
try {
  const result=await new Promise((resolve,reject)=>{
    const req=http.get({host:'127.0.0.1',port:server.address().port,path:'/products?id=p1',agent:false},res=>{
      let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);
      res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(body)}));res.on('error',reject);
    });
    req.on('error',reject);
  });
  // 예상 출력: {"status":200,"body":{"id":"p1"}}
  console.log(JSON.stringify(result));
} finally {
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}
// 예상 출력: {"listening":false}
console.log(JSON.stringify({listening:server.listening}));
