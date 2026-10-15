export async function aggregateQueries(tasks, policy = 'all') {
  // 의도된 오답: 배열을 뒤집고 첫 성공을 첫 완료와 혼동합니다.
  if (!Array.isArray(tasks) || tasks.some(task => typeof task !== 'function')) throw new TypeError('tasks');
  if (!['all', 'settled', 'first', 'race'].includes(policy)) throw new RangeError('policy');
  if (policy === 'race' && tasks.length === 0) throw new RangeError('empty');
  const pending = tasks.map(task => Promise.resolve().then(() => task()));
  if (policy === 'all') return (await Promise.all(pending)).reverse();
  if (policy === 'settled') return (await Promise.allSettled(pending)).reverse();
  if (policy === 'first') {
    if (tasks.length === 0) return Promise.any(pending);
    return Promise.race(pending);
  }
  return Promise.race(pending);
}
