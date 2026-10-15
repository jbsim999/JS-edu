import { executionLimits, gradeWorkerResults, isBehaviorValue, missingRequiredFeatures, validateGrader } from './protocol.mjs';
export { fingerprintSource } from './browser-runner.mjs';

export const moduleProtocol = 'javascript-edu-modules-v1';
export const moduleLimits = Object.freeze({ files: 16, fileBytes: 102400, totalBytes: 524288, bodyBytes: 786432, caseTimeoutMs: 2500, totalTimeoutMs: 15000, resultBytes: 262144 });
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const fields = ['requestId', 'lessonId', 'exerciseId', 'contentRevision', 'sourceFingerprint', 'targetVersion'];
const clock = () => globalThis.performance?.now?.() ?? Date.now();
const validPath = value => typeof value === 'string' && value.length <= 180 && value.endsWith('.mjs') && value.split('/').every(part => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part) && !part.includes('..')) && !value.split('/').includes('__edu_bridge__.mjs');

export function serializeModuleSource({ entry, files }) {
  if (typeof entry !== 'string' || !record(files)) throw new TypeError('모듈 entry와 파일 목록이 필요합니다.');
  return JSON.stringify({ entry, files: Object.fromEntries(Object.keys(files).sort().map(path => [path, files[path]])) });
}

function validateModuleExercise(exercise) {
  if (!record(exercise) || !['id', 'contentRevision', 'graderRevision'].every(field => typeof exercise[field] === 'string' && exercise[field])) throw new Error('모듈 과제 ID와 교재·검사 개정이 필요합니다.');
  if (exercise.runner?.kind !== 'module-files' || !validPath(exercise.runner.entry) || exercise.workspace?.entry !== exercise.runner.entry || !Array.isArray(exercise.workspace.files) || !exercise.workspace.files.length || exercise.workspace.files.length > moduleLimits.files) throw new Error('고정 모듈 작업 공간 계약이 필요합니다.');
  const paths = new Set();
  for (const file of exercise.workspace.files) {
    if (!record(file) || !validPath(file.path) || paths.has(file.path) || typeof file.source !== 'string' || typeof file.editable !== 'boolean') throw new Error('고정 모듈 파일 목록이 올바르지 않습니다.');
    paths.add(file.path);
  }
  if (!paths.has(exercise.runner.entry)) throw new Error('모듈 entry 파일이 없습니다.');
  if (exercise.requiredFeatures !== undefined && (!Array.isArray(exercise.requiredFeatures) || exercise.requiredFeatures.length > 32 || new Set(exercise.requiredFeatures).size !== exercise.requiredFeatures.length || exercise.requiredFeatures.some(path => typeof path !== 'string' || path.length > 200 || !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(path) || path.split('.').length > 8 || path.split('.').includes('__proto__')))) throw new Error('필수 기능은 중복 없는 API 경로 배열이어야 합니다.');
  if (exercise.runner.runProbe !== undefined && (typeof exercise.runner.runProbe !== 'string' || !exercise.runner.runProbe || exercise.runner.runProbe.length > executionLimits.sourceBytes)) throw new Error('고정 모듈 실행 관찰이 올바르지 않습니다.');
  return exercise;
}

export function validateModuleSnapshot(exercise, source, limits = moduleLimits) {
  validateModuleExercise(exercise);
  if (typeof source !== 'string' || encoder.encode(source).byteLength > limits.bodyBytes) throw new Error('모듈 작업 공간 크기가 제한을 넘었습니다.');
  let snapshot;
  try { snapshot = JSON.parse(source); } catch { throw new Error('모듈 작업 공간 JSON을 읽지 못했습니다.'); }
  if (!record(snapshot) || Object.keys(snapshot).sort().join(',') !== 'entry,files' || !record(snapshot.files) || snapshot.entry !== exercise.runner.entry || source !== serializeModuleSource(snapshot)) throw new Error('고정 파일 목록의 정규화된 모듈 snapshot이 필요합니다.');
  const entries = Object.entries(snapshot.files);
  if (entries.length !== exercise.workspace.files.length || entries.length > limits.files) throw new Error('허용된 모듈 파일 수와 일치하지 않습니다.');
  let bytes = 0;
  for (const file of exercise.workspace.files) {
    if (!own(snapshot.files, file.path) || typeof snapshot.files[file.path] !== 'string') throw new Error('필수 모듈 파일이 없습니다.');
    const content = snapshot.files[file.path];
    if (!file.editable && content !== file.source) throw new Error(`읽기 전용 파일은 수정할 수 없습니다: ${file.path}`);
    const size = encoder.encode(content).byteLength;
    bytes += size;
    if (size > limits.fileBytes || bytes > limits.totalBytes) throw new Error('모듈 소스 크기가 제한을 넘었습니다.');
  }
  return snapshot;
}

