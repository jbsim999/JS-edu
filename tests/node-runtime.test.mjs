import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import childProcess, { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { PassThrough } from 'node:stream';
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import filesystem from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Worker, MessageChannel } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { createNodeExecution } from '../web/server/node-execution.mjs';
import { createNodeRunner, fingerprintSource, serializeNodeSource } from '../web/execution/node-runner.mjs';
import { decodeNodeValue, encodeNodeValue, nodeLimits, validateNodeSnapshot } from '../runtime/node-contract.mjs';
import { createExecutionState } from '../web/features/execution-state.mjs';

const executable = process.env.JS_EDU_NODE_EXECUTABLE ? path.resolve(process.env.JS_EDU_NODE_EXECUTABLE) : process.execPath;
const runtimeHost = JSON.parse(execFileSync(executable, ['--eval', 'console.log(JSON.stringify({version:process.versions.node,platform:process.platform,architecture:process.arch}))'], { encoding: 'utf8', windowsHide: true }));
const version = runtimeHost.version;
const contract = (files = { 'main.mjs': 'export function read() { return 42; }' }, extra = {}) => ({ id: 'node-fixture', lessonId: 'node-fixture', contentRevision: 'node-1', graderRevision: 'node-checks-1', profileByVersion: { ES2026: 'node-native' }, hostRequirements: ['node-native'],
  runner: { kind: 'module-files', entry: 'main.mjs', runProbe: 'const value = await submission.read(context.workspaceRoot); console.log(value); observe(value);' }, workspace: { entry: 'main.mjs', files: Object.entries(files).map(([file, source]) => ({ path: file, source, editable: file === 'main.mjs' })) }, ...extra });
const grader = (exercise, cases = [{ id: 'value', label: '42', probe: 'observe(await submission.read(context.workspaceRoot));', expected: 42 }]) => ({ exerciseId: exercise.id, contentRevision: exercise.contentRevision, graderRevision: exercise.graderRevision, cases });
let sequence = 0;
async function request(exercise, files = Object.fromEntries(exercise.workspace.files.map(file => [file.path, file.source])), consent = true) {
  const source = serializeNodeSource({ entry: exercise.runner.entry, files });
  return { requestId: `node-request-${++sequence}`, lessonId: exercise.lessonId, exerciseId: exercise.id, contentRevision: exercise.contentRevision, sourceFingerprint: await fingerprintSource(source), targetVersion: 'ES2026', source, consent };
}
const apiRequest = payload => Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'consent'));

async function fixture(t, exercise = contract(), options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'javascript-edu-node-api-test-'));
  let workspaceParent = root;
  if (options.workspaceParentAlias) {
    await mkdir(path.join(root, 'canonical'));
    workspaceParent = path.join(root, 'alias');
    await symlink(path.join(root, 'canonical'), workspaceParent, process.platform === 'win32' ? 'junction' : 'dir');
  }
  const provider = createNodeExecution({ executable, expectedVersion: options.expectedVersion ?? version, exercises: [exercise], loadGrader: options.loadGrader ?? (async () => grader(exercise, options.cases)), workspaceParent, caseTimeoutMs: options.caseTimeoutMs, totalTimeoutMs: options.totalTimeoutMs });
  let origin;
  const server = createServer((req, res) => { void provider.handle(req, res, origin).then(handled => { if (!handled) { res.writeHead(404); res.end('Not found'); } }).catch(error => { res.writeHead(500); res.end(error.message); }); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  const nativeFetch = (url, init = {}) => fetch(url, { ...init, headers: { ...(init.method && init.method !== 'GET' ? { Origin: origin } : {}), ...init.headers } });
  const fetcher = options.wrapFetch ? options.wrapFetch(nativeFetch) : nativeFetch;
  const runner = createNodeRunner({ exercises: [options.clientExercise ?? exercise], fetcher, origin, getConsent: options.getConsent });
  t.after(async () => {
    await runner.cancel();
    await provider.close();
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    const relative = path.relative(tmpdir(), root);
    assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(root).startsWith('javascript-edu-node-api-test-'));
    await rm(root, { recursive: true, force: true });
  });
  const config = () => fetch(`${origin}/_node/config`).then(response => response.json());
  const post = async (mode, payload, extra = {}) => {
    const environment = await config();
    return fetch(`${origin}/_node/jobs`, { method: 'POST', headers: { Origin: origin, 'X-Execution-Token': environment.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, request: apiRequest(payload), consent: payload.consent, ...extra }) });
  };
  const assertClean = async () => {
    for (const directory of await readdir(root)) if (directory.startsWith('javascript-edu-node-')) assert.deepEqual(await readdir(path.join(root, directory)), []);
  };
  return { root, workspaceParent, provider, origin, runner, config, post, assertClean };
}

