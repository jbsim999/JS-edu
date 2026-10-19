import { spawn } from 'node:child_process';
import path from 'node:path';
import { serviceEnvironment } from './policy.mjs';

export function launchLearningService({ executable, projectRoot, port, startupTimeoutMs = 15000, shutdownTimeoutMs = 12000 }) {
  if (!path.isAbsolute(executable) || !path.isAbsolute(projectRoot) || !Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError('고정 실행 파일, 프로젝트 경로와 로컬 포트가 필요합니다.');
  const child = spawn(executable, [path.join(projectRoot, 'desktop', 'service.mjs'), String(port)], {
    // Windows libuv otherwise kills attached children immediately when Electron
    // dies, before the IPC disconnect handler can remove learner workspaces.
    // Keep the IPC/reference active (no unref); only avoid that parent-exit kill.
    cwd: projectRoot, env: serviceEnvironment(), windowsHide: true, detached: process.platform === 'win32', shell: false, stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  let stderr = '';
  let closedMessage;
  let stop;
  let exited = false;
  let startupTimer;
  const exit = new Promise(resolve => child.once('exit', (code, signal) => { exited = true; resolve({ code, signal }); }));
  child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-4096); });
  const ready = new Promise((resolve, reject) => {
    startupTimer = setTimeout(() => { reject(new Error('학습 서버 시작 제한 시간을 넘었습니다.')); void close().catch(() => {}); }, startupTimeoutMs);
    child.once('error', error => { clearTimeout(startupTimer); reject(error); });
    child.once('exit', () => { clearTimeout(startupTimer); reject(new Error('학습 서버가 시작 전에 종료됐습니다.')); });
    child.on('message', message => {
      if (message?.type === 'closed') closedMessage = message;
      if (message?.type === 'ready' && Number.isInteger(message.port) && message.port >= 1024 && message.port <= 65535 && message.runtime === '24.22.0') {
        clearTimeout(startupTimer);
        resolve({ origin: `http://127.0.0.1:${message.port}`, port: message.port, runtime: message.runtime });
      } else if (message?.type === 'failed') {
        clearTimeout(startupTimer);
        reject(new Error(message.code === 'EADDRINUSE'
          ? '저장된 학습 주소의 포트를 다른 프로그램이 사용하고 있습니다. 해당 프로그램을 닫고 다시 실행하세요. 초안과 진도는 보존됩니다.'
          : '학습 서버를 시작하지 못했습니다.'));
      }
    });
  });
  async function close() {
    if (!stop) stop = (async () => {
      clearTimeout(startupTimer);
      if (exited) return { ok: closedMessage?.ok === true, error: closedMessage?.error };
      if (child.connected) child.send({ type: 'shutdown' }, () => {});
      let timer;
      const result = await Promise.race([exit, new Promise(resolve => { timer = setTimeout(() => resolve(null), shutdownTimeoutMs); })]);
      clearTimeout(timer);
      if (!result) {
        // Kill only this owned process tree after graceful cleanup times out.
        if (process.platform === 'win32' && child.pid) {
          await new Promise(resolve => {
            const killer = spawn(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, shell: false, stdio: 'ignore' });
            const killTimer = setTimeout(() => { killer.kill(); child.kill(); resolve(); }, 3000);
            killer.once('error', () => { clearTimeout(killTimer); child.kill(); resolve(); });
            killer.once('close', () => { clearTimeout(killTimer); resolve(); });
          });
        } else {
          // SIGTERM can be handled (or ignored) by a stalled service. After the
          // graceful deadline, reclaim this exact owned PID with SIGKILL and
          // wait for its exit. This is not a claim about arbitrary descendants.
          child.kill('SIGKILL');
          let forcedTimer;
          await Promise.race([exit, new Promise(resolve => { forcedTimer = setTimeout(resolve, 3000); })]);
          clearTimeout(forcedTimer);
          if (!exited) return { ok: false, error: '종료 제한 시간이 지났으며 소유 실행기 프로세스의 종료도 확인하지 못했습니다.' };
        }
        return { ok: false, error: '종료 제한 시간 안에 실행기 정리를 확인하지 못했습니다.' };
      }
      return { ok: result.code === 0 && closedMessage?.ok === true, error: closedMessage?.error };
    })();
    return stop;
  }
  return { child, ready, close, exit, diagnostics: () => ({ stderr, closedMessage, exited }) };
}
