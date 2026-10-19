import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inventory, copyInventory, compareInventories, sha256File, verifyFinalPackage } from './desktop-integrity.mjs';
import { unixInventory, copyUnixInventory, compareUnixInventories, verifyMacFinalPackage } from './macos-integrity.mjs';
import { requireNativeMac, closeOwnedMacApplication, inspectVendorSignature, findOwnedMacApplication } from './macos-platform.mjs';
import { inspectOriginalElectronSignatures } from './macos-signatures.mjs';
import { createNodeRunner, fingerprintSource, serializeNodeSource } from '../web/execution/node-runner.mjs';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const args = process.argv.slice(2);
const packageRoot = path.resolve(args.shift() || '');
const options = {};
while (args.length) {
  const option = args.shift();
  if (!['--output-dir', '--manifest'].includes(option) || !args[0] || options[option]) throw new Error('Usage: node scripts/check-desktop-smoke.mjs <extracted-package-path> --output-dir <fresh-directory> --manifest <external-final-manifest>');
  options[option] = args.shift();
}
if (!options['--output-dir'] || !options['--manifest']) throw new Error('An external final ZIP manifest and fresh output directory are required.');
const isMac = process.platform === 'darwin';
const nativeMac = isMac ? requireNativeMac() : undefined;
if (!isMac && (process.platform !== 'win32' || process.arch !== 'x64')) throw new Error('Native Windows x64 or macOS x64/arm64 is required.');
const packageInventory = isMac ? unixInventory : inventory;
const copyPackageInventory = isMac ? copyUnixInventory : copyInventory;
const comparePackageInventories = isMac ? compareUnixInventories : compareInventories;
const verifyPackage = isMac ? verifyMacFinalPackage : verifyFinalPackage;
const output = path.resolve(options['--output-dir']);
const finalManifestFile = path.resolve(options['--manifest']);
const verifiedPackage = await verifyPackage(packageRoot, finalManifestFile);
if (verifiedPackage.target?.platform !== process.platform || verifiedPackage.target?.architecture !== process.arch) throw new Error('The final package target must match this native CPU.');
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output, { recursive: false });
await mkdir(path.join(output, 'temp'));
await writeFile(path.join(output, '.owned-by-desktop-smoke'), randomUUID());
const packageBefore = await packageInventory(packageRoot);
const build = JSON.parse(await readFile(path.join(packageRoot, 'BUILD-INFO.json'), 'utf8'));
const appRelativePath = isMac ? build.appRelativePath : 'resources/app';
const sourceManifest = JSON.parse(await readFile(path.join(packageRoot, 'integrity', 'source.json'), 'utf8'));
for (const entry of sourceManifest.files.filter(item => item.type === 'file')) if (await sha256File(path.join(root, entry.path)) !== entry.sha256) throw new Error(`Author inputs differ from packaged source: ${entry.path}`);
async function authorInputs() {
  const names = ['scripts/check-desktop-smoke.mjs', 'scripts/desktop-smoke-main.mjs', 'scripts/desktop-integrity.mjs', 'scripts/macos-integrity.mjs', 'scripts/macos-platform.mjs', 'scripts/macos-signatures.mjs',
    ...(await readdir(path.join(root, 'web', 'execution'))).filter(name => name.startsWith('qualification')).map(name => `web/execution/${name}`),
    ...(await inventory(path.join(root, 'reference'))).filter(item => item.type === 'file').map(item => `reference/${item.path}`)].sort();
  return Promise.all(names.map(async filename => ({ path: filename, type: 'file', size: (await stat(path.join(root, filename))).size, sha256: await sha256File(path.join(root, filename)) })));
}
const authorBefore = await authorInputs();
const authorCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
if (!build.sourceDirty && authorCommit !== build.sourceCommit) throw new Error('Final package verification requires the matching author source commit.');
const executable = path.join(packageRoot, isMac ? build.executableRelativePath : 'JavaScript-edu.exe');
await stat(executable);
// A packaged Electron always uses resources/app and ignores an external app arg.
// Use a full byte-verified copy of its original vendor distribution for the author
// test main, which imports the unchanged application module from the actual ZIP.
const electronManifest = JSON.parse(await readFile(path.join(packageRoot, 'integrity', 'electron.json'), 'utf8'));
const nativeHost = path.join(output, 'native-test-host');
const vendorRoot = isMac ? path.join(packageRoot, build.electronRelativeRoot) : packageRoot;
await copyPackageInventory(vendorRoot, nativeHost, electronManifest.files);
const electronEntry = isMac ? 'Electron.app/Contents/MacOS/Electron' : 'electron.exe';
const nativeExecutable = path.join(nativeHost, electronEntry);
if (await sha256File(isMac ? path.join(vendorRoot, electronEntry) : executable) !== await sha256File(nativeExecutable)) throw new Error('Test native host differs from the final Electron executable.');
const report = { status: 'RUNNING', startedAt: new Date().toISOString(), packageRoot, zipSha256: verifiedPackage.sha256, externalManifestSha256: await sha256File(finalManifestFile), sourceCommit: build.sourceCommit, sourceDirty: build.sourceDirty, sourceFilesSha256: build.sourceFilesSha256,
  authorInputs: { sourceCommit: authorCommit, files: authorBefore, digest: createHash('sha256').update(JSON.stringify(authorBefore)).digest('hex'), verifiedUnchanged: false }, phases: [], native: nativeMac || { platform: process.platform, architecture: process.arch }, limits: ['Forced-parent checks cover the owned Node service PID, both ports and learner temp directories; renderer/GPU/other descendant PID absence is not measured.', 'Native process execution is tested; no OS security sandbox or universal process-tree guarantee', 'A dedicated QA profile is retained; existing user profiles are not touched', ...(isMac ? ['Unsigned wrapper; no Developer ID signing, notarization or downloaded-archive Gatekeeper approval.'] : [])] };
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
function environment(phase) {
  const clean = { ...process.env, JS_EDU_SMOKE_PACKAGE: packageRoot, JS_EDU_SMOKE_AUTHOR: root, JS_EDU_SMOKE_OUTPUT: output, JS_EDU_SMOKE_PHASE: phase,
    PATH: isMac ? '/usr/bin:/bin:/usr/sbin:/sbin' : path.join(process.env.SystemRoot || 'C:\\Windows', 'System32'), TEMP: path.join(output, 'temp'), TMP: path.join(output, 'temp'), ...(isMac ? { TMPDIR: path.join(output, 'temp') } : {}) };
  delete clean.NODE_OPTIONS; delete clean.NODE_PATH; delete clean.ELECTRON_RUN_AS_NODE;
  return clean;
}
function start(phase) {
  // This is the intentional QA GUI, not a hidden background helper. SW_HIDE can
  // suppress the first native window even after Electron window.show().
  const child = spawn(nativeExecutable, [path.join(root, 'scripts', 'desktop-smoke-main.mjs')], { cwd: packageRoot, env: environment(phase), windowsHide: false, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout = (stdout + chunk.toString()).slice(-16000); });
  child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-16000); });
  const exit = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => resolve({ code, signal })); });
  return { child, exit, logs: () => ({ stdout, stderr }) };
}
async function waitForReport(phase, status, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { const value = JSON.parse(await readFile(path.join(output, `${phase}.json`), 'utf8')); if (value.status === status || value.status === 'FAIL') return value; } catch (error) { if (!['ENOENT', undefined].includes(error.code)) throw error; }
    await pause(100);
  }
  throw new Error(`Desktop ${phase} did not reach ${status}.`);
}
async function closedPort(origin) {
  try { await fetch(origin, { signal: AbortSignal.timeout(1500) }); return false; } catch { return true; }
}
function alive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
async function waitForExit(operation, timeout = 20000) {
  let timer;
  try { return await Promise.race([operation.exit, new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('Native application did not exit before the shutdown deadline.')), timeout); })]); }
  finally { clearTimeout(timer); }
}
async function productionEntry(applicationDirectory, entryDirectory, expectedOrigin, launchServices = false) {
  const entryEnvironment = { ...environment('entry'), JS_EDU_USER_DATA_DIR: entryDirectory };
  const entryExecutable = path.join(applicationDirectory, isMac ? build.executableRelativePath : 'JavaScript-edu.exe');
  const launchArguments = launchServices ? ['-W', '-n', ...['JS_EDU_USER_DATA_DIR', 'PATH', 'TMPDIR', 'TEMP', 'TMP'].flatMap(key => ['--env', `${key}=${entryEnvironment[key]}`]), '--env', 'NODE_OPTIONS=', '--env', 'NODE_PATH=', path.join(applicationDirectory, 'JavaScript-edu.app')] : [];
  const entryProcess = spawn(launchServices ? '/usr/bin/open' : entryExecutable, launchArguments, { cwd: applicationDirectory, env: entryEnvironment, windowsHide: false, shell: false, stdio: 'ignore' });
  let appPid = launchServices ? undefined : entryProcess.pid;
  const entryExit = new Promise((resolve, reject) => { entryProcess.once('error', reject); entryProcess.once('exit', code => resolve(code)); });
  let entryOrigin;
  try {
    const deadline = Date.now() + 30000;
    while (!entryOrigin && Date.now() < deadline) {
      try {
        const state = JSON.parse(await readFile(path.join(entryDirectory, 'desktop-state.json'), 'utf8'));
        const candidate = `http://127.0.0.1:${state.port}`;
        if ((await fetch(candidate, { signal: AbortSignal.timeout(1000) })).ok) entryOrigin = candidate;
      } catch { await pause(100); }
    }
    if (!entryOrigin || (expectedOrigin && entryOrigin !== expectedOrigin)) throw new Error('Final production EXE did not initialize or preserve its selected origin.');
    if (launchServices) {
      appPid = findOwnedMacApplication(path.join(applicationDirectory, build.electronRelativeRoot, 'Electron.app/Contents/MacOS/Electron'));
      if (!appPid) throw new Error('LaunchServices did not start the exact owned vendor executable.');
    }
    const config = await (await fetch(`${entryOrigin}/_node/config`, { signal: AbortSignal.timeout(5000) })).json();
    const browser = await (await fetch(`${entryOrigin}/_browser/config`, { signal: AbortSignal.timeout(5000) })).json();
    if (!config.available || config.runtimeVersion !== '24.22.0') throw new Error('Final production EXE did not use the bundled Node runtime.');
    const catalog = JSON.parse(await readFile(path.join(applicationDirectory, appRelativePath, 'curriculum', 'exercises.json'), 'utf8'));
    const exercise = catalog.exercises.find(item => item.lessonId === 'node-esm-packages-and-cli');
    const reference = await readFile(path.join(root, exercise.referenceFile), 'utf8');
    const source = serializeNodeSource({ entry: exercise.workspace.entry, files: Object.fromEntries(exercise.workspace.files.map(file => [file.path, file.path === exercise.workspace.entry ? reference : file.source])) });
    const runner = createNodeRunner({ exercises: [exercise], origin: entryOrigin, getConsent: () => true,
      fetcher: (url, init = {}) => fetch(url, { ...init, headers: { ...(init.method && init.method !== 'GET' ? { Origin: entryOrigin } : {}), ...init.headers } }) });
    const request = { requestId: `entry-${randomUUID()}`, lessonId: exercise.lessonId, exerciseId: exercise.id, contentRevision: exercise.contentRevision, targetVersion: 'ES2026', source, sourceFingerprint: await fingerprintSource(source), consent: true };
    const submission = await runner.submit(request);
    await runner.cancel();
    const grader = JSON.parse(await readFile(path.join(applicationDirectory, appRelativePath, exercise.graderFile), 'utf8'));
    if (submission.status !== 'success' || submission.checks.length !== grader.cases.length || submission.checks.some((item, index) => !item.passed || item.id !== grader.cases[index].id) || submission.cleanupWarning || submission.cleanupPending || submission.outputTruncated) throw new Error('Production EXE native submission failed.');
    // Only this owned process receives WM_CLOSE. Wait for its actual native window,
    // since the service can be ready before the window has finished painting.
    let closed = false;
    const closeDeadline = Date.now() + 10000;
    while (!closed && Date.now() < closeDeadline) {
      closed = isMac ? closeOwnedMacApplication(appPid) : execFileSync('pwsh.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `(Get-Process -Id ${entryProcess.pid} -ErrorAction Stop).CloseMainWindow()`], { encoding: 'utf8', windowsHide: true }).trim() === 'True';
      if (!closed) await pause(150);
    }
    if (!closed) throw new Error('Final EXE native window was not available for normal close.');
    const code = await waitForExit({ exit: entryExit });
    if (code !== 0 || (launchServices && alive(appPid)) || !await closedPort(entryOrigin) || !await closedPort(browser.origin)) throw new Error('Final production entry did not shut down normally.');
    return { passed: true, code, actualRuntime: config.actualRuntime, origin: entryOrigin, nativeCloseMainWindow: !isMac, nativeAppKitTermination: isMac, launchServices, ownedApplicationPid: appPid, isolatedUserData: entryDirectory, applicationDirectory, nativeSubmissionChecks: submission.checks.length };
  } finally {
    if (launchServices && !appPid) appPid = findOwnedMacApplication(path.join(applicationDirectory, build.electronRelativeRoot, 'Electron.app/Contents/MacOS/Electron'));
    if (launchServices && appPid && alive(appPid)) { try { process.kill(appPid, 'SIGTERM'); } catch {} }
    if (entryProcess.exitCode === null) { entryProcess.kill(); await waitForExit({ exit: entryExit }).catch(() => {}); }
  }
}
let active;
try {
  const invalidProfile = spawn(executable, [], { cwd: packageRoot, env: { ...environment('invalid-profile'), JS_EDU_USER_DATA_DIR: 'relative' }, windowsHide: true, shell: false, stdio: ['ignore', 'ignore', 'pipe'] });
  let invalidProfileError = '';
  invalidProfile.stderr.on('data', chunk => { invalidProfileError = (invalidProfileError + chunk.toString()).slice(-4000); });
  const invalidProfileExit = new Promise((resolve, reject) => { invalidProfile.once('error', reject); invalidProfile.once('exit', code => resolve(code)); });
  try {
    const code = await waitForExit({ exit: invalidProfileExit }, 5000);
    if (code !== 1 || !invalidProfileError.includes('절대 경로')) throw new Error('Invalid profile preflight did not terminate the actual production EXE.');
    report.invalidProfilePreflight = { passed: true, code, noServiceStarted: true };
  } finally {
    if (invalidProfile.exitCode === null) { invalidProfile.kill(); await waitForExit({ exit: invalidProfileExit }).catch(() => {}); }
  }
  active = start('qualify');
  const started = await waitForReport('qualify', 'RUNNING', 30000);
  if (started.status === 'FAIL') throw new Error(started.error || 'Native application startup failed.');
  const secondary = start('secondary');
  const secondaryExit = await waitForExit(secondary);
  const secondaryReport = JSON.parse(await readFile(path.join(output, 'secondary.json'), 'utf8'));
  if (secondaryExit.code !== 0 || secondaryReport.secondary !== true || secondaryReport.status !== 'PASS') throw new Error('Single-instance lock did not reject a second native instance.');
  report.singleInstanceConfirmed = true;
  const initial = await waitForReport('qualify', 'PASS', 360000);
  if (initial.status !== 'PASS') throw new Error(initial.error || 'Native qualification failed.');
  const initialExit = await waitForExit(active);
  if (initialExit.code !== 0) throw new Error('Initial native session exited with failure.');
  const initialFinal = JSON.parse(await readFile(path.join(output, 'qualify.json'), 'utf8'));
  report.phases.push({ phase: 'qualify', ...initialExit, ...active.logs(), report: initialFinal });
  if (initialFinal.errors?.length || !initialFinal.shutdown?.closedMessage?.ok || !await closedPort(initial.origin) || !await closedPort(initial.browserOrigin) || alive(initial.servicePid)) throw new Error('Normal shutdown did not close the service and both ports without errors.');
  report.normalShutdownConfirmed = true;
  active = start('restore');
  const restore = await waitForReport('restore', 'PASS', 60000);
  if (restore.status !== 'PASS') throw new Error(restore.error || 'Restart restore failed.');
  const restoreExit = await waitForExit(active);
  const restoreFinal = JSON.parse(await readFile(path.join(output, 'restore.json'), 'utf8'));
  report.phases.push({ phase: 'restore', ...restoreExit, ...active.logs(), report: restoreFinal });
  if (restoreExit.code !== 0 || restoreFinal.errors?.length || !restoreFinal.shutdown?.closedMessage?.ok || !await closedPort(restore.origin) || !await closedPort(restore.browserOrigin) || alive(restore.servicePid)) throw new Error('Restored session did not close the service and both ports without errors.');
  active = start('discard');
  const discard = await waitForReport('discard', 'PASS', 60000);
  if (discard.status !== 'PASS') throw new Error(discard.error || 'Beforeunload discard failed.');
  const discardExit = await waitForExit(active);
  const discardFinal = JSON.parse(await readFile(path.join(output, 'discard.json'), 'utf8'));
  report.phases.push({ phase: 'discard', ...discardExit, ...active.logs(), report: discardFinal });
  if (discardExit.code !== 0 || discardFinal.errors?.length || !discardFinal.shutdown?.closedMessage?.ok || !await closedPort(discard.origin) || !await closedPort(discard.browserOrigin) || alive(discard.servicePid)) throw new Error('Beforeunload discard did not close the service and both ports without errors.');
  active = start('force-parent');
  const force = await waitForReport('force-parent', 'READY_TO_KILL', 30000);
  if (force.status !== 'READY_TO_KILL') throw new Error(force.error || 'Forced-parent test did not start.');
  active.child.kill(isMac ? 'SIGKILL' : undefined);
  const forceExit = await waitForExit(active);
  if (isMac && forceExit.signal !== 'SIGKILL') throw new Error('The macOS parent was not actually terminated with SIGKILL.');
  const deadline = Date.now() + 15000;
  while (alive(force.servicePid) && Date.now() < deadline) await pause(100);
  if (alive(force.servicePid) || !await closedPort(force.origin) || !await closedPort(force.browserOrigin)) throw new Error('IPC-disconnect cleanup left the native service or ports active.');
  report.phases.push({ phase: 'force-parent', ...forceExit, report: force, ...active.logs() });
  report.forcedParentDisconnectCleanupConfirmed = true;
  const remaining = (await readdir(path.join(output, 'temp'))).filter(name => name.startsWith('javascript-edu-node-'));
  if (remaining.length) throw new Error(`Owned learner temp directories remain: ${remaining.join(', ')}`);
  report.learnerTemporaryCleanupAfterForceParentConfirmed = true;
  // Finally start the exact production EXE, including main.mjs, without a harness
  // argument. A new explicit data directory protects the user's existing profile.
  const entryDirectory = path.join(output, 'entry-user-data');
  report.productionEntry = await productionEntry(packageRoot, entryDirectory);
  const relocated = path.join(output, '이동 검사 & 자료', 'JavaScript-edu');
  await mkdir(path.dirname(relocated), { recursive: true });
  await copyPackageInventory(packageRoot, relocated, packageBefore);
  await verifyPackage(relocated, finalManifestFile);
  report.relocatedProductionEntry = await productionEntry(relocated, entryDirectory, report.productionEntry.origin);
  if (isMac) report.launchServicesEntry = await productionEntry(relocated, entryDirectory, report.productionEntry.origin, true);
  comparePackageInventories(packageBefore, await packageInventory(relocated), 'Relocated package unchanged after native execution');
  const finalRemaining = (await readdir(path.join(output, 'temp'))).filter(name => name.startsWith('javascript-edu-node-'));
  if (finalRemaining.length) throw new Error(`Owned learner temp directories remain after production and relocation: ${finalRemaining.join(', ')}`);
  report.learnerTemporaryCleanupConfirmed = true;
  comparePackageInventories(packageBefore, await packageInventory(packageRoot), 'Package unchanged after ALL native phases');
  await verifyPackage(packageRoot, finalManifestFile);
  if (isMac) report.finalVendorSignatures = { electron: await inspectOriginalElectronSignatures(vendorRoot, { architecture: process.arch, version: build.electron.version, files: electronManifest.files, scratchParent: output, reportPath: path.join(output, 'final-electron-signatures.json') }), node: inspectVendorSignature(path.join(packageRoot, build.runtimePath)) };
  if (await sha256File(finalManifestFile) !== report.externalManifestSha256) throw new Error('External package manifest changed during the native test.');
  compareInventories(authorBefore, await authorInputs(), 'Author-only verification inputs unchanged');
  if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim() !== authorCommit) throw new Error('Author commit changed during the native test.');
  report.authorInputs.verifiedUnchanged = true;
  report.packageUnchanged = true;
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.error = error.stack || error.message;
  if (active) { report.activeLogs = active.logs(); active.child.kill(); await active.exit.catch(() => {}); }
} finally {
  report.completedAt = new Date().toISOString();
  await writeFile(path.join(output, 'desktop-smoke-report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ status: report.status, sourceCommit: build.sourceCommit, sourceDirty: build.sourceDirty, output, error: report.error, normalShutdownConfirmed: report.normalShutdownConfirmed, singleInstanceConfirmed: report.singleInstanceConfirmed, forcedParentDisconnectCleanupConfirmed: report.forcedParentDisconnectCleanupConfirmed, learnerTemporaryCleanupConfirmed: report.learnerTemporaryCleanupConfirmed, packageUnchanged: report.packageUnchanged }, null, 2));
process.exitCode = report.status === 'PASS' ? 0 : 1;
