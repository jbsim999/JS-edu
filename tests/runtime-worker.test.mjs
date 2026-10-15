import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Worker as ThreadWorker, MessageChannel } from 'node:worker_threads';
import { createBrowserRunner, fingerprintSource } from '../web/execution/browser-runner.mjs';
import { equalBehaviorValue, gradeWorkerResults, isBehaviorValue, missingRequiredFeatures, validateExercise, validateGrader } from '../web/execution/protocol.mjs';

// Runs the real worker script on an isolated Node worker thread for protocol/behavior tests.
// This bridge does not emulate browser CSP or prove OS security isolation.
class WorkerBridge {
  constructor(url, { removeFeatures = [], realmSetup = '' } = {}) {
    this.featureGetterReads = 0;
    this.thread = new ThreadWorker(`
      const { parentPort, workerData, MessagePort } = require('node:worker_threads');
      globalThis.self = globalThis;
      globalThis.MessagePort = MessagePort;
      const listeners = new Map();
      globalThis.addEventListener = (type, handler) => {
        if (type !== 'message') return;
        const listener = message => handler({ data: message.data, ports: message.ports });
        listeners.set(handler, listener);
        parentPort.on('message', listener);
      };
      globalThis.removeEventListener = (type, handler) => {
        if (type === 'message') parentPort.off('message', listeners.get(handler));
      };
      globalThis.postMessage = data => parentPort.postMessage(data);
      for (const path of workerData.removeFeatures) {
        const parts = path.split('.');
        let value = globalThis;
        for (let i = 0; i < parts.length - 1; i++) value = value[parts[i]];
        delete value[parts.at(-1)];
      }
      new Function('parentPort', workerData.realmSetup)(parentPort);
      new Function(workerData.source)();
    `, { eval: true, workerData: { source: readFileSync(url, 'utf8'), removeFeatures, realmSetup } });
    this.thread.on('message', data => { if (data?.type === 'feature-getter-read') this.featureGetterReads++; this.onmessage?.({ data }); });
    this.thread.on('error', error => this.onerror?.({ message: error.message, preventDefault() {} }));
  }
  postMessage(data, ports) { this.thread.postMessage({ data, ports }, ports); }
  terminate() { void this.thread.terminate(); }
}

const grader = JSON.parse(readFileSync(new URL('../curriculum/checks/independent-counter.json', import.meta.url), 'utf8'));
const catalogExercise = JSON.parse(readFileSync(new URL('../curriculum/exercises.json', import.meta.url), 'utf8')).exercises.find(exercise => exercise.id === grader.exerciseId);
const exercise = { ...catalogExercise, contentRevision: grader.contentRevision };
const reference = 'let count = initial; return () => ++count;';
const runner = options => createBrowserRunner({ exercises: [exercise], loadGrader: async () => grader, WorkerConstructor: WorkerBridge, MessageChannelConstructor: MessageChannel, ...options });
let sequence = 0;
async function payload(source, other = {}) {
  return { requestId: `request-${++sequence}`, lessonId: exercise.lessonId, exerciseId: exercise.id, contentRevision: exercise.contentRevision, source, sourceFingerprint: await fingerprintSource(source), targetVersion: 'ES2026', ...other };
}

test('parent comparison preserves numeric identity, object keys, sparse arrays and type differences', () => {
  assert.equal(equalBehaviorValue(NaN, NaN), true);
  assert.equal(equalBehaviorValue(-0, 0), false);
  assert.equal(equalBehaviorValue({ a: [1, null] }, { a: [1, null] }), true);
  assert.equal(equalBehaviorValue({ a: undefined }, {}), false);
  assert.equal(equalBehaviorValue([, 1], [undefined, 1]), false);
  assert.equal(equalBehaviorValue({ 0: 1 }, [1]), false);
  assert.equal(isBehaviorValue(new Date()), false);
  assert.equal(isBehaviorValue({ get value() { throw new Error('should not run'); } }), false);
  const cycle = {}; cycle.self = cycle;
  assert.equal(isBehaviorValue(cycle), false);
});