test(`Node ${version}: real fixed binary prepares, runs, submits, and removes job files`, async t => {
  const exercise = contract();
  const f = await fixture(t, exercise);
  const environment = await f.runner.getEnvironment();
  assert.equal(environment.available, true, environment.reason);
  assert.match(environment.actualRuntime, new RegExp(version.replaceAll('.', '\\.')));
  assert.equal(environment.platform, runtimeHost.platform);
  assert.equal(environment.architecture, runtimeHost.architecture);
  assert.ok(environment.actualRuntime.includes(`${runtimeHost.platform}/${runtimeHost.architecture}`));
  assert.equal(environment.limits.hardMemoryLimit, false);
  assert.equal(environment.limits.networkRestricted, false);
  const prepared = await f.runner.prepare(await request(exercise, { 'main.mjs': 'throw new Error("must not execute");' }, false));
  assert.equal(prepared.status, 'ready', prepared.stderr);
  const run = await f.runner.run(await request(exercise));
  assert.equal(run.status, 'success', run.stderr);
  assert.equal(run.runValue, 42);
  assert.match(run.stdout, /42/);
  assert.deepEqual(run.checks, []);
  const submitted = await f.runner.submit(await request(exercise));
  assert.equal(submitted.status, 'success', submitted.stderr);
  assert.equal(submitted.checks[0].passed, true);
  assert.equal(submitted.environmentFingerprint, environment.environmentFingerprint);
  await f.assertClean();
});

test('Node prepare and run do not load a missing grader; only submission needs it', async t => {
  const exercise = contract();
  let graderLoads = 0;
  const f = await fixture(t, exercise, { loadGrader: async () => {
    graderLoads++;
    throw new Error('Fixed grader is unavailable');
  } });
  const prepared = await f.runner.prepare(await request(exercise, { 'main.mjs': 'throw new Error("must not import");' }, false));
  assert.equal(prepared.status, 'ready', prepared.stderr);
  const run = await f.runner.run(await request(exercise));
  assert.equal(run.status, 'success', run.stderr);
  assert.equal(run.runValue, 42);
  assert.deepEqual(run.checks, []);
  assert.equal(graderLoads, 0);
  const submitted = await f.runner.submit(await request(exercise));
  assert.equal(submitted.status, 'infrastructure-error');
  assert.deepEqual(submitted.checks, []);
  assert.equal(graderLoads, 1);
  await f.assertClean();
});

test('Node modules require an independent run observation without a grader fallback', () => {
  const exercise = contract();
  delete exercise.runner.runProbe;
  assert.throws(() => createNodeExecution({ executable, expectedVersion: version, exercises: [exercise] }), /실행 관찰/);
});

test('Node phases share one lifecycle ID and cache each result without changing its code snapshot', async t => {
  const exercise = contract();
  let graderLoads = 0;
  const f = await fixture(t, exercise, { loadGrader: async () => { graderLoads++; return grader(exercise); } });
  const payload = await request(exercise);
  assert.equal((await f.runner.prepare(payload)).status, 'ready');
  const run = await f.runner.run(payload);
  assert.equal(run.status, 'success', run.stderr);
  assert.equal(run.runValue, 42);
  const submitted = await f.runner.submit(payload);
  assert.equal(submitted.status, 'success', submitted.stderr);
  assert.equal(submitted.checks[0].passed, true);
  assert.equal((await f.runner.submit(payload)).status, 'success');
  assert.equal(graderLoads, 1, 'The same completed submission must not execute again');
  const changed = { ...await request(exercise, { 'main.mjs': 'export function read(){return 99;}' }), requestId: payload.requestId };
  assert.equal((await f.post('run', changed)).status, 409);
  await f.assertClean();
});

test('Node runner works through the real UI execution state prepare-to-submit contract', async t => {
  const exercise = contract();
  const f = await fixture(t, exercise, { getConsent: () => true });
  const source = (await request(exercise)).source;
  const context = { lessonId: exercise.lessonId, exerciseId: exercise.id, contentRevision: exercise.contentRevision, targetVersion: 'ES2026' };
  const accepted = [];
  const state = createExecutionState({ runner: f.runner, fingerprintSource, onResult: result => accepted.push(result) });
  const run = await state.start('run', context, source);
  assert.equal(run.status, 'success', run.stderr);
  const submitted = await state.start('submit', context, source);
  assert.equal(submitted.status, 'success', submitted.stderr);
  assert.equal(submitted.checks[0].passed, true);
  assert.deepEqual(accepted.map(result => result.kind), ['run', 'submit']);
  await f.assertClean();
});

test('Node client refuses a result produced by a different grader revision', async t => {
  const exercise = contract();
  const clientExercise = { ...exercise, graderRevision: 'client-older-checks' };
  const f = await fixture(t, exercise, { clientExercise });
  const result = await f.runner.submit(await request(clientExercise));
  assert.equal(result.status, 'infrastructure-error');
  assert.match(result.stderr, /식별자/);
  assert.deepEqual(result.checks, []);
  await f.assertClean();
});

