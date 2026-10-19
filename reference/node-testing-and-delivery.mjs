import { createReadStream } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
import { createServer } from 'node:http';
import { finished } from 'node:stream/promises';
import { LIMITS, deliveryError, parseMinScore } from './delivery-contract.mjs';

export async function lookupRecords({ workspaceRoot, fileName = 'records.ndjson', minScore = 0, clock = () => new Date(), sourceRevision = 'local' } = {}) {
  if (typeof workspaceRoot !== 'string' || workspaceRoot.length === 0 ||
      typeof fileName !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\.ndjson$/.test(fileName) ||
      !Number.isInteger(minScore) || minScore < 0 || minScore > 100 ||
      typeof sourceRevision !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(sourceRevision) ||
      typeof clock !== 'function') throw deliveryError('ARGS');
  let target;
  try {
    const root = await realpath(workspaceRoot);
    target = await realpath(join(root, fileName));
    const rel = relative(root, target);
    if (isAbsolute(rel) || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\')) throw deliveryError('ARGS');
  } catch (error) {
    if (error.code === 'ARGS') throw error;
    throw deliveryError('FILE');
  }
  const records = new Map();
  let line = 0;
  let count = 0;
  let byteCount = 0;
  let pending = Buffer.alloc(0);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const consume = bytes => {
    line += 1;
    let text;
    try { text = decoder.decode(bytes); } catch { throw deliveryError('DATA', { line }); }
    if (text.trim() === '') return;
    count += 1;
    if (count > LIMITS.maxRecords) throw deliveryError('LIMIT', { line });
    let record;
    try { record = JSON.parse(text); } catch { throw deliveryError('DATA', { line }); }
    if (record === null || typeof record !== 'object' || Array.isArray(record) ||
        typeof record.id !== 'string' || record.id.length === 0 || record.id.length > 32 ||
        !Number.isInteger(record.score) || record.score < 0 || record.score > 100) throw deliveryError('DATA', { line });
    if (!records.has(record.id)) records.set(record.id, { id: record.id, score: record.score });
  };
  const stream = createReadStream(target, { highWaterMark: 1024 });
  try {
    for await (const chunk of stream) {
      byteCount += chunk.byteLength;
      if (byteCount > LIMITS.maxBytes) throw deliveryError('LIMIT');
      pending = Buffer.concat([pending, chunk]);
      for (;;) {
        const boundary = pending.indexOf(10);
        if (boundary < 0) break;
        consume(pending.subarray(0, boundary));
        pending = pending.subarray(boundary + 1);
      }
    }
    if (pending.length > 0) consume(pending);
  } catch (error) {
    if (['DATA', 'LIMIT'].includes(error.code)) throw error;
    throw deliveryError('FILE');
  } finally {
    stream.destroy();
    await finished(stream, { cleanup: true }).catch(() => {});
  }
  const selected = [...records.values()].filter(record => record.score >= minScore);
  selected.sort((left, right) => right.score - left.score || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const now = clock();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw deliveryError('ARGS');
  return { records: selected, total: selected.length, source: { file: fileName, revision: sourceRevision, runtime: process.version, language: 'ES2026' }, generatedAt: now.toISOString() };
}

export async function runLookupCli(argv, { writeOut = text => process.stdout.write(text), writeError = text => process.stderr.write(text), ...options } = {}) {
  if (typeof writeOut !== 'function' || typeof writeError !== 'function') throw new TypeError('Output functions required');
  try {
    if (!Array.isArray(argv) || (argv.length !== 1 && argv.length !== 3) || (argv.length === 3 && argv[1] !== '--min-score')) throw deliveryError('ARGS');
    const minScore = argv.length === 3 ? parseMinScore(argv[2]) : 0;
    const result = await lookupRecords({ ...options, fileName: argv[0], minScore });
    writeOut(JSON.stringify(result) + '\n');
    return 0;
  } catch (error) {
    const details = { error: ['ARGS', 'FILE', 'DATA', 'LIMIT'].includes(error.code) ? error.code : 'FILE' };
    if (Number.isInteger(error.line)) details.line = error.line;
    writeError(JSON.stringify(details) + '\n');
    return 2;
  }
}

export function createLookupServer(options = {}) {
  return createServer(async (request, response) => {
    const send = (status, payload) => {
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(payload));
    };
    if (request.method !== 'GET') { response.setHeader('allow', 'GET'); send(405, { error: 'METHOD' }); return; }
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname !== '/records') { send(404, { error: 'NOT_FOUND' }); return; }
      if ([...url.searchParams.keys()].some(key => key !== 'minScore') || url.searchParams.getAll('minScore').length > 1) throw deliveryError('ARGS');
      const minScore = parseMinScore(url.searchParams.get('minScore') ?? '0');
      send(200, await lookupRecords({ ...options, minScore }));
    } catch (error) {
      const code = ['ARGS', 'FILE', 'DATA', 'LIMIT'].includes(error.code) ? error.code : 'FILE';
      const details = { error: code };
      if (Number.isInteger(error.line)) details.line = error.line;
      send(code === 'ARGS' ? 400 : 500, details);
    }
  });
}
