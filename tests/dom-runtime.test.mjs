import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { Worker, MessageChannel } from 'node:worker_threads';
import { createBrowserHostServer } from '../web/server/browser-host.mjs';
import { createDomRunner, domLimits, domProtocol, fingerprintSource, validateBrowserHostConfig } from '../web/execution/dom-runner.mjs';

const origin = 'http://127.0.0.1:4182';
const hostConfig = { origin: 'http://127.0.0.1:45123', frameUrl: 'http://127.0.0.1:45123/execution/dom-frame.html' };
const contract = (extra = {}) => ({ id: 'dom-adapter', lessonId: 'dom-adapter', contentRevision: 'dom-1', graderRevision: 'dom-checks-1', profileByVersion: { ES2026: 'browser-dom' }, hostRequirements: ['browser-dom'], runner: { kind: 'function-body', exportName: 'read', parameters: ['initial = 40', '...values'], runProbe: 'const value = submission.read(40, 1, 1); console.log(value); observe(value);' }, ...extra });
const checks = (exercise, cases = [{ id: 'read', label: 'value', probe: 'observe(submission.read(40, 1, 1));', expected: 42 }]) => ({ exerciseId: exercise.id, contentRevision: exercise.contentRevision, graderRevision: exercise.graderRevision, cases });
let sequence = 0;
async function request(exercise, source = 'return initial + values.reduce((total, value) => total + value, 0);') {
  return { requestId: `dom-request-${++sequence}`, lessonId: exercise.lessonId, exerciseId: exercise.id, contentRevision: exercise.contentRevision, source, sourceFingerprint: await fingerprintSource(source), targetVersion: 'ES2026' };
}
async function until(predicate) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Test observation timed out');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

