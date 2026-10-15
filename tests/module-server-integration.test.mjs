import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createLearningServer } from '../web/serve.mjs';

test('module API dispatch follows Host validation and exact Origin authorization', async t => {
  const server = createLearningServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const hostileHostStatus = await new Promise((resolve, reject) => {
    const req = request(`${origin}/_execution/config`, { headers: { Host: 'outside.example' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(hostileHostStatus, 403);
  const config = await (await fetch(`${origin}/_execution/config`)).json();
  const headers = { Origin: origin, 'Content-Type': 'application/json', 'X-Execution-Token': config.token };
  const source = { entry: 'main.mjs', files: { 'main.mjs': 'export let value = 1;' } };
  const post = () => fetch(`${origin}/_execution/workspaces`, { method: 'POST', headers, body: JSON.stringify(source) });
  assert.equal((await fetch(`${origin}/_execution/workspaces`, { method: 'POST', headers: { ...headers, Origin: 'http://localhost:1' }, body: JSON.stringify(source) })).status, 403);
  const created = await post();
  assert.equal(created.status, 201);
  const item = await created.json();
  const bootstrap = await fetch(origin + item.workerUrl);
  assert.match(await bootstrap.text(), /import\('\.\/files\/__edu_bridge__\.mjs'\)/u);
  assert.ok(bootstrap.headers.get('content-security-policy').includes(`${origin}/_execution/${item.id}/files/`));
  assert.equal((await fetch(`${origin}/execution/module-bootstrap.mjs`)).status, 404);
  assert.equal((await fetch(`${origin}/_execution/workspaces/${item.id}`, { method: 'DELETE', headers })).status, 204);
});
