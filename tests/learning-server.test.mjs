import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { readFile } from 'node:fs/promises';
import filesystem from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createLearningServer } from '../web/serve.mjs';
import { createNodeRunner, fingerprintSource, serializeNodeSource } from '../web/execution/node-runner.mjs';
import { createExecutionState } from '../web/features/execution-state.mjs';

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
  for (const path of ['/', '/index.html', '/styles.css', '/app.mjs', '/glossary-data.mjs', '/glossary-expanded.mjs', '/features/workspace-state.mjs', '/adapters/storage.mjs', '/adapters/runner.mjs', '/execution/dom-runner.mjs', '/execution/node-runner.mjs', '/runtime/node-contract.mjs', '/curriculum/catalog.json', '/curriculum/lessons/bindings-and-closures.json', '/starter/create-counter.mjs', '/curriculum/examples/bindings-and-closures.mjs']) {
    const resource = await get(path);
    assert.equal(resource.status, 200, path);
    assert.ok(resource.body.length > 0, path);
    assert.equal(resource.headers['x-content-type-options'], 'nosniff', path);
  }
  assert.equal((await get('/education.config.json?refresh=1')).status, 200);
  const head = await get('/curriculum/exercises.json', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  for (const path of ['/.git/config', '/README.md', '/reference/README.md', '/reference/independent-counter.mjs', '/reference/node-esm-packages-and-cli.mjs', '/_qualification/reference/independent-counter', '/_qualification/incorrect/independent-counter', '/execution/qualification.html', '/execution/qualification.mjs', '/grader/README.md', '/web/serve.mjs', '/web/server/node-execution.mjs', '/runtime/node-supervisor.mjs', '/runtime/node-worker.mjs', '/curriculum/checks/node-esm-packages-and-cli.json', '/curriculum/checks/capstone-host-product-node.json', '/../education.config.json', '/%2e%2e/education.config.json', '//education.config.json']) {
    assert.ok([400, 404].includes((await get(path)).status), path);
  }
  assert.equal((await get('/education.config.json', { method: 'POST' })).status, 405);
  assert.equal((await get('/education.config.json', { headers: { Host: `attacker.example:${port}` } })).status, 403);
});

