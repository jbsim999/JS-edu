import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const products = Object.freeze([{ id: 'p1', name: 'Lemon', price: 120 }, { id: 'p2', name: 'Pistachio', price: 230 }]);
const sumWorker = `'use strict';
self.addEventListener('message', event => {
  const input = event.data;
  if (!input || !Number.isSafeInteger(input.requestId) || input.requestId < 1 || !Array.isArray(input.values) || input.values.length > 100000) return;
  for (let index = 0; index < input.values.length; index++) {
    if (!Object.hasOwn(input.values, index) || !Number.isSafeInteger(input.values[index]) || Math.abs(input.values[index]) > 1000000) return;
  }
  self.postMessage({ requestId: input.requestId, sum: input.values.reduce((total, value) => total + value, 0) });
});
`;

function parseParentOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new TypeError('정확한 부모 화면 loopback origin이 필요합니다.'); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.origin !== value || url.username || url.password) throw new TypeError('부모 화면은 포트가 명시된 http://127.0.0.1 origin이어야 합니다.');
  return url.origin;
}

// This server never evaluates learner code or serves repository paths. Callers
// must listen on 127.0.0.1 with port 0, then expose the resolved origin to the UI.
export function createBrowserHostServer({ parentOrigin } = {}) {
  const parent = parseParentOrigin(parentOrigin);
  const frameTemplate = readFileSync(new URL('../execution/dom-frame.html', import.meta.url), 'utf8');
  const frameScript = readFileSync(new URL('../execution/dom-frame.js', import.meta.url), 'utf8');
  const server = createServer((request, response) => {
    const address = server.address();
    const host = typeof address === 'object' && address ? `127.0.0.1:${address.port}` : '';
    const origin = `http://${host}`;
    const securityHeaders = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), document-domain=()',
      'Origin-Agent-Cluster': '?1',
      'Content-Security-Policy': `default-src 'none'; script-src 'unsafe-eval' ${origin}/execution/dom-frame.js; script-src-attr 'none'; style-src 'unsafe-inline'; img-src data:; connect-src ${origin}/_fixtures/http/; worker-src ${origin}/_fixtures/workers/; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${parent}`,
    };
    const send = (status, content, type = 'application/json; charset=utf-8', headers = {}) => {
      if (response.destroyed || response.writableEnded) return;
      const body = typeof content === 'string' ? content : JSON.stringify(content);
      response.writeHead(status, { ...securityHeaders, 'Content-Type': type, 'Content-Length': Buffer.byteLength(body), ...headers });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    // A second port is an origin boundary, not an OS sandbox or RAM quota.
    if (!host || address.address !== '127.0.0.1' || !['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress) || request.headers.host !== host || origin === parent) { send(403, { error: 'Host is not allowed.' }); return; }
    const requestOrigin = request.headers.origin;
    if (requestOrigin !== undefined && requestOrigin !== parent && requestOrigin !== origin) { send(403, { error: 'Origin is not allowed.' }); return; }
    if (!['GET', 'HEAD'].includes(request.method)) { send(405, { error: 'Method is not allowed.' }, undefined, { Allow: 'GET, HEAD' }); return; }
    const pathname = request.url;
    if (typeof pathname !== 'string' || !/^\/[A-Za-z0-9_./-]+$/.test(pathname) || pathname.includes('..') || pathname.includes('//')) { send(404, { error: 'Not found.' }); return; }
    if (pathname === '/execution/dom-frame.html') {
      send(200, frameTemplate.replace('__JAVASCRIPT_EDU_PARENT_ORIGIN__', parent), 'text/html; charset=utf-8');
      return;
    }
    if (pathname === '/execution/dom-frame.js') { send(200, frameScript, 'text/javascript; charset=utf-8'); return; }
    if (pathname === '/_fixtures/workers/sum.js') {
      if (request.method !== 'GET') { send(405, { error: 'Fixture requests must use GET.' }, undefined, { Allow: 'GET' }); return; }
      send(200, sumWorker, 'text/javascript; charset=utf-8', { 'Content-Security-Policy': "default-src 'none'; script-src 'none'; connect-src 'none'; worker-src 'none'" });
      return;
    }
    if (pathname.startsWith('/_fixtures/http/')) {
      if (request.method !== 'GET') { send(405, { error: 'Fixture requests must use GET.' }, undefined, { Allow: 'GET' }); return; }
      switch (pathname) {
        case '/_fixtures/http/products': send(200, products); return;
        case '/_fixtures/http/empty': send(200, []); return;
        case '/_fixtures/http/not-found': send(404, { error: 'Product not found.' }); return;
        case '/_fixtures/http/invalid-json': send(200, '{"products":'); return;
        case '/_fixtures/http/invalid-schema': send(200, [{ id: 'p1', name: 'Lemon', price: '120' }]); return;
        case '/_fixtures/http/duplicate-id': send(200, [{ id: 'p1', name: 'Lemon', price: 120 }, { id: 'p1', name: 'Duplicate', price: 230 }]); return;
        case '/_fixtures/http/unavailable': send(503, { error: 'Service unavailable.' }); return;
        case '/_fixtures/http/network-error': request.socket.destroy(); return;
        case '/_fixtures/http/slow': {
          const timer = setTimeout(() => send(200, products), 250);
          response.once('close', () => clearTimeout(timer));
          return;
        }
        default: break;
      }
    }
    send(404, { error: 'Not found.' });
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1000;
  server.maxRequestsPerSocket = 100;
  return server;
}
