import { parentPort } from 'node:worker_threads';

parentPort.on('message', ({ id, values, delayMs = 0, duplicateAfterMs = 0, fail = false }) => {
  const complete = () => {
    if (fail) throw new Error('fixture-worker-failure');
    let sum = 0;
    for (const value of values) sum += value;
    const message = { id, sum };
    parentPort.postMessage(message);
    if (duplicateAfterMs > 0) setTimeout(() => parentPort.postMessage(message), duplicateAfterMs);
  };
  if (delayMs > 0) setTimeout(complete, delayMs);
  else complete();
});
