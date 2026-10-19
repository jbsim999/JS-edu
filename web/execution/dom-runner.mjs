import { executionLimits, gradeWorkerResults, isBehaviorValue, missingRequiredFeatures, validateExercise, validateGrader } from './protocol.mjs';
export { fingerprintSource } from './browser-runner.mjs';

export const domProtocol = 'javascript-edu-dom-v1';
export const domLimitations = '제품과 다른 로컬 출처에서 실행합니다. DOM의 동기 무한 루프는 화면까지 멈출 수 있어 시간 초과와 중지를 확실히 보장하지 못하며, 강제 메모리 한도와 OS 격리는 제공하지 않습니다.';
export const domLimits = Object.freeze({ ...executionLimits, frameStartupMs: 5000, caseTimeoutMs: 5000, totalTimeoutMs: 30000, resultBytes: 262144, hardMemoryLimit: false, hardTimeout: false, forcedTermination: false });
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const fields = ['requestId', 'lessonId', 'exerciseId', 'contentRevision', 'sourceFingerprint', 'targetVersion'];
const clock = () => globalThis.performance?.now?.() ?? Date.now();

export function validateBrowserHostConfig(config, parentOrigin) {
  const isOrigin = value => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' && url.hostname === '127.0.0.1' && Boolean(url.port) && url.origin === value && !url.username && !url.password;
    } catch { return false; }
  };
  if (!isOrigin(parentOrigin) || !record(config) || !isOrigin(config.origin) || config.origin === parentOrigin || config.frameUrl !== `${config.origin}/execution/dom-frame.html`) throw new Error('제품과 다른 포트의 고정 loopback DOM 실행 출처가 필요합니다.');
  return Object.freeze({ origin: config.origin, frameUrl: config.frameUrl });
}

