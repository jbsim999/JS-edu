import { decodeNodeValue, nodeEnvironmentFingerprint, nodeLimits, nodeLimitations, nodeProtocol, validateNodeSnapshot } from '../../runtime/node-contract.mjs';
export { fingerprintSource } from './browser-runner.mjs';
export { serializeNodeSource } from '../../runtime/node-contract.mjs';

const fields = ['requestId', 'lessonId', 'exerciseId', 'contentRevision', 'sourceFingerprint', 'targetVersion'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function createNodeRunner({ exercises, getConsent, fetcher = (...args) => fetch(...args), origin = globalThis.location?.origin } = {}) {
  const catalog = new Map((Array.isArray(exercises) ? exercises : exercises?.exercises ?? []).map(exercise => [exercise.id, structuredClone(exercise)]));
  let config;
  let active;
  let cleanupCompletion = Promise.resolve();
  const endpoint = pathname => new URL(pathname, origin);
  const unavailable = reason => ({ available: false, actualRuntime: 'Node.js (unavailable)', environmentFingerprint: `${nodeProtocol}:unavailable`, reason, limitations: nodeLimitations, limits: nodeLimits, consentRequired: true });
  async function loadConfig(signal) {
    if (config) return config;
    if (!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(origin ?? '')) throw new Error('고정 로컬 Node 실행 서버가 필요합니다.');
    const response = await fetcher(endpoint('/_node/config'), { signal, credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('Node 실행 환경 설정을 읽지 못했습니다.');
    const value = await response.json();
    if (!record(value) || value.protocol !== nodeProtocol || typeof value.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value.token) || typeof value.available !== 'boolean' || typeof value.actualRuntime !== 'string' || typeof value.environmentFingerprint !== 'string' || !record(value.limits)) throw new Error('고정 Node 환경 응답이 올바르지 않습니다.');
    config = value;
    return value;
  }
  async function getEnvironment(context) {
    const id = typeof context === 'string' ? context : context?.exerciseId;
    const exercise = id === undefined && catalog.size === 1 ? catalog.values().next().value : catalog.get(id);
    if (id !== undefined && !exercise) return unavailable('실행할 Node 과제를 확인하세요.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const { token, ...environment } = await loadConfig(controller.signal);
      if (!exercise) return { ...environment, exerciseAvailability: Object.fromEntries([...catalog].map(([key, item]) => [key, { ...environment, environmentFingerprint: nodeEnvironmentFingerprint(environment.environmentFingerprint, item) }])) };
      return { ...environment, exerciseId: exercise.id, allowWorker: exercise.nodeCapabilities?.allowWorker === true, environmentFingerprint: nodeEnvironmentFingerprint(environment.environmentFingerprint, exercise) };
    } catch (error) { return unavailable(error?.message ?? 'Node 환경을 확인하지 못했습니다.'); }
    finally { clearTimeout(timer); }
  }
  const current = task => active === task && !task.settled;
  function settle(task, result) {
    if (task.settled) return;
    task.settled = true;
    clearTimeout(task.timer);
    if (active === task) active = undefined;
    task.resolve({ ...task.identity, actualRuntime: config?.actualRuntime ?? 'Node.js (unavailable)', environmentFingerprint: nodeEnvironmentFingerprint(config?.environmentFingerprint ?? `${nodeProtocol}:unavailable`, task.exercise), stdout: '', stderr: '', compilerOutput: '', checks: [], durationMs: Date.now() - task.started, limits: nodeLimits, limitations: nodeLimitations, ...result });
  }
  function cancelTask(task) {
    if (task?.cancellation) return task.cancellation;
    if (!task || task.settled) return Promise.resolve({ status: 'idle' });
    task.cancelling = true;
    task.cancellation = (async () => {
      let cleanupWarning;
      if (task.posted && config) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetcher(endpoint(`/_node/jobs/${task.identity.requestId}`), { method: 'DELETE', signal: controller.signal, headers: { 'X-Execution-Token': config.token }, credentials: 'same-origin', cache: 'no-store' });
          if (!response.ok) throw new Error();
          const text = await response.text();
          if (text.length > 4096) throw new Error();
          const result = JSON.parse(text);
          if (result?.status !== 'cancelled' || result.requestId !== task.identity.requestId
            || (result.cleanupWarning !== undefined && (typeof result.cleanupWarning !== 'string' || result.cleanupWarning.length > 2000))) throw new Error();
          cleanupWarning = result.cleanupWarning;
        } catch { cleanupWarning = 'Node 중지·정리 완료를 확인하지 못했습니다. 서버의 전체 시간 제한으로 회수됩니다.'; }
        finally { clearTimeout(timer); }
      }
      task.abort.abort();
      settle(task, { status: 'cancelled', ...(cleanupWarning ? { cleanupWarning } : {}) });
      return { ...task.identity, status: 'cancelled', ...(cleanupWarning ? { cleanupWarning } : {}) };
    })();
    return task.cancellation;
  }
  function queueCancellation(task) {
    const cancellation = cancelTask(task);
    const completion = Promise.all([cleanupCompletion, cancellation]);
    cleanupCompletion = completion.then(() => undefined);
    return completion.then(([, result]) => result);
  }
  async function launch(task, payload) {
    try {
      if (!task.exercise) throw new Error('실행할 Node 과제가 없습니다.');
      validateNodeSnapshot(task.exercise, payload.source);
      if (task.mode !== 'prepare' && payload.consent !== true && await getConsent?.(task.exercise) !== true) { settle(task, { status: 'infrastructure-error', consentRequired: true, reason: nodeLimitations, stderr: '로컬 코드 실행의 범위를 읽고 동의 체크박스를 선택하세요.' }); return; }
      const environment = await loadConfig(task.abort.signal);
      if (!current(task) || task.cancelling) return;
      if (!environment.available) { settle(task, { status: 'infrastructure-error', available: false, reason: environment.reason, stderr: environment.reason }); return; }
      const request = Object.fromEntries([...fields, 'source'].filter(field => payload[field] !== undefined).map(field => [field, payload[field]]));
      task.posted = true;
      const response = await fetcher(endpoint('/_node/jobs'), { method: 'POST', signal: task.abort.signal, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Execution-Token': environment.token }, body: JSON.stringify({ mode: task.mode, request, consent: task.mode !== 'prepare' }) });
      if (!current(task) || task.cancelling) return;
      const text = await response.text();
      if (!current(task) || task.cancelling) return;
      if (text.length > 1048576) throw new Error('Node 실행 응답 크기가 제한을 넘었습니다.');
      const result = JSON.parse(text);
      if (!response.ok) { if (response.status === 403) config = undefined; throw new Error(result.error ?? `Node 실행 요청 실패: HTTP ${response.status}`); }
      if (!record(result) || !['ready', 'success', 'checks-failed', 'module-load-error', 'compilation-error', 'runtime-error', 'infrastructure-error', 'timeout', 'cancelled'].includes(result.status) || fields.filter(field => task.identity[field] !== undefined).some(field => result[field] !== task.identity[field]) || result.environmentFingerprint !== nodeEnvironmentFingerprint(environment.environmentFingerprint, task.exercise) || !Array.isArray(result.checks)) throw new Error('현재 코드와 Node 실행 결과 식별자가 일치하지 않습니다.');
      if (result.valueEncoding === 'javascript-edu-value-v1') {
        if (Object.hasOwn(result, 'runValue')) result.runValue = decodeNodeValue(result.runValue);
        result.checks = result.checks.map(check => ({ ...check, ...(Object.hasOwn(check, 'actual') ? { actual: decodeNodeValue(check.actual) } : {}), ...(Object.hasOwn(check, 'expected') ? { expected: decodeNodeValue(check.expected) } : {}) }));
      }
      if (task.mode === 'submit' && result.status === 'success' && (!result.checks.length || result.checks.some(check => check.passed !== true))) throw new Error('Node 제출의 고정 행동 검사를 확인하지 못했습니다.');
      settle(task, result);
    } catch (error) { if (current(task) && !task.cancelling) settle(task, { status: 'infrastructure-error', stderr: error?.message ?? 'Node 실행을 완료하지 못했습니다.' }); }
  }
  function execute(mode, payload = {}) {
    const previous = active;
    // A queued replacement can be cancelled before it posts. Its successor still
    // waits for every earlier DELETE, including a now-inactive task's cleanup.
    const previousCompletion = previous ? queueCancellation(previous) : cleanupCompletion;
    const task = { mode, identity: Object.fromEntries(fields.filter(field => typeof payload[field] === 'string').map(field => [field, payload[field]])), exercise: catalog.get(payload.exerciseId), started: Date.now(), abort: new AbortController(), settled: false, posted: false, cancelling: false };
    const promise = new Promise(resolve => { task.resolve = resolve; });
    active = task;
    task.timer = setTimeout(() => { void queueCancellation(task); }, nodeLimits.totalTimeoutMs + 10000);
    void previousCompletion.then(() => { if (current(task)) void launch(task, { ...payload }); });
    return promise;
  }
  return Object.freeze({ getEnvironment, prepare: payload => execute('prepare', payload), run: payload => execute('run', payload), submit: payload => execute('submit', payload), cancel: async requestId => {
    if (!active || (requestId !== undefined && active.identity.requestId !== requestId)) { await cleanupCompletion; return { status: 'idle' }; }
    return queueCancellation(active);
  } });
}
