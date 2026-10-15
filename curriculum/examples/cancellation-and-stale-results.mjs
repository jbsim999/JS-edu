let generation = 0;
let active;
const events = [];
const signals = {};
const resolvers = {};
function load(query, signal) {
  signals[query] = signal;
  return new Promise(resolve => { resolvers[query] = resolve; });
}
async function start(query) {
  const own = ++generation;
  const previous = active;
  const controller = new AbortController();
  active = controller;
  previous?.abort();
  try {
    const value = await load(query, controller.signal);
    if (own !== generation || controller.signal.aborted) return 'stale';
    events.push('commit:' + query + ':' + value);
    return 'committed';
  } finally { if (own === generation) active = null; }
}
const a = start('A');
const b = start('B');
resolvers.B('new');
console.log('B', await b);
resolvers.A('old');
console.log('A', await a);
console.log('A-aborted', signals.A.aborted);
console.log(events.join(' > '));