export function createDomRunner({ exercises, loadGrader, loadHostConfig, document: hostDocument = globalThis.document, realm = globalThis, MessageChannelConstructor = globalThis.MessageChannel, fetcher = (...args) => fetch(...args), origin = globalThis.location?.origin, caseTimeoutMs = domLimits.caseTimeoutMs, totalTimeoutMs = domLimits.totalTimeoutMs } = {}) {
  const catalog = new Map();
  for (const exercise of Array.isArray(exercises) ? exercises : exercises?.exercises ?? []) {
    validateExercise(exercise);
    if (typeof exercise.runner.runProbe !== 'string' || !exercise.runner.runProbe.trim()) throw new TypeError('DOM 과제에는 고정 실행 관찰 runProbe가 필요합니다.');
    if (catalog.has(exercise.id)) throw new Error('중복 브라우저 과제 ID가 있습니다.');
    catalog.set(exercise.id, structuredClone(exercise));
  }
  const actualRuntime = `Browser DOM isolated loopback iframe (${globalThis.navigator?.userAgent ?? 'runtime-adapter-test'})`;
  const hostWindow = hostDocument?.defaultView ?? globalThis;
  const nativeAvailable = typeof hostDocument?.createElement === 'function' && Boolean(hostDocument?.body) && typeof hostWindow?.addEventListener === 'function' && typeof hostWindow?.removeEventListener === 'function' && typeof MessageChannelConstructor === 'function' && Boolean(globalThis.crypto?.subtle) && typeof globalThis.crypto?.getRandomValues === 'function' && /^http:\/\/127\.0\.0\.1:[0-9]+$/.test(origin ?? '');
  const caseDuration = Math.max(100, Math.min(5000, Number.isFinite(caseTimeoutMs) ? caseTimeoutMs : domLimits.caseTimeoutMs));
  const totalDuration = Math.max(caseDuration, Math.min(60000, Number.isFinite(totalTimeoutMs) ? totalTimeoutMs : domLimits.totalTimeoutMs));
  const configLoader = loadHostConfig ?? (async ({ signal }) => {
    const response = await fetcher(new URL('/_browser/config', origin), { signal, credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('별도 브라우저 실습 서버를 연결하지 못했습니다.');
    return response.json();
  });
  const graderLoader = loadGrader ?? (async (exercise, { signal }) => {
    if (typeof exercise.graderFile !== 'string' || !/^\/?curriculum\/checks\/[a-z0-9-]+\.json$/.test(exercise.graderFile)) throw new Error('허용된 고정 검사기 경로가 없습니다.');
    const response = await fetcher(new URL(`/${exercise.graderFile.replace(/^\//, '')}`, origin), { signal, credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('브라우저 행동 검사기를 불러오지 못했습니다.');
    const text = await response.text();
    if (text.length > 1048576) throw new Error('브라우저 검사기 크기가 제한을 넘었습니다.');
    return JSON.parse(text);
  });
  let hostConfig;
  let active;
  let cleanupCompletion = Promise.resolve();
  // The random loopback port is transport identity, not a runtime version. A
  // server restart must not erase progress for the same provider policy/engine.
  const environmentFingerprint = () => `${domProtocol}:isolated-loopback-policy-1:${actualRuntime}`;

  function describe(context) {
    const id = typeof context === 'string' ? context : context?.exerciseId;
    const exercise = id === undefined && catalog.size === 1 ? catalog.values().next().value : catalog.get(id);
    const result = { available: nativeAvailable, actualRuntime, environmentFingerprint: environmentFingerprint(), reason: nativeAvailable ? '브라우저의 실제 DOM에서 실행하며 고정 로컬 HTTP·Worker 자료만 연결합니다.' : 'DOM 문서·MessageChannel·Web Crypto와 로컬 실행 서버가 필요합니다.', limits: domLimits, limitations: domLimitations };
    if (id !== undefined && !exercise) return { ...result, available: false, missingFeatures: [], reason: '실행할 브라우저 과제 ID를 확인하세요.' };
    if (!exercise) return { ...result, missingFeatures: [], exerciseAvailability: Object.fromEntries([...catalog.keys()].map(key => [key, describe(key)])) };
    const missingFeatures = missingRequiredFeatures(exercise.requiredFeatures, realm);
    return { ...result, exerciseId: exercise.id, requiredFeatures: [...(exercise.requiredFeatures ?? [])], missingFeatures, available: nativeAvailable && missingFeatures.length === 0, reason: !nativeAvailable ? result.reason : missingFeatures.length ? `필요한 브라우저 API를 지원하지 않습니다: ${missingFeatures.join(', ')}` : result.reason };
  }

  async function getConfig(signal) {
    if (!hostConfig) hostConfig = validateBrowserHostConfig(await configLoader({ signal }), origin);
    return hostConfig;
  }

  async function getEnvironment(context) {
    const selected = describe(context);
    if (!selected.available) return selected;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try { await getConfig(controller.signal); return describe(context); }
    catch (error) { return { ...selected, available: false, reason: error?.message ?? '별도 브라우저 실행 서버를 준비하지 못했습니다.' }; }
    finally { clearTimeout(timer); }
  }

  const current = task => active === task && !task.settled;
  function finish(task, status, extra = {}) {
    if (task.completion) return task.completion;
    task.settled = true;
    clearTimeout(task.timer);
    task.abort.abort();
    if (active === task) active = null;
    task.completion = (async () => {
      await task.slot?.stop({ status: 'cancelled' });
      task.resolve({ ...task.identity, environmentFingerprint: environmentFingerprint(), actualRuntime, status,
      stdout: task.stdout.join('\n'), stderr: task.stderr.join('\n'), compilerOutput: '', checks: [], durationMs: Math.max(0, Math.round(clock() - task.started)), outputTruncated: task.outputTruncated,
        limits: domLimits, limitations: domLimitations, ...(task.cleanupWarnings.size ? { cleanupWarning: [...task.cleanupWarnings].join(' ') } : {}), ...extra });
    })();
    cleanupCompletion = Promise.allSettled([cleanupCompletion, task.completion]).then(() => undefined);
    return task.completion;
  }

  function appendOutput(task, message) {
    if (!['stdout', 'stderr'].includes(message.stream) || typeof message.text !== 'string' || typeof message.truncated !== 'boolean' || encoder.encode(message.text).byteLength > executionLimits.outputBytes || message.text.split('\n').length > executionLimits.outputLines) throw new Error('브라우저 출력 형식이나 크기가 올바르지 않습니다.');
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

  function executeFrame(task, mode, item) {
    let resolveOutcome;
    const promise = new Promise(resolve => { resolveOutcome = resolve; });
    let settled = false;
    let frame;
    let port;
    let transferPort;
    let timer;
    let disposeTimer;
    let navigationTimer;
    let documentId;
    let readyChallenge;
    let loaded = false;
    let waitingForDisposal;
    const previousFocus = hostDocument.activeElement;
    const recordCleanupWarning = message => {
      if (typeof message.cleanupWarning === 'string') task.cleanupWarnings.add(message.cleanupWarning.slice(0, 1000));
    };
    const remove = outcome => {
      clearTimeout(timer);
      clearTimeout(disposeTimer);
      clearTimeout(navigationTimer);
      hostWindow.removeEventListener('message', onFrameReady);
      if (port) { port.onmessage = null; port.onmessageerror = null; port.close(); }
      transferPort?.close();
      if (frame) {
        const restoreFocus = hostDocument.activeElement === frame;
        frame.onload = null;
        frame.onerror = null;
        // Chromium can leave a removed focused child as its active frame and
        // stall the next iframe navigation. Unfocus while it is still attached.
        if (restoreFocus) frame.blur();
        frame.remove();
        if (restoreFocus && previousFocus?.isConnected && !previousFocus.matches?.(':disabled') && !previousFocus.closest?.('[inert]') && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
      }
      if (task.slot?.stop === stop) task.slot = null;
      resolveOutcome(outcome);
    };
    const stop = (outcome, alreadyCleaned = false) => {
      if (settled) return promise;
      settled = true;
      clearTimeout(timer);
      if (alreadyCleaned || !loaded || !port) { remove(outcome); return promise; }
      waitingForDisposal = outcome;
      disposeTimer = setTimeout(() => {
        task.cleanupWarnings.add('중지된 프레임의 실습 저장소 삭제 완료를 확인하지 못했습니다. 별도 실습 출처에 자료가 남아 있을 수 있습니다.');
        remove(outcome);
      }, 300);
      try { port.postMessage({ protocol: domProtocol, type: 'dispose' }); } catch { clearTimeout(disposeTimer); task.cleanupWarnings.add('중지된 프레임의 저장소 정리 통신을 완료하지 못했습니다.'); remove(outcome); }
      return promise;
    };
    task.slot = { stop };
    const armExecutionTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { void stop({ status: 'timeout', error: `DOM 비동기 실행 시간이 제한을 넘었습니다.${item ? ` 검사: ${item.id}` : ''}`, ...(item ? { timedOutCaseId: item.id } : {}) }); }, caseDuration);
    };
    const nonce = () => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    const onFrameReady = event => {
      // A WindowProxy survives navigation. Check both the exact frame and origin,
      // then bind this execution to the fixed script's per-document identity.
      if (settled || !current(task) || event.source !== frame?.contentWindow || event.origin !== hostConfig.origin) return;
      const message = event.data;
      if (!record(message) || message.protocol !== domProtocol || message.type !== 'script-ready' || !/^[a-f0-9]{32}$/.test(message.documentId ?? '')) return;
      if (documentId && message.documentId !== documentId) { void stop({ status: 'infrastructure-error', error: '실습 프레임이 실행 중 다른 문서로 이동했습니다.' }); return; }
      if (readyChallenge && message.challenge === readyChallenge) { clearTimeout(navigationTimer); readyChallenge = null; }
      if (loaded) return;
      documentId = message.documentId;
      loaded = true;
      armExecutionTimer();
      try {
        if (mode !== 'prepare') frame.focus({ preventScroll: true });
        frame.contentWindow.postMessage({ protocol: domProtocol, mode, source: task.source, runner: task.exercise.runner,
          requiredFeatures: task.exercise.requiredFeatures ?? [], storagePrefix: `javascript-edu-dom:${nonce()}:`,
          runProbe: task.exercise.runner.runProbe, cases: item ? [{ id: item.id, probe: item.probe }] : [], limits: executionLimits }, hostConfig.origin, [transferPort]);
      } catch (error) { void stop({ status: 'infrastructure-error', error: error.message }); }
    };
    timer = setTimeout(() => { void stop({ status: 'infrastructure-error', error: '별도 DOM 프레임을 준비하지 못했습니다. 화면을 다시 활성화한 뒤 실행하세요.' }); }, domLimits.frameStartupMs);
    try {
      hostWindow.addEventListener('message', onFrameReady);
      const channel = new MessageChannelConstructor();
      port = channel.port1;
      transferPort = channel.port2;
      port.onmessage = event => {
        const message = event.data;
        if (waitingForDisposal && record(message) && message.protocol === domProtocol && message.type === 'disposed') { recordCleanupWarning(message); const outcome = waitingForDisposal; waitingForDisposal = null; remove(outcome); return; }
        if (settled || !current(task)) return;
        try {
          if (!record(message) || message.protocol !== domProtocol) throw new Error('브라우저 실행 통신 형식이 올바르지 않습니다.');
          if (message.type === 'output') { appendOutput(task, message); return; }
          if (message.type !== 'complete' || !['ready', 'success', 'compilation-error', 'runtime-error', 'infrastructure-error'].includes(message.status)) throw new Error('알 수 없는 브라우저 실행 응답입니다.');
          recordCleanupWarning(message);
          void stop(message, true);
        } catch (error) { void stop({ status: 'infrastructure-error', error: error.message }); }
      };
      port.onmessageerror = () => { void stop({ status: 'infrastructure-error', error: '브라우저 관찰 결과를 읽지 못했습니다.' }); };
      port.start?.();
      frame = hostDocument.createElement('iframe');
      // Native validation and submit events need allow-forms. The host response's
      // form-action 'none' still forbids actual form navigation or transmission.
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.setAttribute('loading', 'eager');
      frame.setAttribute('title', 'JavaScript-edu 브라우저 실습 실행');
      frame.setAttribute('tabindex', '-1');
      // Keep a rendered, focusable document for accessibility/focus exercises.
      frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0;';
      frame.onload = () => {
        if (settled || !current(task)) return;
        // load may be delayed after SPA navigation even though the fixed script
        // is ready. It only probes document identity and never repeats execution.
        readyChallenge = nonce();
        clearTimeout(navigationTimer);
        navigationTimer = setTimeout(() => { void stop({ status: 'infrastructure-error', error: '실습 프레임의 문서 연결을 확인하지 못했습니다.' }); }, domLimits.frameStartupMs);
        try {
          frame.contentWindow.postMessage({ protocol: domProtocol, type: 'request-ready', challenge: readyChallenge }, hostConfig.origin);
        } catch (error) { void stop({ status: 'infrastructure-error', error: error.message }); }
      };
      frame.onerror = () => { void stop({ status: 'infrastructure-error', error: '별도 출처 DOM 프레임을 불러오지 못했습니다.' }); };
      frame.src = hostConfig.frameUrl;
      hostDocument.body.append(frame);
    } catch (error) { void stop({ status: 'infrastructure-error', error: error.message }); }
    return promise;
  }

  function frameFailure(task, message) {
    const error = typeof message.error === 'string' ? message.error.slice(0, 2000) : 'DOM 실행을 완료하지 못했습니다.';
    const missing = Array.isArray(message.missingFeatures) && message.missingFeatures.length > 0 && message.missingFeatures.every(path => task.exercise.requiredFeatures?.includes(path)) ? message.missingFeatures : null;
    return { ...(message.status === 'compilation-error' ? { compilerOutput: error } : { stderr: [task.stderr.join('\n'), error].filter(Boolean).join('\n') }), ...(missing ? { available: false, missingFeatures: missing, reason: error } : {}), ...(message.timedOutCaseId ? { timedOutCaseId: message.timedOutCaseId } : {}) };
  }

  async function launch(task, payload) {
    try {
      const exercise = catalog.get(payload.exerciseId);
      if (!exercise || fields.filter(field => field !== 'lessonId').some(field => typeof payload[field] !== 'string' || !payload[field] || payload[field].length > 300) || payload.contentRevision !== exercise.contentRevision || (payload.lessonId !== undefined && payload.lessonId !== exercise.lessonId) || (exercise.profileByVersion && !own(exercise.profileByVersion, payload.targetVersion))) throw new Error('실행 요청의 브라우저 과제·개정·버전·코드 식별자가 올바르지 않습니다.');
      if (typeof payload.source !== 'string' || encoder.encode(payload.source).byteLength > executionLimits.sourceBytes) throw new Error('함수 본문 소스 크기가 제한을 넘었습니다.');
      task.exercise = exercise;
      task.source = payload.source;
      const selectedEnvironment = describe(exercise.id);
      if (!selectedEnvironment.available) { await finish(task, 'infrastructure-error', { available: false, reason: selectedEnvironment.reason, stderr: selectedEnvironment.reason, missingFeatures: selectedEnvironment.missingFeatures }); return; }
      task.cases = task.mode === 'submit' ? validateGrader(await graderLoader(exercise, { signal: task.abort.signal }), exercise) : [];
      if (!current(task)) return;
      await getConfig(task.abort.signal);
      if (!current(task)) return;
      if (task.mode !== 'submit') {
        const message = await executeFrame(task, task.mode);
        if (!current(task)) return;
        if (task.mode === 'prepare' && message.status === 'ready') { await finish(task, 'ready'); return; }
        if (task.mode === 'run' && message.status === 'success' && own(message, 'runValue') && isBehaviorValue(message.runValue)) { await finish(task, 'success', { runValue: message.runValue }); return; }
        await finish(task, ['compilation-error', 'runtime-error', 'timeout', 'infrastructure-error'].includes(message.status) ? message.status : 'infrastructure-error', frameFailure(task, message));
        return;
      }
      const checks = [];
      let resultBytes = 0;
      for (const item of task.cases) {
        const message = await executeFrame(task, 'submit', item);
        if (!current(task)) return;
        if (message.status !== 'success') { await finish(task, message.status, frameFailure(task, message)); return; }
        const [check] = gradeWorkerResults(message, [item]);
        resultBytes += encoder.encode(JSON.stringify(check.actual) ?? 'undefined').byteLength;
        if (resultBytes > domLimits.resultBytes) throw new Error('DOM 관찰 결과의 전체 크기가 제한을 넘었습니다.');
        checks.push(check);
      }
      await finish(task, checks.length > 0 && checks.every(check => check.passed) ? 'success' : 'checks-failed', { checks });
    } catch (error) { if (current(task)) await finish(task, 'infrastructure-error', { stderr: error?.message ?? '브라우저 실행 환경을 준비하지 못했습니다.' }); }
  }

  function execute(mode, payload = {}) {
    const previous = active;
    if (previous) void finish(previous, 'cancelled');
    const previousCompletion = cleanupCompletion;
    const task = { mode, identity: Object.fromEntries(fields.filter(field => typeof payload[field] === 'string').map(field => [field, payload[field]])), started: clock(), abort: new AbortController(), stdout: [], stderr: [], outputBytes: 0, outputLines: 0, outputTruncated: false, cleanupWarnings: new Set(), settled: false };
    const promise = new Promise(resolve => { task.resolve = resolve; });
    active = task;
    task.timer = setTimeout(() => { void finish(task, 'timeout', { stderr: '전체 브라우저 실행·제출 시간이 제한을 넘었습니다.' }); }, totalDuration);
    void previousCompletion.then(() => { if (current(task)) void launch(task, { ...payload }); });
    return promise;
  }

  return Object.freeze({ getEnvironment, prepare: payload => execute('prepare', payload), run: payload => execute('run', payload), submit: payload => execute('submit', payload), cancel: async requestId => {
    if (!active) { await cleanupCompletion; return { status: 'idle' }; }
    if (requestId !== undefined && active.identity.requestId !== requestId) return { status: 'idle' };
    const task = active;
    await finish(task, 'cancelled');
    return { ...task.identity, status: 'cancelled' };
  } });
}
