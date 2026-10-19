import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { safeRelativePath, assertDistinctPaths, inventory, compareInventories, extractZip, readZipEntries, selectPackageSource, verifyFinalPackage, sha256File, assertHeadSourceBytes, gitBlobHash } from '../scripts/desktop-integrity.mjs';
import { readPort, savePort, isLearningNavigation, isExternalDocumentation, isAllowedRequest, serviceEnvironment } from '../desktop/policy.mjs';
import { launchLearningService } from '../desktop/service-client.mjs';

async function directory(t) {
  const parent = await realpath(tmpdir());
  const base = await mkdtemp(path.join(parent, 'javascript-edu-desktop-test-'));
  t.after(async () => {
    const actual = await realpath(base);
    const relative = path.relative(parent, actual);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(actual).startsWith('javascript-edu-desktop-test-'));
    await rm(actual, { recursive: true, force: true });
  });
  return base;
}

function archive(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, body = '', mode = 0] of entries) {
    const filename = Buffer.from(name);
    const data = Buffer.from(body);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(filename.length, 28);
    entry.writeUInt32LE(mode >>> 0, 38);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, filename);
    offset += local.length + filename.length + data.length;
  }
  const table = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(table.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, table, end]);
}

test('Windows extraction rejects traversal, ADS, reserved names and ambiguous directory casing', () => {
  for (const invalid of ['../outside', '/root', 'C:/file', 'a\\b', 'a/../b', 'a//b', 'file:stream', 'folder./file', 'CON.txt', 'a/LPT1']) assert.throws(() => safeRelativePath(invalid));
  for (const good of ['locales/ko.pak', '한글 경로/자료.json', 'node_modules/package/file.js']) assert.equal(safeRelativePath(good), good);
  assert.throws(() => assertDistinctPaths([{ path: 'A/file', type: 'file' }, { path: 'a/other', type: 'file' }]), /Case-colliding/);
  assert.throws(() => assertDistinctPaths([{ path: 'a', type: 'file' }, { path: 'a/b', type: 'file' }]), /parent directory/);
});

test('actual ZIP extraction retains empty directories and refuses existing destination', async t => {
  const base = await directory(t);
  const zip = path.join(base, 'valid.zip');
  await writeFile(zip, archive([['empty/', ''], ['한글 자료/file.txt', 'trusted bytes']]));
  const target = path.join(base, 'unpacked');
  const result = await extractZip(zip, target);
  assert.ok(result.some(item => item.path === 'empty' && item.type === 'directory'));
  assert.equal(await readFile(path.join(target, '한글 자료/file.txt'), 'utf8'), 'trusted bytes');
  await assert.rejects(extractZip(zip, target), { code: 'EEXIST' });
});

test('ZIP local/central mismatch, symlink and duplicate entries fail before extraction', async t => {
  const base = await directory(t);
  for (const [name, data] of [
    ['traversal', archive([['../escape', 'bad']])], ['case', archive([['A/file', 'a'], ['a/other', 'b']])],
    ['link', archive([['link', '../escape', 0xa1ff0000]])], ['duplicate', archive([['a', 'a'], ['a', 'b']])],
  ]) {
    const zip = path.join(base, `${name}.zip`);
    await writeFile(zip, data);
    await assert.rejects(readZipEntries(zip));
  }
  const corrupt = archive([['one.txt', 'value']]);
  corrupt[30] = 'x'.charCodeAt(0);
  const filename = path.join(base, 'mismatch.zip');
  await writeFile(filename, corrupt);
  await assert.rejects(readZipEntries(filename), /path mismatch/);
});

test('full inventory detects added, removed and byte-changed files against prior manifest', async t => {
  const base = await directory(t);
  await writeFile(path.join(base, 'runtime.exe'), 'vendor-original');
  await mkdir(path.join(base, 'empty'));
  const expected = await inventory(base);
  assert.equal(compareInventories(expected, await inventory(base)).files, 1);
  await writeFile(path.join(base, 'runtime.exe'), 'modified');
  assert.throws(() => compareInventories(expected, [{ ...expected[0] }, { path: 'extra', type: 'file', size: 1, sha256: 'x' }]), /mismatch/);
  assert.throws(() => compareInventories(expected, []), /mismatch/);
  const changed = await inventory(base);
  assert.throws(() => compareInventories(expected, changed), /runtime.exe/);
});

