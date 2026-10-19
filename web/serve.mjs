import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createModuleWorkspace } from './server/module-workspace.mjs';
import { createBrowserHostServer } from './server/browser-host.mjs';
import { createNodeExecution } from './server/node-execution.mjs';

const projectRoot = new URL('../', import.meta.url);
const routes = new Map([
  ['/', ['web/index.html', 'text/html; charset=utf-8']],
  ...['index.html', 'styles.css', 'app.mjs', 'glossary-data.mjs', 'glossary-expanded.mjs', 'adapters/storage.mjs', 'adapters/runner.mjs', 'features/workspace-state.mjs',
    'features/learning-data.mjs', 'features/execution-state.mjs', 'features/learning-progress.mjs',
    'features/module-workspace-state.mjs', 'execution/module-runner.mjs', 'execution/dom-runner.mjs', 'execution/node-runner.mjs',
    'execution/browser-runner.mjs', 'execution/protocol.mjs', 'execution/worker.js'].map(file => [
    `/${file}`, [`web/${file}`, file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8'],
  ]),
  ['/runtime/node-contract.mjs', ['runtime/node-contract.mjs', 'text/javascript; charset=utf-8']],
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
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
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
    if (exercise.graderFile && exercise.profileId !== 'node-native') add(exercise.graderFile, 'curriculum/checks', 'json');
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
  return exercises.exercises.filter(exercise => exercise.profileId === 'node-native');
}

// Only these public learning resources are served, never the repository directory.
export function createLearningServer({ qualification = false, nodeExecutable = process.env.JS_EDU_NODE_EXECUTABLE || process.execPath } = {}) {
  let closed = false;
  let browserHost;
  let browserHostConfig = null;
  let browserHostReady = Promise.resolve(null);
  let nodeExecutionReady = Promise.resolve(null);
  let shutdown;
  const moduleWorkspace = readFile(new URL('web/execution/module-bootstrap.mjs', projectRoot), 'utf8')
    .then(bootstrap => { const workspace = createModuleWorkspace({ bootstrap, headers: securityHeaders }); if (closed) workspace.close(); return workspace; })
    .catch(() => null);
  const publicRoutes = new Map(routes);
  if (qualification) {
    publicRoutes.set('/execution/qualification.html', ['web/execution/qualification.html', 'text/html; charset=utf-8']);
    publicRoutes.set('/execution/qualification.mjs', ['web/execution/qualification.mjs', 'text/javascript; charset=utf-8']);
    publicRoutes.set('/execution/qualification-completion.mjs', ['web/execution/qualification-completion.mjs', 'text/javascript; charset=utf-8']);
  }
  let learningIndexFailed = false;
  const learningReady = addLearningRoutes(publicRoutes, qualification).catch(() => { learningIndexFailed = true; });
  const actualProjectRoot = realpath(fileURLToPath(projectRoot));
  const server = createServer(async (request, response) => {
    const port = server.address()?.port;
    const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    const send = (status, body, headers = {}) => {
      const policy = securityHeaders['Content-Security-Policy'].replace("frame-src 'none'", browserHostConfig ? `frame-src ${browserHostConfig.origin}` : "frame-src 'none'");
      response.writeHead(status, { ...securityHeaders, 'Content-Security-Policy': policy, 'Content-Type': 'text/plain; charset=utf-8', ...headers });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    if (!allowedHosts.has(request.headers.host)) return send(403, 'Local access only');
    if (request.url?.startsWith('/_node/')) {
      const nodeExecution = await nodeExecutionReady;
      if (!nodeExecution || closed) return send(503, 'Node 실행 서버를 연결하지 못했습니다.');
      try {
        if (!await nodeExecution.handle(request, response, `http://127.0.0.1:${port}`)) send(404, 'Not found');
      } catch {
        if (!response.headersSent) send(500, 'Node 실행 요청을 처리하지 못했습니다.');
        else response.end();
      }
      return;
    }
    if (request.url?.split('?')[0] === '/_browser/config') {
      const parentOrigin = `http://127.0.0.1:${port}`;
      const json = (status, body) => send(status, JSON.stringify(body), { 'Content-Type': 'application/json; charset=utf-8' });
      if (request.headers.origin !== undefined && request.headers.origin !== parentOrigin) return json(403, { error: 'Origin is not allowed.' });
      if (!['GET', 'HEAD'].includes(request.method)) return send(405, 'Method not allowed', { Allow: 'GET, HEAD' });
      if (request.headers.host !== `127.0.0.1:${port}`) return json(409, { error: 'DOM 실습은 127.0.0.1 주소에서 열어 주세요.', parentOrigin });
      const config = await browserHostReady;
      return config && config === browserHostConfig && browserHost?.listening && !closed
        ? json(200, config) : json(503, { error: '별도 브라우저 실습 서버를 연결하지 못했습니다.' });
    }
    if (request.url?.startsWith('/_execution/')) {
      const workspace = await moduleWorkspace;
      if (!workspace) return send(503, 'Module execution is unavailable');
      await workspace.handle(request, response, `http://${request.headers.host}`);
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) return send(405, 'Method not allowed', { Allow: 'GET, HEAD' });
    // Do not normalize traversal segments or absolute-form requests into public routes.
    if (!request.url?.startsWith('/') || request.url.startsWith('//')) return send(400, 'Bad request');
    const pathname = request.url.split('?')[0];
    await learningReady;
    if (learningIndexFailed && pathname.startsWith('/curriculum/')) return send(503, 'Learning index is unavailable');
    const entry = publicRoutes.get(pathname);
    if (!entry) return send(404, 'Not found');
    try {
      // The document receives only the one host origin started for this server.
      // Other local ports, same-origin frames and external frames remain blocked.
      if (entry[1].startsWith('text/html')) await browserHostReady;
      const actual = await realpath(new URL(entry[0], projectRoot));
      const relative = path.relative(await actualProjectRoot, actual);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return send(404, 'Not found');
      const content = await readFile(actual);
      send(200, content, { 'Content-Type': entry[1], ...(pathname === '/execution/worker.js' ? { 'Content-Security-Policy': workerPolicy } : {}) });
    } catch {
      send(500, 'Learning resource could not be read');
    }
  });
  server.on('listening', () => {
    const address = server.address();
    if (closed || !address || typeof address !== 'object' || address.address !== '127.0.0.1') return;
    const parentOrigin = `http://127.0.0.1:${address.port}`;
    browserHostReady = new Promise(resolve => {
      try {
        browserHost = createBrowserHostServer({ parentOrigin });
        browserHost.on('error', () => { browserHostConfig = null; resolve(null); });
        browserHost.on('close', () => { browserHostConfig = null; });
        browserHost.listen(0, '127.0.0.1', () => {
          const hostAddress = browserHost.address();
          if (closed || !hostAddress || typeof hostAddress !== 'object') { browserHost.close(() => resolve(null)); return; }
          const origin = `http://127.0.0.1:${hostAddress.port}`;
          browserHostConfig = Object.freeze({ origin, frameUrl: `${origin}/execution/dom-frame.html` });
          resolve(browserHostConfig);
        });
      } catch { resolve(null); }
    });
    nodeExecutionReady = Promise.all([learningReady, browserHostReady]).then(([exercises, config]) => {
      if (closed || !Array.isArray(exercises) || !config) return null;
      return createNodeExecution({ executable: path.resolve(fileURLToPath(projectRoot), nodeExecutable),
        expectedVersion: '24.22.0', exercises, httpBase: `${config.origin}/_fixtures/http/` });
    }).catch(() => null);
  });
  const closeMain = server.close.bind(server);
  server.close = callback => {
    if (!shutdown) {
      closed = true;
      const mainClosed = new Promise(resolve => closeMain(error => resolve(error)));
      shutdown = (async () => {
        const errors = [];
        const cleanup = async action => { try { await action(); } catch (error) { errors.push(error); } };
        await cleanup(async () => (await nodeExecutionReady)?.close());
        await cleanup(async () => {
          await browserHostReady;
          await new Promise((resolve, reject) => {
            if (!browserHost?.listening) { resolve(); return; }
            browserHost.close(error => error ? reject(error) : resolve());
            browserHost.closeAllConnections();
          });
        });
        await cleanup(async () => (await moduleWorkspace)?.close());
        const mainError = await mainClosed;
        if (mainError) errors.push(mainError);
        return errors.length > 1 ? new AggregateError(errors, '학습 서버 정리 중 오류가 발생했습니다.') : errors[0];
      })();
    }
    if (typeof callback === 'function') void shutdown.then(error => callback(error));
    return server;
  };
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
