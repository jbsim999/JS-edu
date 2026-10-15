import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker as ThreadWorker, MessageChannel } from 'node:worker_threads';
import { createModuleRunner, fingerprintSource, moduleLimits, moduleProtocol, serializeModuleSource, validateModuleSnapshot } from '../web/execution/module-runner.mjs';

const origin = 'http://127.0.0.1:4182';
const baselineFiles = { 'main.mjs': 'export function read() { return 42; }', 'fixed.mjs': 'export const fixed = 7;' };
function contract(files = baselineFiles) {
  return { id: 'native-module-test', lessonId: 'native-module-test', contentRevision: 'module-1', graderRevision: 'module-grader-1', profileByVersion: { ES2026: 'native-module' },
    runner: { kind: 'module-files', entry: 'main.mjs', runProbe: 'const value = submission.read(); console.log(value); observe(value);' },
    workspace: { entry: 'main.mjs', files: Object.entries(files).map(([file, source]) => ({ path: file, source, editable: file !== 'fixed.mjs' })) } };
}
function checks(exercise, cases = [{ id: 'value', label: 'value', probe: 'observe(submission.read());', expected: 42 }]) {
  return { exerciseId: exercise.id, contentRevision: exercise.contentRevision, graderRevision: exercise.graderRevision, cases };
}
let sequence = 0;
async function request(exercise, files = Object.fromEntries(exercise.workspace.files.map(file => [file.path, file.source]))) {
  const source = serializeModuleSource({ entry: exercise.runner.entry, files });
  return { requestId: `module-request-${++sequence}`, lessonId: exercise.lessonId, exerciseId: exercise.id, contentRevision: exercise.contentRevision, source, sourceFingerprint: await fingerprintSource(source), targetVersion: 'ES2026' };
}
async function until(predicate) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for test observation');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

