import http from 'node:http';

export function createProductServer({maxBodyBytes=128}={}) {
  const products=[{id:'p1',name:'Lemon',price:120},{id:'p2',name:'Pistachio',price:230}];
  return http.createServer((req,res)=>{
    res.setHeader('content-type','application/json; charset=utf-8');
    const url=new URL(req.url,'http://localhost');
    if(req.method==='POST'){
      let body='';req.on('error',()=>{});req.on('data',chunk=>body+=chunk.toString());
      req.on('end',()=>{try{const id=JSON.parse(body).id;res.end(JSON.stringify({product:products.find(p=>p.id===id)??null}));}catch{res.end(JSON.stringify({error:'bad-request'}));}});
    }else res.end(JSON.stringify(url.searchParams.has('id')?{product:products.find(p=>p.id===url.searchParams.get('id'))??null}:{products}));
  });
}