test('Node manifests allow fixed CJS and JSON while refusing edits, aliases and reserved paths', () => {
  const exercise = contract({ 'main.mjs': 'export const value=1;', 'package.json': '{"type":"module"}', 'legacy.cjs': 'module.exports=42;' });
  const files = Object.fromEntries(exercise.workspace.files.map(file => [file.path, file.source]));
  assert.equal(validateNodeSnapshot(exercise, serializeNodeSource({ entry: 'main.mjs', files })).entry, 'main.mjs');
  assert.throws(() => validateNodeSnapshot(exercise, serializeNodeSource({ entry: 'main.mjs', files: { ...files, 'legacy.cjs': 'changed' } })), /읽기 전용/);
  for (const name of ['../bad.mjs', '__edu_bridge__.mjs', 'NUL.json', 'x.txt']) {
    const invalid = contract({ 'main.mjs': '', [name]: '' });
    assert.throws(() => validateNodeSnapshot(invalid, serializeNodeSource({ entry: 'main.mjs', files: { 'main.mjs': '', [name]: '' } })));
  }
  const collision = contract({ 'main.mjs': '', 'helper.mjs': '', 'HELPER.mjs': '' });
  assert.throws(() => validateNodeSnapshot(collision, serializeNodeSource({ entry: 'main.mjs', files: Object.fromEntries(collision.workspace.files.map(file => [file.path, file.source])) })));
});

test('Node observation codec preserves special numbers, undefined, holes and object keys', () => {
  const original = { length: 2, a: undefined, numbers: [-0, NaN, Infinity, -Infinity], sparse: [, 1], __jsEduValue: 'user field' };
  const value = decodeNodeValue(encodeNodeValue(original));
  assert.equal(value.length, 2);
  assert.equal(Object.hasOwn(value, 'a'), true);
  assert.equal(Object.is(value.numbers[0], -0), true);
  assert.equal(Number.isNaN(value.numbers[1]), true);
  assert.equal(value.numbers[2], Infinity);
  assert.equal(Object.hasOwn(value.sparse, '0'), false);
  assert.equal(value.__jsEduValue, 'user field');
});

test('Node API requires exact Origin, token, user consent, code fingerprint and supported runtime', async t => {
  const exercise = contract();
  const f = await fixture(t, exercise);
  const config = await f.config();
  const payload = await request(exercise);
  const body = JSON.stringify({ mode: 'submit', request: apiRequest(payload), consent: true });
  for (const headers of [{ Origin: 'https://example.com', 'X-Execution-Token': config.token }, { Origin: f.origin, 'X-Execution-Token': 'wrong' }, { 'X-Execution-Token': config.token }]) assert.equal((await fetch(`${f.origin}/_node/jobs`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body })).status, 403);
  assert.equal((await f.post('submit', { ...payload, consent: false })).status, 403);
  assert.equal((await f.post('submit', { ...payload, sourceFingerprint: 'sha256:forged' })).status, 400);
  const refused = await f.runner.run(await request(exercise, undefined, false));
  assert.equal(refused.status, 'infrastructure-error');
  assert.equal(refused.consentRequired, true);
  assert.equal((await fetch(`${f.origin}/reference/node-fixture.mjs`)).status, 404);
  await f.assertClean();
  const mismatch = await fixture(t, exercise, { expectedVersion: '99.0.0' });
  const unavailable = await mismatch.runner.getEnvironment();
  assert.equal(unavailable.available, false);
  assert.match(unavailable.reason, /99\.0\.0/);
});

test('Node native imports, CJS, top-level await, fs and streams work in the data workspace', async t => {
  const exercise = contract({
    'main.mjs': `import legacy from './legacy.cjs'; import {writeFile,readFile} from 'node:fs/promises'; import {createReadStream} from 'node:fs'; import {join} from 'node:path'; await Promise.resolve(); export async function read(root) { const file=join(root,'rows.txt'); await writeFile(file,'a\\nb'); let text=''; for await(const chunk of createReadStream(file,{highWaterMark:1,encoding:'utf8'})) text+=chunk; return [legacy,text,await readFile(file,'utf8')]; }`,
    'legacy.cjs': 'module.exports=42;', 'package.json': '{"type":"module"}',
  });
  const f = await fixture(t, exercise, { cases: [{ id: 'native', label: 'files and stream', probe: 'observe(await submission.read(context.workspaceRoot));', expected: [42, 'a\nb', 'a\nb'] }] });
  const result = await f.runner.submit(await request(exercise));
  assert.equal(result.status, 'success', result.stderr);
  await f.assertClean();
});

test('Node workspace aliases use canonical paths for permission grants and cleanup', async t => {
  const exercise = contract({ 'main.mjs': `import {realpath,writeFile,readFile} from 'node:fs/promises'; import {join} from 'node:path'; export async function read(root){const directory=await realpath(root);const file=join(directory,'note.txt');await writeFile(file,'42');return Number(await readFile(file,'utf8'));}` });
  const f = await fixture(t, exercise, { workspaceParentAlias: true });
  const result = await f.runner.submit(await request(exercise));
  assert.equal(result.status, 'success', result.stderr + JSON.stringify(result.checks));
  await f.provider.close();
  assert.deepEqual(await readdir(path.join(f.root, 'canonical')), []);
});