export function createModuleRunner({ exercises, loadGrader, WorkerConstructor = globalThis.Worker, MessageChannelConstructor = globalThis.MessageChannel, fetcher = (...args) => fetch(...args), origin = globalThis.location?.origin, caseTimeoutMs = moduleLimits.caseTimeoutMs, totalTimeoutMs = moduleLimits.totalTimeoutMs } = {}) {
  const catalog = new Map();
  for (const exercise of Array.isArray(exercises) ? exercises : exercises?.exercises ?? []) {
    validateModuleExercise(exercise);
    if (catalog.has(exercise.id)) throw new Error('중복 모듈 과제 ID가 있습니다.');
    catalog.set(exercise.id, structuredClone(exercise));
  }
  const actualRuntime = `Browser native ES module Worker (${globalThis.navigator?.userAgent ?? 'runtime-adapter-test'})`;
  const available = typeof WorkerConstructor === 'function' && typeof MessageChannelConstructor === 'function' && Boolean(globalThis.crypto?.subtle) && typeof fetcher === 'function' && typeof origin === 'string' && /^https?:\/\//.test(origin);
  const environment = Object.freeze({ available, actualRuntime, environmentFingerprint: `${moduleProtocol}:${actualRuntime}`, reason: available ? '현재 브라우저의 네이티브 ES 모듈로 실행합니다. 임시 파일은 로컬 실행 서버가 제공하며 학습 코드는 Worker에서 실행합니다.' : '브라우저의 모듈 Worker와 로컬 실행 서버 연결이 필요합니다.', limits: moduleLimits });
  const caseDuration = Math.max(100, Math.min(3000, Number.isFinite(caseTimeoutMs) ? caseTimeoutMs : moduleLimits.caseTimeoutMs));
  const totalDuration = Math.max(caseDuration, Math.min(30000, Number.isFinite(totalTimeoutMs) ? totalTimeoutMs : moduleLimits.totalTimeoutMs));
  const endpoint = path => new URL(path, origin);
  const graderLoader = loadGrader ?? (async (exercise, { signal }) => {
    if (typeof exercise.graderFile !== 'string' || !/^\/?curriculum\/checks\/[a-z0-9-]+\.json$/.test(exercise.graderFile)) throw new Error('허용된 고정 검사기 경로가 없습니다.');
    const response = await fetcher(endpoint(`/${exercise.graderFile.replace(/^\//, '')}`), { signal, cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error('모듈 검사기를 불러오지 못했습니다.');
    const text = await response.text();
    if (text.length > 1048576) throw new Error('모듈 검사기 크기가 제한을 넘었습니다.');
    return JSON.parse(text);
  });
  let active;

  function describe(context) {
    const id = typeof context === 'string' ? context : context?.exerciseId;
    const exercise = id === undefined && catalog.size === 1 ? catalog.values().next().value : catalog.get(id);
    if (id !== undefined && !exercise) return { ...environment, available: false, missingFeatures: [], reason: '실행할 모듈 과제 ID를 확인하세요.' };
    if (!exercise) return { ...environment, missingFeatures: [], exerciseAvailability: Object.fromEntries([...catalog.keys()].map(key => [key, describe(key)])) };
    const missingFeatures = missingRequiredFeatures(exercise.requiredFeatures);
    return { ...environment, exerciseId: exercise.id, requiredFeatures: [...(exercise.requiredFeatures ?? [])], missingFeatures, available: available && missingFeatures.length === 0, reason: !available ? environment.reason : missingFeatures.length ? `필요한 브라우저 기능을 지원하지 않습니다: ${missingFeatures.join(', ')}` : environment.reason };
  }

  async function cleanupWorkspace(task) {
    if (!task.workspace) return null;
    if (task.cleanupPromise) return task.cleanupPromise;
    task.cleanupPromise = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      try {
        const response = await fetcher(endpoint(`/_execution/workspaces/${task.workspace.id}`), { method: 'DELETE', headers: { 'X-Execution-Token': task.token }, signal: controller.signal, credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok && ![404, 410].includes(response.status)) throw new Error();
        return null;
      } catch { return '임시 작업 공간 삭제를 확인하지 못했습니다. 로컬 서버의 만료 시간 후 회수됩니다.'; }
      finally { clearTimeout(timer); }
    })();
    return task.cleanupPromise;
  }

  async function finish(task, status, extra = {}) {
    if (task.settled) return;
    task.settled = true;
    clearTimeout(task.timer);
    task.abort.abort();
    task.slot?.stop({ status: 'cancelled' });
    if (active === task) active = null;
    const cleanupPending = task.creating && !task.workspace;
    const cleanupWarning = await cleanupWorkspace(task) || (!task.creating && task.unidentifiedWorkspace ? '임시 작업 공간 생성 응답을 확인하지 못했습니다. 생성된 자료는 로컬 서버의 만료 시간 후 회수됩니다.' : null);
    task.resolve({ ...task.identity, environmentFingerprint: environment.environmentFingerprint, actualRuntime, status,
      stdout: task.stdout.join('\n'), stderr: task.stderr.join('\n'), compilerOutput: '', checks: [], outputTruncated: task.outputTruncated,
      durationMs: Math.max(0, Math.round(clock() - task.started)), cleanupPending, ...(cleanupWarning ? { cleanupWarning } : {}), ...extra });
  }
  const current = task => active === task && !task.settled;

  function appendOutput(task, message) {
    if (!['stdout', 'stderr'].includes(message.stream) || typeof message.text !== 'string' || typeof message.truncated !== 'boolean' || encoder.encode(message.text).byteLength > executionLimits.outputBytes || message.text.split('\n').length > executionLimits.outputLines) throw new Error('모듈 출력 형식이나 크기가 올바르지 않습니다.');
    task.outputTruncated ||= message.truncated;
    if (message.text.length === 0 && message.truncated) return;
    const remainingLines = executionLimits.outputLines - task.outputLines;
    const separator = task[message.stream].length > 0 ? 1 : 0;
    const remainingBytes = Math.max(0, executionLimits.outputBytes - task.outputBytes - separator);
    if (remainingLines <= 0 || remainingBytes <= 0) { task.outputTruncated = true; return; }
    const lines = message.text.split('\n');
    let text = lines.slice(0, remainingLines).join('\n');
    if (lines.length > remainingLines) task.outputTruncated = true;
    const bytes = encoder.encode(text);
    if (bytes.byteLength > remainingBytes) {
      text = decoder.decode(bytes.slice(0, remainingBytes));
      while (encoder.encode(text).byteLength > remainingBytes) text = text.slice(0, -1);
      task.outputTruncated = true;
    }
    task[message.stream].push(text);
    task.outputBytes += encoder.encode(text).byteLength + separator;
    task.outputLines += text.split('\n').length;
  }

  function executeWorker(task, mode, item) {
    return new Promise(resolve => {
      let settled = false;
      let worker;
      let port;
      let transferPort;
      let timer;
      const stop = outcome => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (port) { port.onmessage = null; port.onmessageerror = null; port.close(); }
        transferPort?.close();
        if (worker) { worker.onerror = null; worker.onmessageerror = null; worker.terminate(); }
        if (task.slot?.stop === stop) task.slot = null;
        resolve(outcome);
      };
      task.slot = { stop };
      timer = setTimeout(() => stop({ status: 'timeout', error: '모듈 실행 또는 개별 행동 검사 시간이 제한을 넘었습니다.', ...(item ? { timedOutCaseId: item.id } : {}) }), caseDuration);
      try {
        const channel = new MessageChannelConstructor();
        port = channel.port1;
        transferPort = channel.port2;
        port.onmessage = event => {
          if (settled || !current(task)) return;
          const message = event.data;
          if (!record(message) || message.protocol !== moduleProtocol) { stop({ status: 'infrastructure-error', error: '모듈 통신 형식이 올바르지 않습니다.' }); return; }
          try {
            if (message.type === 'output') { appendOutput(task, message); return; }
            if (message.type !== 'complete' || !['ready', 'success', 'module-load-error', 'compilation-error', 'runtime-error', 'infrastructure-error'].includes(message.status)) throw new Error('알 수 없는 모듈 실행 응답입니다.');
            stop(message);
          } catch (error) { stop({ status: 'infrastructure-error', error: error.message }); }
        };
        port.onmessageerror = () => stop({ status: 'infrastructure-error', error: '모듈 실행 결과를 읽지 못했습니다.' });
        port.start?.();
        worker = new WorkerConstructor(endpoint(task.workspace.workerUrl), { type: 'module', name: 'javascript-edu-module-execution' });
        worker.onerror = event => { event.preventDefault?.(); stop({ status: 'infrastructure-error', error: '네이티브 모듈 Worker를 시작하거나 유지하지 못했습니다.' }); };
        worker.onmessageerror = () => stop({ status: 'infrastructure-error', error: '모듈 실행 통신을 열지 못했습니다.' });
        worker.postMessage({ protocol: moduleProtocol, mode, requiredFeatures: task.exercise.requiredFeatures ?? [],
          runProbe: task.exercise.runner.runProbe ?? task.cases[0].probe, cases: item ? [{ id: item.id, probe: item.probe }] : [], limits: executionLimits }, [transferPort]);
      } catch (error) { stop({ status: 'infrastructure-error', error: error.message }); }
    });
  }

  async function createWorkspace(task, snapshot) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    task.creating = true;
    task.unidentifiedWorkspace = true;
    try {
      // Cancellation does not abort this POST: its late response may identify a
      // workspace that must still be deleted. A separate request deadline bounds it.
      const response = await fetcher(endpoint('/_execution/workspaces'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Execution-Token': task.token }, body: serializeModuleSource(snapshot), signal: controller.signal, credentials: 'same-origin', cache: 'no-store' });
      if (response.status !== 201) { task.unidentifiedWorkspace = false; throw new Error(`임시 모듈 작업 공간 생성에 실패했습니다. HTTP ${response.status}`); }
      const workspace = await response.json();
      // Retain a valid resource identity for cleanup even if the remaining server
      // response is invalid; never navigate to its unvalidated worker URL.
      if (record(workspace) && /^[a-f0-9]{48}$/.test(workspace.id)) { task.workspace = workspace; task.unidentifiedWorkspace = false; }
      if (!record(workspace) || !/^[a-f0-9]{48}$/.test(workspace.id) || workspace.workerUrl !== `/_execution/${workspace.id}/bootstrap.mjs` || !Number.isFinite(workspace.expiresAt)) throw new Error('임시 작업 공간 응답이 올바르지 않습니다.');
      if (!current(task)) await cleanupWorkspace(task);
    } finally {
      task.creating = false;
      clearTimeout(timer);
      if (task.settled && task.workspace) await cleanupWorkspace(task);
    }
  }

  function workerFailure(task, message) {
    const error = typeof message.error === 'string' ? message.error.slice(0, 2000) : '모듈 실행을 완료하지 못했습니다.';
    const missing = Array.isArray(message.missingFeatures) && message.missingFeatures.length > 0 && message.missingFeatures.every(path => task.exercise.requiredFeatures?.includes(path)) ? message.missingFeatures : null;
    return { ...(message.status === 'compilation-error' ? { compilerOutput: error } : { stderr: [task.stderr.join('\n'), error].filter(Boolean).join('\n') }), ...(missing ? { available: false, missingFeatures: missing, reason: error } : {}), ...(message.timedOutCaseId ? { timedOutCaseId: message.timedOutCaseId } : {}) };
  }

  async function launch(task, payload) {
    try {
      const exercise = catalog.get(payload.exerciseId);
      if (!exercise || fields.filter(field => field !== 'lessonId').some(field => typeof payload[field] !== 'string' || !payload[field] || payload[field].length > 300) || payload.contentRevision !== exercise.contentRevision || (exercise.profileByVersion && !own(exercise.profileByVersion, payload.targetVersion))) throw new Error('실행 요청의 모듈 과제·개정·버전·코드 식별자가 올바르지 않습니다.');
      task.exercise = exercise;
      const selectedEnvironment = describe(exercise.id);
      if (!selectedEnvironment.available) { await finish(task, 'infrastructure-error', { available: false, reason: selectedEnvironment.reason, stderr: selectedEnvironment.reason, missingFeatures: selectedEnvironment.missingFeatures }); return; }
      let snapshot = validateModuleSnapshot(exercise, payload.source);
      task.cases = validateGrader(await graderLoader(exercise, { signal: task.abort.signal }), exercise);
      if (!current(task)) return;
      const response = await fetcher(endpoint('/_execution/config'), { signal: task.abort.signal, credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('로컬 모듈 실행 설정을 읽지 못했습니다.');
      const config = await response.json();
      if (!record(config) || config.protocol !== moduleProtocol || typeof config.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(config.token) || !record(config.limits) || ['files', 'fileBytes', 'totalBytes', 'bodyBytes'].some(key => !Number.isSafeInteger(config.limits[key]) || config.limits[key] < 1)) throw new Error('로컬 모듈 실행 설정이 올바르지 않습니다.');
      task.token = config.token;
      snapshot = validateModuleSnapshot(exercise, payload.source, Object.fromEntries(['files', 'fileBytes', 'totalBytes', 'bodyBytes'].map(key => [key, Math.min(moduleLimits[key], config.limits[key])])));
      if (!current(task)) return;
      await createWorkspace(task, snapshot);
      if (!current(task)) return;
      if (task.mode !== 'submit') {
        const message = await executeWorker(task, task.mode);
        if (!current(task)) return;
        if (task.mode === 'prepare' && message.status === 'ready') { await finish(task, 'ready'); return; }
        if (task.mode === 'run' && message.status === 'success' && own(message, 'runValue') && isBehaviorValue(message.runValue)) { await finish(task, 'success', { runValue: message.runValue }); return; }
        await finish(task, ['module-load-error', 'compilation-error', 'runtime-error', 'timeout', 'infrastructure-error'].includes(message.status) ? message.status : 'infrastructure-error', workerFailure(task, message));
        return;
      }
      const checks = [];
      let resultBytes = 0;
      for (const item of task.cases) {
        const message = await executeWorker(task, 'submit', item);
        if (!current(task)) return;
        if (message.status !== 'success') { await finish(task, message.status, workerFailure(task, message)); return; }
        const [check] = gradeWorkerResults(message, [item]);
        resultBytes += encoder.encode(JSON.stringify(check.actual) ?? 'undefined').byteLength;
        if (resultBytes > moduleLimits.resultBytes) throw new Error('모듈 관찰 결과의 전체 크기가 제한을 넘었습니다.');
        checks.push(check);
      }
      await finish(task, checks.length > 0 && checks.every(check => check.passed) ? 'success' : 'checks-failed', { checks });
    } catch (error) {
      if (current(task)) await finish(task, 'infrastructure-error', { stderr: error?.message ?? '모듈 실행 환경을 준비하지 못했습니다.' });
    }
  }

  function execute(mode, payload = {}) {
    if (active) void finish(active, 'cancelled');
    const task = { mode, identity: Object.fromEntries(fields.filter(field => typeof payload[field] === 'string').map(field => [field, payload[field]])), started: clock(), abort: new AbortController(), stdout: [], stderr: [], outputBytes: 0, outputLines: 0, outputTruncated: false, settled: false, creating: false };
    const promise = new Promise(resolve => { task.resolve = resolve; });
    active = task;
    task.timer = setTimeout(() => { void finish(task, 'timeout', { stderr: '전체 모듈 실행·제출 시간이 제한을 넘었습니다.' }); }, totalDuration);
    void launch(task, { ...payload });
    return promise;
  }

  return Object.freeze({ getEnvironment: async context => describe(context), prepare: payload => execute('prepare', payload), run: payload => execute('run', payload), submit: payload => execute('submit', payload), cancel: async requestId => {
    if (!active || (requestId !== undefined && active.identity.requestId !== requestId)) return { status: 'idle' };
    const task = active;
    await finish(task, 'cancelled');
    return { ...task.identity, status: 'cancelled' };
  } });
}
