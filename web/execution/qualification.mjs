import { createBrowserRunner, fingerprintSource } from './browser-runner.mjs';
import { createModuleRunner, serializeModuleSource } from './module-runner.mjs';

const byId = id => document.getElementById(id);
const output = byId('qualification-results');
const status = byId('qualification-status');
const runButton = byId('qualification-run');
const cancelButton = byId('qualification-cancel');
let running = false;
let stopped = false;
let activeRunner = null;
let sequence = 0;
let report;

function show(state, detail = '') {
  document.documentElement.dataset.status = state;
  status.textContent = detail ? `${state} · ${detail}` : state;
  if (report) output.textContent = JSON.stringify(report, null, 2);
}

async function readText(url) {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 1048576) throw new Error('검증 자료 크기가 제한을 넘었습니다.');
  return text;
}

function bodyFromReference(text, exercise) {
  if (exercise.runner.kind === 'module-files') return moduleSource(exercise, text.replace(/\r\n/g, '\n'));
  const source = text.replace(/\r\n/g, '\n').trimEnd();
  const prefix = exercise.editable?.prefix?.replace(/\r\n/g, '\n');
  const suffix = exercise.editable?.suffix?.replace(/\r\n/g, '\n').trimEnd();
  if (!prefix || !suffix || !source.startsWith(prefix) || !source.endsWith(suffix)) throw new Error('기준 답안이 고정 prefix/suffix를 따르는 단일 함수 파일이 아닙니다.');
  return source.slice(prefix.length, source.length - suffix.length);
}

function moduleSource(exercise, entrySource) {
  return serializeModuleSource({ entry: exercise.workspace.entry, files: Object.fromEntries(exercise.workspace.files.map(file =>
    [file.path, file.path === exercise.workspace.entry && entrySource !== undefined ? entrySource : file.source])) });
}

async function requestFor(exercise, source) {
  return {
    requestId: `qualification-${++sequence}`, lessonId: exercise.lessonId ?? exercise.id,
    exerciseId: exercise.id, contentRevision: exercise.contentRevision, source,
    sourceFingerprint: await fingerprintSource(source), targetVersion: Object.keys(exercise.profileByVersion ?? { ES2026: true })[0],
  };
}

async function invoke(adapter, mode, exercise, source) {
  const request = await requestFor(exercise, source);
  if (stopped) throw new Error('사용자가 검증을 중지했습니다.');
  activeRunner = adapter;
  return adapter[mode](request);
}

const rejected = result => ['checks-failed', 'compilation-error', 'runtime-error', 'module-load-error'].includes(result.status);
const passedSubmission = result => result.status === 'success' && result.checks.length > 0 && result.checks.every(check => check.passed);

async function qualifyExercise(exercise) {
  const record = { exerciseId: exercise.id, contentRevision: exercise.contentRevision, tests: [], passed: false };
  report.exercises.push(record);
  show('running', exercise.id);
  try {
    const module = exercise.runner.kind === 'module-files';
    const adapter = (module ? createModuleRunner : createBrowserRunner)({ exercises: [exercise] });
    activeRunner = adapter;
    const reference = bodyFromReference(await readText(`/_qualification/reference/${encodeURIComponent(exercise.id)}`), exercise);
    const incorrect = bodyFromReference(await readText(`/_qualification/incorrect/${encodeURIComponent(exercise.id)}`), exercise);
    for (const [name, mode, source, accepted] of [
      ['reference-run', 'run', reference, result => result.status === 'success' && result.checks.length === 0],
      ['reference-submit', 'submit', reference, passedSubmission],
      ['starter-rejected', 'submit', module ? moduleSource(exercise) : exercise.editable.initialBody, rejected],
      ['incorrect-rejected', 'submit', incorrect, rejected],
    ]) {
      const result = await invoke(adapter, mode, exercise, source);
      record.tests.push({ name, passed: accepted(result), result });
      show('running', `${exercise.id} · ${name}`);
    }
    record.passed = record.tests.length === 4 && record.tests.every(item => item.passed);
  } catch (error) { record.error = error.message; }
}

function internalContract(id, { asynchronous = false } = {}) {
  const exercise = {
    id, contentRevision: 'qualification-1', graderRevision: 'qualification-grader-1', profileByVersion: { ES2026: 'qualification' },
    runner: { kind: 'function-body', exportName: 'check', parameters: [], async: asynchronous, runProbe: 'observe(await submission.check());' },
  };
  return exercise;
}