// Native Node ESM checks language semantics and runner protocol. This fixture is
// not a browser, does not enforce CSP, and is not an untrusted-code OS sandbox.
async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'javascript-edu-module-test-'));
  const bootstrap = await readFile(new URL('../web/execution/module-bootstrap.mjs', import.meta.url), 'utf8');
  const live = new Map();
  const created = [];
  const deleted = [];
  const workers = [];
  const terminations = [];
  const token = 'A'.repeat(43);
  let releasePost;
  let cleanupAborted = false;
  const response = (status, value) => ({ status, ok: status >= 200 && status < 300, json: async () => value, text: async () => JSON.stringify(value) });
  const fetcher = async (url, init = {}) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/_execution/config') return response(200, { token, protocol: moduleProtocol, limits: moduleLimits });
    if (pathname === '/_execution/workspaces' && init.method === 'POST') {
      assert.equal(init.headers['X-Execution-Token'], token);
      const id = (created.length + 1).toString(16).padStart(48, '0');
      const workspace = path.join(root, id);
      const source = JSON.parse(init.body);
      await mkdir(path.join(workspace, 'files'), { recursive: true });
      await writeFile(path.join(workspace, 'bootstrap.mjs'), bootstrap);
      for (const [file, content] of Object.entries(source.files)) {
        await mkdir(path.dirname(path.join(workspace, 'files', file)), { recursive: true });
        await writeFile(path.join(workspace, 'files', file), content);
      }
      await writeFile(path.join(workspace, 'files', '__edu_bridge__.mjs'), `import * as submission from ${JSON.stringify(`./${source.entry}`)};\nexport { submission };\n`);
      live.set(id, workspace);
      created.push({ id, workspace, source, signal: init.signal });
      if (options.delayPost) await new Promise(resolve => { releasePost = resolve; });
      return response(201, { id, workerUrl: options.badWorkerUrl ? '/wrong-worker.mjs' : `/_execution/${id}/bootstrap.mjs`, expiresAt: Date.now() + 60000 });
    }
    const deletion = /^\/_execution\/workspaces\/([a-f0-9]{48})$/.exec(pathname);
    if (deletion && init.method === 'DELETE') {
      cleanupAborted ||= init.signal.aborted;
      assert.equal(init.headers['X-Execution-Token'], token);
      deleted.push(deletion[1]);
      if (options.failDelete) return response(500, {});
      live.delete(deletion[1]);
      return response(204, null);
    }
    throw new Error(`Unexpected fixture request ${init.method ?? 'GET'} ${pathname}`);
  };
  class NativeModuleBridge {
    constructor(url, settings) {
      this.featureGetterReads = 0;
      assert.equal(settings.type, 'module');
      const id = /^\/_execution\/([a-f0-9]{48})\/bootstrap\.mjs$/.exec(new URL(url).pathname)?.[1];
      if (!live.has(id)) throw new Error('Workspace is not available');
      this.thread = new ThreadWorker(`
        const { parentPort, workerData, MessagePort } = require('node:worker_threads');
        globalThis.self = globalThis;
        globalThis.MessagePort = MessagePort;
        const listeners = new Map();
        globalThis.addEventListener = (type, handler) => {
          if (type !== 'message') return;
          const listener = message => handler({ data: message.data, ports: message.ports });
          listeners.set(handler, listener); parentPort.on('message', listener);
        };
        globalThis.removeEventListener = (type, handler) => { if (type === 'message') parentPort.off('message', listeners.get(handler)); };
        globalThis.postMessage = data => parentPort.postMessage(data);
        new Function('parentPort', workerData.realmSetup)(parentPort);
        import(workerData.bootstrapUrl).catch(error => { throw error; });
      `, { eval: true, workerData: { bootstrapUrl: pathToFileURL(path.join(live.get(id), 'bootstrap.mjs')).href, realmSetup: options.realmSetup ?? '' } });
      this.thread.on('message', data => { if (data?.type === 'feature-getter-read') this.featureGetterReads++; this.onmessage?.({ data }); });
      this.thread.on('error', error => this.onerror?.({ message: error.message, preventDefault() {} }));
      workers.push(this);
    }
    postMessage(data, ports) { this.thread.postMessage({ data, ports }, ports); }
    terminate() { terminations.push(this.thread.terminate()); }
  }
  t.after(async () => {
    for (const worker of workers) worker.terminate();
    await Promise.all(terminations);
    const relative = path.relative(tmpdir(), root);
    assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(root).startsWith('javascript-edu-module-test-'));
    await rm(root, { recursive: true, force: true });
  });
  return { live, created, deleted, workers, get releasePost() { return releasePost; }, get cleanupAborted() { return cleanupAborted; },
    runner(exercise, grader = checks(exercise), overrides = {}) { return createModuleRunner({ exercises: [exercise], loadGrader: async () => grader, WorkerConstructor: NativeModuleBridge, MessageChannelConstructor: MessageChannel, fetcher, origin, ...overrides }); } };
}

test('module snapshot is canonical and admits only the fixed file manifest and editable content', () => {
  const exercise = contract();
  const snapshot = serializeModuleSource({ entry: 'main.mjs', files: { 'fixed.mjs': baselineFiles['fixed.mjs'], 'main.mjs': baselineFiles['main.mjs'] } });
  assert.deepEqual(Object.keys(JSON.parse(snapshot).files), ['fixed.mjs', 'main.mjs']);
  assert.equal(validateModuleSnapshot(exercise, snapshot).entry, 'main.mjs');
  for (const files of [{ ...baselineFiles, 'extra.mjs': '' }, { 'main.mjs': '' }, { ...baselineFiles, 'fixed.mjs': 'changed' }, { ...baselineFiles, 'main.mjs': 'x'.repeat(moduleLimits.fileBytes + 1) }]) assert.throws(() => validateModuleSnapshot(exercise, serializeModuleSource({ entry: 'main.mjs', files })));
  assert.throws(() => validateModuleSnapshot(exercise, '{"entry":"bad.mjs","entry":"main.mjs","files":{}}'));
  assert.throws(() => createModuleRunner({ exercises: [{ ...exercise, workspace: { ...exercise.workspace, files: [{ path: '../bad.mjs', source: '', editable: true }] } }] }));
});

