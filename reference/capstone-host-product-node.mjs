import { createReadStream } from 'node:fs';
import { lstat, realpath, stat } from 'node:fs/promises';
import { finished } from 'node:stream/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryProducts, serializeReport } from './reader/core.mjs';

const LIMITS = Object.freeze({ bytes: 65536, line: 4096, records: 1000 });
const filenamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\.ndjson$/;
function failure(code, line) {
  const error = code === 'INPUT' ? new TypeError(code) : code === 'LIMIT' ? new RangeError(code) : new Error(code);
  error.code = code;
  if (line !== undefined) error.line = line;
  return error;
}
function rootPath(value) {
  if (value instanceof URL && value.protocol === 'file:') value = fileURLToPath(value);
  if (typeof value !== 'string' || !value || value.includes('\0')) throw failure('INPUT');
  return value;
}
function queryOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw failure('INPUT');
  const { query = '', maxPrice = Infinity, limit = 100, signal } = options;
  if (!Number.isSafeInteger(limit) || limit < 0 || limit > 100 ||
      signal !== undefined && !(signal instanceof AbortSignal)) throw failure('INPUT');
  try { queryProducts([], { query, maxPrice, limit }); } catch { throw failure('INPUT'); }
  return { query, maxPrice, limit, signal };
}

export async function queryProductFile(workspaceRoot, fileName, options = {}) {
  const root = rootPath(workspaceRoot);
  if (typeof fileName !== 'string' || fileName.trim() !== fileName || !filenamePattern.test(fileName)) throw failure('INPUT');
  const { query, maxPrice, limit, signal } = queryOptions(options);
  signal?.throwIfAborted();
  let source;
  let input;
  try {
    const base = await realpath(root);
    if (!(await stat(base)).isDirectory()) throw failure('INPUT');
    const candidate = path.join(base, fileName);
    const info = await lstat(candidate);
    if (!info.isFile() || info.isSymbolicLink()) throw failure('INPUT');
    source = await realpath(candidate);
    if (path.dirname(source) !== base) throw failure('INPUT');
    signal?.throwIfAborted();
    input = createReadStream(source, { highWaterMark: 1024, signal });
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    if (error?.code === 'INPUT') throw error;
    throw failure('FILE');
  }
  let bytes = 0;
  let line = 0;
  let parts = [];
  let size = 0;
  const records = [];
  function append(part) {
    size += part.length;
    if (size > LIMITS.line) throw failure('LIMIT', line + 1);
    if (part.length) parts.push(part);
  }
  function completeLine() {
    line++;
    let value = Buffer.concat(parts, size);
    parts = []; size = 0;
    if (value.at(-1) === 13) value = value.subarray(0, -1);
    if (!value.length) return;
    if (records.length === LIMITS.records) throw failure('LIMIT', line);
    try {
      const row = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(value));
      queryProducts([row]);
      records.push(row);
    } catch { throw failure('DATA', line); }
  }
  try {
    for await (const chunk of input) {
      signal?.throwIfAborted();
      bytes += chunk.length;
      if (bytes > LIMITS.bytes) throw failure('LIMIT');
      let start = 0;
      for (let index = 0; index < chunk.length; index++) {
        if (chunk[index] !== 10) continue;
        append(chunk.subarray(start, index)); completeLine(); start = index + 1;
      }
      append(chunk.subarray(start));
    }
    if (size) completeLine();
    signal?.throwIfAborted();
    try { return queryProducts(records, { query, maxPrice, limit }); }
    catch { throw failure('DATA'); }
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    if (['DATA', 'LIMIT'].includes(error?.code)) throw error;
    throw failure('FILE');
  } finally {
    input.destroy();
    await finished(input).catch(() => {});
  }
}

function integerText(value, maximum = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'string' || value.trim() !== value || !/^(0|[1-9]\d*)$/.test(value)) throw failure('INPUT');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > maximum) throw failure('INPUT');
  return number;
}
function publicError(error, signal) {
  if (signal?.aborted) return { error: 'ABORTED' };
  const code = ['INPUT', 'FILE', 'DATA', 'LIMIT'].includes(error?.code) ? error.code : 'FILE';
  return { error: code, ...(Number.isSafeInteger(error?.line) ? { line: error.line } : {}) };
}
export async function runProductCli(argv, { workspaceRoot, stdout = text => process.stdout.write(text), stderr = text => process.stderr.write(text), signal } = {}) {
  if (typeof stdout !== 'function' || typeof stderr !== 'function') throw failure('INPUT');
  let report;
  try {
    if (!Array.isArray(argv) || !argv.length || argv.length % 2 !== 1) throw failure('INPUT');
    for (let index = 0; index < argv.length; index++) if (!Object.hasOwn(argv, index) || typeof argv[index] !== 'string') throw failure('INPUT');
    const options = { signal };
    const seen = new Set();
    for (let index = 1; index < argv.length; index += 2) {
      const flag = argv[index];
      if (!['--query', '--max-price', '--limit'].includes(flag) || seen.has(flag)) throw failure('INPUT');
      seen.add(flag);
      if (flag === '--query') options.query = argv[index + 1];
      else if (flag === '--max-price') options.maxPrice = integerText(argv[index + 1]);
      else options.limit = integerText(argv[index + 1], 100);
    }
    report = await queryProductFile(workspaceRoot, argv[0], options);
  } catch (error) {
    await stderr(JSON.stringify(publicError(error, signal)) + '\n');
    return signal?.aborted ? 130 : 2;
  }
  await stdout(serializeReport(report) + '\n');
  return 0;
}

export function createProductServer({ workspaceRoot } = {}) {
  const root = rootPath(workspaceRoot);
  function send(response, status, value, headers = {}) {
    if (response.destroyed || response.writableEnded) return;
    const body = JSON.stringify(value);
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), ...headers });
    response.end(body);
  }
  const server = createServer((request, response) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const disconnected = () => { if (!response.writableFinished) abort(); };
    request.once('aborted', abort);
    response.once('close', disconnected);
    request.resume();
    void (async () => {
      let url;
      try {
        if (!request.url.startsWith('/') || request.url.startsWith('//') || request.url.includes('#')) throw failure('INPUT');
        decodeURIComponent(request.url);
        url = new URL(request.url, 'http://127.0.0.1');
      } catch { send(response, 400, { error: 'INPUT' }); return; }
      if (url.pathname !== '/products') { send(response, 404, { error: 'NOT_FOUND' }); return; }
      if (request.method !== 'GET') { send(response, 405, { error: 'METHOD' }, { allow: 'GET' }); return; }
      try {
        const keys = [...url.searchParams.keys()];
        if (keys.some(key => !['file', 'query', 'maxPrice', 'limit'].includes(key)) || new Set(keys).size !== keys.length) throw failure('INPUT');
        const options = { signal: controller.signal, query: url.searchParams.get('query') ?? '' };
        if (url.searchParams.has('maxPrice')) options.maxPrice = integerText(url.searchParams.get('maxPrice'));
        if (url.searchParams.has('limit')) options.limit = integerText(url.searchParams.get('limit'), 100);
        const report = await queryProductFile(root, url.searchParams.get('file') ?? 'products.ndjson', options);
        send(response, 200, report);
      } catch (error) {
        if (controller.signal.aborted || response.destroyed) return;
        const value = publicError(error);
        send(response, value.error === 'INPUT' ? 400 : value.error === 'FILE' ? 404 : 500, value);
      }
    })().catch(() => send(response, 500, { error: 'FILE' })).finally(() => {
      request.off('aborted', abort);
      response.off('close', disconnected);
    });
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  return server;
}