// These Node worker fixtures verify communication and error handling only. Their
// document/storage stubs do NOT establish real DOM, focus, iframe, or CSP behavior.
async function fixture(t, options = {}) {
  const script = await readFile(new URL('../web/execution/dom-frame.js', import.meta.url), 'utf8');
  const frames = [];
  const audits = [];
  const captures = [];
  const terminations = [];
  const messageListeners = new Set();
  const dispatchMessage = event => { for (const listener of [...messageListeners]) listener(event); };
  const document = { activeElement: null, body: {}, createElement: null, defaultView: {
    addEventListener(type, listener) { if (type === 'message') messageListeners.add(listener); },
    removeEventListener(type, listener) { if (type === 'message') messageListeners.delete(listener); },
  } };
  const announce = (frame, extra = {}) => dispatchMessage({ source: frame.contentWindow, origin: hostConfig.origin,
    data: { protocol: domProtocol, type: 'script-ready', documentId: frame.documentId }, ...extra });
  const previousFocus = { isConnected: true, calls: 0, matches(selector) { assert.equal(selector, ':disabled'); return options.previousDisabled === true; }, focus(settings) { assert.equal(settings.preventScroll, true); this.calls++; document.activeElement = this; } };
  document.activeElement = previousFocus;
  document.createElement = name => {
    assert.equal(name, 'iframe');
    const frame = { attributes: {}, style: {}, removed: false, focusCalls: 0, blurCalls: 0,
      focus(settings) { assert.equal(settings.preventScroll, true); this.focusCalls++; if (options.focusFrame) document.activeElement = this; },
      blur() { assert.equal(this.removed, false); this.blurCalls++; if (document.activeElement === this) document.activeElement = document.body; },
      setAttribute(name, value) { this.attributes[name] = value; }, remove() { this.removed = true; if (this.thread) terminations.push(this.thread.terminate()); }, contentWindow: {} };
    frame.contentWindow.postMessage = (configuration, targetOrigin, ports) => {
      assert.equal(targetOrigin, hostConfig.origin);
      assert.equal(configuration.protocol, domProtocol);
      if (configuration.type === 'request-ready') { frame.thread.postMessage({ configuration, ports: [], wrongOrigin: options.wrongOrigin, wrongSource: options.wrongSource }); return; }
      assert.equal(configuration.cases.some(item => 'expected' in item), false);
      captures.push(configuration);
      if (options.focusFrame) document.activeElement = frame;
      if (options.moveFocus) document.activeElement = options.moveFocus;
      frame.thread.postMessage({ configuration, ports, wrongOrigin: options.wrongOrigin, wrongSource: options.wrongSource }, ports);
    };
    frames.push(frame);
    return frame;
  };
  document.body.append = frame => {
    assert.equal(frame.src, hostConfig.frameUrl);
    assert.equal(frame.attributes.sandbox, 'allow-scripts allow-same-origin allow-forms');
    assert.equal(frame.attributes.tabindex, '-1');
    assert.equal(frame.attributes.loading, 'eager');
    assert.equal(/display\s*:\s*none|visibility\s*:\s*hidden/.test(frame.style.cssText), false);
    frame.thread = new Worker(`
      const { parentPort, workerData, MessagePort } = require('node:worker_threads');
      const { runInThisContext } = require('node:vm');
      globalThis.self = globalThis;
      globalThis.MessagePort = MessagePort;
      globalThis.parent = Object.freeze({ parent: true, postMessage(data, targetOrigin) { parentPort.postMessage({ type: 'host-message', data, targetOrigin }); } });
      globalThis.location = { origin: workerData.hostOrigin };
      globalThis.document = { documentElement: { dataset: { parentOrigin: workerData.parentOrigin } }, createElement() { return {}; }, querySelector() { return {}; } };
      class Storage {
        constructor(kind) { this.kind = kind; this.map = new Map([['unrelated-keep', 'keep']]); }
        get length() { return this.map.size; }
        key(index) { return [...this.map.keys()][index] ?? null; }
        getItem(key) { return this.map.get(String(key)) ?? null; }
        setItem(key, value) { this.map.set(String(key), String(value)); }
        removeItem(key) { this.map.delete(key); parentPort.postMessage({ type: 'audit', kind: this.kind, removed: key, remaining: [...this.map.keys()] }); }
      }
      globalThis.Storage = Storage;
      globalThis.localStorage = new Storage('local');
      globalThis.sessionStorage = new Storage('session');
      let storagePrefix;
      class IDBFactory {
        databases() { return Promise.resolve(workerData.blockedDatabase ? [{name: storagePrefix+'blocked'}, {name:'unrelated-db'}] : []); }
        deleteDatabase(name) { parentPort.postMessage({type:'database-delete',name}); const request = new EventTarget(); setTimeout(() => request.dispatchEvent(new Event('blocked')), 0); return request; }
      }
      globalThis.IDBFactory = IDBFactory;
      globalThis.indexedDB = new IDBFactory();
      const listeners = new Set();
      globalThis.addEventListener = (type, listener) => { if (type === 'message') listeners.add(listener); };
      globalThis.removeEventListener = (type, listener) => { if (type === 'message') listeners.delete(listener); };
      globalThis.postMessage = data => parentPort.postMessage({ type: 'forged', data });
      new Function('parentPort', workerData.realmSetup)(parentPort);
      runInThisContext(workerData.script);
      parentPort.on('message', message => {
        if (message.configuration.storagePrefix) storagePrefix = message.configuration.storagePrefix;
        for (const listener of [...listeners]) listener({ data: message.configuration, ports: message.ports, origin: message.wrongOrigin ? 'http://127.0.0.1:9999' : workerData.parentOrigin, source: message.wrongSource ? {} : globalThis.parent });
      });
      parentPort.postMessage({ type: 'ready' });
    `, { eval: true, workerData: { script, parentOrigin: origin, hostOrigin: hostConfig.origin, blockedDatabase: options.blockedDatabase, realmSetup: options.realmSetup ?? '' } });
    frame.thread.on('message', message => {
      if (message.type === 'ready') { if (!options.noLoad) frame.onload?.(); }
      else if (message.type === 'host-message') {
        assert.equal(message.targetOrigin, origin);
        frame.documentId = message.data.documentId;
        if (!options.holdReady && (!options.dropInitialReady || message.data.challenge)) announce(frame, { data: message.data });
      }
      else audits.push(message);
    });
    frame.thread.on('error', error => frame.onerror?.({ error }));
  };
  const exercise = options.exercise ?? contract();
  const runner = createDomRunner({ exercises: [exercise], document, origin, MessageChannelConstructor: MessageChannel, loadHostConfig: options.loadHostConfig ?? (async () => hostConfig), loadGrader: options.loadGrader ?? (async () => checks(exercise, options.cases)), caseTimeoutMs: options.caseTimeoutMs, totalTimeoutMs: options.totalTimeoutMs, realm: options.realm ?? globalThis });
  t.after(async () => { await runner.cancel(); for (const frame of frames) if (!frame.removed) frame.remove(); await Promise.all(terminations); });
  return { runner, exercise, frames, audits, captures, previousFocus, document, announce, messageListeners };
}

