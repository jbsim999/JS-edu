import { spawn } from 'node:child_process';
import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm, realpath, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { serialize } from 'node:v8';
import { executionLimits, gradeWorkerResults, isBehaviorValue, validateGrader } from '../execution/protocol.mjs';
import { encodeNodeValue, nodeEnvironmentFingerprint, nodeLimits, nodeLimitations, nodePolicy, nodeProtocol, serializeNodeSource, validateNodeSnapshot } from '../../runtime/node-contract.mjs';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const identityFields = ['requestId', 'lessonId', 'exerciseId', 'contentRevision', 'sourceFingerprint', 'targetVersion'];
const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const trustedRoot = new URL('../../runtime/', import.meta.url);
const projectRoot = new URL('../../', import.meta.url);
const minimalEnvironment = root => ({ ...(process.platform === 'win32' && process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot, WINDIR: process.env.SystemRoot } : {}), HOME: root, USERPROFILE: root, TEMP: root, TMP: root, TMPDIR: root, LANG: 'C.UTF-8', TZ: 'UTC', NODE_NO_WARNINGS: '1' });
const assertChildPath = (parent, target) => { const relative = path.relative(path.resolve(parent), path.resolve(target)); if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('임시 작업 공간 경계를 확인하지 못했습니다.'); };

