import { app, BrowserWindow, Menu, dialog, shell } from 'electron';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { productName, readPort, savePort, isLearningNavigation, isExternalDocumentation, isAllowedRequest } from './policy.mjs';
import { launchLearningService } from './service-client.mjs';

const projectRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));

// Tests import this same packaged shell from a separate, unshipped test main.
// There is no renderer IPC/preload bridge and no production smoke/qualification switch.
export async function startDesktop({ userDataDirectory, show = true, reportError = message => dialog.showErrorBox(productName, message) } = {}) {
  app.setName(productName);
  app.enableSandbox();
  app.setAppUserModelId('org.junbo.javascriptedu');
  const dataDirectory = userDataDirectory ?? path.join(app.getPath('appData'), productName);
  if (!path.isAbsolute(dataDirectory)) throw new Error('사용자 데이터의 절대 경로가 필요합니다.');
  app.setPath('userData', dataDirectory);
  app.setPath('sessionData', path.join(dataDirectory, 'browser'));
  if (!app.requestSingleInstanceLock()) { app.quit(); return { secondary: true }; }

  let window;
  let service;
  let quitting = false;
  let quitPromise;
  let finishQuit;
  let resolveQuit;
  let browserSession;
  let windowReady = false;
  app.on('second-instance', () => { if (window && !window.isDestroyed()) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  const finish = () => {
    if (!finishQuit) finishQuit = (async () => {
      const result = service ? await service.close() : { ok: true };
      if (!result.ok) reportError(result.error || '학습 실행기 종료를 확인하지 못했습니다.');
      browserSession?.flushStorageData();
      quitting = true;
      resolveQuit?.(result);
      app.quit();
      return result;
    })();
    return finishQuit;
  };
  const quit = () => {
    if (!quitPromise) {
      quitPromise = new Promise(resolve => { resolveQuit = resolve; });
      // Let the renderer flush drafts and handle beforeunload BEFORE stopping the
      // server. Cancelling an unsaved-data dialog keeps a fully working app.
      if (window && !window.isDestroyed()) window.close();
      else void finish();
    }
    return quitPromise;
  };
  app.on('before-quit', event => { if (!quitting) { event.preventDefault(); void quit(); } });
  app.on('window-all-closed', () => { void finish(); });
  await app.whenReady();
  try {
    const config = JSON.parse(await readFile(path.join(projectRoot, 'desktop', 'runtime-config.json'), 'utf8'));
    if (config.nodeVersion !== '24.22.0' || config.nodeRelativePath !== '../vendor/node/node-v24.22.0-win-x64/node.exe' || process.platform !== 'win32' || process.arch !== 'x64') throw new Error('이 패키지는 Windows x64와 포함 Node.js 24.22.0 전용입니다.');
    const savedPort = await readPort(dataDirectory);
    service = launchLearningService({ executable: path.resolve(projectRoot, config.nodeRelativePath), projectRoot, port: savedPort });
    const { origin, port, runtime } = await service.ready;
    if (!savedPort) await savePort(dataDirectory, port);
    const response = await fetch(`${origin}/_browser/config`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('별도 브라우저 실습 서버를 준비하지 못했습니다.');
    const browserHost = await response.json();
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(browserHost.origin) || browserHost.origin === origin) throw new Error('브라우저 실습 origin이 올바르지 않습니다.');
    const origins = new Set([origin, browserHost.origin]);
    window = new BrowserWindow({ width: 1440, height: 960, minWidth: 360, minHeight: 360, title: productName, show: false,
      backgroundColor: '#131c17', autoHideMenuBar: false,
      webPreferences: { nodeIntegration: false, nodeIntegrationInWorker: false, nodeIntegrationInSubFrames: false,
        contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, devTools: false, spellcheck: false },
    });
    const session = window.webContents.session;
    browserSession = session;
    session.setPermissionRequestHandler((contents, permission, callback) => callback(permission === 'clipboard-sanitized-write' && contents === window.webContents && isLearningNavigation(contents.getURL(), origin)));
    session.setPermissionCheckHandler((contents, permission, requestingOrigin) => permission === 'clipboard-sanitized-write' && contents === window.webContents && requestingOrigin === origin);
    session.on('will-download', event => event.preventDefault());
    session.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => callback({ cancel: !isAllowedRequest(details.url, origins) }));
    const openExternal = url => { if (isExternalDocumentation(url)) void shell.openExternal(url).catch(() => reportError('자료 링크를 기본 브라우저에서 열지 못했습니다.')); };
    window.webContents.setWindowOpenHandler(details => { openExternal(details.url); return { action: 'deny' }; });
    window.webContents.on('will-navigate', (event, url) => { if (!isLearningNavigation(url, origin)) { event.preventDefault(); openExternal(url); } });
    window.webContents.on('will-redirect', (event, url) => { if (!isLearningNavigation(url, origin)) event.preventDefault(); });
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.webContents.on('render-process-gone', () => { if (!quitting) { reportError('학습 화면이 종료됐습니다. 앱을 다시 시작하면 저장된 초안과 진도를 이어갈 수 있습니다.'); void quit(); } });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: '파일', submenu: [{ label: '종료', accelerator: 'Alt+F4', click: () => { void quit(); } }] },
      { label: '편집', submenu: [{ role: 'undo', label: '실행 취소' }, { role: 'redo', label: '다시 실행' }, { type: 'separator' }, { role: 'cut', label: '잘라내기' }, { role: 'copy', label: '복사' }, { role: 'paste', label: '붙여넣기' }, { role: 'selectAll', label: '전체 선택' }] },
      { label: '보기', submenu: [{ role: 'reload', label: '새로 고침' }, { role: 'resetZoom', label: '실제 크기' }, { role: 'zoomIn', label: '확대' }, { role: 'zoomOut', label: '축소' }, { role: 'togglefullscreen', label: '전체 화면' }] },
    ]));
    window.webContents.on('will-prevent-unload', event => {
      const choice = dialog.showMessageBoxSync(window, { type: 'warning', title: productName,
        message: '저장하지 못한 학습 내용이 있습니다.', detail: '돌아가서 저장을 다시 시도할 수 있습니다. 종료하면 저장하지 못한 변경사항은 사라집니다.',
        buttons: ['돌아가기', '종료'], defaultId: 0, cancelId: 0, noLink: true });
      if (choice === 1) event.preventDefault();
      else { resolveQuit?.({ ok: false, cancelled: true }); resolveQuit = undefined; quitPromise = undefined; }
    });
    void service.exit.then(() => { if (windowReady && !quitPromise && !finishQuit) { reportError('학습 실행 서버가 종료됐습니다. 앱을 다시 실행해 주세요.'); void quit(); } });
    await window.loadURL(`${origin}/`);
    windowReady = true;
    if (show) window.show();
    return { window, origin, browserOrigin: browserHost.origin, runtime, dataDirectory, service, quit };
  } catch (error) {
    reportError(error.message);
    await quit();
    throw error;
  }
}
