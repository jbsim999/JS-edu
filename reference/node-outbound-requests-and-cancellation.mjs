import { setTimeout as delay } from 'node:timers/promises';

export async function fetchRecord(url, { signal, timeoutMs = 500, maxAttempts = 3, maxBytes = 4096, backoffMs = 10 } = {}) {
  const target = new URL(url);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new TypeError('HTTP URL required');
  for (const [value, min, max] of [[timeoutMs, 1, 10000], [maxAttempts, 1, 3], [maxBytes, 1, 65536], [backoffMs, 0, 1000]]) {
    if (!Number.isInteger(value) || value < min || value > max) throw new RangeError('Invalid request limits');
  }
  if (signal !== undefined && !(signal instanceof AbortSignal)) throw new TypeError('AbortSignal required');
  if (signal?.aborted) throw signal.reason;
  const controller = new AbortController();
  let attempts = 0;
  const failure = (code, details = {}) => Object.assign(new Error(code), { code, attempts, ...details });
  const forwardAbort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', forwardAbort, { once: true });
  const timer = setTimeout(() => controller.abort(failure('TIMEOUT')), timeoutMs);
  const wait = async () => {
    controller.signal.throwIfAborted();
    if (backoffMs > 0) await delay(backoffMs, undefined, { signal: controller.signal });
  };
  try {
    while (attempts < maxAttempts) {
      controller.signal.throwIfAborted();
      attempts += 1;
      let response;
      try {
        response = await fetch(target, { method: 'GET', redirect: 'error', signal: controller.signal });
      } catch (cause) {
        controller.signal.throwIfAborted();
        if (attempts === maxAttempts) throw failure('NETWORK', { cause });
        await wait();
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        controller.signal.throwIfAborted();
        if ([502, 503, 504].includes(response.status) && attempts < maxAttempts) {
          await wait();
          continue;
        }
        throw failure('HTTP_STATUS', { status: response.status });
      }
      const reader = response.body?.getReader();
      const chunks = [];
      let bytes = 0;
      try {
        if (reader) {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > maxBytes) throw failure('BODY_LIMIT');
            chunks.push(value);
          }
        }
      } catch (cause) {
        try { await reader?.cancel(cause); } catch {}
        controller.signal.throwIfAborted();
        throw cause.code === 'BODY_LIMIT' ? cause : failure('NETWORK', { cause });
      } finally {
        reader?.releaseLock();
      }
      controller.signal.throwIfAborted();
      let value;
      try {
        value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes)));
      } catch (cause) {
        throw failure('PARSE', { cause });
      }
      if (value === null || typeof value !== 'object' || Array.isArray(value) ||
          typeof value.id !== 'string' || value.id.length === 0 ||
          !Number.isInteger(value.score) || value.score < 0 || value.score > 100) {
        throw failure('SCHEMA');
      }
      return { record: { id: value.id, score: value.score }, attempts };
    }
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}