async function serverFixture(t) {
  const server = createBrowserHostServer({ parentOrigin: origin });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

function rawRequest(url, { method = 'GET', headers = {}, pathname } = {}) {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port: target.port, path: pathname ?? target.pathname, method, headers }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, text }));
    });
    request.on('error', reject);
    request.end();
  });
}

test('HTTP host allows only fixed files and guards Host, Origin, method, and paths', async t => {
  const { url } = await serverFixture(t);
  const frame = await rawRequest(`${url}/execution/dom-frame.html`);
  assert.equal(frame.status, 200);
  assert.match(frame.text, new RegExp(`data-parent-origin="${origin.replaceAll('.', '\\.')}`));
  assert.equal(frame.headers['cache-control'], 'no-store');
  assert.equal(frame.headers['origin-agent-cluster'], '?1');
  assert.ok(frame.headers['content-security-policy'].includes(`frame-ancestors ${origin}`));
  assert.ok(frame.headers['content-security-policy'].includes(`script-src 'unsafe-eval' ${url}/execution/dom-frame.js`));
  assert.ok(frame.headers['content-security-policy'].includes(`connect-src ${url}/_fixtures/http/`));
  assert.ok(frame.headers['content-security-policy'].includes(`worker-src ${url}/_fixtures/workers/`));
  assert.ok(!frame.headers['content-security-policy'].includes("script-src 'self'"));
  assert.equal(frame.headers['access-control-allow-origin'], undefined);
  assert.equal((await rawRequest(`${url}/execution/dom-frame.js`)).status, 200);
  assert.equal((await rawRequest(`${url}/execution/dom-frame.html`, { method: 'HEAD' })).text, '');
  assert.equal((await rawRequest(`${url}/execution/dom-frame.html`, { headers: { Host: 'localhost:1' } })).status, 403);
  assert.equal((await rawRequest(`${url}/execution/dom-frame.html`, { headers: { Origin: 'https://example.com' } })).status, 403);
  assert.equal((await rawRequest(`${url}/execution/dom-frame.html`, { headers: { Origin: origin } })).status, 200);
  assert.equal((await rawRequest(`${url}/execution/dom-frame.html`, { method: 'POST' })).status, 405);
  for (const pathname of ['/reference/answer.mjs', '/curriculum/catalog.json', '/execution/../server/browser-host.mjs', '/execution/%2e%2e/x', '//execution/dom-frame.js', '/execution/dom-frame.js?anything=1']) assert.equal((await rawRequest(url, { pathname })).status, 404);
  assert.throws(() => createBrowserHostServer({ parentOrigin: 'https://example.com' }), /loopback|127/);
});