test('trusted Node bootstrap remains alive until its parent terminates it after private completion', { timeout: 5000 }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'javascript-edu-bootstrap-test-'));
  const bridge = path.join(root, 'bridge.mjs');
  await writeFile(bridge, 'export const submission = {};');
  const channel = new MessageChannel();
  const worker = new Worker(new URL('../runtime/node-worker.mjs', import.meta.url), {
    execArgv: ['--permission', `--allow-fs-read=${fileURLToPath(new URL('..', import.meta.url))}`, `--allow-fs-read=${root}`, `--allow-fs-write=${root}`, '--no-addons'], stdout: true, stderr: true,
  });
  t.after(async () => {
    await worker.terminate(); channel.port1.close(); channel.port2.close();
    const relative = path.relative(tmpdir(), root);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(root).startsWith('javascript-edu-bootstrap-test-'));
    await rm(root, { recursive: true, force: true });
  });
  let exited = false;
  const observation = new Promise((resolve, reject) => {
    channel.port1.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', code => { exited = true; reject(new Error(`Bootstrap exited before parent cleanup: ${code}`)); });
  });
  worker.postMessage({ protocol: 'javascript-edu-node-v1', port: channel.port2, mode: 'prepare', context: { workspaceRoot: root },
    bridgePath: bridge, requiredFeatures: [], allowWorker: false, limits: { outputBytes: 65536, outputLines: 200 } }, [channel.port2]);
  assert.equal((await observation).status, 'ready');
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(exited, false, 'Private completion must arrive before parent-controlled Worker termination');
});

test('Node native beforeExit can settle a probe before the private completion keepalive starts', async t => {
  const exercise = contract({ 'main.mjs': `export async function read() { await new Promise(resolve => process.once('beforeExit', resolve)); return 42; }` });
  const f = await fixture(t, exercise);
  const result = await f.runner.submit(await request(exercise));
  assert.equal(result.status, 'success', result.stderr);
  assert.equal(result.checks[0].actual, 42);
  await f.assertClean();
});

test('Node nested Worker permission is denied by default and enabled only by fixed metadata', async t => {
  const files = { 'main.mjs': `import {Worker} from 'node:worker_threads'; export async function read() { try { const worker=new Worker(new URL('./sum.mjs',import.meta.url),{workerData:[20,22]}); return await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);}); } catch(error) { return error.code; } }`, 'sum.mjs': `import {parentPort,workerData} from 'node:worker_threads'; parentPort.postMessage(workerData.reduce((a,b)=>a+b,0));` };
  const blocked = contract(files);
  const denied = await fixture(t, blocked, { cases: [{ id: 'denied', label: 'worker denied', probe: 'observe(await submission.read());', expected: 'ERR_ACCESS_DENIED' }] });
  assert.equal((await denied.runner.submit(await request(blocked))).status, 'success');
  const permitted = contract(files, { nodeCapabilities: { allowWorker: true } });
  const allowed = await fixture(t, permitted);
  const result = await allowed.runner.submit(await request(permitted));
  assert.equal(result.status, 'success', result.stderr);
  assert.notEqual(result.environmentFingerprint, (await denied.runner.getEnvironment()).environmentFingerprint);
  await allowed.assertClean();
});

test('Node permissions deny parent files, code writes, child processes and credential inheritance', async t => {
  const exercise = contract();
  const f = await fixture(t, exercise, { cases: [{ id: 'boundaries', label: 'permissions', probe: 'observe(await submission.read(context.workspaceRoot));', expected: [true, true, true, true, true] }] });
  const secret = path.join(f.root, 'private-reference.txt');
  await writeFile(secret, 'PRIVATE_REFERENCE_SHOULD_NOT_BE_READ');
  process.env.JS_EDU_TEST_PRIVATE_SECRET = 'DO_NOT_INHERIT';
  try {
    const code = `import {readFile,writeFile} from 'node:fs/promises'; import {spawn} from 'node:child_process'; export async function read(){ let readDenied=false,writeDenied=false,childDenied=false;try{await readFile(${JSON.stringify(secret)},'utf8');}catch(e){readDenied=e.code==='ERR_ACCESS_DENIED';}try{await writeFile(new URL('./main.mjs',import.meta.url),'overwrite');}catch(e){writeDenied=e.code==='ERR_ACCESS_DENIED';}try{spawn(process.execPath,['--version']);}catch(e){childDenied=e.code==='ERR_ACCESS_DENIED';}return [readDenied,writeDenied,childDenied,process.env.JS_EDU_TEST_PRIVATE_SECRET===undefined,typeof process.send==='undefined'];}`;
    const result = await f.runner.submit(await request(exercise, { 'main.mjs': code }));
    assert.equal(result.status, 'success', result.stderr);
    assert.deepEqual(result.checks[0].actual, [true, true, true, true, true]);
  } finally { delete process.env.JS_EDU_TEST_PRIVATE_SECRET; }
});