test('zero checks, duplicate IDs, mismatched revisions, count and result-type forgery are rejected', () => {
  assert.throws(() => validateGrader({ ...grader, cases: [] }, exercise));
  assert.throws(() => validateGrader({ ...grader, cases: [grader.cases[0], grader.cases[0]] }, exercise));
  assert.throws(() => validateGrader({ ...grader, contentRevision: 'old' }, exercise));
  assert.throws(() => validateGrader({ ...grader, graderRevision: 'old' }, exercise));
  assert.throws(() => gradeWorkerResults({ type: 'complete', status: 'success', results: [] }, grader.cases));
  assert.throws(() => gradeWorkerResults({ type: 'complete', status: 'success', results: [{ id: 'forged-id', ok: true, actual: true }] }, [grader.cases[0]]));
  assert.throws(() => gradeWorkerResults({ type: 'complete', status: 'success', results: [{ id: grader.cases[0].id, ok: 'true', actual: true }] }, [grader.cases[0]]));
  assert.throws(() => gradeWorkerResults({ type: 'complete', status: 'success', results: [{ id: grader.cases[0].id, ok: true, actual: () => true }] }, [grader.cases[0]]));
});

test('prepare checks the real worker boot and eval; run executes the fixed sample without grading', async () => {
  const adapter = runner();
  const request = await payload(reference);
  const ready = await adapter.prepare(request);
  assert.equal(ready.status, 'ready', ready.stderr);
  assert.deepEqual(ready.checks, []);
  const result = await adapter.run(request);
  assert.equal(result.status, 'success', result.stderr);
  assert.equal(result.sourceFingerprint, request.sourceFingerprint);
  assert.equal(result.stdout, '1 2 11 3');
  assert.deepEqual(result.runValue, [1, 2, 11, 3]);
  assert.deepEqual(result.checks, []);
  assert.equal(result.environmentFingerprint, (await adapter.getEnvironment()).environmentFingerprint);
});

test('real reference passes default, zero, negative, fractional and independent-instance behavior', async () => {
  const result = await runner().submit(await payload(reference));
  assert.equal(result.status, 'success', result.stderr);
  assert.equal(result.checks.length, grader.cases.length);
  assert.equal(result.checks.every(check => check.passed), true);
});

test('strict outer compilation supports async, default parameters and rest parameters together', async () => {
  const contract = { ...exercise, runner: { kind: 'function-body', exportName: 'collect', parameters: ['values', 'options = {}', '...labels'], async: true } };
  const asyncGrader = { ...grader, cases: [{ id: 'async-default-rest', label: 'async/default/rest', probe: 'observe(await submission.collect([1, 2], { scale: 3 }, "a", "b"));', expected: { total: 9, labels: ['a', 'b'] } }] };
  const adapter = runner({ exercises: [contract], loadGrader: async () => asyncGrader });
  const result = await adapter.submit(await payload('await Promise.resolve(); return { total: values.reduce((sum, value) => sum + value, 0) * options.scale, labels };'));
  assert.equal(result.status, 'success', result.stderr || result.compilerOutput);
  assert.equal(result.checks[0].passed, true);
});

test('declared generator and async-generator contracts retain yield semantics', async () => {
  for (const asynchronous of [false, true]) {
    const contract = { ...exercise, runner: { kind: 'function-body', exportName: 'generate', parameters: ['initial = 2'], generator: true, async: asynchronous } };
    const generatorGrader = { ...grader, cases: [{ id: 'generator', label: 'generator', probe: 'const values = []; for await (const value of submission.generate()) values.push(value); observe(values);', expected: [2, 3] }] };
    const adapter = runner({ exercises: [contract], loadGrader: async () => generatorGrader });
    const result = await adapter.submit(await payload(`${asynchronous ? 'await Promise.resolve();' : ''} yield initial; yield initial + 1;`));
    assert.equal(result.status, 'success', result.stderr || result.compilerOutput);
  }
});

test('wrong behavior and counterfeit public postMessage/Object.is/MessagePort methods do not pass', async () => {
  const source = `
    self.postMessage({ protocol: 'javascript-edu-worker-v1', type: 'complete', status: 'success', checks: [{ passed: true }] });
    Object.is = () => true;
    MessagePort.prototype.postMessage = () => {};
    Reflect.apply = () => 'forged';
    return () => 99;
  `;
  const result = await runner().submit(await payload(source));
  assert.equal(result.status, 'checks-failed', result.stderr);
  assert.ok(result.checks.some(check => !check.passed));
  assert.deepEqual(result.checks.find(check => check.id === 'default-increments').actual, [99, 99, 99]);
});

test('learner Array.prototype.then cannot replace fixed probe observations with expected answers', async () => {
  const source = `
    const expected = [[1,2,3],[1,2],[11,12],[-2,-1,0],[2.5,3.5],[1,11,-1,2,12,0]];
    globalThis.calls = (globalThis.calls || 0) + 1;
    Array.prototype.then = function(resolve) {
      delete Array.prototype.then;
      resolve(expected[globalThis.calls >= 7 ? 5 : globalThis.calls - 2]);
    };
    return () => 99;
  `;
  const result = await runner().submit(await payload(source));
  assert.equal(result.status, 'checks-failed', result.stderr);
  assert.deepEqual(result.checks.find(check => check.id === 'default-increments').actual, [99, 99, 99]);
});

