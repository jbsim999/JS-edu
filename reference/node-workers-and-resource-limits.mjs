import { Worker } from 'node:worker_threads';

export function createSumPool({ size = 2, maxQueued = 2, timeoutMs = 1000, makeWorker = (url, options) => new Worker(url, options) } = {}) {
  for (const [value, min, max] of [[size, 1, 4], [maxQueued, 0, 8], [timeoutMs, 1, 10000]]) {
    if (!Number.isInteger(value) || value < min || value > max) throw new RangeError('Invalid pool limits');
  }
  if (typeof makeWorker !== 'function') throw new TypeError('Worker factory required');
  const slots = Array.from({ length: size }, () => ({ worker: null, task: null, retiring: null, listeners: null }));
  const queue = [];
  let state = 'open';
  let nextId = 0;
  let closePromise;
  const failure = (code, cause) => Object.assign(new Error(code, cause === undefined ? undefined : { cause }), { code });
  const detach = task => {
    clearTimeout(task.timer);
    task.signal?.removeEventListener('abort', task.abort);
  };
  const retire = slot => {
    if (slot.retiring) return slot.retiring;
    if (!slot.worker) return Promise.resolve();
    const worker = slot.worker;
    slot.retiring = worker.terminate().finally(() => {
      const listeners = slot.listeners;
      if (listeners) for (const [name, listener] of Object.entries(listeners)) worker.off(name, listener);
      if (slot.worker === worker) { slot.worker = null; slot.listeners = null; }
      slot.retiring = null;
      pump();
    });
    return slot.retiring;
  };
  const settle = (slot, rejected, value, disposeWorker = false) => {
    const task = slot.task;
    if (!task) return;
    slot.task = null;
    detach(task);
    if (disposeWorker) void retire(slot);
    if (rejected) task.reject(value);
    else task.resolve(value);
    pump();
  };
  const ensureWorker = slot => {
    if (slot.worker) return slot.worker;
    const worker = makeWorker(new URL('./worker.mjs', import.meta.url), { resourceLimits: { maxOldGenerationSizeMb: 32, stackSizeMb: 4 } });
    slot.worker = worker;
    const listeners = {
      message(message) {
        if (slot.worker !== worker || slot.retiring || !slot.task || message?.id !== slot.task.id) return;
        if (!Number.isSafeInteger(message.sum)) { settle(slot, true, failure('WORKER_FAILURE'), true); return; }
        settle(slot, false, message.sum);
      },
      error(error) {
        if (slot.worker !== worker || slot.retiring) return;
        if (slot.task) settle(slot, true, failure('WORKER_FAILURE', error), true);
        else void retire(slot);
      },
      messageerror(error) {
        if (slot.worker === worker && !slot.retiring && slot.task) settle(slot, true, failure('WORKER_FAILURE', error), true);
      },
      exit() {
        if (slot.worker !== worker || slot.retiring) return;
        if (slot.task) settle(slot, true, failure('WORKER_FAILURE'), true);
        else void retire(slot);
      }
    };
    slot.listeners = listeners;
    for (const [name, listener] of Object.entries(listeners)) worker.on(name, listener);
    return worker;
  };
  const dispatch = (slot, task) => {
    slot.task = task;
    task.slot = slot;
    task.timer = setTimeout(() => settle(slot, true, failure('TIMEOUT'), true), timeoutMs);
    try {
      ensureWorker(slot).postMessage({ id: task.id, values: task.values, delayMs: task.delayMs, duplicateAfterMs: task.duplicateAfterMs, fail: task.fail });
    } catch (error) { settle(slot, true, failure('WORKER_FAILURE', error), true); }
  };
  function pump() {
    if (state !== 'open') return;
    for (const slot of slots) {
      if (!slot.task && !slot.retiring && queue.length > 0) dispatch(slot, queue.shift());
    }
  }
  return {
    submit(values, { signal, delayMs = 0, duplicateAfterMs = 0, fail = false } = {}) {
      if (state !== 'open') return Promise.reject(failure('POOL_CLOSED'));
      if (!Array.isArray(values) || values.length > 100000) return Promise.reject(new TypeError('Dense integer array required'));
      for (let index = 0; index < values.length; index += 1) {
        if (!Object.hasOwn(values, index) || !Number.isSafeInteger(values[index]) || Math.abs(values[index]) > 1000000) return Promise.reject(new TypeError('Dense bounded own integers required'));
      }
      for (const [value, max] of [[delayMs, 3000], [duplicateAfterMs, 1000]]) {
        if (!Number.isInteger(value) || value < 0 || value > max) return Promise.reject(new RangeError('Invalid fixture delay'));
      }
      if (typeof fail !== 'boolean' || (signal !== undefined && !(signal instanceof AbortSignal))) return Promise.reject(new TypeError('Invalid task options'));
      if (signal?.aborted) return Promise.reject(signal.reason);
      const hasFreeSlot = slots.some(slot => !slot.task && !slot.retiring);
      if (!hasFreeSlot && queue.length >= maxQueued) return Promise.reject(failure('QUEUE_FULL'));
      return new Promise((resolve, reject) => {
        const task = { id: ++nextId, values: values.slice(), delayMs, duplicateAfterMs, fail, signal, resolve, reject, timer: undefined, slot: null, abort: null };
        task.abort = () => {
          if (task.slot?.task === task) settle(task.slot, true, signal.reason, true);
          else {
            const index = queue.indexOf(task);
            if (index >= 0) { queue.splice(index, 1); detach(task); reject(signal.reason); }
          }
        };
        signal?.addEventListener('abort', task.abort, { once: true });
        queue.push(task);
        pump();
      });
    },
    close() {
      if (closePromise) return closePromise;
      state = 'closing';
      const closed = failure('POOL_CLOSED');
      for (const task of queue.splice(0)) { detach(task); task.reject(closed); }
      const terminations = [];
      for (const slot of slots) {
        if (slot.task) { const task = slot.task; slot.task = null; detach(task); task.reject(closed); }
        terminations.push(retire(slot));
      }
      closePromise = Promise.all(terminations).then(() => { state = 'closed'; });
      return closePromise;
    },
    stats() { return { state, active: slots.filter(slot => slot.task).length, queued: queue.length, workers: slots.filter(slot => slot.worker).length }; }
  };
}