test('Node loopback HTTP is real and is not claimed to be network-restricted', async t => {
  const exercise = contract({ 'main.mjs': `import {createServer} from 'node:http'; export async function read(){const server=createServer((req,res)=>res.end('native-http'));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{return await(await fetch('http://127.0.0.1:'+server.address().port)).text();}finally{await new Promise(resolve=>server.close(resolve));}}` });
  const f = await fixture(t, exercise, { cases: [{ id: 'http', label: 'HTTP', probe: 'observe(await submission.read());', expected: 'native-http' }] });
  const result = await f.runner.submit(await request(exercise));
  assert.equal(result.status, 'success', result.stderr);
  assert.equal(result.limits.networkRestricted, false);
});

test('Node wrong answers, public parentPort forgery and then/prototype tampering do not pass', async t => {
  const exercise = contract();
  const f = await fixture(t, exercise, { cases: [{ id: 'value', label: '42 array', probe: 'observe(submission.read());', expected: [42] }] });
  const result = await f.runner.submit(await request(exercise, { 'main.mjs': `import {parentPort,MessagePort} from 'node:worker_threads'; export function then(){throw new Error('entry then must not run');} export function read(){parentPort.postMessage({type:'complete',status:'success',results:[{id:'value',ok:true,actual:[42]}]});Object.is=()=>true;MessagePort.prototype.postMessage=()=>{};Array.prototype.then=function(resolve){delete Array.prototype.then;resolve([42]);};return [99];}` }));
  assert.equal(result.status, 'checks-failed', result.stderr);
  assert.deepEqual(result.checks[0].actual, [99]);
  await f.assertClean();
});

test('Node fresh case workers separate module cache and original code files remain unchanged', async t => {
  const exercise = contract({ 'main.mjs': 'let count=0; export function read(){return ++count;}' });
  const f = await fixture(t, exercise, { cases: [1, 2].map(index => ({ id: `fresh-${index}`, label: 'fresh', probe: 'observe(submission.read());', expected: 1 })) });
  const result = await f.runner.submit(await request(exercise));
  assert.equal(result.status, 'success', result.stderr);
  assert.equal(result.checks.length, 2);
  await f.assertClean();
});

test('Node timeout, concurrent-job rejection, cancellation and replay leave no job workspace', async t => {
  const exercise = contract();
  const f = await fixture(t, exercise, { caseTimeoutMs: 150, totalTimeoutMs: 1500 });
  const timeout = await f.runner.run(await request(exercise, { 'main.mjs': 'export function read(){while(true){}}' }));
  assert.equal(timeout.status, 'timeout', timeout.stderr);
  await f.assertClean();
  const pendingPayload = await request(exercise, { 'main.mjs': 'export async function read(){await new Promise(resolve=>setTimeout(resolve,10000));return 42;}' });
  const pending = f.runner.run(pendingPayload);
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal((await f.post('run', await request(exercise))).status, 429);
  await f.runner.cancel(pendingPayload.requestId);
  assert.equal((await pending).status, 'cancelled');
  await f.assertClean();
  const payload = await request(exercise);
  const first = await f.post('submit', payload);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).status, 'success');
  const second = await f.post('submit', payload);
  assert.equal((await second.json()).status, 'success');
  await f.assertClean();
});

test('Node direct stdout and returned observations stay bounded', async t => {
  const exercise = contract();
  const f = await fixture(t, exercise);
  const result = await f.runner.run(await request(exercise, { 'main.mjs': `export function read(){for(let i=0;i<2000;i++)process.stdout.write('x'.repeat(500)+'\\n');console.log('tail');return 42;}` }));
  assert.equal(result.status, 'success', result.stderr);
  assert.equal(result.outputTruncated, true);
  assert.ok(new TextEncoder().encode(result.stdout).byteLength <= nodeLimits.outputBytes);
  const oversized = await f.runner.run(await request(exercise, { 'main.mjs': 'export function read(){return Array(10000).fill(1);}' }));
  assert.equal(oversized.status, 'runtime-error');
  await f.assertClean();
});

test('Node zero checks, grader revision mismatch and missing features are environment failures', async t => {
  const exercise = contract();
  for (const fixedGrader of [grader(exercise, []), { ...grader(exercise), graderRevision: 'old' }]) {
    const f = await fixture(t, exercise, { loadGrader: async () => fixedGrader });
    const result = await f.runner.submit(await request(exercise));
    assert.equal(result.status, 'infrastructure-error');
    assert.deepEqual(result.checks, []);
    await f.assertClean();
  }
  const missing = contract({ 'main.mjs': 'throw new Error("learner must not execute");' }, { requiredFeatures: ['Intl.QualificationMissingFeature'] });
  const g = await fixture(t, missing);
  const result = await g.runner.submit(await request(missing));
  assert.equal(result.status, 'infrastructure-error');
  assert.equal(result.available, false);
  assert.deepEqual(result.missingFeatures, ['Intl.QualificationMissingFeature']);
  assert.doesNotMatch(result.stderr, /learner must not execute/);
  await g.assertClean();
});