test('syntax and runtime errors are distinguishable and do not claim behavior success', async () => {
  const adapter = runner();
  const invalid = await adapter.run(await payload('let = ;'));
  assert.equal(invalid.status, 'compilation-error');
  assert.ok(invalid.compilerOutput.length > 0);
  const failed = await adapter.run(await payload('throw new Error("counter failed");'));
  assert.equal(failed.status, 'runtime-error');
  assert.match(failed.stderr, /counter failed/);
  const submitted = await adapter.submit(await payload('throw new Error("counter failed");'));
  assert.equal(submitted.status, 'checks-failed');
  assert.ok(submitted.checks.every(check => !check.passed && check.error));
  for (const source of ['throw undefined;', 'throw null;', 'throw "";', 'throw new Error("");']) {
    const result = await adapter.run(await payload(source));
    assert.equal(result.status, 'runtime-error', result.stderr);
  }
});

test('missing, duplicate, and return-value probe observations are infrastructure failures', async () => {
  for (const probe of ['submission.createCounter();', 'observe(1); observe(2);', 'observe(1); return 1;']) {
    const invalidGrader = { ...grader, cases: [{ id: 'invalid-observer', label: 'invalid observer', probe, expected: 1 }] };
    const result = await runner({ loadGrader: async () => invalidGrader }).submit(await payload(reference));
    assert.equal(result.status, 'infrastructure-error', result.stderr);
    assert.deepEqual(result.checks, []);
  }
});

test('infinite loops time out and a subsequent worker still succeeds', async () => {
  const adapter = runner({ timeoutMs: 700 });
  const result = await adapter.run(await payload('while (true) {}'));
  assert.equal(result.status, 'timeout');
  assert.deepEqual(result.checks, []);
  const after = await adapter.run(await payload(reference));
  assert.equal(after.status, 'success', after.stderr);
});

test('cancel and replacement settle once, and late grader loads cannot launch an obsolete request', async () => {
  let resolveFirst;
  let calls = 0;
  const adapter = runner({ loadGrader: async () => ++calls === 1 ? new Promise(resolve => { resolveFirst = resolve; }) : grader });
  const firstRequest = await payload(reference);
  const firstPromise = adapter.submit(firstRequest);
  assert.deepEqual(await adapter.cancel('unrelated'), { status: 'idle' });
  const secondPromise = adapter.run(await payload(reference));
  assert.equal((await firstPromise).status, 'cancelled');
  resolveFirst(grader);
  assert.equal((await secondPromise).status, 'success');
  const loopingRequest = await payload('while (true) {}');
  const looping = adapter.run(loopingRequest);
  assert.equal((await adapter.cancel(loopingRequest.requestId)).status, 'cancelled');
  assert.equal((await looping).status, 'cancelled');
  assert.deepEqual(await adapter.cancel(), { status: 'idle' });
});

test('stdout bounds include UTF-8, multiline output and separators', async () => {
  const adapter = runner();
  const manyLines = await adapter.run(await payload(`for (let i = 0; i < 500; i++) console.log('line', i); ${reference}`));
  assert.equal(manyLines.status, 'success', manyLines.stderr);
  assert.equal(manyLines.outputTruncated, true);
  assert.ok(manyLines.stdout.split('\n').length <= 200);
  const unicode = await adapter.run(await payload(`console.log('한'.repeat(100000)); ${reference}`));
  assert.equal(unicode.status, 'success', unicode.stderr);
  assert.equal(unicode.outputTruncated, true);
  assert.ok(new TextEncoder().encode(unicode.stdout).byteLength <= 65536);
});

test('oversized, cyclic and accessor observation values fail without sending unbounded results', async () => {
  for (const source of ['return () => "x".repeat(70000);', 'return () => { const x = {}; x.x = x; return x; };', 'return () => ({ get bad() { throw new Error("getter"); } });']) {
    const result = await runner().run(await payload(source));
    assert.equal(result.status, 'runtime-error', result.stderr);
  }
});

test('invalid and unavailable requests fail before executing learner code', async () => {
  const adapter = runner();
  assert.equal((await adapter.run(await payload(reference, { contentRevision: 'old' }))).status, 'infrastructure-error');
  assert.equal((await adapter.run(await payload('한'.repeat(40000)))).status, 'infrastructure-error');
  assert.equal((await runner({ loadGrader: async () => ({ ...grader, cases: [] }) }).submit(await payload(reference))).status, 'infrastructure-error');
  const unavailable = runner({ WorkerConstructor: null });
  assert.equal((await unavailable.getEnvironment()).available, false);
  assert.equal((await unavailable.run(await payload(reference))).status, 'infrastructure-error');
});