export function createNodeExecution({ executable, expectedVersion = '24.22.0', exercises, loadGrader, httpBase, caseTimeoutMs = nodeLimits.caseTimeoutMs, totalTimeoutMs = nodeLimits.totalTimeoutMs, workspaceParent = tmpdir() } = {}) {
  if (typeof executable !== 'string' || !path.isAbsolute(executable) || !/^\d+\.\d+\.\d+$/.test(expectedVersion) || !path.isAbsolute(workspaceParent)) throw new TypeError('고정 Node 실행 파일의 절대 경로와 정확한 버전이 필요합니다.');
  if (httpBase !== undefined && !/^http:\/\/127\.0\.0\.1:[0-9]+\/_fixtures\/http\/$/.test(httpBase)) throw new TypeError('HTTP 자료는 고정 loopback fixture 경로여야 합니다.');
  const catalog = new Map();
  for (const exercise of Array.isArray(exercises) ? exercises : exercises?.exercises ?? []) {
    const source = serializeNodeSource({ entry: exercise.workspace?.entry, files: Object.fromEntries((exercise.workspace?.files ?? []).map(file => [file.path, file.source])) });
    validateNodeSnapshot(exercise, source);
    if (catalog.has(exercise.id)) throw new Error('중복 Node 과제 ID가 있습니다.');
    catalog.set(exercise.id, structuredClone(exercise));
  }
  const token = randomBytes(32).toString('base64url');
  const duration = Math.max(100, Math.min(30000, totalTimeoutMs));
  const caseDuration = Math.max(100, Math.min(5000, caseTimeoutMs));
  const completed = new Map();
  const cancelled = new Map();
  let active;
  let pending = 0;
  let closed = false;
  let preparation;
  let environment;
  let base;
  let resolvedExecutable;
  let resolvedWorkspaceParent;
  const loader = loadGrader ?? (async exercise => {
    if (typeof exercise.graderFile !== 'string' || !/^curriculum\/checks\/[a-z0-9-]+\.json$/.test(exercise.graderFile)) throw new Error('허용된 고정 Node 검사기 파일이 없습니다.');
    return JSON.parse(await readFile(new URL(exercise.graderFile, projectRoot), 'utf8'));
  });

  async function getEnvironment() {
    if (!preparation) preparation = (async () => {
      let reason;
      let actualVersion;
      let actualPlatform;
      let actualArchitecture;
      try {
        resolvedExecutable = await realpath(executable);
        resolvedWorkspaceParent = await realpath(workspaceParent);
        base = await mkdtemp(path.join(resolvedWorkspaceParent, 'javascript-edu-node-'));
        const probe = `console.log(JSON.stringify({version:process.versions.node,platform:process.platform,architecture:process.arch,permission:!!process.permission,child:process.permission?.has('child'),addons:process.permission?.has('addons')}))`;
        const result = await new Promise((resolve, reject) => {
          let stdout = '';
          let stderr = '';
          const child = spawn(resolvedExecutable, ['--permission', '--allow-worker', '--no-addons', '--max-old-space-size=64', '--eval', probe], { cwd: base, env: minimalEnvironment(base), windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
          const timer = setTimeout(() => { child.kill(); reject(new Error('Node 환경 확인 시간이 제한을 넘었습니다.')); }, 3000);
          child.stdout.on('data', data => { stdout += data.toString(); if (stdout.length > 8192) child.kill(); });
          child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(0, 8192); });
          child.on('error', reject);
          child.on('close', code => { clearTimeout(timer); if (code !== 0) reject(new Error('고정 Node 실행 파일 또는 권한 옵션을 시작하지 못했습니다.')); else { try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Node 환경 응답이 올바르지 않습니다.')); } } });
        });
        actualVersion = result.version;
        actualPlatform = result.platform;
        actualArchitecture = result.architecture;
        if (typeof actualPlatform !== 'string' || !/^[a-z0-9_-]+$/.test(actualPlatform) || typeof actualArchitecture !== 'string' || !/^[a-z0-9_-]+$/.test(actualArchitecture)) throw new Error('Node 실행 파일의 플랫폼과 아키텍처를 확인하지 못했습니다.');
        if (actualVersion !== expectedVersion) throw new Error(`이 과제에는 Node.js ${expectedVersion}이 필요하며 현재 실행 파일은 ${actualVersion}입니다.`);
        if (!result.permission || result.child !== false || result.addons !== false) throw new Error('고정 Node 권한 모델을 확인하지 못했습니다.');
      } catch (error) { reason = error?.message ?? '고정 Node 실행 파일이 없습니다.'; }
      const actualRuntime = actualVersion ? `Node.js ${actualVersion} (${actualPlatform}/${actualArchitecture}; native process + Worker)` : `Node.js ${expectedVersion} (unavailable)`;
      const fingerprint = createHash('sha256').update(`${actualRuntime}:${nodePolicy}`).digest('hex');
      environment = Object.freeze({ protocol: nodeProtocol, available: !reason && !closed, actualRuntime, environmentFingerprint: `${nodeProtocol}:sha256:${fingerprint}`, runtimeVersion: actualVersion ?? null, platform: actualPlatform ?? null, architecture: actualArchitecture ?? null, expectedVersion, policy: nodePolicy, limits: nodeLimits, limitations: nodeLimitations, reason: reason ?? '고정 Node 실행 파일과 임시 실습 폴더를 사용합니다.', consentRequired: true });
      return environment;
    })();
    return preparation;
  }

  async function killChild(task) {
    const child = task.child;
    if (!child || !Number.isSafeInteger(child.pid) || child.exitCode !== null || task.childClosed) return;
    if (process.platform === 'win32') {
      const killer = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
      await new Promise(resolve => {
        const operation = spawn(killer, ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, shell: false, stdio: 'ignore' });
        const timer = setTimeout(() => { operation.kill(); child.kill(); resolve(); }, 3000);
        operation.once('error', () => { clearTimeout(timer); child.kill(); resolve(); });
        operation.once('close', () => { clearTimeout(timer); resolve(); });
      });
    } else {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    }
    await new Promise(resolve => { const timer = setTimeout(resolve, 2000); void task.childExit.then(() => { clearTimeout(timer); resolve(); }); });
    if (!task.childClosed) task.cleanupWarnings.add('Node 프로세스 종료 완료를 확인하지 못했습니다.');
  }

  async function finish(task, status, extra = {}) {
    if (task.settled) return task.done;
    task.settled = true;
    clearTimeout(task.timer);
    task.abort.abort();
    await task.preparing?.catch(() => {});
    await killChild(task);
    if (task.workspace) {
      try { assertChildPath(base, task.workspace); await rm(task.workspace, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
      catch { task.cleanupWarnings.add('임시 Node 작업 공간 삭제를 확인하지 못했습니다.'); }
    }
    const result = { ...task.identity, status, actualRuntime: environment.actualRuntime, environmentFingerprint: nodeEnvironmentFingerprint(environment.environmentFingerprint, task.exercise), stdout: task.stdout.join('\n'), stderr: task.stderr.join('\n'), compilerOutput: '', checks: [], outputTruncated: task.outputTruncated, durationMs: Date.now() - task.started, limits: nodeLimits, limitations: nodeLimitations, ...(task.cleanupWarnings.size ? { cleanupWarning: [...task.cleanupWarnings].join(' ') } : {}), ...extra };
    if (task.cleanupWarnings.size && ['ready', 'success'].includes(result.status)) result.status = 'infrastructure-error';
    if (active === task) active = undefined;
    const prior = completed.get(task.identity.requestId);
    const results = prior?.key === task.key ? prior.results : new Map();
    results.set(task.mode, result);
    completed.set(task.identity.requestId, { key: task.key, results, expires: Date.now() + 60000 });
    while (completed.size > 32) completed.delete(completed.keys().next().value);
    task.resolve(result);
    return result;
  }

  function appendOutput(task, stream, value, truncated = false) {
    if (!['stdout', 'stderr'].includes(stream) || typeof value !== 'string') throw new Error('Node 출력 형식이 올바르지 않습니다.');
    task.outputTruncated ||= truncated;
    const lines = value.split('\n');
    const remainingLines = nodeLimits.outputLines - task.outputLines;
    const remainingBytes = Math.max(0, nodeLimits.outputBytes - task.outputBytes - 1);
    if (remainingLines <= 0 || remainingBytes <= 0) { task.outputTruncated = true; return; }
    let text = lines.slice(0, remainingLines).join('\n');
    const bytes = encoder.encode(text);
    if (bytes.byteLength > remainingBytes) { text = decoder.decode(bytes.slice(0, remainingBytes)); while (encoder.encode(text).byteLength > remainingBytes) text = text.slice(0, -1); }
    task.outputTruncated ||= lines.length > remainingLines || bytes.byteLength > remainingBytes;
    task.outputBytes += encoder.encode(text).byteLength + 1;
    task.outputLines += text.split('\n').length;
    if (task.workspace) text = text.split(task.workspace).join('<workspace>');
    task[stream].push(text);
  }

  async function createWorkspace(task, snapshot) {
    task.workspace = await mkdtemp(path.join(base, 'job-'));
    const files = path.join(task.workspace, 'files');
    const trusted = path.join(task.workspace, 'trusted');
    const data = path.join(task.workspace, 'data');
    const home = path.join(task.workspace, 'runtime-home');
    for (const directory of [files, trusted, data, home]) await mkdir(directory);
    for (const [name, content] of Object.entries(snapshot.files)) {
      const target = path.join(files, name);
      assertChildPath(files, target);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content, { flag: 'wx' });
    }
    const bridgePath = path.join(files, '__edu_bridge__.mjs');
    await writeFile(bridgePath, `import * as submission from ${JSON.stringify(`./${snapshot.entry}`)}; export { submission };\n`, { flag: 'wx' });
    for (const name of ['node-supervisor.mjs', 'node-worker.mjs']) await writeFile(path.join(trusted, name), await readFile(new URL(name, trustedRoot)), { flag: 'wx' });
    const dataRoots = [];
    for (let index = 0; index < (task.mode === 'submit' ? task.cases.length : 1); index++) {
      const root = path.join(data, `case-${index}`);
      await mkdir(root);
      dataRoots.push(root);
      const fixture = task.mode === 'submit' ? task.exercise.nodeFixtures?.find(item => item.caseId === task.cases[index].id) : undefined;
      if (fixture?.kind === 'linked-directory') {
        // Trusted fixed fixture only: all paths stay inside this owned data root.
        // Learner Workers keep their existing permissions and never create links.
        const allowed = path.join(root, 'allowed');
        const outside = path.join(root, 'outside');
        await mkdir(allowed);
        await mkdir(outside);
        await writeFile(path.join(outside, 'secret.txt'), 'original', { flag: 'wx' });
        await symlink(outside, path.join(allowed, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
      }
    }
    const permissionArgs = ['--permission', `--allow-fs-read=${task.workspace}`, `--allow-fs-write=${data}`, `--allow-fs-write=${home}`, '--no-addons'];
    task.spawn = { supervisor: path.join(trusted, 'node-supervisor.mjs'), home, data, permissionArgs, job: { mode: task.mode, cases: task.cases.map(item => ({ id: item.id, probe: item.probe })), runProbe: task.exercise.runner.runProbe, requiredFeatures: task.exercise.requiredFeatures ?? [], allowWorker: task.exercise.nodeCapabilities?.allowWorker === true,
      workerArgs: [...permissionArgs, ...(task.exercise.nodeCapabilities?.allowWorker === true ? ['--allow-worker'] : [])], dataRoots, bridgePath, bridgeUrl: pathToFileURL(bridgePath).href, httpBase, caseTimeoutMs: caseDuration, limits: nodeLimits, valueLimits: executionLimits } };
  }

  async function launch(task, source) {
    try {
      const snapshot = validateNodeSnapshot(task.exercise, source);
      task.cases = task.mode === 'submit'
        ? validateGrader(await loader(task.exercise, { signal: task.abort.signal }), task.exercise)
        : [];
      if (task.settled) return;
      task.preparing = createWorkspace(task, snapshot);
      await task.preparing;
      if (task.settled) return;
      const auth = randomBytes(32);
      let sequence = 0;
      const child = spawn(resolvedExecutable, [...task.spawn.permissionArgs, '--allow-worker', '--max-old-space-size=64', task.spawn.supervisor], { cwd: task.spawn.data, env: minimalEnvironment(task.spawn.home), windowsHide: true, shell: false, detached: process.platform !== 'win32', serialization: 'advanced', stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
      task.child = child;
      task.childExit = new Promise(resolve => { child.once('close', () => { task.childClosed = true; resolve(); }); });
      child.stdout.on('data', chunk => { if (!task.settled) appendOutput(task, 'stdout', chunk.toString()); });
      child.stderr.on('data', chunk => { if (!task.settled) appendOutput(task, 'stderr', chunk.toString()); });
      child.on('error', () => { void finish(task, 'infrastructure-error', { stderr: 'Node 실행 프로세스를 시작하지 못했습니다.' }); });
      child.on('exit', code => {
        if (!task.settled) {
          task.cleanupWarnings.add('Node 프로세스가 예상보다 일찍 종료되어 하위 프로세스 정리를 확인하지 못했습니다.');
          void finish(task, 'runtime-error', { stderr: `관찰 완료 전에 Node 프로세스가 종료되었습니다. exit=${code}` });
        }
      });
      child.on('message', envelope => {
        if (task.settled) return;
        try {
          if (!record(envelope) || envelope.protocol !== nodeProtocol || envelope.sequence !== sequence + 1 || typeof envelope.mac !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.mac)) throw new Error('Node supervisor 인증 응답이 올바르지 않습니다.');
          const bytes = serialize(envelope.payload);
          if (bytes.byteLength > 1048576) throw new Error('Node 응답 크기가 제한을 넘었습니다.');
          const expectedMac = createHmac('sha256', auth).update(String(envelope.sequence)).update(bytes).digest();
          if (!timingSafeEqual(expectedMac, Buffer.from(envelope.mac, 'hex'))) throw new Error('위조된 Node supervisor 응답입니다.');
          sequence++;
          const message = envelope.payload;
          if (message.type === 'output') { appendOutput(task, message.stream, message.text, message.truncated === true); return; }
          if (message.type === 'case') {
            const item = task.cases[task.checks.length];
            if (task.mode !== 'submit' || !item) throw new Error('Node 검사 수가 일치하지 않습니다.');
            const [check] = gradeWorkerResults(message.result, [item]);
            task.resultBytes += serialize(check.actual).byteLength;
            if (task.resultBytes > nodeLimits.resultBytes) throw new Error('Node 관찰 결과가 전체 상한을 넘었습니다.');
            task.checks.push(check);
            return;
          }
          if (message.type !== 'complete' || !['ready', 'success', 'module-load-error', 'runtime-error', 'infrastructure-error', 'timeout'].includes(message.status)) throw new Error('Node 결과 상태가 올바르지 않습니다.');
          if (task.mode === 'prepare' && message.status === 'ready') { void finish(task, 'ready'); return; }
          if (task.mode === 'run' && message.status === 'success' && Object.hasOwn(message, 'runValue') && isBehaviorValue(message.runValue)) { void finish(task, 'success', { runValue: message.runValue }); return; }
          if (task.mode === 'submit' && message.status === 'success') {
            if (!task.checks.length || task.checks.length !== task.cases.length) throw new Error('Node 고정 검사가 누락되었습니다.');
            void finish(task, task.checks.every(check => check.passed) ? 'success' : 'checks-failed', { checks: task.checks });
            return;
          }
          const error = typeof message.error === 'string' ? message.error.slice(0, 2000).split(task.workspace).join('<workspace>') : 'Node 관찰을 완료하지 못했습니다.';
          const missing = Array.isArray(message.missingFeatures) && message.missingFeatures.every(feature => task.exercise.requiredFeatures?.includes(feature)) ? message.missingFeatures : null;
          void finish(task, ['module-load-error', 'runtime-error', 'infrastructure-error', 'timeout'].includes(message.status) ? message.status : 'infrastructure-error', { stderr: [task.stderr.join('\n'), error].filter(Boolean).join('\n'), ...(missing?.length ? { available: false, missingFeatures: missing, reason: error } : {}), ...(message.timedOutCaseId ? { timedOutCaseId: message.timedOutCaseId } : {}) });
        } catch (error) { void finish(task, 'infrastructure-error', { stderr: error.message }); }
      });
      child.send({ protocol: nodeProtocol, auth: auth.toString('hex'), job: task.spawn.job });
    } catch (error) { if (!task.settled) await finish(task, 'infrastructure-error', { stderr: error?.message ?? 'Node 작업 공간 준비에 실패했습니다.' }); }
  }

  function start(mode, request, exercise, key) {
    const task = { mode, identity: Object.fromEntries(identityFields.filter(field => typeof request[field] === 'string').map(field => [field, request[field]])), key, exercise, started: Date.now(), abort: new AbortController(), stdout: [], stderr: [], outputBytes: 0, outputLines: 0, outputTruncated: false, checks: [], resultBytes: 0, cleanupWarnings: new Set(), settled: false };
    task.done = new Promise(resolve => { task.resolve = resolve; });
    active = task;
    task.timer = setTimeout(() => { void finish(task, 'timeout', { stderr: '전체 Node 실행 시간이 제한을 넘었습니다.' }); }, duration);
    void launch(task, request.source);
    return task;
  }

  const authorized = supplied => typeof supplied === 'string' && /^[A-Za-z0-9_-]{43}$/.test(supplied) && timingSafeEqual(Buffer.from(supplied), Buffer.from(token));
  const send = (res, status, data) => {
    if (res.destroyed || res.headersSent) return;
    const value = data?.status ? { ...data, valueEncoding: 'javascript-edu-value-v1', ...(Object.hasOwn(data, 'runValue') ? { runValue: encodeNodeValue(data.runValue) } : {}), ...(Array.isArray(data.checks) ? { checks: data.checks.map(check => ({ ...check, ...(Object.hasOwn(check, 'actual') ? { actual: encodeNodeValue(check.actual) } : {}), ...(Object.hasOwn(check, 'expected') ? { expected: encodeNodeValue(check.expected) } : {}) })) } : {}) } : data;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    res.end(JSON.stringify(value));
  };

  async function handle(req, res, origin) {
    if (!req.url?.startsWith('/_node/')) return false;
    const reply = (status, error) => { send(res, status, { error }); return true; };
    let expectedHost;
    try { const url = new URL(origin); if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.origin !== origin || !url.port) return reply(403, 'Local origin required'); expectedHost = url.host; } catch { return reply(403, 'Local origin required'); }
    if (closed || req.headers.host !== expectedHost || (req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') return reply(403, 'Local Node execution is unavailable');
    if (/[?%#\\]/.test(req.url)) return reply(400, 'Invalid Node execution URL');
    for (const [id, item] of completed) if (item.expires <= Date.now()) completed.delete(id);
    for (const [id, expiry] of cancelled) if (expiry <= Date.now()) cancelled.delete(id);
    if (req.url === '/_node/config') {
      if (req.method !== 'GET') return reply(405, 'GET required');
      send(res, 200, { token, ...await getEnvironment() }); return true;
    }
    if (!['POST', 'DELETE'].includes(req.method)) return reply(405, 'POST or DELETE required');
    if (req.headers.origin !== origin || !authorized(req.headers['x-execution-token'])) return reply(403, 'Local execution authorization required');
    const cancelMatch = /^\/_node\/jobs\/([A-Za-z0-9][A-Za-z0-9_.:-]{0,127})$/.exec(req.url);
    if (req.method === 'DELETE' && cancelMatch) {
      cancelled.set(cancelMatch[1], Date.now() + 60000);
      while (cancelled.size > 100) cancelled.delete(cancelled.keys().next().value);
      const outcome = active?.identity.requestId === cancelMatch[1] ? await finish(active, 'cancelled') : null;
      const warnings = [outcome?.cleanupWarning, ...[...(completed.get(cancelMatch[1])?.results.values() ?? [])].map(result => result.cleanupWarning)].filter(Boolean);
      send(res, 200, { status: 'cancelled', requestId: cancelMatch[1], ...(warnings.length ? { cleanupWarning: [...new Set(warnings)].join(' ') } : {}) }); return true;
    }
    if (req.url !== '/_node/jobs' || req.method !== 'POST') return reply(404, 'Unknown Node execution operation');
    if (active || pending >= nodeLimits.pending) return reply(429, 'Only one Node job is allowed; no background queue');
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) return reply(415, 'JSON required');
    const announcedLength = Number(req.headers['content-length']);
    if (Number.isFinite(announcedLength) && announcedLength > nodeLimits.bodyBytes) return reply(413, 'Request too large');
    pending++;
    let reserved = true;
    const timer = setTimeout(() => { send(res, 408, { error: 'Node request body deadline exceeded' }); req.destroy(); }, nodeLimits.bodyTimeoutMs);
    try {
      let bytes = 0;
      const chunks = [];
      for await (const chunk of req) { bytes += chunk.length; if (bytes > nodeLimits.bodyBytes) return reply(413, 'Request too large'); chunks.push(chunk); }
      clearTimeout(timer);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!record(body) || Object.keys(body).some(key => !['mode', 'request', 'consent'].includes(key)) || !['prepare', 'run', 'submit'].includes(body.mode) || !record(body.request)) return reply(400, 'Invalid Node job');
      if (body.mode !== 'prepare' && body.consent !== true) return reply(403, 'Explicit local-code consent is required');
      const request = body.request;
      const exercise = catalog.get(request.exerciseId);
      if (!exercise || Object.keys(request).some(key => ![...identityFields, 'source'].includes(key)) || identityFields.filter(field => field !== 'lessonId').some(field => typeof request[field] !== 'string' || !request[field] || request[field].length > 300) || !requestIdPattern.test(request.requestId) || request.contentRevision !== exercise.contentRevision || (request.lessonId !== undefined && request.lessonId !== exercise.lessonId) || (exercise.profileByVersion && !Object.hasOwn(exercise.profileByVersion, request.targetVersion)) || typeof request.source !== 'string') return reply(400, 'Invalid Node exercise identity');
      validateNodeSnapshot(exercise, request.source);
      if (request.sourceFingerprint !== `sha256:${createHash('sha256').update(request.source).digest('hex')}`) return reply(400, 'Node source fingerprint mismatch');
      // A UI operation prepares and then runs/submits the same snapshot with one
      // lifecycle ID. Cache each phase while binding that ID to immutable code.
      const key = createHash('sha256').update(JSON.stringify([...identityFields.map(field => request[field]), request.source])).digest('hex');
      if (completed.has(request.requestId)) {
        const prior = completed.get(request.requestId);
        if (prior.key !== key) return reply(409, 'Request ID already belongs to another code snapshot');
        if (prior.results.has(body.mode)) { send(res, 200, prior.results.get(body.mode)); return true; }
      }
      const env = await getEnvironment();
      if (req.aborted || res.destroyed) return true;
      if (!env.available) { send(res, 200, { ...Object.fromEntries(identityFields.map(field => [field, request[field]])), ...env, environmentFingerprint: nodeEnvironmentFingerprint(env.environmentFingerprint, exercise), status: 'infrastructure-error', stdout: '', stderr: env.reason, compilerOutput: '', checks: [] }); return true; }
      if (cancelled.has(request.requestId)) { send(res, 200, { ...request, source: undefined, actualRuntime: env.actualRuntime, environmentFingerprint: nodeEnvironmentFingerprint(env.environmentFingerprint, exercise), status: 'cancelled', checks: [], stdout: '', stderr: '', compilerOutput: '' }); return true; }
      if (active || closed) return reply(429, 'Node execution is busy');
      const task = start(body.mode, request, exercise, key);
      pending--; reserved = false;
      res.once('close', () => { if (!res.writableEnded && !task.settled) void finish(task, 'cancelled'); });
      send(res, 200, await task.done);
      return true;
    } catch (error) { return reply(400, error instanceof SyntaxError ? 'Invalid Node job JSON' : error?.message ?? 'Node request failed'); }
    finally { clearTimeout(timer); if (reserved) pending--; }
  }

  async function close() {
    closed = true;
    if (active) await finish(active, 'cancelled');
    await preparation?.catch(() => {});
    if (base) { assertChildPath(resolvedWorkspaceParent, base); await rm(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
  }
  return Object.freeze({ handle, close, getEnvironment });
}