async function qualifyLimits() {
  const exercise = internalContract('qualification-limits');
  const grader = { exerciseId: exercise.id, contentRevision: exercise.contentRevision, graderRevision: exercise.graderRevision, cases: [{ id: 'observed', label: 'observed', probe: 'observe(submission.check());', expected: true }] };
  const adapter = createBrowserRunner({ exercises: [exercise], loadGrader: async () => grader });
  const timeout = await invoke(adapter, 'run', exercise, 'while (true) {}');
  report.runtime.push({ name: 'timeout', passed: timeout.status === 'timeout', result: timeout });
  show('running', '취소 및 출력 상한');
  const cancellationRequest = await requestFor(exercise, 'while (true) {}');
  if (stopped) return;
  activeRunner = adapter;
  const pending = adapter.run(cancellationRequest);
  await new Promise(resolve => setTimeout(resolve, 100));
  await adapter.cancel(cancellationRequest.requestId);
  const cancellation = await pending;
  report.runtime.push({ name: 'cancel', passed: cancellation.status === 'cancelled', result: cancellation });
  const outputResult = await invoke(adapter, 'run', exercise, 'for (let i = 0; i < 500; i++) console.log("출력", i); return true;');
  report.runtime.push({ name: 'output-limit', passed: outputResult.status === 'success' && outputResult.outputTruncated && outputResult.stdout.split('\n').length <= 200 && new TextEncoder().encode(outputResult.stdout).byteLength <= 65536, result: outputResult });
  const recovery = await invoke(adapter, 'run', exercise, 'return true;');
  report.runtime.push({ name: 'recovery-after-termination', passed: recovery.status === 'success', result: recovery });
}

async function qualifyCsp() {
  const response = await fetch('/execution/worker.js', { cache: 'no-store' });
  const header = response.headers.get('content-security-policy') ?? '';
  const required = ["default-src 'none'", "script-src 'unsafe-eval'", "connect-src 'none'", "worker-src 'none'"];
  report.runtime.push({ name: 'worker-csp-header', passed: response.ok && required.every(value => header.includes(value)), header });
  const exercise = internalContract('qualification-csp', { asynchronous: true });
  const expected = { fetchBlocked: true, dynamicImportBlocked: true, importScriptsBlocked: true, childWorkerBlocked: true };
  const grader = { exerciseId: exercise.id, contentRevision: exercise.contentRevision, graderRevision: exercise.graderRevision, cases: [{ id: 'csp', label: 'worker CSP', probe: 'observe(await submission.check());', expected }] };
  const adapter = createBrowserRunner({ exercises: [exercise], loadGrader: async () => grader });
  const source = `
    let fetchBlocked = false;
    try { await fetch('/curriculum/exercises.json'); } catch { fetchBlocked = true; }
    let dynamicImportBlocked = false;
    try { await import('/execution/protocol.mjs'); } catch { dynamicImportBlocked = true; }
    let importScriptsBlocked = false;
    try { importScripts('/execution/worker.js'); } catch { importScriptsBlocked = true; }
    const childWorkerBlocked = await new Promise(resolve => {
      let child;
      let channel;
      let timer;
      const finish = blocked => { clearTimeout(timer); channel?.port1.close(); child?.terminate(); resolve(blocked); };
      try {
        child = new Worker('/execution/worker.js');
        channel = new MessageChannel();
        channel.port1.onmessage = () => finish(false);
        child.onerror = event => { event.preventDefault(); finish(true); };
        timer = setTimeout(() => finish(false), 400);
        child.postMessage({ protocol: 'javascript-edu-worker-v1', mode: 'prepare', limits: {} }, [channel.port2]);
      } catch { finish(true); }
    });
    return { fetchBlocked, dynamicImportBlocked, importScriptsBlocked, childWorkerBlocked };
  `;
  const result = await invoke(adapter, 'submit', exercise, source);
  report.runtime.push({ name: 'worker-csp-enforcement', passed: passedSubmission(result), result });
}

