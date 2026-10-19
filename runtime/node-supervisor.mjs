import { Worker, MessageChannel } from 'node:worker_threads';
import { createHmac } from 'node:crypto';
import { serialize } from 'node:v8';

const protocol = 'javascript-edu-node-v1';
let initialized = false;
let stopActive;
let authenticatedSend;
let outputBytes = 0;
let outputLines = 0;
let outputTruncated = false;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
// The trusted provider starts POSIX supervisors with detached:true, making this
// fresh PID the session/process-group leader. A group with this still-live PID
// must exist before any learner Worker starts. No caller-supplied PGID is used.
let ownedPosixProcessGroup;
if (process.platform !== 'win32' && process.pid > 1) {
  try { process.kill(-process.pid, 0); ownedPosixProcessGroup = process.pid; } catch { /* Fail closed before starting a learner below. */ }
}

process.on('message', async function initialize(message) {
  if (initialized || message?.protocol !== protocol || typeof message.auth !== 'string' || !/^[a-f0-9]{64}$/.test(message.auth)) return;
  initialized = true;
  process.off('message', initialize);
  const secret = Buffer.from(message.auth, 'hex');
  const job = message.job;
  let sequence = 0;
  authenticatedSend = payload => {
    if (!process.connected) return;
    const bytes = serialize(payload);
    if (bytes.byteLength > 1048576) payload = { type: 'complete', status: 'infrastructure-error', error: 'Node supervisor 결과 크기가 제한을 넘었습니다.' };
    const index = ++sequence;
    const mac = createHmac('sha256', secret).update(String(index)).update(serialize(payload)).digest('hex');
    process.send({ protocol, sequence: index, payload, mac });
  };
  if (process.platform !== 'win32' && !ownedPosixProcessGroup) {
    authenticatedSend({ type: 'complete', status: 'infrastructure-error', error: '독립 Node 프로세스 그룹의 소유권을 확인하지 못했습니다.' });
    return;
  }
  const output = (stream, value, truncated = false) => {
    if (outputTruncated) return;
    const text = typeof value === 'string' ? value : decoder.decode(value);
    const remainingLines = Math.max(0, job.limits.outputLines - outputLines);
    const remainingBytes = Math.max(0, job.limits.outputBytes - outputBytes - 1);
    const lines = text.split('\n');
    let bounded = lines.slice(0, remainingLines).join('\n');
    const bytes = encoder.encode(bounded);
    if (bytes.byteLength > remainingBytes) {
      bounded = decoder.decode(bytes.slice(0, remainingBytes));
      while (encoder.encode(bounded).byteLength > remainingBytes) bounded = bounded.slice(0, -1);
    }
    outputTruncated = truncated || lines.length > remainingLines || bytes.byteLength > remainingBytes;
    outputBytes += encoder.encode(bounded).byteLength + 1;
    outputLines += bounded.split('\n').length;
    authenticatedSend({ type: 'output', stream, text: bounded, truncated: outputTruncated });
  };
  const execute = (mode, item, index) => new Promise(resolve => {
    let settled = false;
    let worker;
    let channel;
    let timer;
    const stop = async outcome => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      channel?.port1.close();
      channel?.port2.close();
      if (worker) await worker.terminate().catch(() => {});
      stopActive = null;
      resolve(outcome);
    };
    stopActive = stop;
    timer = setTimeout(() => { void stop({ type: 'complete', status: 'timeout', error: '개별 Node 실행 시간이 제한을 넘었습니다.', ...(item ? { timedOutCaseId: item.id } : {}) }); }, job.caseTimeoutMs);
    try {
      const context = { workspaceRoot: job.dataRoots[index], runtimeVersion: process.versions.node, ...(job.httpBase ? { httpBase: job.httpBase } : {}) };
      process.chdir(context.workspaceRoot);
      channel = new MessageChannel();
      worker = new Worker(new URL('./node-worker.mjs', import.meta.url), { execArgv: job.workerArgs, resourceLimits: { maxOldGenerationSizeMb: job.limits.heapMb, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 }, stdout: true, stderr: true });
      worker.stdout.on('data', chunk => output('stdout', chunk));
      worker.stderr.on('data', chunk => output('stderr', chunk));
      // Public Worker messages are deliberately ignored, including forged PASS.
      worker.on('error', error => { void stop({ type: 'complete', status: 'runtime-error', error: String(error?.message ?? 'Node Worker 실패').slice(0, 2000) }); });
      worker.on('exit', code => { if (!settled) void stop({ type: 'complete', status: 'runtime-error', error: `관찰 완료 전에 Node Worker가 종료되었습니다. exit=${code}` }); });
      channel.port1.on('message', observation => {
        if (settled) return;
        if (observation?.protocol !== protocol) { void stop({ type: 'complete', status: 'infrastructure-error', error: 'Node private port 응답이 올바르지 않습니다.' }); return; }
        if (observation.type === 'output' && ['stdout', 'stderr'].includes(observation.stream) && typeof observation.text === 'string') { output(observation.stream, observation.text, observation.truncated === true); return; }
        if (observation.type !== 'complete') { void stop({ type: 'complete', status: 'infrastructure-error', error: '알 수 없는 Node 관찰 응답입니다.' }); return; }
        void stop(observation);
      });
      worker.postMessage({ protocol, port: channel.port2, mode, context, allowWorker: job.allowWorker, bridgeUrl: job.bridgeUrl, bridgePath: job.bridgePath, requiredFeatures: job.requiredFeatures,
        runProbe: job.runProbe, cases: item ? [{ id: item.id, probe: item.probe }] : [], limits: job.valueLimits }, [channel.port2]);
    } catch (error) { void stop({ type: 'complete', status: 'infrastructure-error', error: String(error?.message ?? 'Node Worker 준비 실패').slice(0, 2000) }); }
  });
  try {
    if (job.mode === 'submit') {
      for (let index = 0; index < job.cases.length; index++) {
        const result = await execute('submit', job.cases[index], index);
        if (result.status !== 'success') { authenticatedSend(result); return; }
        authenticatedSend({ type: 'case', result });
      }
      authenticatedSend({ type: 'complete', status: 'success' });
    } else authenticatedSend(await execute(job.mode, null, 0));
  } catch (error) { authenticatedSend({ type: 'complete', status: 'infrastructure-error', error: String(error?.message ?? 'Node supervisor 실패').slice(0, 2000) }); }
  // Remain alive until the web parent kills this process tree. Exiting here
  // would make descendant cleanup less reliable on Windows.
});

process.on('disconnect', () => {
  if (process.platform !== 'win32') {
    if (ownedPosixProcessGroup) {
      // A killed service cannot perform its usual -supervisorPid cleanup. Kill
      // our verified group, including this supervisor and same-group children.
      // Descendants that explicitly create another group/session are not covered.
      try { process.kill(-ownedPosixProcessGroup, 'SIGKILL'); return; } catch { /* Never report unsuccessful reclamation as clean shutdown. */ }
    }
    process.exit(1);
  }
  void stopActive?.({ type: 'complete', status: 'cancelled' });
  process.exit(0);
});
process.on('uncaughtException', error => { authenticatedSend?.({ type: 'complete', status: 'infrastructure-error', error: String(error?.message ?? 'Node supervisor 오류').slice(0, 2000) }); });