test('prepare boots native module Worker without evaluating learner modules', async t => {
  const f = await fixture(t);
  const exercise = contract({ 'main.mjs': 'throw new Error("must not be imported");' });
  const result = await f.runner(exercise).prepare(await request(exercise));
  assert.equal(result.status, 'ready', result.stderr);
  assert.deepEqual(result.checks, []);
  assert.equal(f.created.length, 1);
  assert.deepEqual(f.deleted, [f.created[0].id]);
  assert.equal(f.live.size, 0);
});

test('native ESM preserves static imports, live bindings, safe cycles and top-level await', async t => {
  const f = await fixture(t);
  const files = {
    'main.mjs': 'import { count, increment } from "./state.mjs"; import { cycle } from "./cycle-a.mjs"; await Promise.resolve(); export { count, increment, cycle }; export const ready = true;',
    'state.mjs': 'export let count = 0; export function increment() { count++; }',
    'cycle-a.mjs': 'import { b } from "./cycle-b.mjs"; export function a() { return "A"; } export function cycle() { return b() + a(); }',
    'cycle-b.mjs': 'import { a } from "./cycle-a.mjs"; export function b() { return "B" + a(); }',
  };
  const exercise = contract(files);
  const grader = checks(exercise, [{ id: 'native-semantics', label: 'native semantics', probe: 'submission.increment(); observe([submission.count, submission.ready, submission.cycle()]);', expected: [1, true, 'BAA'] }]);
  const result = await f.runner(exercise, grader).submit(await request(exercise));
  assert.equal(result.status, 'success', result.stderr || result.compilerOutput);
  assert.deepEqual(result.checks[0].actual, [1, true, 'BAA']);
  assert.equal(f.live.size, 0);
});

test('each fixed case gets a fresh Worker and module cache', async t => {
  const f = await fixture(t);
  const exercise = contract({ 'main.mjs': 'let count = 0; export function increment() { return ++count; }' });
  const grader = checks(exercise, [1, 2, 3].map(id => ({ id: `fresh-${id}`, label: 'fresh state', probe: 'observe(submission.increment());', expected: 1 })));
  const result = await f.runner(exercise, grader).submit(await request(exercise));
  assert.equal(result.status, 'success', result.stderr);
  assert.equal(f.workers.length, 3);
  assert.equal(f.created.length, 1);
  assert.deepEqual(result.checks.map(item => item.actual), [1, 1, 1]);
});

test('entry export then and Object.prototype.then do not assimilate the trusted namespace wrapper', async t => {
  const f = await fixture(t);
  const exercise = contract({ 'main.mjs': 'Object.prototype.then = function (resolve) { resolve({ read: () => 999 }); }; export function then() { throw new Error("entry then invoked"); } export function read() { return 42; }' });
  const result = await f.runner(exercise).submit(await request(exercise));
  assert.equal(result.status, 'success', result.stderr);
  assert.equal(result.checks[0].actual, 42);
});

test('public message and prototype method tampering cannot turn wrong module behavior into success', async t => {
  const f = await fixture(t);
  const exercise = contract({ 'main.mjs': 'self.postMessage({ protocol: "javascript-edu-modules-v1", type: "complete", status: "success", results: [] }); Object.is = () => true; Reflect.apply = () => 42; MessagePort.prototype.postMessage = () => {}; Array.prototype.then = resolve => resolve([42]); export function read() { return 99; }' });
  const grader = checks(exercise, [{ id: 'raw-array', label: 'raw array', probe: 'observe([submission.read()]);', expected: [42] }]);
  const result = await f.runner(exercise, grader).submit(await request(exercise));
  assert.equal(result.status, 'checks-failed', result.stderr);
  assert.deepEqual(result.checks[0].actual, [99]);
});

