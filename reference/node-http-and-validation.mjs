import http from 'node:http';
import { Buffer } from 'node:buffer';
import { TextDecoder } from 'node:util';

export function createProductServer({maxBodyBytes = 128} = {}) {
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > 1048576) throw new RangeError('invalid body limit');
  const products = [{id:'p1',name:'Lemon',price:120},{id:'p2',name:'Pistachio',price:230}];
  const validId = value => typeof value === 'string' && /^p[1-9]\d*$/.test(value);
  function send(res, status, value, headers = {}) {
    if (res.destroyed || res.writableEnded) return;
    const body = JSON.stringify(value);
    res.writeHead(status, {'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),...headers});
    res.end(body);
  }
  function readJson(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      let chunks = [];
      let settled = false;
      function fail(error) {
        if (settled) return;
        settled = true;
        chunks = [];
        reject(error);
      }
      req.on('error', fail);
      req.on('aborted', () => fail(Object.assign(new Error('aborted'), {status:0})));
      req.on('data', chunk => {
        if (settled) return;
        size += chunk.length;
        if (size > maxBodyBytes) {
          fail(Object.assign(new Error('too large'), {status:413}));
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (settled) return;
        settled = true;
        try {
          const text = new TextDecoder('utf-8', {fatal:true}).decode(Buffer.concat(chunks,size));
          resolve(JSON.parse(text));
        } catch {
          reject(Object.assign(new Error('invalid JSON'), {status:400}));
        } finally { chunks = []; }
      });
    });
  }
  async function handle(req, res) {
    let url;
    try {
      if (!req.url.startsWith('/') || req.url.startsWith('//')) throw new TypeError('origin form required');
      decodeURIComponent(req.url);
      url = new URL(req.url, 'http://localhost');
    } catch { send(res,400,{error:'bad-request'}); req.resume(); return; }
    if (url.pathname !== '/products' && url.pathname !== '/lookup') {
      send(res,404,{error:'not-found'}); req.resume(); return;
    }
    const allowed = url.pathname === '/products' ? 'GET' : 'POST';
    if (req.method !== allowed) {
      send(res,405,{error:'method-not-allowed'},{allow:allowed}); req.resume(); return;
    }
    if (allowed === 'GET') {
      const keys = [...url.searchParams.keys()];
      if (keys.some(key => key !== 'id') || url.searchParams.getAll('id').length > 1) {
        send(res,400,{error:'bad-request'}); req.resume(); return;
      }
      if (!url.searchParams.has('id')) send(res,200,{products});
      else {
        const id = url.searchParams.get('id');
        if (!validId(id)) send(res,400,{error:'bad-request'});
        else {
          const product = products.find(item => item.id === id);
          send(res,product ? 200 : 404, product ? {product} : {error:'not-found'});
        }
      }
      req.resume();
      return;
    }
    if (url.search !== '') { send(res,400,{error:'bad-request'}); req.resume(); return; }
    if ((req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') {
      send(res,415,{error:'unsupported-media-type'}); req.resume(); return;
    }
    try {
      const body = await readJson(req);
      if (body === null || typeof body !== 'object' || Array.isArray(body) || !validId(body.id)) {
        send(res,400,{error:'bad-request'}); return;
      }
      const product = products.find(item => item.id === body.id);
      send(res,product ? 200 : 404, product ? {product} : {error:'not-found'});
    } catch (error) {
      if (error.status === 0 || req.aborted || res.destroyed) return;
      send(res,error.status === 413 ? 413 : 400,{error:error.status === 413 ? 'body-too-large' : 'bad-request'});
      req.resume();
    }
  }
  const server = http.createServer((req,res) => {
    handle(req,res).catch(() => {
      if (!res.headersSent) send(res,500,{error:'internal-error'});
      else res.destroy();
    });
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  return server;
}
