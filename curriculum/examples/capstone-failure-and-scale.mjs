function createBoundedQueryBatch(root, queryProducts, options) {
  const { load, now, concurrency = 2, maxInputs = 8, maxRecords = 100, maxOutputs = 3 } = options || {};
  if (!root || typeof root.replaceChildren !== 'function' || typeof queryProducts !== 'function' ||
      typeof load !== 'function' || typeof now !== 'function') throw new TypeError('invalid dependencies');
  for (const [value, maximum, minimum] of [[concurrency, 4, 1], [maxInputs, 32, 1], [maxRecords, 1000, 1], [maxOutputs, 100, 0]]) {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new RangeError('invalid bound');
  }
  const output = root.ownerDocument.createElement('output'); output.setAttribute('role', 'status'); output.setAttribute('aria-live', 'polite');
  const button = root.ownerDocument.createElement('button'); button.type = 'button'; button.textContent = '작업 취소';
  root.replaceChildren(output, button);
  const fresh = (runId, total) => ({ status: 'idle', runId, total, started: 0, completed: 0, failed: 0, active: 0, peakActive: 0, returnedItems: 0, elapsedMs: 0 });
  let state = fresh(0, 0), currentRun = null, disposed = false;
  const getState = () => ({ ...state });
  const render = () => {
    if (disposed) return;
    output.textContent = state.completed + '/' + state.total + ' 완료 · 활성 ' + state.active + ' · 실패 ' + state.failed;
    root.setAttribute('aria-busy', String(state.status === 'running')); button.disabled = !currentRun;
  };
  function cancel() { if (currentRun) currentRun.controller.abort(); }
  button.addEventListener('click', cancel); render();
  async function run(tasks) {
    if (disposed || currentRun) throw new DOMException('batch unavailable', 'InvalidStateError');
    if (!Array.isArray(tasks)) throw new TypeError('tasks must be an array');
    if (tasks.length > maxInputs) throw new RangeError('too many inputs');
    const ids = new Set(), queue = [];
    for (let index = 0; index < tasks.length; index++) {
      const task = tasks[index];
      if (!Object.hasOwn(tasks, index) || !task || typeof task.id !== 'string' || !task.id || ids.has(task.id) || typeof task.query !== 'string') throw new TypeError('invalid task');
      ids.add(task.id); queue.push({ id: task.id, query: task.query });
    }
    const startedAt = now();
    const token = { controller: new AbortController() }; currentRun = token;
    state = { ...fresh(state.runId + 1, queue.length), status: 'running' }; render();
    const results = new Array(queue.length);
    let cursor = 0;
    async function worker() {
      while (!token.controller.signal.aborted && cursor < queue.length) {
        const index = cursor++, task = queue[index];
        state.active++; state.started++; state.peakActive = Math.max(state.peakActive, state.active); render();
        let phase = 'load';
        try {
          const records = await load(task, { signal: token.controller.signal });
          if (token.controller.signal.aborted) { results[index] = { id: task.id, status: 'cancelled' }; continue; }
          phase = 'input';
          if (!Array.isArray(records) || records.length > maxRecords) throw new RangeError('too many records');
          phase = 'core';
          const report = queryProducts(records, { query: task.query, limit: maxOutputs });
          results[index] = { id: task.id, status: 'fulfilled', report };
          state.returnedItems += report.items.length; state.completed++;
        } catch {
          if (token.controller.signal.aborted) results[index] = { id: task.id, status: 'cancelled' };
          else { results[index] = { id: task.id, status: 'rejected', error: phase }; state.failed++; state.completed++; }
        } finally { state.active--; render(); }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
    for (let index = 0; index < queue.length; index++) if (!results[index]) results[index] = { id: queue[index].id, status: 'cancelled' };
    state.elapsedMs = now() - startedAt;
    const cancelled = token.controller.signal.aborted;
    state.status = disposed ? 'disposed' : cancelled ? 'cancelled' : 'done';
    currentRun = null; render();
    return { status: cancelled ? 'cancelled' : 'done', runId: state.runId, results, metrics: getState() };
  }
  return { run, cancel, getState, dispose() {
    if (disposed) return;
    disposed = true; cancel(); state.status = 'disposed';
    button.removeEventListener('click', cancel); root.removeAttribute('aria-busy'); root.replaceChildren();
  } };
}

function normalizeProduct(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !['id', 'name', 'price'].every(key => Object.hasOwn(value, key)) ||
      typeof value.id !== 'string' || typeof value.name !== 'string' ||
      !Number.isSafeInteger(value.price) || value.price < 0) throw new TypeError('invalid product');
  const id = value.id.trim().normalize('NFC');
  const name = value.name.trim().normalize('NFC');
  if (!id || !name) throw new TypeError('missing product text');
  return { id, name, price: value.price };
}
function normalizeQuery(value) {
  if (typeof value !== 'string') throw new TypeError('query must be a string');
  return value.trim().normalize('NFC').toLowerCase();
}

function queryProducts(records, options = {}) {
  if (!Array.isArray(records) || !options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('records and options are invalid');
  }
  const { query = '', maxPrice = Infinity, limit = Infinity } = options;
  const normalized = normalizeQuery(query);
  if (typeof maxPrice !== 'number' || Number.isNaN(maxPrice) || maxPrice < 0 ||
      !(limit === Infinity || Number.isSafeInteger(limit) && limit >= 0)) throw new TypeError('invalid query options');
  const unique = new Map();
  for (let index = 0; index < records.length; index++) {
    if (!Object.hasOwn(records, index)) throw new TypeError('sparse input');
    const item = normalizeProduct(records[index]);
    if (!unique.has(item.id)) unique.set(item.id, item);
  }
  const matched = [...unique.values()].filter(item => item.name.toLowerCase().includes(normalized) && item.price <= maxPrice);
  matched.sort((a, b) => a.price - b.price || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let total = 0;
  for (const item of matched) {
    total += item.price;
    if (!Number.isSafeInteger(total)) throw new RangeError('unsafe total');
  }
  return { version: 1, query: normalized, count: matched.length, total, items: matched.slice(0, limit) };
}

function serializeReport(report) {
  return JSON.stringify({ version: report.version, query: report.query, count: report.count, total: report.total,
    items: report.items.map(({ id, name, price }) => ({ id, name, price })) });
}

const root=document.getElementById('exercise-root');
let clock=10;
const batch=createBoundedQueryBatch(root,queryProducts,{concurrency:1,maxOutputs:1,now:()=>clock,load:async task=>{const response=await fetch('/_fixtures/http/'+task.id);if(!response.ok)throw new Error('HTTP failure');const records=await response.json();clock+=5;return records;}});
try { const result=await batch.run([{id:'products',query:''},{id:'empty',query:''}]);console.log(JSON.stringify({status:result.status,ids:result.results.map(x=>x.id),returnedItems:result.metrics.returnedItems,elapsedMs:result.metrics.elapsedMs})); } finally {batch.dispose();}
