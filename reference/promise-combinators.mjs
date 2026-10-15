export async function aggregateQueries(tasks, policy = 'all') {
  if (!Array.isArray(tasks)) throw new TypeError('tasks must be a dense array of functions');
  for (let index = 0; index < tasks.length; index++) {
    if (!Object.hasOwn(tasks, index) || typeof tasks[index] !== 'function') {
      throw new TypeError('tasks must be a dense array of functions');
    }
  }
  if (!['all', 'settled', 'first', 'race'].includes(policy)) throw new RangeError('Unknown policy');
  if (policy === 'race' && tasks.length === 0) throw new RangeError('race needs an input');
  const pending = tasks.map(task => Promise.resolve().then(() => task()));
  if (policy === 'all') return Promise.all(pending);
  if (policy === 'settled') return Promise.allSettled(pending);
  if (policy === 'first') return Promise.any(pending);
  return Promise.race(pending);
}
