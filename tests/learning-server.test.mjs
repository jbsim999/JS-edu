import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createLearningServer } from '../web/serve.mjs';

test('learning server exposes only public resources and preserves unavailable execution', async t => {
  const server = createLearningServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const get = (path, options = {}) => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, ...options }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
  const profile = await get('/runtime/profiles.json');
  assert.equal(profile.status, 200);
  assert.equal(JSON.parse(profile.body).profiles[0].execution.available, false);
  assert.match(profile.headers['content-security-policy'], /connect-src 'self'/);
  assert.equal(profile.headers['cache-control'], 'no-store');
  for (const path of ['/', '/index.html', '/styles.css', '/app.mjs', '/glossary-data.mjs', '/features/workspace-state.mjs', '/adapters/storage.mjs', '/adapters/runner.mjs', '/curriculum/catalog.json', '/curriculum/lessons/bindings-and-closures.json', '/starter/create-counter.mjs', '/curriculum/examples/bindings-and-closures.mjs']) {
    const resource = await get(path);
    assert.equal(resource.status, 200, path);
    assert.ok(resource.body.length > 0, path);
    assert.equal(resource.headers['x-content-type-options'], 'nosniff', path);
  }
  assert.equal((await get('/education.config.json?refresh=1')).status, 200);
  const head = await get('/curriculum/exercises.json', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  for (const path of ['/.git/config', '/README.md', '/reference/README.md', '/grader/README.md', '/web/serve.mjs', '/../education.config.json', '/%2e%2e/education.config.json', '//education.config.json']) {
    assert.ok([400, 404].includes((await get(path)).status), path);
  }
  assert.equal((await get('/education.config.json', { method: 'POST' })).status, 405);
  assert.equal((await get('/education.config.json', { headers: { Host: `attacker.example:${port}` } })).status, 403);
});
