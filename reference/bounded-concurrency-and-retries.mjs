export async function runBounded(tasks, options = {}) {
  if (!Array.isArray(tasks)) throw new TypeError('tasks must be a dense array of functions');
  for (let index = 0; index < tasks.length; index++) {
    if (!Object.hasOwn(tasks, index) || typeof tasks[index] !== 'function') {
      throw new TypeError('tasks must be a dense array of functions');
    }
  }
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }
  const { limit = 2, retries = 0, baseDelay = 1, signal,
    wait = delay => new Promise(resolve => setTimeout(resolve, delay)) } = options;
  if (!Number.isInteger(limit) || limit < 1 || limit > 32 ||
      !Number.isInteger(retries) || retries < 0 || retries > 5 ||
      typeof baseDelay !== 'number' || !Number.isFinite(baseDelay) || baseDelay < 0 || baseDelay > 1000) {
    throw new RangeError('Invalid limit, retries, or baseDelay');
  }
  if (typeof wait !== 'function') throw new TypeError('wait must be a function');
  if (signal !== undefined) {
    const aborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted').get;
    try { aborted.call(signal); } catch { throw new TypeError('signal must be an AbortSignal'); }
  }
  const results = new Array(tasks.length);
  let cursor = 0;
  const cancelled = attempts => ({ status: 'cancelled', attempts });
  async function worker() {
    while (cursor < tasks.length && !signal?.aborted) {
      const index = cursor++;
      let attempts = 0;
      while (true) {
        if (signal?.aborted) { results[index] = cancelled(attempts); break; }
        attempts++;
        try {
          const value = await tasks[index]({ signal, attempt: attempts, index });
          results[index] = signal?.aborted ? cancelled(attempts) : { status: 'fulfilled', value, attempts };
          break;
        } catch (reason) {
          if (signal?.aborted) { results[index] = cancelled(attempts); break; }
          if (attempts > retries) { results[index] = { status: 'rejected', reason, attempts }; break; }
          try {
            await wait(baseDelay * 2 ** (attempts - 1), { signal, index, attempt: attempts });
          } catch (waitReason) {
            results[index] = signal?.aborted ? cancelled(attempts) : { status: 'rejected', reason: waitReason, attempts };
            break;
          }
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  for (let index = 0; index < tasks.length; index++) {
    if (results[index] === undefined) results[index] = cancelled(0);
  }
  return results;
}