async function qualifyModules() {
  const exercise = {
    id: 'qualification-modules', contentRevision: 'qualification-1', graderRevision: 'module-qualification-1',
    profileByVersion: { ES2026: 'browser-esm' },
    runner: { kind: 'module-files', entry: 'main.mjs', runProbe: 'observe(await submission.check());' },
    workspace: { entry: 'main.mjs', files: [{ path: 'main.mjs', source: 'export function check() { return true; }', editable: true }] },
  };
  const observedHeaders = [];
  const fetcher = async (...args) => {
    const response = await fetch(...args);
    if (args[1]?.method === 'POST' && response.status === 201) {
      const item = await response.clone().json();
      const worker = await fetch(item.workerUrl, { cache: 'no-store' });
      observedHeaders.push({ id: item.id, header: worker.headers.get('content-security-policy') || '' });
    }
    return response;
  };
  const grader = { exerciseId: exercise.id, contentRevision: exercise.contentRevision, graderRevision: exercise.graderRevision,
    observationMode: 'callback', cases: [{ id: 'isolated-state', label: 'fresh module state', probe: 'observe(submission.check());', expected: 1 },
      { id: 'fresh-again', label: 'fresh module state again', probe: 'observe(submission.check());', expected: 1 }] };
  const adapter = createModuleRunner({ exercises: [exercise], loadGrader: async () => grader, fetcher, caseTimeoutMs: 400, totalTimeoutMs: 5000 });
  const record = (name, passed, result) => { report.runtime.push({ name, passed, result }); show('running', name); };
  const fresh = await invoke(adapter, 'submit', exercise, moduleSource(exercise, 'let count = 0; export function check() { return ++count; }'));
  record('module-fresh-case-state', passedSubmission(fresh), fresh);
  const exportedThen = await invoke(adapter, 'run', exercise, moduleSource(exercise, 'export function then(resolve) { resolve({check:()=>99}); } export function check() { return 7; }'));
  record('module-export-then', exportedThen.status === 'success' && exportedThen.runValue === 7, exportedThen);
  const prototypeThen = await invoke(adapter, 'run', exercise, moduleSource(exercise, 'Object.prototype.then = function(resolve){ resolve({check:()=>99}); }; export function check() { return 7; }'));
  record('module-prototype-then', prototypeThen.status === 'success' && prototypeThen.runValue === 7, prototypeThen);
  const timeout = await invoke(adapter, 'run', exercise, moduleSource(exercise, 'await new Promise(()=>{}); export function check() { return true; }'));
  record('module-tla-timeout', timeout.status === 'timeout', timeout);
  const request = await requestFor(exercise, moduleSource(exercise, 'await new Promise(()=>{}); export function check() { return true; }'));
  activeRunner = adapter;
  const pending = adapter.run(request);
  await new Promise(resolve => setTimeout(resolve, 100));
  await adapter.cancel(request.requestId);
  const cancelled = await pending;
  record('module-cancel', cancelled.status === 'cancelled', cancelled);
  const recovery = await invoke(adapter, 'run', exercise, moduleSource(exercise));
  record('module-recovery', recovery.status === 'success' && recovery.runValue === true, recovery);
  const cspSource = `export async function check() {
    const blocked = { fetch: false, configImport: false, answerImport: false, outsideFileImport: false, childWorker: false };
    try { await fetch('/_execution/config'); } catch { blocked.fetch = true; }
    try { await import('/_execution/config'); } catch { blocked.configImport = true; }
    try { await import('/_qualification/reference/independent-counter'); } catch { blocked.answerImport = true; }
    try { await import('/execution/protocol.mjs'); } catch { blocked.outsideFileImport = true; }
    blocked.childWorker = await new Promise(resolve => { let worker; let timer;
      const finish = value => { clearTimeout(timer); worker?.terminate(); resolve(value); };
      try { worker = new Worker('/execution/worker.js'); worker.onerror = event => { event.preventDefault(); finish(true); }; timer = setTimeout(()=>finish(false),150); } catch { finish(true); }
    });
    return blocked;
  }`;
  const csp = await invoke(adapter, 'run', exercise, moduleSource(exercise, cspSource));
  record('module-namespace-csp', csp.status === 'success' && ['fetch', 'configImport', 'answerImport', 'outsideFileImport', 'childWorker'].every(key => csp.runValue?.[key] === true), csp);
  record('module-namespace-csp-headers', observedHeaders.length > 0 && observedHeaders.every(item =>
    item.header.includes(`${location.origin}/_execution/${item.id}/files/`) && item.header.includes("connect-src 'none'")
    && item.header.includes("worker-src 'none'") && !item.header.includes("'self'") && !item.header.includes('blob:')), observedHeaders);
}

byId('qualification-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (running) return;
  running = true;
  stopped = false;
  runButton.disabled = true;
  cancelButton.disabled = false;
  report = { startedAt: new Date().toISOString(), runtime: [], exercises: [], passed: false, browser: navigator.userAgent, limits: ['실제 브라우저 Worker 검증이며 실제 기기 검증과 구별합니다.', '메모리의 절대 상한·같은 출처 저장 권한의 제거·공인 성적은 보장하지 않습니다.'] };
  show('running', '과제 목록 읽기');
  try {
    const catalog = JSON.parse(await readText('/curriculum/exercises.json'));
    const ids = byId('exercise-filter').value.split(',').map(value => value.trim()).filter(Boolean);
    const exercises = catalog.exercises.filter(exercise => ['function-body', 'module-files'].includes(exercise.runner?.kind)
      && !(exercise.hostRequirements?.length) && (ids.length === 0 || ids.includes(exercise.id)));
    if (!exercises.length || ids.some(id => !exercises.some(exercise => exercise.id === id))) throw new Error('검증할 브라우저 Worker 과제 ID를 확인하세요.');
    report.selectedExerciseCount = exercises.length;
    for (const exercise of exercises) {
      if (stopped) break;
      await qualifyExercise(exercise);
    }
    if (!stopped) await qualifyLimits();
    if (!stopped) { show('running', 'Worker CSP'); await qualifyCsp(); }
    if (!stopped && exercises.some(exercise => exercise.runner.kind === 'module-files')) await qualifyModules();
    report.passed = !stopped && report.exercises.length === exercises.length && report.exercises.every(item => item.passed) && report.runtime.length >= 6 && report.runtime.every(item => item.passed);
  } catch (error) { report.error = error.message; }
  finally {
    await activeRunner?.cancel();
    activeRunner = null;
    running = false;
    report.stopped = stopped;
    report.completedAt = new Date().toISOString();
    runButton.disabled = false;
    cancelButton.disabled = true;
    show('done', report.passed ? 'PASS' : stopped ? '중지됨' : 'FAIL');
  }
});

cancelButton.addEventListener('click', () => { stopped = true; void activeRunner?.cancel(); });
show('idle');