test('Node loader errors and invalid observe contracts do not become successful submissions', async t => {
  const exercise = contract();
  const f = await fixture(t, exercise);
  for (const source of ['export function read( {', 'throw new SyntaxError("top level execution"); export function read(){return 42;}', 'throw new Proxy({}, {getOwnPropertyDescriptor(){throw 1;}});']) {
    const result = await f.runner.submit(await request(exercise, { 'main.mjs': source }));
    assert.equal(result.status, 'module-load-error', result.stderr);
    assert.deepEqual(result.checks, []);
  }
  const g = await fixture(t, exercise, { cases: [{ id: 'invalid-observe', label: 'invalid', probe: 'observe(42); observe(42);', expected: 42 }] });
  assert.equal((await g.runner.submit(await request(exercise))).status, 'infrastructure-error');
  await f.assertClean();
  await g.assertClean();
});

test('Node cancellation arriving before a POST suppresses late job creation', async t => {
  const exercise = contract();
  const f = await fixture(t, exercise);
  const payload = await request(exercise);
  const config = await f.config();
  const cancelled = await fetch(`${f.origin}/_node/jobs/${payload.requestId}`, { method: 'DELETE', headers: { Origin: f.origin, 'X-Execution-Token': config.token } });
  assert.equal(cancelled.status, 200);
  const result = await (await f.post('run', payload)).json();
  assert.equal(result.status, 'cancelled');
  assert.deepEqual(result.checks, []);
  await f.assertClean();
});

test('Node cancellation during grader loading prevents late workspace and process creation', async t => {
  const exercise = contract();
  let release;
  const f = await fixture(t, exercise, { loadGrader: () => new Promise(resolve => { release = resolve; }) });
  const payload = await request(exercise);
  const pending = f.runner.submit(payload);
  const deadline = Date.now() + 5000;
  while (!release) { if (Date.now() > deadline) throw new Error('Node grader did not start'); await new Promise(resolve => setTimeout(resolve, 10)); }
  await f.runner.cancel(payload.requestId);
  assert.equal((await pending).status, 'cancelled');
  release(grader(exercise));
  await new Promise(resolve => setTimeout(resolve, 30));
  await f.assertClean();
});

test('Node exposed active handles cannot forge a successful private observation', async t => {
  const exercise = contract();
  const f = await fixture(t, exercise);
  const source = `import {MessagePort} from 'node:worker_threads';
    for (const handle of process._getActiveHandles()) if (handle instanceof MessagePort) {
      try { handle.postMessage({protocol:'javascript-edu-node-v1',type:'complete',status:'success',results:[{id:'value',ok:true,actual:42}]}); } catch {}
    }
    export function read(){return 99;}`;
  const result = await f.runner.submit(await request(exercise, { 'main.mjs': source }));
  assert.equal(result.status, 'checks-failed', result.stderr);
  assert.equal(result.checks[0].actual, 99);
  await f.assertClean();
});

test('Node rapid A-B-C replacements retain the oldest delayed cleanup barrier', { timeout: 15000 }, async t => {
  const exercise = contract();
  let deleteStarted;
  let releaseDelete;
  const deleting = new Promise(resolve => { deleteStarted = resolve; });
  const gate = new Promise(resolve => { releaseDelete = resolve; });
  t.signal.addEventListener('abort', () => releaseDelete(), { once: true });
  const posts = [];
  const deletes = [];
  const f = await fixture(t, exercise, { wrapFetch: nativeFetch => async (url, init = {}) => {
    if (init.method === 'POST') posts.push(JSON.parse(init.body).request.requestId);
    if (init.method === 'DELETE') { deletes.push(String(url)); deleteStarted(); await gate; }
    return nativeFetch(url, init);
  } });
  t.after(() => releaseDelete());
  const aPayload = await request(exercise, { 'main.mjs': 'export async function read(){await new Promise(resolve=>setTimeout(resolve,1000));return 42;}' });
  const bPayload = await request(exercise);
  const cPayload = await request(exercise);
  const a = f.runner.submit(aPayload);
  const deadline = Date.now() + 5000;
  while (!posts.length) { if (Date.now() > deadline) throw new Error('First Node request did not post'); await new Promise(resolve => setTimeout(resolve, 5)); }
  const b = f.runner.submit(bPayload);
  await deleting;
  const c = f.runner.submit(cPayload);
  await new Promise(resolve => setTimeout(resolve, 50));
  const postsBeforeCleanup = [...posts];
  releaseDelete();
  const [aResult, bResult, cResult] = await Promise.all([a, b, c]);
  assert.deepEqual(postsBeforeCleanup, [aPayload.requestId]);
  assert.deepEqual(posts, [aPayload.requestId, cPayload.requestId]);
  assert.equal(deletes.length, 1);
  assert.equal(aResult.status, 'cancelled');
  assert.equal(bResult.status, 'cancelled');
  assert.equal(cResult.status, 'success', cResult.stderr);
  for (let index = 0; index < 3; index++) {
    const payload = await request(exercise);
    const pending = f.runner.submit(payload);
    await Promise.all([f.runner.cancel(payload.requestId), f.runner.cancel(payload.requestId)]);
    assert.equal((await pending).status, 'cancelled');
    assert.equal((await f.runner.submit(await request(exercise))).status, 'success');
  }
  await f.assertClean();
});