test('Windows inventory does not follow a directory junction', async t => {
  const base = await directory(t);
  const external = path.join(base, 'external');
  const packaged = path.join(base, 'package');
  await mkdir(external); await mkdir(packaged);
  await symlink(external, path.join(packaged, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(inventory(packaged), /Links\/reparse/);
});

test('saved origin stays fixed across restarts and malformed state is preserved', async t => {
  const base = await directory(t);
  assert.equal(await readPort(base), 0);
  await savePort(base, 42424);
  assert.equal(await readPort(base), 42424);
  const invalid = '{"version":1,"port":80}';
  await writeFile(path.join(base, 'desktop-state.json'), invalid);
  await assert.rejects(readPort(base));
  assert.equal(await readFile(path.join(base, 'desktop-state.json'), 'utf8'), invalid);
});

test('renderer navigation/request policy denies file, privileged schemes, foreign origins and credentials', () => {
  const origin = 'http://127.0.0.1:42424';
  assert.equal(isLearningNavigation(`${origin}/?lesson=x`, origin), true);
  for (const url of [`${origin}/app.mjs`, 'file:///C:/private', 'javascript:alert(1)', `${origin}.example/`, 'http://user@127.0.0.1:42424/']) assert.equal(isLearningNavigation(url, origin), false);
  for (const url of ['file:///private', 'ms-settings:privacy', 'https://nodejs.org.evil.test/', 'https://user@nodejs.org/', 'http://nodejs.org/', 'https://nodejs.org:444/']) assert.equal(isExternalDocumentation(url), false);
  assert.equal(isExternalDocumentation('https://nodejs.org/api/fs.html'), true);
  for (const host of ['r2.nodejs.org', '402.ecma-international.org', 'www.rfc-editor.org', 'storage.spec.whatwg.org']) assert.equal(isExternalDocumentation(`https://${host}/official-document`), true);
  assert.equal(isAllowedRequest(`${origin}/_node/config`, new Set([origin])), true);
  assert.equal(isAllowedRequest('http://127.0.0.1:42425/private', new Set([origin])), false);
  assert.equal(isAllowedRequest('https://nodejs.org/api/', new Set([origin])), false);
  assert.equal(isAllowedRequest('data:text/html,<script>x</script>', new Set([origin])), false);
});

test('native service environment omits executable paths, preload hooks and unrelated credentials', () => {
  const result = serviceEnvironment({ SystemRoot: 'C:\\Windows', TEMP: 'C:\\temp', NODE_OPTIONS: '--import malicious.mjs', PATH: 'bad', ELECTRON_RUN_AS_NODE: '1', SECRET_TOKEN: 'private' });
  assert.deepEqual(result, { SystemRoot: 'C:\\Windows', TEMP: 'C:\\temp' });
});

test('ignored secrets and untracked files cannot enter a clean-source package or a dirty candidate', async t => {
  const base = await directory(t);
  const trackedPaths = new Set(['web/app.mjs']);
  await writeFile(path.join(base, 'app.mjs'), 'export const visible = true;');
  const valid = await inventory(base);
  assert.equal(selectPackageSource(valid, { folder: 'web', trackedPaths }).length, 1);
  for (const name of ['.env', 'private.key', 'local-only.mjs']) {
    await writeFile(path.join(base, name), 'harmless fixture; not a secret');
    const files = await inventory(base);
    for (const allowDirty of [false, true]) assert.throws(() => selectPackageSource(files, { folder: 'web', trackedPaths, allowDirty }), /Unapproved|Untracked or ignored/);
    await rm(path.join(base, name));
  }
  const desktop = [{ path: 'main.mjs', type: 'file', size: 1, sha256: 'x' }];
  assert.throws(() => selectPackageSource(desktop, { folder: 'desktop', trackedPaths: new Set(), allowDirty: true }), /Untracked/);
  assert.equal(selectPackageSource(desktop, { folder: 'desktop', trackedPaths: new Set(), allowDirty: true, candidatePaths: new Set(['desktop/main.mjs']) }).length, 1);
});

test('native smoke baseline is bound to the external ZIP manifest and catches non-executed file tampering', async t => {
  const base = await directory(t);
  const packageRoot = path.join(base, 'package');
  await mkdir(path.join(packageRoot, 'resources', 'app'), { recursive: true });
  await mkdir(path.join(packageRoot, 'integrity'));
  const sourceFile = path.join(packageRoot, 'resources', 'app', 'lesson.json');
  const vendorFile = path.join(packageRoot, 'vendor-README.txt');
  await writeFile(sourceFile, '{"lesson":"original"}');
  await writeFile(vendorFile, 'original vendor text');
  const commit = 'a'.repeat(40), sourceDigest = 'b'.repeat(64);
  await writeFile(path.join(packageRoot, 'BUILD-INFO.json'), JSON.stringify({ sourceCommit: commit, sourceDirty: false, sourceFilesSha256: sourceDigest }));
  await writeFile(path.join(packageRoot, 'integrity', 'source.json'), JSON.stringify({ sourceCommit: commit, digest: sourceDigest, files: [{ path: 'lesson.json', type: 'file', size: Buffer.byteLength('{"lesson":"original"}'), sha256: await sha256File(sourceFile) }] }));
  const zipFile = path.join(base, 'final.zip');
  const zipBytes = archive([['fixture', 'official test fixture']]);
  await writeFile(zipFile, zipBytes);
  const manifestFile = path.join(base, 'final.manifest.json');
  await writeFile(manifestFile, JSON.stringify({ status: 'PASS', scope: 'final-zip-extraction-and-byte-integrity-only', package: 'final.zip', sourceCommit: commit, sourceDirty: false, sourceFilesSha256: sourceDigest, sha256: await sha256File(zipFile), bytes: zipBytes.length, inventory: await inventory(packageRoot) }));
  await verifyFinalPackage(packageRoot, manifestFile);
  await writeFile(sourceFile, '{"lesson":"modified"}');
  await assert.rejects(verifyFinalPackage(packageRoot, manifestFile), /inventory mismatch/);
  await writeFile(sourceFile, '{"lesson":"original"}');
  await writeFile(vendorFile, 'changed vendor notice');
  await assert.rejects(verifyFinalPackage(packageRoot, manifestFile), /inventory mismatch/);
  await writeFile(vendorFile, 'original vendor text');
  await writeFile(zipFile, 'different archive');
  await assert.rejects(verifyFinalPackage(packageRoot, manifestFile), /ZIP no longer matches/);
});

test('HEAD byte guard detects tracked modifications hidden by both Git index flags in an isolated fixture', async t => {
  const base = await directory(t);
  const git = args => execFileSync('git', args, { cwd: base, encoding: 'utf8', windowsHide: true });
  git(['init', '--quiet']);
  git(['config', 'core.autocrlf', 'false']);
  await mkdir(path.join(base, 'empty-hooks'));
  git(['config', 'core.hooksPath', path.join(base, 'empty-hooks')]);
  git(['config', 'user.name', 'Packaging fixture']);
  git(['config', 'user.email', 'packaging-fixture@example.invalid']);
  const filename = path.join(base, 'source.mjs');
  const original = 'export const original = true;\n';
  await writeFile(filename, original);
  git(['add', '--', 'source.mjs']);
  git(['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'fixture baseline']);
  const headBlobs = new Map([['source.mjs', git(['rev-parse', 'HEAD:source.mjs']).trim()]]);
  const entries = [{ path: 'source.mjs', type: 'file' }];
  assert.equal(await gitBlobHash(filename), headBlobs.get('source.mjs'));
  await assertHeadSourceBytes(base, entries, headBlobs);
  for (const flag of ['assume-unchanged', 'skip-worktree']) {
    git(['update-index', `--${flag}`, '--', 'source.mjs']);
    await writeFile(filename, 'export const changed = true;\n');
    assert.equal(git(['status', '--porcelain']), '');
    await assert.rejects(assertHeadSourceBytes(base, entries, headBlobs), /Source bytes differ from HEAD/);
    assert.deepEqual(await assertHeadSourceBytes(base, entries, headBlobs, { allowDirty: true }), ['source.mjs']);
    await writeFile(filename, original);
    git(['update-index', `--no-${flag}`, '--', 'source.mjs']);
  }
  await mkdir(path.join(base, 'web'));
  await writeFile(path.join(base, 'web', 'unused.mjs'), 'export const unused = true;\n');
  git(['add', '--', 'web/unused.mjs']);
  git(['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'fixture unused input']);
  git(['update-index', '--skip-worktree', '--', 'web/unused.mjs']);
  await rm(path.join(base, 'web', 'unused.mjs'));
  assert.equal(git(['status', '--porcelain']), '');
  const trackedPaths = new Set(git(['ls-tree', '-r', '--name-only', 'HEAD']).trim().split('\n'));
  for (const allowDirty of [false, true]) assert.throws(() => selectPackageSource([], { folder: 'web', trackedPaths, allowDirty }), /Tracked package source is missing/);
});

test('owned native service receives IPC disconnect and completes cleanup after its parent is forcibly killed', async t => {
  const base = await directory(t);
  await mkdir(path.join(base, 'desktop'));
  const marker = path.join(base, 'cleanup-complete.json');
  await writeFile(path.join(base, 'desktop', 'service.mjs'), `import {writeFile} from 'node:fs/promises';
const keepAlive=setInterval(()=>{},1000);
process.on('message',()=>{});
process.once('disconnect',()=>{void(async()=>{
 await new Promise(resolve=>setTimeout(resolve,150));
 await writeFile(${JSON.stringify(marker)},JSON.stringify({pid:process.pid,completed:true}));
 clearInterval(keepAlive);
})();});
process.send({type:'ready',port:42424,runtime:'24.22.0'});
`);
  const moduleUrl = pathToFileURL(path.resolve('desktop/service-client.mjs')).href;
  const parentFile = path.join(base, 'parent.mjs');
  await writeFile(parentFile, `import {launchLearningService} from ${JSON.stringify(moduleUrl)};
const service=launchLearningService({executable:process.execPath,projectRoot:${JSON.stringify(base)},port:0});
await service.ready; process.send({servicePid:service.child.pid});
`);
  const parent = spawn(process.execPath, [parentFile], { windowsHide: true, shell: false, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const parentExit = new Promise(resolve => parent.once('exit', resolve));
  let servicePid;
  try {
    const ready = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Fixture parent did not report its owned service.')), 10000);
      parent.once('message', message => { clearTimeout(timer); resolve(message); });
      parent.once('error', error => { clearTimeout(timer); reject(error); });
    });
    servicePid = ready.servicePid;
    assert.ok(Number.isInteger(servicePid));
    parent.kill(); await parentExit;
    let result;
    const deadline = Date.now() + 5000;
    while (!result && Date.now() < deadline) {
      try { result = JSON.parse(await readFile(marker, 'utf8')); } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.deepEqual(result, { pid: servicePid, completed: true });
    const alive = () => { try { process.kill(servicePid, 0); return true; } catch { return false; } };
    while (alive() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(alive(), false);
  } finally {
    if (parent.exitCode === null) { parent.kill(); await parentExit; }
    if (servicePid) { try { process.kill(servicePid); } catch {} }
  }
});

test('Windows shutdown timeout reports failure and actually reclaims only the owned service process tree', { skip: process.platform !== 'win32' }, async t => {
  const base = await directory(t);
  await mkdir(path.join(base, 'desktop'));
  const childFile = path.join(base, 'owned-child.mjs');
  const marker = path.join(base, 'child-pid.json');
  await writeFile(childFile, 'setInterval(()=>{},1000);\n');
  await writeFile(path.join(base, 'desktop', 'service.mjs'), `import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
const child=spawn(process.execPath,[${JSON.stringify(childFile)}],{windowsHide:true,shell:false,stdio:'ignore'});
await writeFile(${JSON.stringify(marker)},JSON.stringify({pid:child.pid}));
process.on('message',()=>{}); setInterval(()=>{},1000);
process.send({type:'ready',port:42424,runtime:'24.22.0'});
`);
  const service = launchLearningService({ executable: process.execPath, projectRoot: base, port: 0, shutdownTimeoutMs: 50 });
  let childPid;
  const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
  try {
    await service.ready;
    childPid = JSON.parse(await readFile(marker, 'utf8')).pid;
    assert.ok(Number.isInteger(childPid) && alive(childPid));
    const outcome = await service.close();
    assert.equal(outcome.ok, false);
    assert.match(outcome.error, /종료 제한 시간/);
    const deadline = Date.now() + 5000;
    while ((alive(service.child.pid) || alive(childPid)) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(alive(service.child.pid), false);
    assert.equal(alive(childPid), false);
  } finally {
    for (const pid of [childPid, service.child.pid].filter(Number.isInteger)) { try { process.kill(pid); } catch {} }
  }
});
