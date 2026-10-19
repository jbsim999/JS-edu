export function createWorkerAggregator(options) {
  const {workerURL, onResult, onError = () => {}, makeWorker = url => new Worker(url)} = options;
  let worker = null;
  let lifecycle = null;
  let counter = 0;
  let active = null;
  let status = 'idle';
  let lastSum = null;
  let disposed = false;
  function stopWorker() {
    lifecycle?.abort();
    lifecycle = null;
    if (worker) { worker.terminate(); worker = null; }
  }
  function workerFailure(message) {
    if (disposed || active === null) return;
    const requestId = active;
    active = null;
    status = 'error';
    stopWorker();
    onError({requestId, message});
  }
  function ensureWorker() {
    if (worker) return;
    worker = makeWorker(workerURL);
    lifecycle = new AbortController();
    worker.addEventListener('message', event => {
      const data = event.data;
      if (disposed || active === null || !data || data.requestId !== active || typeof data.sum !== 'number' || !Number.isFinite(data.sum)) return;
      const requestId = active;
      active = null;
      status = 'done';
      lastSum = data.sum;
      onResult({requestId, sum: data.sum});
    }, {signal: lifecycle.signal});
    worker.addEventListener('error', event => {
      event.preventDefault();
      workerFailure(typeof event.message === 'string' ? event.message : 'Worker failed');
    }, {signal: lifecycle.signal});
    worker.addEventListener('messageerror', () => workerFailure('Message deserialization failed'), {signal: lifecycle.signal});
  }
  return {
    submit(values) {
      if (disposed) throw new DOMException('Aggregator disposed', 'InvalidStateError');
      if (!Array.isArray(values) || values.length > 100000) throw new TypeError('Expected a bounded array');
      const copy = [];
      for (let index = 0; index < values.length; index++) {
        if (!Object.hasOwn(values, index) || !Number.isSafeInteger(values[index]) || Math.abs(values[index]) > 1000000) throw new TypeError('Expected finite own numbers');
        copy.push(values[index]);
      }
      const requestId = ++counter;
      active = requestId;
      status = 'running';
      try {
        ensureWorker();
        worker.postMessage({requestId, values: copy});
      } catch (error) {
        active = null;
        status = 'error';
        stopWorker();
        throw error;
      }
      return requestId;
    },
    cancel() {
      if (disposed) return;
      active = null;
      status = 'cancelled';
      stopWorker();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active = null;
      status = 'disposed';
      stopWorker();
    },
    getState() { return {status, requestId: counter, lastSum}; }
  };
}