test('Node cancellation cannot be overwritten while a successful response body is delayed', { timeout: 15000 }, async t => {
  const exercise = contract();
  let bodyStarted;
  let deleteStarted;
  let releaseBody;
  let releaseDelete;
  const reading = new Promise(resolve => { bodyStarted = resolve; });
  const deleting = new Promise(resolve => { deleteStarted = resolve; });
  const bodyGate = new Promise(resolve => { releaseBody = resolve; });
  const deleteGate = new Promise(resolve => { releaseDelete = resolve; });
  t.signal.addEventListener('abort', () => { releaseBody(); releaseDelete(); }, { once: true });
  const f = await fixture(t, exercise, { wrapFetch: nativeFetch => async (url, init = {}) => {
    if (init.method === 'DELETE') { deleteStarted(); await deleteGate; }
    const response = await nativeFetch(url, init);
    if (init.method !== 'POST') return response;
    return { ok: response.ok, status: response.status, text: async () => {
      const body = await response.text();
      bodyStarted();
      await bodyGate;
      return body;
    } };
  } });
  t.after(() => { releaseBody(); releaseDelete(); });
  const payload = await request(exercise);
  let completed;
  const pending = f.runner.submit(payload).then(result => { completed = result; return result; });
  await reading;
  const cancelling = f.runner.cancel(payload.requestId);
  await deleting;
  releaseBody();
  await new Promise(resolve => setTimeout(resolve, 40));
  const completedBeforeDelete = completed;
  releaseDelete();
  await cancelling;
  assert.equal(completedBeforeDelete, undefined, 'Successful body must not settle during cancellation');
  assert.equal((await pending).status, 'cancelled');
  await f.assertClean();
});

test('Node unfinished and oversized chunked bodies release the single pending reservation', { timeout: 20000 }, async t => {
  const exercise = contract();
  const f = await fixture(t, exercise);
  const config = await f.config();
  const raw = ({ oversized = false } = {}) => new Promise(resolve => {
    let settled = false;
    let timer;
    const finish = result => { if (settled) return; settled = true; clearTimeout(timer); resolve(result); };
    const req = httpRequest(new URL('/_node/jobs', f.origin), { method: 'POST', headers: { Origin: f.origin, 'X-Execution-Token': config.token, 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } }, response => {
      response.resume();
      response.once('end', () => finish({ status: response.statusCode }));
      response.once('error', error => finish({ error: error.code }));
    });
    t.signal.addEventListener('abort', () => req.destroy(), { once: true });
    t.after(() => req.destroy());
    req.once('error', error => finish({ error: error.code }));
    timer = setTimeout(() => { req.destroy(); finish({ error: 'test-deadline' }); }, nodeLimits.bodyTimeoutMs + 3000);
    req.write(oversized ? 'x'.repeat(nodeLimits.bodyBytes + 1) : '{"mode":');
    if (oversized) req.end();
  });
  const start = Date.now();
  const pending = raw();
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal((await f.post('run', await request(exercise))).status, 429);
  const timedOut = await pending;
  assert.ok(timedOut.status === 408 || timedOut.error === 'ECONNRESET', JSON.stringify(timedOut));
  assert.ok(Date.now() - start >= nodeLimits.bodyTimeoutMs - 100);
  assert.equal((await f.runner.submit(await request(exercise))).status, 'success');
  const oversized = await raw({ oversized: true });
  assert.ok(oversized.status === 413 || oversized.error === 'ECONNRESET', JSON.stringify(oversized));
  assert.equal((await f.runner.submit(await request(exercise))).status, 'success');
  await f.assertClean();
});

test('Node server rejects an injected supervisor response with an invalid HMAC', async t => {
  const exercise = contract();
  const f = await fixture(t, exercise);
  assert.equal((await f.config()).available, true);
  const nativeSpawn = childProcess.spawn;
  let injections = 0;
  const spawn = t.mock.method(childProcess, 'spawn', (file, args, options) => {
    if (!args?.some(argument => typeof argument === 'string' && argument.endsWith('node-supervisor.mjs'))) return nativeSpawn(file, args, options);
    injections++;
    // Fault injection in the trusted IPC transport, not an actual learner escape.
    // No process is created and no real PID is ever assigned to this fake child.
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.exitCode = null;
    child.send = () => queueMicrotask(() => {
      child.emit('message', { protocol: 'javascript-edu-node-v1', sequence: 1, payload: { type: 'complete', status: 'success' }, mac: '0'.repeat(64) });
      child.stdout.end(); child.stderr.end(); child.emit('close', 0);
    });
    return child;
  });
  syncBuiltinESMExports();
  try {
    const result = await f.runner.submit(await request(exercise));
    assert.equal(injections, 1);
    assert.equal(result.status, 'infrastructure-error');
    assert.match(result.stderr, /위조된 Node supervisor 응답/);
    assert.deepEqual(result.checks, []);
  } finally { spawn.mock.restore(); syncBuiltinESMExports(); }
  await f.assertClean();
  assert.equal((await f.runner.submit(await request(exercise))).status, 'success');
});