test('the main server reports an unavailable Node executable and rejects other origins', async t => {
  const server = createLearningServer({ nodeExecutable: './missing-node-for-server-test.exe' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${origin}/_node/config`);
  assert.equal(response.status, 200);
  const config = await response.json();
  assert.equal(config.available, false);
  assert.equal(config.expectedVersion, '24.22.0');
  assert.match(config.actualRuntime, /unavailable/);
  assert.ok(config.reason);
  assert.equal((await fetch(`${origin}/_node/config`, { headers: { Origin: 'https://attacker.example' } })).status, 403);
  const otherHostStatus = await new Promise((resolve, reject) => {
    const req = request(`${origin}/_node/config`, { headers: { Host: `localhost:${server.address().port}` } }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    });
    req.on('error', reject); req.end();
  });
  assert.equal(otherHostStatus, 403);
  assert.equal((await fetch(`${origin}/_node/jobs`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
});

test('the main server connects native Node prepare/run/submit and closes its HTTP fixture host', async t => {
  const executable = path.resolve(process.env.JS_EDU_NODE_EXECUTABLE || process.execPath);
  let version;
  try { version = execFileSync(executable, ['--version'], { encoding: 'utf8', windowsHide: true }).trim(); } catch { /* Report an explicit platform prerequisite. */ }
  if (version !== 'v24.22.0') { t.skip('Set JS_EDU_NODE_EXECUTABLE to Node.js 24.22.0 for native integration.'); return; }
  const server = createLearningServer({ nodeExecutable: executable });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const close = () => new Promise(resolve => server.close(resolve));
  t.after(close);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browserHost = await (await fetch(`${origin}/_browser/config`)).json();
  let consent = false;
  const definitions = await Promise.all(['node-esm-packages-and-cli', 'node-outbound-requests-and-cancellation', 'capstone-host-product-node']
    .map(id => readFile(new URL(`../curriculum/exercises/${id}.json`, import.meta.url), 'utf8').then(JSON.parse)));
  const runner = createNodeRunner({ exercises: definitions, origin, getConsent: () => consent,
    fetcher: (url, options = {}) => fetch(url, { ...options, headers: { ...options.headers, Origin: origin } }) });
  const state = createExecutionState({ runner, fingerprintSource });
  const sourceFor = (exercise, code) => serializeNodeSource({ entry: exercise.workspace.entry,
    files: Object.fromEntries(exercise.workspace.files.map(file => [file.path, file.path === exercise.workspace.entry ? code : file.source])) });
  const contextFor = exercise => ({ lessonId: exercise.lessonId, exerciseId: exercise.id, contentRevision: exercise.contentRevision, targetVersion: 'ES2026' });
  const first = definitions[0];
  const unimportable = sourceFor(first, 'throw new Error("prepare must not import learner code");');
  assert.equal((await state.start('prepare', contextFor(first), unimportable)).status, 'ready');
  assert.equal((await state.start('run', contextFor(first), unimportable)).consentRequired, true);
  consent = true;
  for (const exercise of definitions) {
    const code = await readFile(new URL(`../${exercise.referenceFile}`, import.meta.url), 'utf8');
    const source = sourceFor(exercise, code);
    const result = await state.start('run', contextFor(exercise), source);
    assert.equal(result?.status, 'success', `${exercise.id}: ${result?.stderr}`);
    assert.match(result.actualRuntime, /^Node\.js 24\.22\.0/);
    const submitted = await state.start('submit', contextFor(exercise), source);
    assert.equal(submitted?.status, 'success', `${exercise.id}: ${submitted?.stderr}`);
    assert.ok(submitted.checks.length > 0 && submitted.checks.every(check => check.passed));
  }
  const starter = sourceFor(first, first.workspace.files.find(file => file.path === first.workspace.entry).source);
  const unfinished = await state.start('submit', contextFor(first), starter);
  assert.notEqual(unfinished?.status, 'success');
  const pendingSource = sourceFor(first, 'export async function runSummaryCli() { await new Promise(() => {}); }');
  const requestBodyRead = new Promise(resolve => server.once('request', req => req.once('end', resolve)));
  const pending = runner.run({ ...contextFor(first), requestId: 'server-shutdown-running-job', source: pendingSource,
    sourceFingerprint: await fingerprintSource(pendingSource) });
  await requestBodyRead;
  await new Promise(resolve => setImmediate(resolve));
  await close();
  assert.equal((await pending).status, 'cancelled');
  await assert.rejects(fetch(`${browserHost.origin}/_fixtures/http/products`));
  await assert.rejects(fetch(`${origin}/_node/config`));
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

test('server close reports Node cleanup failure after still closing its browser and module resources', async t => {
  const server = createLearningServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browserHost = await (await fetch(`${origin}/_browser/config`)).json();
  await fetch(`${origin}/_node/config`);
  const nativeRemove = filesystem.rm;
  const error = Object.assign(new Error('Injected Node base cleanup failure'), { code: 'EACCES' });
  const failedDirectories = [];
  const nativeClearInterval = globalThis.clearInterval;
  let clearedIntervals = 0;
  const interval = t.mock.method(globalThis, 'clearInterval', timer => { clearedIntervals++; return nativeClearInterval(timer); });
  const removal = t.mock.method(filesystem, 'rm', (target, options) => {
    if (path.basename(target).startsWith('javascript-edu-node-')) {
      failedDirectories.push(target);
      return Promise.reject(error);
    }
    return nativeRemove(target, options);
  });
  syncBuiltinESMExports();
  try {
    const closed = await Promise.race([
      new Promise(resolve => server.close(resolve)),
      new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('close callback did not finish')), 5000); timer.unref(); }),
    ]);
    assert.equal(closed, error);
    assert.equal(failedDirectories.length, 1);
    assert.equal(clearedIntervals, 1, 'the module workspace expiry interval must also close');
    await assert.rejects(fetch(`${origin}/_node/config`));
    await assert.rejects(fetch(`${browserHost.origin}/_fixtures/http/products`));
    assert.equal(await new Promise(resolve => server.close(resolve)), error);
  } finally {
    removal.mock.restore(); interval.mock.restore(); syncBuiltinESMExports();
    const temporaryParent = await filesystem.realpath(tmpdir());
    for (const directory of failedDirectories) {
      const canonicalDirectory = await filesystem.realpath(directory);
      const relative = path.relative(temporaryParent, canonicalDirectory);
      assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(canonicalDirectory).startsWith('javascript-edu-node-'));
      await nativeRemove(canonicalDirectory, { recursive: true, force: true });
    }
  }
});
