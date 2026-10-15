import { randomBytes, timingSafeEqual } from 'node:crypto';

export const workspaceLimits = Object.freeze({ files: 16, fileBytes: 102400, totalBytes: 524288,
  bodyBytes: 786432, bodyTimeoutMs: 5000, active: 4, pending: 2, ttlMs: 60000 });
const protocol = 'javascript-edu-modules-v1';
const prefix = '/_execution/';
const reserved = '__edu_bridge__.mjs';
const validPath = value => typeof value === 'string' && value.length <= 180 && value.endsWith('.mjs')
  && value.split('/').every(part => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u.test(part) && !part.includes('..'))
  && !value.split('/').includes(reserved);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// JSON.parse silently overwrites duplicate keys. Workspace input must not do so.
function hasDuplicateMembers(source) {
  const tokens = source.match(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/gu) ?? [];
  let index = 0;
  let duplicate = false;
  const visit = () => {
    const token = tokens[index++];
    if (token === '{') {
      const keys = new Set();
      while (tokens[index] !== '}') {
        const key = JSON.parse(tokens[index++]);
        if (keys.has(key)) duplicate = true;
        keys.add(key); index++; visit();
        if (tokens[index] === ',') index++;
      }
      index++;
    } else if (token === '[') {
      while (tokens[index] !== ']') { visit(); if (tokens[index] === ',') index++; }
      index++;
    }
  };
  visit();
  return duplicate;
}

// This server stores source text only. It never imports, evaluates or writes it.
export function createModuleWorkspace({ bootstrap, headers = {}, limits = workspaceLimits, now = Date.now } = {}) {
  if (typeof bootstrap !== 'string') throw new TypeError('A fixed module bootstrap is required.');
  const token = randomBytes(32).toString('base64url');
  const workspaces = new Map();
  let pending = 0;
  const sweep = () => { for (const [id, item] of workspaces) if (item.expiresAt <= now()) workspaces.delete(id); };
  const timer = setInterval(sweep, Math.min(10000, limits.ttlMs));
  timer.unref();
  const authorized = supplied => typeof supplied === 'string' && /^[A-Za-z0-9_-]{43}$/u.test(supplied)
    && timingSafeEqual(Buffer.from(supplied), Buffer.from(token));
  const send = (req, res, status, body, type = 'application/json; charset=utf-8', extra = {}) => {
    if (res.headersSent || res.destroyed) return;
    res.writeHead(status, { ...headers, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer', 'Content-Type': type, ...extra });
    res.end(req.method === 'HEAD' ? undefined : typeof body === 'string' ? body : JSON.stringify(body));
  };
  const handle = async (req, res, origin) => {
    if (!req.url?.startsWith(prefix)) return false;
    const pathname = req.url;
    const reply = (status, message) => { send(req, res, status, { error: message }); return true; };
    if (/[?%#\\]/u.test(pathname)) return reply(400, 'Invalid workspace URL');
    sweep();
    if (pathname === '/_execution/config') {
      if (req.method !== 'GET') return reply(405, 'GET required');
      if ((req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') return reply(403, 'Local origin required');
      send(req, res, 200, { token, protocol, limits }); return true;
    }
    if (['POST', 'DELETE'].includes(req.method)) {
      if (req.headers.origin !== origin || !authorized(req.headers['x-execution-token'])) return reply(403, 'Local execution authorization required');
      if (req.method === 'POST' && pathname === '/_execution/workspaces') {
        if (!/^application\/json(?:\s*;|$)/iu.test(req.headers['content-type'] ?? '')) return reply(415, 'JSON required');
        if (pending >= limits.pending || workspaces.size >= limits.active) return reply(429, 'Workspace limit reached');
        const length = Number(req.headers['content-length']);
        if (Number.isFinite(length) && length > limits.bodyBytes) return reply(413, 'Request too large');
        pending++;
        const bodyTimer = setTimeout(() => {
          res.once('finish', () => req.destroy());
          if (!res.headersSent) send(req, res, 408, { error: 'Workspace body deadline exceeded' });
          else req.destroy();
        }, limits.bodyTimeoutMs);
        bodyTimer.unref();
        try {
          let bytes = 0;
          const chunks = [];
          for await (const chunk of req) {
            bytes += chunk.length;
            if (bytes > limits.bodyBytes) return reply(413, 'Request too large');
            chunks.push(chunk);
          }
          const text = Buffer.concat(chunks).toString('utf8');
          let data;
          try { data = JSON.parse(text); if (hasDuplicateMembers(text)) throw new Error(); }
          catch { return reply(400, 'Invalid or duplicate JSON members'); }
          if (!isRecord(data) || Object.keys(data).sort().join(',') !== 'entry,files'
            || !isRecord(data.files) || !validPath(data.entry)) return reply(400, 'Invalid workspace manifest');
          const entries = Object.entries(data.files);
          if (!entries.length || entries.length > limits.files || !Object.hasOwn(data.files, data.entry)) return reply(400, 'Missing entry or too many files');
          let total = 0;
          for (const [file, source] of entries) {
            if (!validPath(file) || typeof source !== 'string') return reply(400, 'Invalid workspace file');
            const size = Buffer.byteLength(source);
            total += size;
            if (size > limits.fileBytes || total > limits.totalBytes) return reply(413, 'Source limit reached');
          }
          sweep();
          if (workspaces.size >= limits.active) return reply(429, 'Workspace limit reached');
          const id = randomBytes(24).toString('hex');
          const files = new Map(entries);
          files.set(reserved, `import * as submission from ${JSON.stringify(`./${data.entry}`)};\nexport { submission };\n`);
          const expiresAt = now() + limits.ttlMs;
          workspaces.set(id, { files, expiresAt });
          send(req, res, 201, { id, workerUrl: `/_execution/${id}/bootstrap.mjs`, expiresAt }); return true;
        } catch { return reply(400, 'Workspace request could not be read'); }
        finally { clearTimeout(bodyTimer); pending--; }
      }
      const deletion = /^\/_execution\/workspaces\/([a-f0-9]{48})$/u.exec(pathname);
      if (req.method === 'DELETE' && deletion) {
        workspaces.delete(deletion[1]); send(req, res, 204, ''); return true;
      }
      return reply(404, 'Unknown workspace operation');
    }
    if (!['GET', 'HEAD'].includes(req.method)) return reply(405, 'Method not allowed');
    const match = /^\/_execution\/([a-f0-9]{48})\/(bootstrap\.mjs|files\/(.+))$/u.exec(pathname);
    if (!match) return reply(404, 'Not found');
    const item = workspaces.get(match[1]);
    if (!item) return reply(410, 'Workspace expired or closed');
    const scriptPolicy = `default-src 'none'; script-src 'unsafe-eval' ${origin}/_execution/${match[1]}/files/; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
    const content = match[2] === 'bootstrap.mjs' ? bootstrap : item.files.get(match[3]);
    if (content === undefined) return reply(404, 'File not found');
    send(req, res, 200, content, 'text/javascript; charset=utf-8', { 'Content-Security-Policy': scriptPolicy }); return true;
  };
  return Object.freeze({ handle, close: () => { clearInterval(timer); workspaces.clear(); } });
}