test('HTTP fixture success, schema, parse, status, delay, abort, and network errors are actual HTTP behavior', async t => {
  const { url } = await serverFixture(t);
  const products = [{ id: 'p1', name: 'Lemon', price: 120 }, { id: 'p2', name: 'Pistachio', price: 230 }];
  assert.deepEqual(await (await fetch(`${url}/_fixtures/http/products`)).json(), products);
  assert.deepEqual(await (await fetch(`${url}/_fixtures/http/empty`)).json(), []);
  assert.equal((await fetch(`${url}/_fixtures/http/not-found`)).status, 404);
  assert.equal((await fetch(`${url}/_fixtures/http/unavailable`)).status, 503);
  assert.equal((await (await fetch(`${url}/_fixtures/http/invalid-schema`)).json())[0].price, '120');
  await assert.rejects((await fetch(`${url}/_fixtures/http/invalid-json`)).json(), SyntaxError);
  await assert.rejects(fetch(`${url}/_fixtures/http/network-error`), TypeError);
  const start = performance.now();
  assert.deepEqual(await (await fetch(`${url}/_fixtures/http/slow`)).json(), products);
  assert.ok(performance.now() - start >= 200);
  const controller = new AbortController();
  const pending = fetch(`${url}/_fixtures/http/slow`, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal((await fetch(`${url}/_fixtures/http/products`, { method: 'HEAD' })).status, 405);
});

test('fixed worker fixture implements bounded sum messages without importing external code', async t => {
  const { url } = await serverFixture(t);
  const response = await fetch(`${url}/_fixtures/workers/sum.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'none'; worker-src 'none'/);
  assert.equal((await fetch(`${url}/_fixtures/workers/sum.js`, { method: 'HEAD' })).status, 405);
  const source = await response.text();
  const thread = new Worker(`const {parentPort}=require('node:worker_threads');globalThis.self={addEventListener(type, callback){parentPort.on('message', data=>callback({data}));},postMessage(data){parentPort.postMessage(data);}};${source}`, { eval: true });
  t.after(() => thread.terminate());
  const received = new Promise(resolve => thread.once('message', resolve));
  thread.postMessage({ requestId: 1, values: [1, -2, 3] });
  assert.deepEqual(await received, { requestId: 1, sum: 2 });
  const bounded = new Promise(resolve => thread.once('message', resolve));
  thread.postMessage({ requestId: 2, values: Array(100000).fill(1000000) });
  assert.deepEqual(await bounded, { requestId: 2, sum: 100000000000 });
  const afterInvalid = new Promise(resolve => thread.once('message', resolve));
  for (const values of [[1,,3], [1.5], [1000001], Array(100001).fill(1)]) thread.postMessage({ requestId: 3, values });
  thread.postMessage({ requestId: '4', values: [1] });
  thread.postMessage({ requestId: 5, values: [] });
  assert.deepEqual(await afterInvalid, { requestId: 5, sum: 0 });
});

test('host config refuses shared-origin, nonloopback, credential, alternate-path, and normalized-origin aliases', () => {
  assert.deepEqual(validateBrowserHostConfig(hostConfig, origin), hostConfig);
  for (const candidate of [{ origin, frameUrl: `${origin}/execution/dom-frame.html` }, { origin: 'http://localhost:45123', frameUrl: 'http://localhost:45123/execution/dom-frame.html' }, { ...hostConfig, frameUrl: `${hostConfig.origin}/execution/other.html` }, { origin: 'http://user@127.0.0.1:45123', frameUrl: 'http://user@127.0.0.1:45123/execution/dom-frame.html' }, { ...hostConfig, origin: `${hostConfig.origin}/` }]) assert.throws(() => validateBrowserHostConfig(candidate, origin), /loopback/);
});

test('prepare and run do not load the submission grader', async t => {
  let loads = 0;
  const f = await fixture(t, { loadGrader: async () => { loads++; throw new Error('grader unavailable'); } });
  assert.equal((await f.runner.prepare(await request(f.exercise))).status, 'ready');
  assert.equal((await f.runner.run(await request(f.exercise))).status, 'success');
  assert.equal(loads, 0);
  assert.equal((await f.runner.submit(await request(f.exercise))).status, 'infrastructure-error');
  assert.equal(loads, 1);
});

test('equivalent isolated host ports do not invalidate the runtime fingerprint', async t => {
  const first = await fixture(t);
  const second = await fixture(t, { loadHostConfig: async () => ({ origin: 'http://127.0.0.1:45124', frameUrl: 'http://127.0.0.1:45124/execution/dom-frame.html' }) });
  const a = await first.runner.getEnvironment();
  const b = await second.runner.getEnvironment();
  assert.equal(a.available, true);
  assert.equal(b.available, true);
  assert.equal(a.environmentFingerprint, b.environmentFingerprint);
});

test('DOM contracts require a run observation and execution explicitly activates its frame', async t => {
  const missing = contract();
  delete missing.runner.runProbe;
  assert.throws(() => createDomRunner({ exercises: [missing] }), /runProbe/);
  const f = await fixture(t);
  assert.equal((await f.runner.prepare(await request(f.exercise))).status, 'ready');
  assert.equal(f.frames[0].focusCalls, 0);
  assert.equal((await f.runner.run(await request(f.exercise))).status, 'success');
  assert.equal(f.frames[1].focusCalls, 1);
});

test('script-ready starts without load and load can recover a missed initial announcement', async t => {
  for (const options of [{ noLoad: true }, { dropInitialReady: true }]) {
    const f = await fixture(t, options);
    assert.equal((await f.runner.prepare(await request(f.exercise, 'throw new Error("must not run");'))).status, 'ready');
    assert.equal((await f.runner.run(await request(f.exercise))).runValue, 42);
    assert.equal(f.captures.length, 2);
    assert.equal(f.messageListeners.size, 0);
  }
});

test('duplicate ready announcements and delayed load never repeat learner execution', async t => {
  const exercise = contract({ runner: { ...contract().runner, async: true, runProbe: 'observe(await submission.read());' } });
  const f = await fixture(t, { exercise, noLoad: true });
  const pending = f.runner.run(await request(exercise, 'await new Promise(resolve=>setTimeout(resolve,120));return 42;'));
  await until(() => f.captures.length === 1);
  f.announce(f.frames[0]);
  f.frames[0].onload();
  f.frames[0].onload();
  assert.equal((await pending).runValue, 42);
  assert.equal(f.captures.length, 1);
  assert.equal(f.messageListeners.size, 0);
});

test('ready requires the exact frame source and host origin and late ready cannot revive cancellation', async t => {
  const f = await fixture(t, { holdReady: true, noLoad: true });
  const pending = f.runner.prepare(await request(f.exercise));
  await until(() => f.frames[0]?.documentId);
  f.announce(f.frames[0], { source: {} });
  f.announce(f.frames[0], { origin: 'http://127.0.0.1:9999' });
  f.announce(f.frames[0], { data: { protocol: domProtocol, type: 'script-ready', documentId: 'invalid' } });
  assert.equal(f.captures.length, 0);
  f.announce(f.frames[0]);
  assert.equal((await pending).status, 'ready');
  const cancelled = f.runner.run(await request(f.exercise));
  await until(() => f.frames[1]?.documentId);
  await f.runner.cancel();
  f.announce(f.frames[1]);
  assert.equal((await cancelled).status, 'cancelled');
  assert.equal(f.captures.length, 1);
  assert.equal(f.messageListeners.size, 0);
});

test('a new document identity in the same frame is an infrastructure failure without rerunning code', async t => {
  const exercise = contract({ runner: { ...contract().runner, async: true, runProbe: 'observe(await submission.read());' } });
  const f = await fixture(t, { exercise });
  const pending = f.runner.run(await request(exercise, 'await new Promise(resolve=>setTimeout(resolve,1000));return 42;'));
  await until(() => f.captures.length === 1);
  f.announce(f.frames[0], { data: { protocol: domProtocol, type: 'script-ready', documentId: 'a'.repeat(32) } });
  const result = await pending;
  assert.equal(result.status, 'infrastructure-error');
  assert.match(result.stderr, /다른 문서/);
  assert.equal(f.captures.length, 1);
  assert.equal(f.messageListeners.size, 0);
});

test('three replacements and cancel-then-run await disposal of the original frame', async t => {
  const exercise = contract({ runner: { ...contract().runner, async: true, runProbe: 'observe(await submission.read());' } });
  const realmSetup = `const post=MessagePort.prototype.postMessage; MessagePort.prototype.postMessage=function(message,...rest){ if(message.type==='disposed'){ parentPort.postMessage({type:'disposal-wait'}); setTimeout(()=>post.call(this,message,...rest),120); } else post.call(this,message,...rest); };`;
  const f = await fixture(t, { exercise, realmSetup });
  const a = f.runner.run(await request(exercise, 'await new Promise(resolve=>setTimeout(resolve,1000));return 1;'));
  await until(() => f.captures.length === 1);
  const b = f.runner.run(await request(exercise, 'return 2;'));
  const c = f.runner.run(await request(exercise, 'return 3;'));
  await until(() => f.audits.some(item => item.type === 'disposal-wait'));
  assert.equal(f.frames.length, 1);
  assert.equal((await a).status, 'cancelled');
  assert.equal((await b).status, 'cancelled');
  assert.equal((await c).runValue, 3);
  const d = f.runner.run(await request(exercise, 'await new Promise(resolve=>setTimeout(resolve,1000));return 4;'));
  await until(() => f.captures.length === 3);
  const cancelled = f.runner.cancel();
  const e = f.runner.run(await request(exercise, 'return 5;'));
  await cancelled;
  assert.equal((await d).status, 'cancelled');
  assert.equal((await e).runValue, 5);
  assert.ok(f.frames.every(frame => frame.removed));
});

test('frame protocol prepares without calling learner, runs without grading, and parent grades nonempty cases in fresh frames', async t => {
  const exercise = contract();
  const f = await fixture(t, { exercise, cases: [{ id: 'one', label: '42', probe: 'observe(submission.read(40,1,1));', expected: 42 }, { id: 'two', label: '43', probe: 'observe(submission.read(40,1,2));', expected: 43 }] });
  const environment = await f.runner.getEnvironment();
  assert.equal(environment.available, true);
  assert.equal(environment.limits.hardMemoryLimit, false);
  assert.equal(environment.limits.hardTimeout, false);
  assert.equal(environment.limits.forcedTermination, false);
  assert.match(environment.limitations, /동기 무한 루프/);
  assert.equal((await f.runner.prepare(await request(exercise, 'throw new Error("Must not execute");'))).status, 'ready');
  const run = await f.runner.run(await request(exercise));
  assert.equal(run.status, 'success');
  assert.equal(run.stdout, '42');
  assert.deepEqual(run.checks, []);
  assert.equal(run.runValue, 42);
  const submit = await f.runner.submit(await request(exercise));
  assert.equal(submit.status, 'success');
  assert.equal(submit.checks.length, 2);
  assert.ok(submit.checks.every(check => check.passed));
  assert.equal(submit.environmentFingerprint, environment.environmentFingerprint);
  assert.equal(f.frames.length, 4);
  assert.ok(f.frames.every(frame => frame.removed));
  assert.equal(new Set(f.captures.map(config => config.storagePrefix)).size, 4);
  const wrong = await f.runner.submit(await request(exercise, 'return 0;'));
  assert.equal(wrong.status, 'checks-failed');
  assert.ok(wrong.checks.every(check => !check.passed));
});

test('frame protocol rejects empty or mismatched graders before creating a frame', async t => {
  for (const wrong of ['empty', 'revision']) {
    const exercise = contract();
    const f = await fixture(t, { exercise, loadGrader: async () => wrong === 'empty' ? checks(exercise, []) : { ...checks(exercise), graderRevision: 'old' } });
    const result = await f.runner.submit(await request(exercise));
    assert.equal(result.status, 'infrastructure-error');
    assert.deepEqual(result.checks, []);
    assert.equal(f.frames.length, 0);
  }
});

test('frame protocol rejects missing APIs in parent and frame, never marking learning failure', async t => {
  const exercise = contract({ requiredFeatures: ['MissingApi'] });
  const parent = await fixture(t, { exercise });
  assert.equal((await parent.runner.getEnvironment()).available, false);
  const unavailable = await parent.runner.submit(await request(exercise));
  assert.equal(unavailable.status, 'infrastructure-error');
  assert.equal(unavailable.available, false);
  assert.deepEqual(unavailable.checks, []);
  assert.equal(parent.frames.length, 0);
  const frame = await fixture(t, { exercise, realm: { MissingApi() {} } });
  const result = await frame.runner.submit(await request(exercise));
  assert.equal(result.status, 'infrastructure-error');
  assert.equal(result.available, false);
  assert.deepEqual(result.missingFeatures, ['MissingApi']);
  assert.equal(frame.frames.length, 1);
});

test('frame protocol preflight discovers inherited native timer APIs', async t => {
  const exercise = contract({ requiredFeatures: ['setTimeout', 'queueMicrotask'] });
  const f = await fixture(t, { exercise, realm: Object.create({ setTimeout, queueMicrotask }), realmSetup: `const prototype = Object.create(Object.getPrototypeOf(globalThis));
    for (const name of ['setTimeout', 'queueMicrotask']) { Object.defineProperty(prototype, name, Object.getOwnPropertyDescriptor(globalThis, name)); delete globalThis[name]; }
    Object.setPrototypeOf(globalThis, prototype);` });
  assert.equal((await f.runner.getEnvironment()).available, true);
  assert.equal((await f.runner.prepare(await request(exercise))).status, 'ready');
  assert.equal((await f.runner.run(await request(exercise))).status, 'success');
  assert.equal((await f.runner.submit(await request(exercise))).status, 'success');
});

test('frame protocol preflight rejects own and inherited API getters without invoking them', async t => {
  for (const inherited of [false, true]) {
    const exercise = contract({ requiredFeatures: ['queueMicrotask'] });
    const f = await fixture(t, { exercise, realmSetup: `const prototype = Object.create(Object.getPrototypeOf(globalThis));
      delete globalThis.queueMicrotask;
      Object.defineProperty(${inherited ? 'prototype' : 'globalThis'}, 'queueMicrotask', {get() { parentPort.postMessage({type:'feature-getter-read'}); return () => {}; }});
      Object.setPrototypeOf(globalThis, prototype);` });
    const result = await f.runner.submit(await request(exercise, 'throw new Error("must never execute");'));
    assert.equal(result.status, 'infrastructure-error');
    assert.deepEqual(result.missingFeatures, ['queueMicrotask']);
    assert.doesNotMatch(result.stderr, /must never execute/);
    assert.equal(f.audits.filter(item => item.type === 'feature-getter-read').length, 0);
  }
});

test('frame protocol reports syntax, falsy throw, and invalid observe contracts', async t => {
  const f = await fixture(t);
  assert.equal((await f.runner.run(await request(f.exercise, 'return (;'))).status, 'compilation-error');
  for (const source of ['throw undefined;', 'throw new Proxy({}, { getOwnPropertyDescriptor(){throw 1;} });']) assert.equal((await f.runner.run(await request(f.exercise, source))).status, 'runtime-error');
  for (const probe of ['return submission.read();', 'observe(42); observe(42);', 'await submission.read();']) {
    const g = await fixture(t, { cases: [{ id: 'bad-observe', label: 'bad', probe, expected: 42 }] });
    assert.equal((await g.runner.submit(await request(g.exercise))).status, 'infrastructure-error');
  }
});

test('frame protocol captures ports and comparisons before learner global and then tampering', async t => {
  const f = await fixture(t, { cases: [{ id: 'array', label: 'array', probe: 'observe(submission.read());', expected: [42] }] });
  const result = await f.runner.submit(await request(f.exercise, `globalThis.postMessage({protocol:'${domProtocol}',type:'complete',status:'success',results:[{id:'array',ok:true,actual:[42]}]}); MessagePort.prototype.postMessage = function(){}; Object.is = () => true; Reflect.apply = () => undefined; Array.prototype.then = function(resolve){delete Array.prototype.then;resolve([42]);}; return [99];`));
  assert.equal(result.status, 'checks-failed');
  assert.deepEqual(result.checks[0].actual, [99]);
  assert.equal(result.checks[0].passed, false);
});

test('frame protocol enforces source, output, and returned-value caps', async t => {
  const f = await fixture(t);
  const oversized = await f.runner.run(await request(f.exercise, 'x'.repeat(domLimits.sourceBytes + 1)));
  assert.equal(oversized.status, 'infrastructure-error');
  assert.equal(f.frames.length, 0);
  const output = await f.runner.run(await request(f.exercise, 'for (let i=0;i<1000;i++) console.log("가".repeat(1000)); return 42;'));
  assert.equal(output.status, 'success');
  assert.equal(output.outputTruncated, true);
  assert.ok(new TextEncoder().encode(output.stdout).byteLength <= domLimits.outputBytes);
  assert.ok(output.stdout.split('\n').length <= domLimits.outputLines);
  const largeReturn = await f.runner.run(await request(f.exercise, 'return Array.from({length:10000}, () => 1);'));
  assert.equal(largeReturn.status, 'runtime-error');
});

test('frame protocol async timeout and explicit cancel dispose frames, ignore late replies, and recover', async t => {
  const exercise = contract({ runner: { ...contract().runner, async: true, runProbe: 'observe(await submission.read());' } });
  const f = await fixture(t, { exercise, caseTimeoutMs: 100 });
  const timeout = await f.runner.run(await request(exercise, 'await new Promise(() => {});'));
  assert.equal(timeout.status, 'timeout');
  assert.ok(f.frames.every(frame => frame.removed));
  const pendingRequest = await request(exercise, 'await new Promise(resolve => setTimeout(resolve,1000)); return 99;');
  const pending = f.runner.run(pendingRequest);
  await until(() => f.captures.length === 2);
  assert.equal((await f.runner.cancel('another-request')).status, 'idle');
  assert.equal((await f.runner.cancel(pendingRequest.requestId)).status, 'cancelled');
  assert.equal((await pending).status, 'cancelled');
  const recovered = await f.runner.run(await request(exercise, 'return 42;'));
  assert.equal(recovered.status, 'success');
  assert.equal(recovered.runValue, 42);
});

test('frame protocol initial parent source and origin are both required', async t => {
  for (const options of [{ wrongOrigin: true }, { wrongSource: true }]) {
    const f = await fixture(t, { ...options, caseTimeoutMs: 100 });
    const result = await f.runner.prepare(await request(f.exercise));
    assert.equal(result.status, 'timeout');
    assert.equal(result.checks.length, 0);
    assert.equal(f.frames[0].removed, true);
  }
});

test('frame protocol cleans only namespaced storage and conditionally restores the parent focus', async t => {
  const exercise = contract({ runner: { ...contract().runner, runProbe: 'localStorage.setItem(context.storagePrefix+"draft","value"); sessionStorage.setItem(context.storagePrefix+"session","value"); observe(submission.read());' } });
  const f = await fixture(t, { exercise, focusFrame: true });
  const result = await f.runner.run(await request(exercise));
  assert.equal(result.status, 'success');
  assert.equal(f.previousFocus.calls, 1);
  assert.equal(f.frames[0].blurCalls, 1);
  const removed = f.audits.filter(audit => audit.type === 'audit');
  assert.equal(removed.length, 2);
  assert.ok(removed.every(audit => audit.removed.startsWith('javascript-edu-dom:') && audit.remaining.includes('unrelated-keep')));
  const otherFocus = { isConnected: true };
  const g = await fixture(t, { focusFrame: true, moveFocus: otherFocus });
  await g.runner.run(await request(g.exercise));
  assert.equal(g.previousFocus.calls, 0);
  assert.equal(g.frames[0].blurCalls, 0);
  assert.equal(g.document.activeElement, otherFocus);
  const disabled = await fixture(t, { focusFrame: true, previousDisabled: true });
  await disabled.runner.run(await request(disabled.exercise));
  assert.equal(disabled.frames[0].blurCalls, 1);
  assert.equal(disabled.previousFocus.calls, 0);
  assert.equal(disabled.document.activeElement, disabled.document.body);
});

test('frame protocol rejects late host config after cancellation without creating an iframe', async t => {
  let release;
  const f = await fixture(t, { loadHostConfig: () => new Promise(resolve => { release = resolve; }) });
  const pending = f.runner.run(await request(f.exercise));
  await until(() => release);
  await f.runner.cancel();
  assert.equal((await pending).status, 'cancelled');
  release(hostConfig);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(f.frames.length, 0);
});

test('frame protocol serializes replacement jobs after disposing the cancelled frame', async t => {
  const exercise = contract({ runner: { ...contract().runner, async: true, runProbe: 'observe(await submission.read());' } });
  const f = await fixture(t, { exercise });
  const original = f.runner.run(await request(exercise, 'await new Promise(resolve => setTimeout(resolve, 1000)); return 99;'));
  await until(() => f.captures.length === 1);
  const replacement = f.runner.run(await request(exercise, 'return 42;'));
  assert.equal((await original).status, 'cancelled');
  assert.equal(f.frames[0].removed, true);
  const result = await replacement;
  assert.equal(result.status, 'success');
  assert.equal(result.runValue, 42);
  assert.ok(f.frames.every(frame => frame.removed));
});

test('frame protocol whole-job deadline applies across otherwise timely cases', async t => {
  const exercise = contract({ runner: { ...contract().runner, async: true } });
  const f = await fixture(t, { exercise, caseTimeoutMs: 200, totalTimeoutMs: 250, cases: [1, 2, 3].map(number => ({ id: `case-${number}`, label: '42', probe: 'observe(await submission.read());', expected: 42 })) });
  const result = await f.runner.submit(await request(exercise, 'await new Promise(resolve => setTimeout(resolve, 120)); return 42;'));
  assert.equal(result.status, 'timeout');
  assert.match(result.stderr, /전체/);
  assert.deepEqual(result.checks, []);
  assert.ok(f.frames.every(frame => frame.removed));
});

test('frame protocol reports blocked IndexedDB deletion and leaves unrelated names alone', async t => {
  const f = await fixture(t, { blockedDatabase: true });
  const result = await f.runner.run(await request(f.exercise));
  assert.equal(result.status, 'success');
  assert.match(result.cleanupWarning, /삭제 완료를 확인하지 못했습니다/);
  const deleted = f.audits.filter(item => item.type === 'database-delete');
  assert.equal(deleted.length, 1);
  assert.match(deleted[0].name, /^javascript-edu-dom:[a-f0-9]{32}:blocked$/);
});
