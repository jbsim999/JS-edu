import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const projectRoot = new URL('../', import.meta.url);
const routes = new Map([
  ['/', ['web/index.html', 'text/html; charset=utf-8']],
  ...['index.html', 'styles.css', 'app.mjs', 'glossary-data.mjs', 'adapters/storage.mjs', 'adapters/runner.mjs', 'features/workspace-state.mjs',
    'features/learning-data.mjs', 'features/execution-state.mjs', 'features/learning-progress.mjs',
    'execution/browser-runner.mjs', 'execution/protocol.mjs', 'execution/worker.js'].map(file => [
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
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
};
const workerPolicy = "default-src 'none'; script-src 'unsafe-eval'; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

async function addLearningRoutes(publicRoutes, qualification) {
  const [catalog, exercises] = await Promise.all(['curriculum/catalog.json', 'curriculum/exercises.json'].map(async file => JSON.parse(await readFile(new URL(file, projectRoot), 'utf8'))));
  if (!Array.isArray(catalog.lessons) || !Array.isArray(exercises.exercises)) throw new Error('Invalid learning index');
  const add = (file, group, extension) => {
    if (typeof file !== 'string' || !file.startsWith(`${group}/`) || !file.endsWith(`.${extension}`)
      || !file.split('/').every(segment => /^[a-z0-9][a-z0-9.-]*$/u.test(segment) && !segment.includes('..'))) {
      throw new Error('Invalid public learning path');
    }
    publicRoutes.set(`/${file}`, [file, extension === 'json' ? 'application/json; charset=utf-8' : 'text/javascript; charset=utf-8']);
  };
  for (const lesson of catalog.lessons) add(lesson.file, 'curriculum/lessons', 'json');
  for (const exercise of exercises.exercises) {
    if (exercise.graderFile) add(exercise.graderFile, 'curriculum/checks', 'json');
    if (exercise.exampleFile) add(exercise.exampleFile, 'curriculum/examples', 'mjs');
    for (const source of exercise.files ?? []) {
      if (source.editable === true) add(source.path, 'starter', 'mjs');
    }
    if (qualification) {
      if (!/^[a-z][a-z0-9-]*$/u.test(exercise.id)) throw new Error('Invalid qualification identity');
      for (const [kind, field] of [['reference', 'referenceFile'], ['incorrect', 'incorrectFile']]) {
        if (!exercise[field]) continue;
        add(exercise[field], 'reference', 'mjs');
        publicRoutes.set(`/_qualification/${kind}/${exercise.id}`, [exercise[field], 'text/javascript; charset=utf-8']);
      }
    }
  }
}

// Only these public learning resources are served, never the repository directory.
export function createLearningServer({ qualification = false } = {}) {
  const publicRoutes = new Map(routes);
  if (qualification) {
    publicRoutes.set('/execution/qualification.html', ['web/execution/qualification.html', 'text/html; charset=utf-8']);
    publicRoutes.set('/execution/qualification.mjs', ['web/execution/qualification.mjs', 'text/javascript; charset=utf-8']);
  }
  let learningIndexFailed = false;
  const learningReady = addLearningRoutes(publicRoutes, qualification).catch(() => { learningIndexFailed = true; });
  const actualProjectRoot = realpath(fileURLToPath(projectRoot));
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
    await learningReady;
    if (learningIndexFailed && pathname.startsWith('/curriculum/')) return send(503, 'Learning index is unavailable');
    const entry = publicRoutes.get(pathname);
    if (!entry) return send(404, 'Not found');
    try {
      const actual = await realpath(new URL(entry[0], projectRoot));
      const relative = path.relative(await actualProjectRoot, actual);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return send(404, 'Not found');
      const content = await readFile(actual);
      send(200, content, { 'Content-Type': entry[1], ...(pathname === '/execution/worker.js' ? { 'Content-Security-Policy': workerPolicy } : {}) });
    } catch {
      send(500, 'Learning resource could not be read');
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const supplied = process.argv.slice(2);
  let port = 4179;
  let qualification = false;
  let valid = true;
  let portSeen = false;
  for (let index = 0; index < supplied.length; index++) {
    if (supplied[index] === '--qualification' && !qualification) qualification = true;
    else if (supplied[index] === '--port' && !portSeen && /^\d+$/u.test(supplied[index + 1] ?? '')) {
      port = Number(supplied[++index]);
      portSeen = true;
    } else valid = false;
  }
  if (!valid || !Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('사용법: npm run dev -- --port 4179 [--qualification] (1–65535)');
    process.exitCode = 1;
  } else {
    const server = createLearningServer({ qualification });
    server.on('error', error => {
      console.error(error.code === 'EADDRINUSE' ? `127.0.0.1:${port} 포트를 사용 중입니다.` : `학습 화면 시작 실패: ${error.code ?? error.message}`);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`JavaScript-edu 학습 화면: http://127.0.0.1:${port}/`);
      console.log('종료: Ctrl+C. 로컬 학습용이며 브라우저 실행의 가용성은 화면에서 확인합니다.');
      if (qualification) console.log('제작자 검증 모드: 고정 정답 파일이 이 로컬 서버에 제공됩니다.');
    });
  }
}