test('run observes native exports and reports native import rejection without guessing its cause', async t => {
  const f = await fixture(t);
  const exercise = contract();
  const adapter = f.runner(exercise);
  const good = await adapter.run(await request(exercise));
  assert.equal(good.status, 'success', good.stderr);
  assert.equal(good.stdout, '42');
  assert.deepEqual(good.checks, []);
  const syntax = await adapter.run(await request(exercise, { ...baselineFiles, 'main.mjs': 'export const missing = ;' }));
  assert.equal(syntax.status, 'module-load-error', syntax.stderr);
  const failed = await adapter.run(await request(exercise, { ...baselineFiles, 'main.mjs': 'throw new Error("module failed"); export function read() {}' }));
  assert.equal(failed.status, 'module-load-error');
  assert.match(failed.stderr, /module failed/);
  assert.equal(f.live.size, 0);
  for (const source of ['throw new SyntaxError("thrown during evaluation");', 'JSON.parse("broken");', 'throw new Proxy({}, {getPrototypeOf(){throw 1},getOwnPropertyDescriptor(){throw 2}});']) {
    const result = await adapter.run(await request(exercise, { ...baselineFiles, 'main.mjs': source }));
    assert.equal(result.status, 'module-load-error', result.stderr);
    assert.equal(f.live.size, 0);
  }
});

test('unsettled top-level await times out, closes its workspace, and permits recovery', async t => {
  const f = await fixture(t);
  const exercise = contract();
  const adapter = f.runner(exercise, checks(exercise), { caseTimeoutMs: 500 });
  const result = await adapter.run(await request(exercise, { ...baselineFiles, 'main.mjs': 'await new Promise(() => {}); export function read() {}' }));
  assert.equal(result.status, 'timeout');
  assert.equal(f.live.size, 0);
  const recovered = await adapter.run(await request(exercise));
  assert.equal(recovered.status, 'success', recovered.stderr);
});

test('whole-submission timeout bounds several individually valid asynchronous cases', async t => {
  const f = await fixture(t);
  const exercise = contract();
  const grader = checks(exercise, [1, 2, 3].map(id => ({ id: `slow-${id}`, label: 'slow', probe: 'await new Promise(resolve => setTimeout(resolve, 300)); observe(submission.read());', expected: 42 })));
  const result = await f.runner(exercise, grader, { caseTimeoutMs: 700, totalTimeoutMs: 800 }).submit(await request(exercise));
  assert.equal(result.status, 'timeout');
  assert.match(result.stderr, /전체/);
  assert.deepEqual(result.checks, []);
  assert.equal(f.live.size, 0);
});

test('cancel during execution uses an independent cleanup signal', async t => {
  const f = await fixture(t);
  const exercise = contract();
  const adapter = f.runner(exercise);
  const payload = await request(exercise, { ...baselineFiles, 'main.mjs': 'while (true) {}' });
  const pending = adapter.run(payload);
  await until(() => f.workers.length > 0);
  assert.equal((await adapter.cancel(payload.requestId)).status, 'cancelled');
  assert.equal((await pending).status, 'cancelled');
  assert.equal(f.cleanupAborted, false);
  assert.equal(f.live.size, 0);
});

test('a workspace arriving after cancellation is still deleted even if the late worker URL is invalid', async t => {
  const f = await fixture(t, { delayPost: true, badWorkerUrl: true });
  const exercise = contract();
  const adapter = f.runner(exercise);
  const payload = await request(exercise);
  const pending = adapter.run(payload);
  await until(() => Boolean(f.releasePost));
  await adapter.cancel(payload.requestId);
  const result = await pending;
  assert.equal(result.status, 'cancelled');
  assert.equal(result.cleanupPending, true);
  assert.equal(f.created[0].signal.aborted, false);
  f.releasePost();
  await until(() => f.deleted.length === 1);
  assert.equal(f.live.size, 0);
  assert.equal(f.workers.length, 0);
  assert.equal(f.cleanupAborted, false);
});

