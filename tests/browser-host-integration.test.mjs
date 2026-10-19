import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createLearningServer } from '../web/serve.mjs';
import { validateBrowserHostConfig } from '../web/execution/dom-runner.mjs';

function get(origin, pathname, { method = 'GET', headers = {} } = {}) {
  const url = new URL(origin);
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: url.port, path: pathname, method, headers, agent: false }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('HTTP integration request timed out')));
    req.end();
  });
}

async function start(t) {
  const server = createLearningServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const close = () => new Promise(resolve => server.close(resolve));
  t.after(close);
  return { server, origin, close };
}

test('main server resolves one separate DOM host and allows only its exact frame origin', async t => {
  const { origin } = await start(t);
  const configuration = await get(origin, '/_browser/config', { headers: { Origin: origin } });
  assert.equal(configuration.status, 200);
  assert.match(configuration.headers['content-type'], /^application\/json/);
  assert.equal(configuration.headers['cache-control'], 'no-store');
  assert.equal(configuration.headers['access-control-allow-origin'], undefined);
  const config = validateBrowserHostConfig(JSON.parse(configuration.body), origin);
  assert.notEqual(config.origin, origin);
  const document = await get(origin, '/');
  const policy = document.headers['content-security-policy'];
  assert.equal(policy.split(';').map(item => item.trim()).find(item => item.startsWith('frame-src ')), `frame-src ${config.origin}`);
  assert.ok(policy.includes("script-src 'self'"));
  assert.ok(policy.includes("connect-src 'self'"));
  assert.ok(!policy.includes('unsafe-eval'));
  const frame = await get(config.origin, '/execution/dom-frame.html', { headers: { Origin: origin } });
  assert.equal(frame.status, 200);
  assert.ok(frame.body.includes(`data-parent-origin="${origin}"`));
  assert.ok(frame.headers['content-security-policy'].includes(`frame-ancestors ${origin}`));
  assert.ok(frame.headers['content-security-policy'].includes(`connect-src ${config.origin}/_fixtures/http/`));
  assert.ok(!frame.body.includes('__JAVASCRIPT_EDU_PARENT_ORIGIN__'));
  assert.equal((await get(origin, '/execution/dom-runner.mjs')).status, 200);
  assert.equal((await get(origin, '/execution/dom-frame.html')).status, 404);
  assert.equal((await get(origin, '/execution/dom-frame.js')).status, 404);
  assert.equal((await get(config.origin, '/app.mjs')).status, 404);
  assert.equal((await get(config.origin, '/curriculum/exercises.json')).status, 404);
  assert.equal((await get(config.origin, '/_fixtures/http/products')).status, 200);
});

test('DOM configuration refuses other Origins and Hosts and gives a canonical address for localhost', async t => {
  const { origin } = await start(t);
  const port = new URL(origin).port;
  for (const invalidOrigin of ['null', 'https://example.com', `http://localhost:${port}`, 'http://127.0.0.1:1']) {
    assert.equal((await get(origin, '/_browser/config', { headers: { Origin: invalidOrigin } })).status, 403);
  }
  assert.equal((await get(origin, '/_browser/config', { headers: { Host: `attacker.example:${port}` } })).status, 403);
  const alias = await get(origin, '/_browser/config', { headers: { Host: `localhost:${port}` } });
  assert.equal(alias.status, 409);
  assert.equal(JSON.parse(alias.body).parentOrigin, origin);
  assert.ok(!Object.hasOwn(JSON.parse(alias.body), 'frameUrl'));
  assert.equal((await get(origin, '/_browser/config', { method: 'POST' })).status, 405);
  assert.equal((await get(origin, '/_browser/config', { method: 'HEAD' })).body, '');
});

test('independent main servers get separate parent-bound hosts and close callbacks finish host cleanup', async t => {
  const first = await start(t);
  const second = await start(t);
  const firstConfig = JSON.parse((await get(first.origin, '/_browser/config')).body);
  const secondConfig = JSON.parse((await get(second.origin, '/_browser/config')).body);
  assert.notEqual(firstConfig.origin, secondConfig.origin);
  assert.equal((await get(firstConfig.origin, '/execution/dom-frame.html', { headers: { Origin: second.origin } })).status, 403);
  assert.equal((await get(secondConfig.origin, '/execution/dom-frame.html', { headers: { Origin: first.origin } })).status, 403);
  await first.close();
  await assert.rejects(get(firstConfig.origin, '/execution/dom-frame.html'), error => ['ECONNREFUSED', 'ECONNRESET'].includes(error.code));
  assert.equal((await get(secondConfig.origin, '/execution/dom-frame.html')).status, 200);
  await second.close();
  await assert.rejects(get(secondConfig.origin, '/execution/dom-frame.html'), error => ['ECONNREFUSED', 'ECONNRESET'].includes(error.code));
});

test('closing immediately after main listen also completes without a dangling DOM host', async t => {
  const { close } = await start(t);
  await close();
});
