import { executionLimits, gradeWorkerResults, isBehaviorValue, missingRequiredFeatures, runtimeProtocol, validateExercise, validateGrader } from './protocol.mjs';

const encoder = new TextEncoder();
export async function fingerprintSource(source) {
  if (typeof source !== 'string') throw new TypeError('코드 본문 문자열이 필요합니다.');
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(source));
  return `sha256:${Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

const fields = ['requestId', 'lessonId', 'exerciseId', 'contentRevision', 'sourceFingerprint', 'targetVersion'];
const now = () => globalThis.performance?.now?.() ?? Date.now();

export function createBrowserRunner({ exercises, loadGrader, WorkerConstructor = globalThis.Worker, MessageChannelConstructor = globalThis.MessageChannel, timeoutMs = executionLimits.timeoutMs } = {}) {
  const catalog = new Map();
  for (const exercise of Array.isArray(exercises) ? exercises : exercises?.exercises ?? []) {
    validateExercise(exercise);
    if (catalog.has(exercise.id)) throw new Error('중복 과제 ID가 있습니다.');
    catalog.set(exercise.id, structuredClone(exercise));
  }
  const actualRuntime = `Browser Dedicated Worker (${globalThis.navigator?.userAgent ?? 'runtime-adapter-test'})`;
  const nativeAvailable = typeof WorkerConstructor === 'function' && typeof MessageChannelConstructor === 'function' && Boolean(globalThis.crypto?.subtle);
  const environment = Object.freeze({
    available: nativeAvailable,
    actualRuntime,
    environmentFingerprint: `${runtimeProtocol}:${actualRuntime}`,
    reason: nativeAvailable ? '현재 브라우저의 JavaScript 엔진에서 실행합니다. 언어 기준의 모든 기능 지원을 뜻하지 않습니다.' : '이 브라우저는 전용 Worker·MessageChannel·코드 지문 기능을 지원하지 않습니다.',
    limits: executionLimits,
  });
  function exerciseEnvironment(exercise) {
    const missingFeatures = Object.freeze(missingRequiredFeatures(exercise.requiredFeatures));
    return Object.freeze({
      ...environment, exerciseId: exercise.id, requiredFeatures: Object.freeze([...(exercise.requiredFeatures ?? [])]), missingFeatures,
      available: environment.available && missingFeatures.length === 0,
      reason: !environment.available ? environment.reason : missingFeatures.length ? `이 과제에 필요한 브라우저 기능을 지원하지 않습니다: ${missingFeatures.join(', ')}` : environment.reason,
    });
  }
  function describeEnvironment(context) {
    const exerciseId = typeof context === 'string' ? context : context?.exerciseId;
    if (exerciseId !== undefined) {
      const exercise = catalog.get(exerciseId);
      return exercise ? exerciseEnvironment(exercise) : Object.freeze({ ...environment, available: false, missingFeatures: [], reason: '실행할 과제 ID를 확인하세요.' });
    }
    if (catalog.size === 1) return exerciseEnvironment(catalog.values().next().value);
    return Object.freeze({ ...environment, missingFeatures: Object.freeze([]), exerciseAvailability: Object.freeze(Object.fromEntries([...catalog].map(([id, exercise]) => [id, exerciseEnvironment(exercise)]))) });
  }
  const durationLimit = Number.isFinite(timeoutMs) ? Math.max(100, Math.min(3000, timeoutMs)) : executionLimits.timeoutMs;
  const fetchGrader = loadGrader ?? (async (exercise, { signal }) => {
    if (typeof exercise.graderFile !== 'string' || !/^\/?curriculum\/checks\/[a-z0-9-]+\.json$/.test(exercise.graderFile)) throw new Error('허용된 고정 검사기 경로가 없습니다.');
    // Catalog paths are relative to the repository root, never the current UI route.
    const url = new URL(`/${exercise.graderFile.replace(/^\//, '')}`, globalThis.location.origin);
    if (url.origin !== globalThis.location.origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('검사기는 같은 출처에서만 읽습니다.');
    const response = await fetch(url, { signal, credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('행동 검사기를 불러오지 못했습니다.');
    const text = await response.text();
    if (text.length > 1048576) throw new Error('행동 검사기 크기가 제한을 넘었습니다.');
    return JSON.parse(text);
  });
  let active = null;

  function result(task, status, extra = {}) {
    return {
      ...task.identity,
      environmentFingerprint: environment.environmentFingerprint,
      actualRuntime,
      status,
      stdout: task.stdout.join('\n'), stderr: task.stderr.join('\n'), compilerOutput: '', checks: [],
      outputTruncated: task.outputTruncated, durationMs: Math.max(0, Math.round(now() - task.started)), ...extra,
    };
  }
  function finish(task, status, extra) {
    if (task.settled) return;
    task.settled = true;
    clearTimeout(task.timer);
    task.abort.abort();
    if (task.port) { task.port.onmessage = null; task.port.onmessageerror = null; task.port.close(); }
    task.transferPort?.close();
    if (task.worker) { task.worker.onerror = null; task.worker.onmessageerror = null; task.worker.terminate(); }
    if (active === task) active = null;
    task.resolve(result(task, status, extra));
  }
  const current = task => active === task && !task.settled;

  function receive(task, event) {
    if (!current(task)) return;
    const message = event.data;
    if (!message || typeof message !== 'object' || message.protocol !== runtimeProtocol) {
      finish(task, 'infrastructure-error', { stderr: '실행 통신 형식이 올바르지 않습니다.' }); return;
    }
    if (message.type === 'output') {
      if (!['stdout', 'stderr'].includes(message.stream) || typeof message.text !== 'string' || typeof message.truncated !== 'boolean') {
        finish(task, 'infrastructure-error', { stderr: '실행 출력 형식이 올바르지 않습니다.' }); return;
      }
      const retained = message.text.length > 0 || !message.truncated;
      const bytes = encoder.encode(message.text).byteLength + (retained && task[message.stream].length > 0 ? 1 : 0);
      const lines = message.text.split('\n').length;
      if (retained && (task.outputBytes + bytes > executionLimits.outputBytes || task.outputLines + lines > executionLimits.outputLines)) {
        finish(task, 'infrastructure-error', { stderr: '실행 출력 제한을 초과한 응답입니다.' }); return;
      }
      if (retained) { task[message.stream].push(message.text); task.outputBytes += bytes; task.outputLines += lines; }
      task.outputTruncated ||= message.truncated;
      return;
    }
    if (message.type !== 'complete') { finish(task, 'infrastructure-error', { stderr: '알 수 없는 실행 응답입니다.' }); return; }
    if (['compilation-error', 'runtime-error', 'infrastructure-error'].includes(message.status)) {
      const error = typeof message.error === 'string' ? message.error.slice(0, 2000) : '실행 중 오류가 발생했습니다.';
      const featureFailure = message.status === 'infrastructure-error' && Array.isArray(message.missingFeatures) && message.missingFeatures.length > 0 && message.missingFeatures.length <= 32 && message.missingFeatures.every(path => task.requiredFeatures?.includes(path));
      finish(task, message.status, message.status === 'compilation-error' ? { compilerOutput: error } : { stderr: [task.stderr.join('\n'), error].filter(Boolean).join('\n'), ...(featureFailure ? { available: false, reason: error, missingFeatures: [...message.missingFeatures] } : {}) });
      return;
    }
    if (task.mode === 'prepare' && message.status === 'ready') { finish(task, 'ready'); return; }
    if (message.status !== 'success') { finish(task, 'infrastructure-error', { stderr: '예상하지 못한 실행 상태입니다.' }); return; }
    try {
      if (task.mode === 'submit') {
        const checks = gradeWorkerResults(message, task.cases);
        finish(task, checks.every(check => check.passed) ? 'success' : 'checks-failed', { checks });
      } else if (task.mode === 'run' && Object.prototype.hasOwnProperty.call(message, 'runValue') && isBehaviorValue(message.runValue)) {
        finish(task, 'success', { runValue: message.runValue });
      } else { throw new Error('실행 결과 형식이 올바르지 않습니다.'); }
    } catch (error) { finish(task, 'infrastructure-error', { stderr: error.message }); }
  }

  async function launch(task, payload) {
    try {
      if (!environment.available) throw new Error('이 브라우저는 전용 Worker 실행을 지원하지 않습니다.');
      const exercise = catalog.get(payload?.exerciseId);
      if (!exercise || fields.filter(field => field !== 'lessonId').some(field => typeof payload?.[field] !== 'string' || !payload[field] || payload[field].length > 300) || payload.contentRevision !== exercise.contentRevision) throw new Error('실행 요청의 과제·개정·코드 식별자가 올바르지 않습니다.');
      task.requiredFeatures = exercise.requiredFeatures ?? [];
      const requestedEnvironment = exerciseEnvironment(exercise);
      if (!requestedEnvironment.available) {
        finish(task, 'infrastructure-error', { available: false, reason: requestedEnvironment.reason, stderr: requestedEnvironment.reason, missingFeatures: [...requestedEnvironment.missingFeatures] });
        return;
      }
      if (exercise.profileByVersion && !Object.prototype.hasOwnProperty.call(exercise.profileByVersion, payload.targetVersion)) throw new Error('이 과제에서 제공하지 않는 언어 기준입니다.');
      if (typeof payload.source !== 'string' || encoder.encode(payload.source).byteLength > executionLimits.sourceBytes) throw new Error('코드 본문은 UTF-8 기준 100KB 이하여야 합니다.');
      task.cases = validateGrader(await fetchGrader(exercise, { signal: task.abort.signal }), exercise);
      if (!current(task)) return;
      const channel = new MessageChannelConstructor();
      task.port = channel.port1;
      task.transferPort = channel.port2;
      task.port.onmessage = event => receive(task, event);
      task.port.onmessageerror = () => finish(task, 'infrastructure-error', { stderr: '실행 결과를 읽지 못했습니다.' });
      task.port.start?.();
      const worker = new WorkerConstructor(new URL('./worker.js', import.meta.url), { name: 'javascript-edu-execution' });
      task.worker = worker;
      // The public worker message channel is deliberately never used for results.
      worker.onerror = event => { event.preventDefault?.(); finish(task, 'infrastructure-error', { stderr: '실행 Worker를 시작하거나 유지하지 못했습니다.' }); };
      worker.onmessageerror = () => finish(task, 'infrastructure-error', { stderr: '실행 Worker 통신을 열지 못했습니다.' });
      worker.postMessage({
        protocol: runtimeProtocol, mode: task.mode, source: payload.source, runner: exercise.runner, requiredFeatures: task.requiredFeatures,
        runProbe: exercise.runner.runProbe ?? task.cases[0].probe,
        cases: task.cases.map(({ id, probe }) => ({ id, probe })), limits: executionLimits,
      }, [channel.port2]);
    } catch (error) {
      if (current(task)) finish(task, 'infrastructure-error', { stderr: error?.message ?? '실행 환경을 준비하지 못했습니다.' });
    }
  }

  function execute(mode, payload = {}) {
    if (active) finish(active, 'cancelled');
    const task = {
      mode, identity: Object.fromEntries(fields.filter(field => typeof payload[field] === 'string').map(field => [field, payload[field]])),
      started: now(), stdout: [], stderr: [], outputBytes: 0, outputLines: 0, outputTruncated: false, abort: new AbortController(), settled: false,
    };
    const promise = new Promise(resolve => { task.resolve = resolve; });
    active = task;
    task.timer = setTimeout(() => finish(task, 'timeout', { stderr: [task.stderr.join('\n'), '실행 시간이 제한을 넘었습니다. 반복 조건과 비동기 완료를 확인하세요.'].filter(Boolean).join('\n') }), durationLimit);
    void launch(task, { ...payload });
    return promise;
  }

  return Object.freeze({
    getEnvironment: async context => describeEnvironment(context),
    prepare: payload => execute('prepare', payload),
    run: payload => execute('run', payload),
    submit: payload => execute('submit', payload),
    cancel: async requestId => {
      if (!active || (requestId !== undefined && active.identity.requestId !== requestId)) return { status: 'idle' };
      const identity = { ...active.identity };
      finish(active, 'cancelled');
      return { ...identity, status: 'cancelled' };
    },
  });
}
