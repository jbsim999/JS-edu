import path from 'node:path';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export const productName = 'JavaScript-edu';
export const desktopStateVersion = 1;

export function isLearningNavigation(value, origin) {
  try {
    const url = new URL(value);
    return url.origin === origin && url.pathname === '/' && !url.username && !url.password;
  } catch { return false; }
}

// External documentation is opened by the OS browser; it never receives a Node bridge.
export function isExternalDocumentation(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443')
      && ['tc39.es', '262.ecma-international.org', 'ecma-international.org', 'www.ecma-international.org',
        'developer.mozilla.org', 'nodejs.org', 'r2.nodejs.org', '402.ecma-international.org', 'www.rfc-editor.org', 'storage.spec.whatwg.org', 'www.typescriptlang.org', 'html.spec.whatwg.org',
        'dom.spec.whatwg.org', 'fetch.spec.whatwg.org', 'url.spec.whatwg.org', 'streams.spec.whatwg.org',
        'encoding.spec.whatwg.org', 'w3c.github.io', 'www.w3.org', 'web.dev', 'v8.dev',
        'github.com', 'docs.github.com', 'docs.npmjs.com', 'eslint.org', 'vitest.dev', 'playwright.dev'].includes(url.hostname);
  } catch { return false; }
}

export function isAllowedRequest(value, origins) {
  if (value === 'about:blank') return true;
  try {
    const url = new URL(value);
    if (url.protocol === 'data:') return value.startsWith('data:image/');
    return ['http:', 'blob:'].includes(url.protocol) && origins.has(url.origin);
  } catch { return false; }
}

export function validatePortState(value) {
  if (!value || Object.keys(value).sort().join(',') !== 'port,version' || value.version !== desktopStateVersion
    || !Number.isInteger(value.port) || value.port < 1024 || value.port > 65535) {
    throw new Error('저장된 학습 주소 설정을 읽지 못했습니다. 사용자 데이터는 변경하지 않았습니다.');
  }
  return value.port;
}

export async function readPort(userDataDirectory) {
  try { return validatePortState(JSON.parse(await readFile(path.join(userDataDirectory, 'desktop-state.json'), 'utf8'))); }
  catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
}

export async function savePort(userDataDirectory, port) {
  validatePortState({ version: desktopStateVersion, port });
  await mkdir(userDataDirectory, { recursive: true });
  const temporary = path.join(userDataDirectory, `desktop-state.${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify({ version: desktopStateVersion, port }, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, path.join(userDataDirectory, 'desktop-state.json'));
}

export function serviceEnvironment(environment = process.env) {
  // The explicit environment excludes preload hooks, tokens and Electron switches.
  // Windows libuv can supplement required variables such as PATH from its parent;
  // every executable used by the service is selected by an absolute path.
  return Object.fromEntries(['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']
    .filter(key => typeof environment[key] === 'string').map(key => [key, environment[key]]));
}