test('Node cleanup failure keeps passing behavior checks but rejects the submission and recovers', async t => {
  const exercise = contract();
  const f = await fixture(t, exercise);
  const nativeRemove = filesystem.rm;
  let injections = 0;
  const removal = t.mock.method(filesystem, 'rm', (target, options) => {
    if (path.basename(path.dirname(target)).startsWith('javascript-edu-node-') && path.basename(target).startsWith('job-')) {
      injections++;
      return Promise.reject(Object.assign(new Error('Injected cleanup failure'), { code: 'EACCES' }));
    }
    return nativeRemove(target, options);
  });
  syncBuiltinESMExports();
  try {
    const result = await f.runner.submit(await request(exercise));
    assert.equal(injections, 1);
    assert.equal(result.status, 'infrastructure-error');
    assert.match(result.cleanupWarning, /작업 공간 삭제/);
    assert.ok(result.checks.length > 0 && result.checks.every(check => check.passed));
  } finally { removal.mock.restore(); syncBuiltinESMExports(); }
  assert.equal((await f.runner.submit(await request(exercise))).status, 'success');
});

test('one failed Node prepare cleanup prevents grader execution and a later request recovers', async t => {
  const exercise = contract();
  let graderLoads = 0;
  const f = await fixture(t, exercise, { getConsent: () => true, loadGrader: async () => { graderLoads++; return grader(exercise); } });
  const source = serializeNodeSource({ entry: exercise.workspace.entry, files: Object.fromEntries(exercise.workspace.files.map(file => [file.path, file.source])) });
  const state = createExecutionState({ runner: f.runner, fingerprintSource });
  const nativeRemove = filesystem.rm;
  let injections = 0;
  const removal = t.mock.method(filesystem, 'rm', (target, options) => {
    if (!injections && path.basename(path.dirname(target)).startsWith('javascript-edu-node-') && path.basename(target).startsWith('job-')) {
      injections++;
      return Promise.reject(Object.assign(new Error('Injected prepare cleanup failure'), { code: 'EACCES' }));
    }
    return nativeRemove(target, options);
  });
  syncBuiltinESMExports();
  try {
    const result = await state.start('submit', { lessonId: exercise.lessonId, exerciseId: exercise.id, contentRevision: exercise.contentRevision, targetVersion: 'ES2026' }, source);
    assert.equal(result.status, 'infrastructure-error');
    assert.match(result.cleanupWarning, /작업 공간 삭제/);
    assert.equal(injections, 1);
    assert.equal(graderLoads, 0);
  } finally { removal.mock.restore(); syncBuiltinESMExports(); }
  assert.equal((await state.start('submit', { lessonId: exercise.lessonId, exerciseId: exercise.id, contentRevision: exercise.contentRevision, targetVersion: 'ES2026' }, source)).status, 'success');
  assert.equal(graderLoads, 1);
});

test('Node cancellation preserves a one-time workspace cleanup warning and later execution recovers', async t => {
  const exercise = contract();
  const f = await fixture(t, exercise);
  await f.runner.getEnvironment();
  const payload = await request(exercise, { 'main.mjs': 'export async function read() { await new Promise(() => {}); }' });
  const pending = f.runner.run(payload);
  const deadline = Date.now() + 5000;
  while (true) {
    const bases = (await readdir(f.root)).filter(name => name.startsWith('javascript-edu-node-'));
    if ((await Promise.all(bases.map(base => readdir(path.join(f.root, base))))).flat().some(name => name.startsWith('job-'))) break;
    if (Date.now() > deadline) throw new Error('Node workspace did not start');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const nativeRemove = filesystem.rm;
  let injections = 0;
  const removal = t.mock.method(filesystem, 'rm', (target, options) => {
    if (!injections && path.basename(path.dirname(target)).startsWith('javascript-edu-node-') && path.basename(target).startsWith('job-')) {
      injections++;
      return Promise.reject(Object.assign(new Error('Injected cancellation cleanup failure'), { code: 'EACCES' }));
    }
    return nativeRemove(target, options);
  });
  syncBuiltinESMExports();
  try {
    const cancelled = await f.runner.cancel(payload.requestId);
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(injections, 1);
    assert.match(cancelled.cleanupWarning, /작업 공간 삭제/);
    const result = await pending;
    assert.equal(result.status, 'cancelled');
    assert.equal(result.cleanupWarning, cancelled.cleanupWarning);
  } finally { removal.mock.restore(); syncBuiltinESMExports(); }
  assert.equal((await f.runner.submit(await request(exercise))).status, 'success');
});
