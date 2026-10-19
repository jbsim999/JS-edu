export function createWorkerAggregator(options) {
  const {workerURL, onResult, makeWorker = url => new Worker(url)} = options;
  const worker = makeWorker(workerURL);
  let requestId = 0;
  let lastSum = null;
  worker.addEventListener('message', event => { lastSum = event.data.sum; onResult(event.data); });
  return {
    submit(values) { worker.postMessage({requestId: ++requestId, values}); return requestId; },
    cancel() {},
    dispose() {},
    getState() { return {status: 'done', requestId, lastSum}; }
  };
}
