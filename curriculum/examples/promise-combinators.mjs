let finishA;
const a = new Promise(resolve => { finishA = resolve; });
const b = Promise.resolve('B');
const all = Promise.all([a, b]);
finishA('A');
console.log('all', JSON.stringify(await all));
console.log('settled', JSON.stringify(await Promise.allSettled([Promise.resolve(3), Promise.reject('offline')])));
console.log('first', await Promise.any([Promise.reject('early'), Promise.resolve('usable')]));
try { await Promise.any([]); } catch (error) { console.log('empty-any', error.name, error.errors.length); }