test('fixed grader paths resolve from the root even on a nested qualification route', async () => {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const previousFetch = globalThis.fetch;
  const urls = [];
  try {
    Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('http://127.0.0.1:4182/execution/qualification.html') });
    globalThis.fetch = async url => { urls.push(String(url)); return { ok: true, text: async () => JSON.stringify(grader) }; };
    const result = await runner({ loadGrader: undefined }).submit(await payload(reference));
    assert.equal(result.status, 'success', result.stderr);
    assert.deepEqual(urls, ['http://127.0.0.1:4182/curriculum/checks/independent-counter.json']);
    const invalid = await runner({ loadGrader: undefined, exercises: [{ ...exercise, graderFile: 'https://example.test/grader.json' }] }).submit(await payload(reference));
    assert.equal(invalid.status, 'infrastructure-error');
    assert.equal(urls.length, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousLocation) Object.defineProperty(globalThis, 'location', previousLocation);
    else delete globalThis.location;
  }
});

test('required feature paths resolve callable APIs without evaluating getters or expressions', () => {
  let getterRead = false;
  const realm = { Intl: { Segmenter() {}, NumberFormat: function NumberFormat() {} }, get unsafe() { getterRead = true; return () => {}; } };
  realm.Intl.NumberFormat.prototype.formatToParts = function formatToParts() {};
  assert.deepEqual(missingRequiredFeatures(['Intl.Segmenter', 'Intl.NumberFormat.prototype.formatToParts', 'Intl.DateTimeFormat.prototype.formatToParts', 'unsafe'], realm), ['Intl.DateTimeFormat.prototype.formatToParts', 'unsafe']);
  assert.equal(getterRead, false);
  for (const requiredFeatures of [['Intl.Segmenter()'], ['Intl.Segmenter', 'Intl.Segmenter'], ['Intl.__proto__.toString'], 'Intl.Segmenter']) assert.throws(() => validateExercise({ ...exercise, requiredFeatures }));
});

test('required APIs may be inherited, but shadowing accessors are never read and lookup is bounded', () => {
  let getterReads = 0;
  let functionCalls = 0;
  const inherited = { callable() { functionCalls++; }, namespace: Object.create({ nested() { functionCalls++; } }) };
  Object.defineProperty(inherited, 'inheritedGetter', { get() { getterReads++; return () => {}; } });
  const realm = Object.create(inherited);
  Object.defineProperty(realm, 'ownGetter', { get() { getterReads++; return () => {}; } });
  Object.defineProperty(realm, 'callable', { get() { getterReads++; return () => {}; } });
  assert.deepEqual(missingRequiredFeatures(['namespace.nested', 'inheritedGetter', 'ownGetter', 'callable'], realm), ['inheritedGetter', 'ownGetter', 'callable']);
  assert.equal(getterReads, 0);
  assert.equal(functionCalls, 0);
  let atLimit = { callable() { functionCalls++; } };
  for (let depth = 0; depth < 15; depth++) atLimit = Object.create(atLimit);
  assert.deepEqual(missingRequiredFeatures(['callable'], atLimit), []);
  assert.deepEqual(missingRequiredFeatures(['callable'], Object.create(atLimit)), ['callable']);
  assert.deepEqual(missingRequiredFeatures(['callable'], new Proxy({}, { getPrototypeOf() { throw new Error('unreadable'); } })), ['callable']);
  assert.equal(functionCalls, 0);
});

test('real Node worker bridge supports native timer APIs moved onto its global prototype', async () => {
  class InheritedWorkerFeatures extends WorkerBridge {
    constructor(url) {
      super(url, { realmSetup: `const prototype = Object.create(Object.getPrototypeOf(globalThis));
        for (const name of ['setTimeout', 'queueMicrotask']) { Object.defineProperty(prototype, name, Object.getOwnPropertyDescriptor(globalThis, name)); delete globalThis[name]; }
        Object.setPrototypeOf(globalThis, prototype);` });
    }
  }
  const adapter = runner({ exercises: [{ ...exercise, requiredFeatures: ['setTimeout', 'queueMicrotask'] }], WorkerConstructor: InheritedWorkerFeatures });
  assert.equal((await adapter.getEnvironment()).available, true);
  assert.equal((await adapter.prepare(await payload(reference))).status, 'ready');
  assert.equal((await adapter.run(await payload(reference))).status, 'success');
  assert.equal((await adapter.submit(await payload(reference))).status, 'success');
});

