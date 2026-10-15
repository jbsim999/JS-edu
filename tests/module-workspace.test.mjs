import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { createModuleWorkspace, workspaceLimits } from '../web/server/module-workspace.mjs';

async function fixture(t, options = {}) {
  const workspace = createModuleWorkspace({ bootstrap: '/* fixed trusted bootstrap */', ...options });
  const server = createServer(async (req, res) => {
    if (!await workspace.handle(req, res, `http://${req.headers.host}`)) { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { workspace.close(); return new Promise(resolve => server.close(resolve)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const config = await (await fetch(`${origin}/_execution/config`)).json();
  const headers = { Origin: origin, 'X-Execution-Token': config.token, 'Content-Type': 'application/json' };
  const manifest = { entry: 'main.mjs', files: { 'main.mjs': 'export let count = 0;', 'lib/read.mjs': "export { count } from '../main.mjs';" } };
  return { origin, config, headers, manifest,
    post: (body = manifest, extra = {}) => fetch(`${origin}/_execution/workspaces`, { method: 'POST', headers, body: JSON.stringify(body), ...extra }) };
}

test('module workspaces enforce parent authorization and JSON inputs', async t => {
  const f = await fixture(t);
  assert.equal(f.config.protocol, 'javascript-edu-modules-v1');
  assert.match(f.config.token, /^[A-Za-z0-9_-]{43}$/u);
  for (const headers of [{}, { ...f.headers, Origin: 'null' }, { ...f.headers, Origin: `${f.origin}0` }, { ...f.headers, 'X-Execution-Token': 'é'.repeat(43) }]) {
    assert.equal((await f.post(f.manifest, { headers })).status, 403);
  }
  assert.equal((await fetch(`${f.origin}/_execution/config`, { headers: { Origin: 'https://outside.example' } })).status, 403);
  assert.equal((await f.post(f.manifest, { headers: { ...f.headers, 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await f.post(f.manifest, { body: '{"entry":"main.mjs","files":{"main.mjs":"a","main.mjs":"b"}}' })).status, 400);
  assert.equal((await fetch(`${f.origin}/_execution/workspaces`, { method: 'OPTIONS' })).status, 405);
});

test('native module source has exact namespace CSP and a fixed namespace bridge', async t => {
  const f = await fixture(t);
  const created = await f.post();
  assert.equal(created.status, 201);
  assert.equal(created.headers.get('access-control-allow-origin'), null);
  const item = await created.json();
  assert.match(item.id, /^[a-f0-9]{48}$/u);
  const bootstrap = await fetch(f.origin + item.workerUrl);
  assert.equal(await bootstrap.text(), '/* fixed trusted bootstrap */');
  const policy = bootstrap.headers.get('content-security-policy');
  assert.ok(policy.includes(`${f.origin}/_execution/${item.id}/files/;`));
  assert.ok(!policy.includes("'self'") && !policy.includes(f.config.token));
  assert.match(policy, /connect-src 'none'; worker-src 'none'/u);
  const base = `${f.origin}/_execution/${item.id}/files/`;
  const bridge = await fetch(base + '__edu_bridge__.mjs');
  assert.equal(await bridge.text(), 'import * as submission from "./main.mjs";\nexport { submission };\n');
  const source = await fetch(base + 'lib/read.mjs');
  assert.equal(source.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(source.headers.get('cache-control'), 'no-store');
  assert.equal(await source.text(), f.manifest.files['lib/read.mjs']);
  assert.equal((await fetch(base + 'missing.mjs', { redirect: 'manual' })).status, 404);
  assert.equal((await fetch(base + 'main.mjs?different', { redirect: 'manual' })).status, 400);
  const deletion = () => fetch(`${f.origin}/_execution/workspaces/${item.id}`, { method: 'DELETE', headers: f.headers });
  assert.equal((await deletion()).status, 204);
  assert.equal((await deletion()).status, 204);
  assert.equal((await fetch(base + 'main.mjs')).status, 410);
});

test('invalid paths, reserved files, missing entry and source limits are rejected', async t => {
  const f = await fixture(t);
  for (const invalid of ['../main.mjs', '/main.mjs', 'lib//main.mjs', 'lib/./main.mjs', 'lib\\main.mjs', 'main.mjs?x', 'main%2emjs', '__edu_bridge__.mjs']) {
    assert.equal((await f.post({ entry: invalid, files: { [invalid]: 'export {};' } })).status, 400, invalid);
  }
  assert.equal((await f.post({ entry: 'missing.mjs', files: { 'main.mjs': '' } })).status, 400);
  assert.equal((await f.post({ ...f.manifest, token: 'not-allowed' })).status, 400);
  assert.equal((await f.post({ entry: 'main.mjs', files: { 'main.mjs': 'x'.repeat(workspaceLimits.fileBytes + 1) } })).status, 413);
  const many = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`file${i}.mjs`, '']));
  assert.equal((await f.post({ entry: 'file0.mjs', files: many })).status, 400);
  assert.equal((await f.post(f.manifest, { body: 'x'.repeat(workspaceLimits.bodyBytes + 1) })).status, 413);
});

test('workspace count is bounded and TTL is never extended by reads', async t => {
  let now = 1000;
  const f = await fixture(t, { now: () => now });
  const items = [];
  for (let i = 0; i < workspaceLimits.active; i++) items.push(await (await f.post()).json());
  assert.equal((await f.post()).status, 429);
  now += workspaceLimits.ttlMs - 1;
  assert.equal((await fetch(f.origin + items[0].workerUrl)).status, 200);
  now++;
  assert.equal((await fetch(f.origin + items[0].workerUrl)).status, 410);
  assert.equal((await f.post()).status, 201);
});

test('oversized chunked bodies release their pending slot without waiting for a deadline', async t => {
  const f = await fixture(t, { limits: { ...workspaceLimits, bodyBytes: 256, pending: 1 } });
  const status = await new Promise((resolve, reject) => {
    const req = request(`${f.origin}/_execution/workspaces`, { method: 'POST', headers: f.headers }, res => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.write('{"entry":');
    req.end('x'.repeat(300));
  });
  assert.equal(status, 413);
  assert.equal((await f.post()).status, 201);
});

test('unfinished request bodies release pending slots at a hard deadline and on abort', async t => {
  const f = await fixture(t, { limits: { ...workspaceLimits, bodyTimeoutMs: 100 } });
  const unfinished = [];
  for (let index = 0; index < 2; index++) {
    const req = request(`${f.origin}/_execution/workspaces`, { method: 'POST', headers: f.headers });
    req.on('error', () => {});
    req.on('response', res => res.resume());
    req.write('{');
    unfinished.push(req);
  }
  t.after(() => unfinished.forEach(req => req.destroy()));
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal((await f.post()).status, 429);
  await new Promise(resolve => setTimeout(resolve, 130));
  assert.equal((await f.post()).status, 201);
  const aborted = request(`${f.origin}/_execution/workspaces`, { method: 'POST', headers: f.headers });
  aborted.on('error', () => {});
  aborted.write('{');
  await new Promise(resolve => setTimeout(resolve, 10));
  aborted.destroy();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal((await f.post()).status, 201);
});