test('aggregate console output remains bounded across fresh workers', async t => {
  const f = await fixture(t);
  const exercise = contract({ 'main.mjs': 'for (let i = 0; i < 160; i++) console.log("한글", i); export function read() { return 42; }' });
  const grader = checks(exercise, [1, 2, 3].map(id => ({ id: `output-${id}`, label: 'output', probe: 'observe(submission.read());', expected: 42 })));
  const result = await f.runner(exercise, grader).submit(await request(exercise));
  assert.equal(result.status, 'success', result.stderr);
  assert.equal(result.outputTruncated, true);
  assert.ok(result.stdout.split('\n').length <= 200);
  assert.ok(new TextEncoder().encode(result.stdout).byteLength <= 65536);
});

test('cleanup failure is explicit and does not claim the workspace was removed', async t => {
  const f = await fixture(t, { failDelete: true });
  const exercise = contract();
  const result = await f.runner(exercise).run(await request(exercise));
  assert.equal(result.status, 'success');
  assert.match(result.cleanupWarning, /만료 시간/);
  assert.equal(f.live.size, 1);
});

test('invalid worker URL responses still clean a known workspace identity without starting it', async t => {
  const f = await fixture(t, { badWorkerUrl: true });
  const exercise = contract();
  const result = await f.runner(exercise).run(await request(exercise));
  assert.equal(result.status, 'infrastructure-error');
  assert.equal(f.workers.length, 0);
  assert.equal(f.deleted.length, 1);
  assert.equal(f.live.size, 0);
});

test('missing features and invalid snapshots cannot create a workspace or learner Worker', async t => {
  const f = await fixture(t);
  const exercise = { ...contract(), requiredFeatures: ['Intl.QualificationMissingFeature'] };
  const adapter = f.runner(exercise);
  assert.equal((await adapter.getEnvironment({ exerciseId: exercise.id })).available, false);
  const result = await adapter.submit(await request(exercise));
  assert.equal(result.status, 'infrastructure-error');
  assert.deepEqual(result.missingFeatures, ['Intl.QualificationMissingFeature']);
  assert.deepEqual(result.checks, []);
  assert.equal(f.created.length, 0);
  assert.equal(f.workers.length, 0);
});

test('module preflight discovers inherited native timer APIs before importing learner modules', async t => {
  const f = await fixture(t, { realmSetup: `const prototype = Object.create(Object.getPrototypeOf(globalThis));
    for (const name of ['setTimeout', 'queueMicrotask']) { Object.defineProperty(prototype, name, Object.getOwnPropertyDescriptor(globalThis, name)); delete globalThis[name]; }
    Object.setPrototypeOf(globalThis, prototype);` });
  const exercise = { ...contract(), requiredFeatures: ['setTimeout', 'queueMicrotask'] };
  const adapter = f.runner(exercise);
  assert.equal((await adapter.prepare(await request(exercise))).status, 'ready');
  assert.equal((await adapter.run(await request(exercise))).status, 'success');
  assert.equal((await adapter.submit(await request(exercise))).status, 'success');
});

test('module preflight refuses own and inherited getters without evaluating them or learner imports', async t => {
  for (const inherited of [false, true]) {
    const f = await fixture(t, { realmSetup: `const prototype = Object.create(Object.getPrototypeOf(globalThis));
      delete globalThis.queueMicrotask;
      Object.defineProperty(${inherited ? 'prototype' : 'globalThis'}, 'queueMicrotask', {get() { parentPort.postMessage({type:'feature-getter-read'}); return () => {}; }});
      Object.setPrototypeOf(globalThis, prototype);` });
    const exercise = { ...contract({ 'main.mjs': 'throw new Error("must not be imported"); export function read() { return 42; }' }), requiredFeatures: ['queueMicrotask'] };
    const result = await f.runner(exercise).submit(await request(exercise));
    assert.equal(result.status, 'infrastructure-error');
    assert.deepEqual(result.missingFeatures, ['queueMicrotask']);
    assert.doesNotMatch(result.stderr, /must not be imported/);
    assert.equal(f.workers[0].featureGetterReads, 0);
  }
});
