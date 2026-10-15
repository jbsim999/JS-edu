import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const projectRoot = new URL('../', import.meta.url);
const routes = new Map([
  ['/', ['web/index.html', 'text/html; charset=utf-8']],
  ...['index.html', 'styles.css', 'app.mjs', 'glossary-data.mjs', 'adapters/storage.mjs', 'adapters/runner.mjs', 'features/workspace-state.mjs'].map(file => [
    `/${file}`, [`web/${file}`, file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8'],
  ]),
  ...['education.config.json', 'curriculum/catalog.json', 'curriculum/lessons/bindings-and-closures.json', 'curriculum/exercises.json', 'runtime/profiles.json'].map(file => [
    `/${file}`, [file, 'application/json; charset=utf-8'],
  ]),
  ...['starter/create-counter.mjs', 'curriculum/examples/bindings-and-closures.mjs'].map(file => [
    `/${file}`, [file, 'text/javascript; charset=utf-8'],
  ]),
]);

const securityHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
};

// Only these public learning resources are served, never the repository directory.
export function createLearningServer() {
  const server = createServer(async (request, response) => {
    const port = server.address()?.port;
    const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    const send = (status, body, headers = {}) => {
      response.writeHead(status, { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8', ...headers });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    if (!allowedHosts.has(request.headers.host)) return send(403, 'Local access only');
    if (!['GET', 'HEAD'].includes(request.method)) return send(405, 'Method not allowed', { Allow: 'GET, HEAD' });
    // Do not normalize traversal segments or absolute-form requests into public routes.
    if (!request.url?.startsWith('/') || request.url.startsWith('//')) return send(400, 'Bad request');
    const pathname = request.url.split('?')[0];
    const entry = routes.get(pathname);
    if (!entry) return send(404, 'Not found');
    try {
      const content = await readFile(new URL(entry[0], projectRoot));
      send(200, content, { 'Content-Type': entry[1] });
    } catch {
      send(500, 'Learning resource could not be read');
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const supplied = process.argv.slice(2);
  const port = supplied.length === 0 ? 4179 : supplied.length === 2 && supplied[0] === '--port' && /^\d+$/.test(supplied[1]) ? Number(supplied[1]) : NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('사용법: npm run dev -- --port 4179 (1–65535)');
    process.exitCode = 1;
  } else {
    const server = createLearningServer();
    server.on('error', error => {
      console.error(error.code === 'EADDRINUSE' ? `127.0.0.1:${port} 포트를 사용 중입니다.` : `학습 화면 시작 실패: ${error.code ?? error.message}`);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`JavaScript-edu 학습 화면: http://127.0.0.1:${port}/`);
      console.log('종료: Ctrl+C. 로컬 개발용이며 코드 실행·제출 검사는 아직 제공하지 않습니다.');
    });
  }
}
