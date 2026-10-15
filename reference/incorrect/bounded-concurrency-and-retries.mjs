export async function runBounded(tasks, options = {}) {
  // 의도된 오답: 모든 작업을 동시에 한 번씩만 시작합니다.
  if (!Array.isArray(tasks) || tasks.some(task => typeof task !== 'function')) throw new TypeError('tasks');
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options');
  const { limit = 2, retries = 0, baseDelay = 1, signal, wait = () => Promise.resolve() } = options;
  if (!Number.isInteger(limit) || limit < 1 || limit > 32 ||
      !Number.isInteger(retries) || retries < 0 || retries > 5 ||
      typeof baseDelay !== 'number' || !Number.isFinite(baseDelay) || baseDelay < 0 || baseDelay > 1000) throw new RangeError('options');
  if (typeof wait !== 'function') throw new TypeError('wait');
  return Promise.all(tasks.map(async (task, index) => {
    try { return { status: 'fulfilled', value: await task({ signal, attempt: 1, index }), attempts: 1 }; }
    catch (reason) { return { status: 'rejected', reason, attempts: 1 }; }
  }));
}