test('real Node worker preflight rejects own and inherited API getters without invoking them or learner code', async () => {
  for (const inherited of [false, true]) {
    const workers = [];
    class GetterWorkerFeature extends WorkerBridge {
      constructor(url) {
        super(url, { realmSetup: `const prototype = Object.create(Object.getPrototypeOf(globalThis));
          delete globalThis.queueMicrotask;
          Object.defineProperty(${inherited ? 'prototype' : 'globalThis'}, 'queueMicrotask', {get() { parentPort.postMessage({type:'feature-getter-read'}); return () => {}; }});
          Object.setPrototypeOf(globalThis, prototype);` });
        workers.push(this);
      }
    }
    const adapter = runner({ exercises: [{ ...exercise, requiredFeatures: ['queueMicrotask'] }], WorkerConstructor: GetterWorkerFeature });
    const result = await adapter.submit(await payload('throw new Error("must never execute");'));
    assert.equal(result.status, 'infrastructure-error');
    assert.deepEqual(result.missingFeatures, ['queueMicrotask']);
    assert.doesNotMatch(result.stderr, /must never execute/);
    assert.equal(workers[0].featureGetterReads, 0);
  }
});

test('missing declared features are environment failures before preparation, execution, grading or grader loading', async () => {
  let graderLoads = 0;
  const missingPath = 'Intl.QualificationMissingFeature';
  const adapter = runner({ exercises: [{ ...exercise, requiredFeatures: [missingPath] }], loadGrader: async () => { graderLoads++; return grader; } });
  const environment = await adapter.getEnvironment({ exerciseId: exercise.id });
  assert.equal(environment.available, false);
  assert.deepEqual(environment.missingFeatures, [missingPath]);
  assert.match(environment.reason, /Intl\.QualificationMissingFeature/);
  assert.equal((await adapter.getEnvironment()).available, false);
  for (const mode of ['prepare', 'run', 'submit']) {
    const result = await adapter[mode](await payload('throw new Error("must never execute");'));
    assert.equal(result.status, 'infrastructure-error');
    assert.equal(result.available, false);
    assert.deepEqual(result.checks, []);
    assert.deepEqual(result.missingFeatures, [missingPath]);
    assert.match(result.reason, /Intl\.QualificationMissingFeature/);
    assert.doesNotMatch(result.stderr, /must never execute/);
  }
  assert.equal(graderLoads, 0);
});

test('real worker preflight catches a feature missing only in its own realm', async () => {
  class MissingWorkerFeature extends WorkerBridge {
    constructor(url) { super(url, { removeFeatures: ['Intl.Segmenter'] }); }
  }
  const adapter = runner({ exercises: [{ ...exercise, requiredFeatures: ['Intl.Segmenter'] }], WorkerConstructor: MissingWorkerFeature });
  assert.equal((await adapter.getEnvironment({ exerciseId: exercise.id })).available, true);
  for (const mode of ['prepare', 'run', 'submit']) {
    const result = await adapter[mode](await payload('throw new Error("must never execute");'));
    assert.equal(result.status, 'infrastructure-error');
    assert.equal(result.available, false);
    assert.deepEqual(result.checks, []);
    assert.deepEqual(result.missingFeatures, ['Intl.Segmenter']);
    assert.match(result.reason, /Worker.*Intl\.Segmenter/);
    assert.doesNotMatch(result.stderr, /must never execute/);
  }
});

test('supported Intl feature prerequisites preserve the reference behavior and exercise-specific availability', async () => {
  const requiredFeatures = ['Intl.Segmenter', 'Intl.DateTimeFormat.prototype.formatToParts', 'Intl.NumberFormat.prototype.formatToParts'];
  const supported = { ...exercise, requiredFeatures };
  const unsupported = { ...exercise, id: 'unsupported-exercise', requiredFeatures: ['Intl.QualificationMissingFeature'] };
  const adapter = runner({ exercises: [supported, unsupported] });
  const environment = await adapter.getEnvironment();
  assert.equal(environment.available, true);
  assert.equal(environment.exerciseAvailability[exercise.id].available, true);
  assert.equal(environment.exerciseAvailability[unsupported.id].available, false);
  assert.deepEqual((await adapter.getEnvironment(exercise.id)).missingFeatures, []);
  assert.equal((await adapter.getEnvironment({ exerciseId: 'unknown-exercise' })).available, false);
  const result = await adapter.submit(await payload(reference));
  assert.equal(result.status, 'success', result.stderr);
  assert.equal(result.checks.every(check => check.passed), true);
});
