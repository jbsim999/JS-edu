import { createReadStream } from 'node:fs';
import { lstat, realpath, stat } from 'node:fs/promises';
import { finished } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryProducts } from './reader/core.mjs';

const filenamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\.ndjson$/;
const invalidState = () => Object.assign(new Error('not available'), { name: 'InvalidStateError' });
const inputError = () => Object.assign(new Error('invalid input data'), { code: 'DATA' });
function rootPath(value) {
  if (value instanceof URL && value.protocol === 'file:') value = fileURLToPath(value);
  if (typeof value !== 'string' || !value || value.includes('\0')) throw new TypeError('workspaceRoot required');
  return value;
}

async function readProducts(task, { workspaceRoot, signal, maxFileBytes, maxLineBytes, maxRecords }) {
  signal.throwIfAborted();
  const base = await realpath(workspaceRoot);
  if (!(await stat(base)).isDirectory()) throw new TypeError('directory required');
  const candidate = path.join(base, task.file);
  const info = await lstat(candidate);
  const source = await realpath(candidate);
  if (!info.isFile() || info.isSymbolicLink() || path.dirname(source) !== base) throw new TypeError('file outside root');
  signal.throwIfAborted();
  const input = createReadStream(source, { signal, highWaterMark: 1024 });
  let bytes = 0;
  let parts = [];
  let size = 0;
  const rows = [];
  function append(part) {
    size += part.length;
    if (size > maxLineBytes) throw inputError();
    if (part.length) parts.push(part);
  }
  function completeLine() {
    let line = Buffer.concat(parts, size);
    parts = []; size = 0;
    if (line.at(-1) === 13) line = line.subarray(0, -1);
    if (!line.length) return;
    if (rows.length >= maxRecords) throw inputError();
    try { rows.push(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(line))); }
    catch { throw inputError(); }
  }
  try {
    for await (const chunk of input) {
      signal.throwIfAborted();
      bytes += chunk.length;
      if (bytes > maxFileBytes) throw inputError();
      let start = 0;
      for (let index = 0; index < chunk.length; index++) {
        if (chunk[index] !== 10) continue;
        append(chunk.subarray(start, index)); completeLine(); start = index + 1;
      }
      append(chunk.subarray(start));
    }
    if (size) completeLine();
    signal.throwIfAborted();
    return rows;
  } finally {
    input.destroy();
    await finished(input).catch(() => {});
  }
}

export function createNodeQueryBatch(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options required');
  const { workspaceRoot, load, now = () => performance.now(), concurrency = 2, maxInputs = 8,
    maxFileBytes = 65536, maxLineBytes = 4096, maxRecords = 100, maxOutputs = 3 } = options;
  const root = rootPath(workspaceRoot);
  for (const [value, minimum, maximum] of [[concurrency,1,4], [maxInputs,1,32], [maxFileBytes,1,1048576], [maxLineBytes,1,65536], [maxRecords,1,1000], [maxOutputs,0,100]]) {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new RangeError('invalid limit');
  }
  if (typeof now !== 'function' || load !== undefined && typeof load !== 'function') throw new TypeError('invalid dependency');
  const loader = load ?? readProducts;
  let disposed = false;
  let activeRun = null;
  let sequence = 0;
  let state = { status: 'idle', runId: 0, total: 0, started: 0, completed: 0, failed: 0, active: 0, peakActive: 0, returnedItems: 0, elapsedMs: 0 };
  const snapshot = () => ({ ...state, elapsedMs: activeRun ? now() - activeRun.start : state.elapsedMs });
  function tasksCopy(tasks) {
    if (!Array.isArray(tasks)) throw new TypeError('tasks must be an array');
    if (tasks.length > maxInputs) throw new RangeError('too many tasks');
    const ids = new Set();
    const copy = [];
    for (let index = 0; index < tasks.length; index++) {
      if (!Object.hasOwn(tasks, index)) throw new TypeError('sparse tasks');
      const task = tasks[index];
      if (!task || typeof task !== 'object' || Array.isArray(task) ||
          !['id', 'file', 'query'].every(key => Object.hasOwn(task, key)) ||
          typeof task.id !== 'string' || !task.id.trim() || ids.has(task.id) ||
          typeof task.file !== 'string' || task.file.trim() !== task.file || !filenamePattern.test(task.file) || typeof task.query !== 'string') throw new TypeError('invalid task');
      ids.add(task.id);
      copy.push({ id: task.id, file: task.file, query: task.query });
    }
    return copy;
  }
  async function run(tasks) {
    if (disposed || activeRun) throw invalidState();
    const copied = tasksCopy(tasks);
    const current = { controller: new AbortController(), start: now() };
    activeRun = current;
    state = { status: 'running', runId: ++sequence, total: copied.length, started: 0, completed: 0, failed: 0, active: 0, peakActive: 0, returnedItems: 0, elapsedMs: 0 };
    const results = copied.map(task => ({ id: task.id, status: 'cancelled' }));
    let next = 0;
    async function worker() {
      while (!current.controller.signal.aborted && next < copied.length) {
        const index = next++;
        const task = copied[index];
        state.started++; state.active++;
        state.peakActive = Math.max(state.peakActive, state.active);
        let stage = 'load';
        try {
          // A fresh task object prevents an injected loader from changing result identity.
          const records = await loader({ ...task }, { signal: current.controller.signal, workspaceRoot: root, maxFileBytes, maxLineBytes, maxRecords });
          if (current.controller.signal.aborted) continue;
          stage = 'input';
          if (!Array.isArray(records) || records.length > maxRecords) throw inputError();
          for (let i = 0; i < records.length; i++) if (!Object.hasOwn(records, i)) throw inputError();
          stage = 'core';
          const report = queryProducts(records, { query: task.query, limit: maxOutputs });
          results[index] = { id: task.id, status: 'fulfilled', report };
          state.completed++; state.returnedItems += report.items.length;
        } catch (error) {
          if (!current.controller.signal.aborted) {
            results[index] = { id: task.id, status: 'rejected', error: stage === 'load' && load === undefined && error?.code === 'DATA' ? 'input' : stage };
            state.completed++; state.failed++;
          }
        } finally { state.active--; }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, copied.length) }, () => worker()));
    const status = current.controller.signal.aborted ? 'cancelled' : 'done';
    state.elapsedMs = now() - current.start;
    state.status = disposed ? 'disposed' : status;
    activeRun = null;
    return structuredClone({ status, runId: state.runId, results, metrics: { ...state, status } });
  }
  function cancel() {
    if (!activeRun || activeRun.controller.signal.aborted) return false;
    if (!disposed) state.status = 'cancelling';
    activeRun.controller.abort();
    return true;
  }
  return Object.freeze({
    run, cancel, getState: snapshot,
    dispose() { if (disposed) return; disposed = true; cancel(); state.status = 'disposed'; },
  });
}
