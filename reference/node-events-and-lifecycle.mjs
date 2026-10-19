import { EventEmitter, on } from 'node:events';

export function createTaskService(handler, { maxQueued = 2, onError = () => {} } = {}) {
  if (typeof handler !== 'function' || typeof onError !== 'function') throw new TypeError('Function required');
  if (!Number.isInteger(maxQueued) || maxQueued < 0 || maxQueued > 32) throw new RangeError('Invalid queue capacity');
  const events = new EventEmitter();
  const stop = new AbortController();
  const reportError = error => onError(error);
  events.on('error', reportError);
  const queue = [];
  let state = 'open';
  let active = 0;
  let submitted = 0;
  let settled = 0;
  let closePromise;
  let resolveClose;
  const failure = code => Object.assign(new Error(code), { code });
  const finishClose = () => {
    if (state !== 'closing' || active !== 0 || queue.length !== 0) return;
    state = 'closed';
    stop.abort();
    events.removeListener('error', reportError);
    resolveClose();
  };
  const pump = () => {
    if (active || queue.length === 0) { finishClose(); return; }
    const task = queue.shift();
    active = 1;
    void (async () => {
      let value;
      let rejected = false;
      let reason;
      try { value = await handler(task.value); }
      catch (error) { rejected = true; reason = error; }
      active = 0;
      settled += 1;
      if (rejected) {
        events.emit('error', reason);
        events.emit('settled', { id: task.id, status: 'rejected', reason });
        task.reject(reason);
      } else {
        events.emit('settled', { id: task.id, status: 'fulfilled', value });
        task.resolve(value);
      }
      pump();
    })();
  };
  return {
    events,
    submit(value) {
      if (state !== 'open') return Promise.reject(failure('CLOSED'));
      if (active && queue.length >= maxQueued) return Promise.reject(failure('QUEUE_FULL'));
      const id = ++submitted;
      const promise = new Promise((resolve, reject) => queue.push({ id, value, resolve, reject }));
      pump();
      return promise;
    },
    watch() {
      const subscription = new AbortController();
      const cancel = () => subscription.abort();
      if (stop.signal.aborted) cancel();
      else stop.signal.addEventListener('abort', cancel, { once: true });
      const cleanup = () => stop.signal.removeEventListener('abort', cancel);
      const iterator = subscription.signal.aborted ? null : on(events, 'settled', { signal: subscription.signal });
      return {
        [Symbol.asyncIterator]() { return this; },
        async next() {
          if (!iterator) return { value: undefined, done: true };
          try {
            const item = await iterator.next();
            if (item.done) { cleanup(); return { value: undefined, done: true }; }
            return { value: item.value[0], done: false };
          } catch (error) {
            cleanup();
            if (subscription.signal.aborted && error?.name === 'AbortError' && error?.cause === subscription.signal.reason) return { value: undefined, done: true };
            throw error;
          }
        },
        async return() {
          cancel();
          try { await iterator?.return(); }
          finally { cleanup(); }
          return { value: undefined, done: true };
        }
      };
    },
    close() {
      if (closePromise) return closePromise;
      closePromise = new Promise(resolve => { resolveClose = resolve; });
      state = 'closing';
      finishClose();
      return closePromise;
    },
    stats() { return { state, active, queued: queue.length, submitted, settled }; }
  };
}
