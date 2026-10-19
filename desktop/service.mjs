import { createLearningServer } from '../web/serve.mjs';

// Only the native shell owns this IPC channel. No HTTP endpoint can stop the app.
if (!process.send || process.argv.length !== 3 || !/^\d{1,5}$/.test(process.argv[2])
    || Number(process.argv[2]) > 65535 || process.versions.node !== '24.22.0') {
  console.error('이 학습 서버는 포함된 Node.js 24.22.0과 데스크톱 앱의 IPC로 시작해야 합니다.');
  process.exitCode = 1;
} else {
  const server = createLearningServer({ qualification: false, nodeExecutable: process.execPath });
  let closing;
  const send = message => { if (process.connected) process.send(message, () => {}); };
  async function shutdown() {
    if (!closing) closing = (async () => {
      const error = await new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections();
      });
      send({ type: 'closed', ok: !error, ...(error ? { error: '학습 실행기 정리를 완료하지 못했습니다.' } : {}) });
      process.exitCode = error ? 1 : 0;
      if (process.connected) process.disconnect();
    })();
    return closing;
  }
  process.on('message', message => { if (message?.type === 'shutdown') void shutdown(); });
  // The pipe closes even when the native shell is forcibly killed. This is not a Job Object.
  process.once('disconnect', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
  process.once('SIGINT', () => { void shutdown(); });
  server.once('error', error => {
    send({ type: 'failed', code: error.code === 'EADDRINUSE' ? 'EADDRINUSE' : 'START_FAILED' });
    void shutdown();
  });
  server.listen(Number(process.argv[2]), '127.0.0.1', () => {
    const address = server.address();
    if (!closing && address && typeof address === 'object') send({ type: 'ready', port: address.port, runtime: process.versions.node });
  });
}
