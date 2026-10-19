import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createLearningServer } from '../web/serve.mjs';

test('learning server exposes only public resources with separate document and Worker CSP', async t => {
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
  assert.equal(JSON.parse(profile.body).profiles[0].execution.provider, 'browser-worker');
  assert.match(profile.headers['content-security-policy'], /connect-src 'self'/);
  assert.equal(profile.headers['cache-control'], 'no-store');
  assert.match(profile.headers['content-security-policy'], /script-src 'self';/);
  assert.doesNotMatch(profile.headers['content-security-policy'], /unsafe-eval/);
  const worker = await get('/execution/worker.js');
  assert.equal(worker.status, 200);
  assert.match(worker.headers['content-type'], /^text\/javascript/);
  assert.match(worker.headers['content-security-policy'], /script-src 'unsafe-eval'; connect-src 'none'; worker-src 'none'/);
  const checks = await get('/curriculum/checks/independent-counter.json');
  assert.equal(checks.status, 200);
  assert.match(checks.headers['content-type'], /^application\/json/);
  assert.equal(JSON.parse(checks.body).cases.length, 7);
  for (const path of ['/', '/index.html', '/styles.css', '/app.mjs', '/glossary-data.mjs', '/glossary-expanded.mjs', '/features/workspace-state.mjs', '/adapters/storage.mjs', '/adapters/runner.mjs', '/execution/dom-runner.mjs', '/curriculum/catalog.json', '/curriculum/lessons/bindings-and-closures.json', '/starter/create-counter.mjs', '/curriculum/examples/bindings-and-closures.mjs']) {
    const resource = await get(path);
    assert.equal(resource.status, 200, path);
    assert.ok(resource.body.length > 0, path);
    assert.equal(resource.headers['x-content-type-options'], 'nosniff', path);
  }
  assert.equal((await get('/education.config.json?refresh=1')).status, 200);
  const head = await get('/curriculum/exercises.json', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  for (const path of ['/.git/config', '/README.md', '/reference/README.md', '/reference/independent-counter.mjs', '/_qualification/reference/independent-counter', '/_qualification/incorrect/independent-counter', '/execution/qualification.html', '/execution/qualification.mjs', '/grader/README.md', '/web/serve.mjs', '/../education.config.json', '/%2e%2e/education.config.json', '//education.config.json']) {
    assert.ok([400, 404].includes((await get(path)).status), path);
  }
  assert.equal((await get('/education.config.json', { method: 'POST' })).status, 405);
  assert.equal((await get('/education.config.json', { headers: { Host: `attacker.example:${port}` } })).status, 403);
});

test('qualification answers require an explicit local developer server option', async t => {
  const server = createLearningServer({ qualification: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  for (const pathname of ['/execution/qualification.html', '/execution/qualification.mjs', '/_qualification/reference/independent-counter', '/_qualification/incorrect/independent-counter']) {
    const result = await fetch(`http://127.0.0.1:${port}${pathname}`);
    assert.equal(result.status, 200, pathname);
    assert.ok((await result.text()).length > 0);
  }
});
