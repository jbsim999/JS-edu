// Author-only Electron test main. This file and reference answers are NOT packaged.
import { app, dialog } from 'electron';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Finish bootstrap during main-module evaluation. An unawaited async IIFE may
// yield to Electron ready before setPath/enableSandbox run. The dynamic import
// therefore has a real top-level await; startDesktop itself must NOT be awaited
// at top level because it waits for ready after its synchronous initial setup.
const packageRoot = process.env.JS_EDU_SMOKE_PACKAGE;
const authorRoot = process.env.JS_EDU_SMOKE_AUTHOR;
const output = process.env.JS_EDU_SMOKE_OUTPUT;
const phase = process.env.JS_EDU_SMOKE_PHASE;
if (![packageRoot, authorRoot, output].every(value => value && path.isAbsolute(value)) || !['qualify', 'restore', 'discard', 'force-parent', 'secondary'].includes(phase)) throw new Error('Author smoke configuration is required.');
const resultFile = path.join(output, `${phase}.json`);
const buildInfo = JSON.parse(readFileSync(path.join(packageRoot, 'BUILD-INFO.json'), 'utf8'));
const appRoot = path.join(packageRoot, process.platform === 'darwin' ? buildInfo.appRelativePath : 'resources/app');
const { startDesktop } = await import(pathToFileURL(path.join(appRoot, 'desktop', 'application.mjs')));
void (async () => {
const report = { status: 'RUNNING', phase, startedAt: new Date().toISOString(), host: { platform: process.platform, architecture: process.arch, versions: process.versions }, tests: [], screenshots: [], limitations: ['Native desktop application automation; not a physical mobile test, OS IME test or screen-reader session.', 'Page zoom uses actual Electron webContents.setZoomFactor, not viewport emulation.', 'No OS security sandbox or universal process-tree isolation guarantee for learner Node code.'] };
let controller;
const check = (name, passed, details) => { report.tests.push({ name, passed: Boolean(passed), ...(details === undefined ? {} : { details }) }); assert.ok(passed, name); };
const persist = () => writeFileSync(resultFile, JSON.stringify(report, null, 2));
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function evaluate(source) { return controller.window.webContents.executeJavaScript(source, true); }
async function waitFor(source, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await evaluate(source);
    if (value) return value;
    await pause(75);
  }
  throw new Error(`UI condition timed out: ${source.slice(0, 200)}`);
}
async function frames() { await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))'); }
async function capture(name, scrollSelector) {
  if (scrollSelector) await evaluate(`document.querySelector(${JSON.stringify(scrollSelector)}).scrollIntoView({block:'start'})`);
  await frames();
  const image = await controller.window.webContents.capturePage();
  const filename = `${name}.png`;
  await writeFile(path.join(output, filename), image.toPNG());
  const measurements = await evaluate('({innerWidth,innerHeight,dpr:devicePixelRatio,scrollWidth:document.documentElement.scrollWidth,theme:document.documentElement.dataset.theme})');
  report.screenshots.push({ file: filename, zoomFactor: controller.window.webContents.getZoomFactor(), ...measurements });
  check(`${name}: no horizontal page overflow`, measurements.scrollWidth <= measurements.innerWidth + 1, measurements);
  persist();
  return measurements;
}
async function navigate(lesson, step = 'lab') {
  await controller.window.loadURL(`${controller.origin}/?lesson=${encodeURIComponent(lesson)}&step=${step}&version=ES2026&track=all`);
  await waitFor('!document.querySelector("#boot-note") && document.querySelectorAll("#lesson-list li").length > 0 && document.querySelector("#lesson-heading")?.textContent.trim()');
  if (step === 'lab') await waitFor('document.querySelector("#code-editor") && !document.querySelector("[data-execute=prepare]")?.disabled');
}
async function input(selector, value) {
  await evaluate(`(() => { const element=document.querySelector(${JSON.stringify(selector)}); element.focus(); element.value=${JSON.stringify(value)}; element.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'})); })()`);
}
async function click(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); }
async function execute(mode, wanted) {
  await click(`[data-execute=${mode}]`);
  const value = await waitFor(`document.querySelector('.execution-outcome[data-status]')?.dataset.status`, 30000);
  if (wanted) check(`UI ${mode}: ${wanted}`, value === wanted, { status: value });
  return value;
}

async function browserQualification(exercises) {
  const answers = {};
  for (const exercise of exercises.filter(item => !item.hostRequirements?.includes('node-native'))) {
    for (const [kind, field] of [['reference', 'referenceFile'], ['incorrect', 'incorrectFile']]) answers[`/_qualification/${kind}/${exercise.id}`] = await readFile(path.join(authorRoot, exercise[field]), 'utf8');
  }
  const original = await readFile(path.join(authorRoot, 'web', 'execution', 'qualification.mjs'), 'utf8');
  const completion = await readFile(path.join(authorRoot, 'web', 'execution', 'qualification-completion.mjs'), 'utf8');
  let source = original.replace(/import \{ ([^}]+) \} from '\.\/([^']+)';/g, (_, names, filename) => filename === 'qualification-completion.mjs' ? '' : `const { ${names} } = await import('/execution/${filename}');`);
  source = source.replace('async function readText(url) {', 'async function readText(url) { if (Object.hasOwn(authorAnswers,url)) return authorAnswers[url];');
  const fixture = `<div id="desktop-qualification-fixture" hidden><p id="qualification-status"></p><pre id="qualification-results"></pre><form id="qualification-form"><input id="exercise-filter"><button id="qualification-run" type="submit">run</button><button id="qualification-cancel" type="button">cancel</button></form></div>`;
  await evaluate(`(async () => { document.body.insertAdjacentHTML('beforeend',${JSON.stringify(fixture)}); const authorAnswers=${JSON.stringify(answers)}; ${completion.replace('export function qualificationPassed', 'function qualificationPassed')}\n${source}\ndocument.querySelector('#qualification-form').requestSubmit(); })()`);
  await waitFor("document.documentElement.dataset.status === 'done'", 240000);
  const result = await evaluate("JSON.parse(document.querySelector('#qualification-results').textContent)");
  await writeFile(path.join(output, 'browser-qualification.json'), JSON.stringify(result, null, 2));
  const counts = { exercises: result.exercises?.length, referenceChecks: result.exercises?.reduce((sum, item) => sum + (item.tests.find(test => test.name === 'reference-submit')?.result.checks.length || 0), 0), negatives: result.exercises?.reduce((sum, item) => sum + item.tests.filter(test => ['starter-rejected', 'incorrect-rejected'].includes(test.name) && test.passed).length, 0), examples: result.examples?.length, runtime: result.runtime?.length };
  check('Electron browser curriculum: 44 exercises / 361 checks / 88 negatives / 11 DOM examples / 16 runtime checks', result.passed && counts.exercises === 44 && counts.referenceChecks === 361 && counts.negatives === 88 && counts.examples === 11 && counts.runtime === 16, counts);
  report.browserQualification = { ...counts, sourceSha256: createHash('sha256').update(original).digest('hex'), fixture: 'Original author qualification with HTTP reference reads replaced by fixed in-memory answers; production server routes unchanged.' };
  await evaluate("document.querySelector('#desktop-qualification-fixture').remove(); delete document.documentElement.dataset.status");
}

async function nodeQualification(exercises) {
  const inputs = [];
  for (const exercise of exercises.filter(item => item.hostRequirements?.includes('node-native'))) {
    inputs.push({ exercise, reference: await readFile(path.join(authorRoot, exercise.referenceFile), 'utf8'), incorrect: await readFile(path.join(authorRoot, exercise.incorrectFile), 'utf8'), grader: JSON.parse(await readFile(path.join(appRoot, exercise.graderFile), 'utf8')) });
  }
  const result = await evaluate(`(async () => {
    const inputs=${JSON.stringify(inputs)};
    const {createNodeRunner,fingerprintSource,serializeNodeSource}=await import('/execution/node-runner.mjs');
    const results=[]; let sequence=0;
    const clean=result=>!result.cleanupWarning&&!result.cleanupPending&&!result.outputTruncated;
    const rejected=result=>clean(result)&&((result.status==='checks-failed'&&result.checks.some(check=>check.passed===false))||['module-load-error','compilation-error','runtime-error'].includes(result.status));
    for(const item of inputs) {
      const {exercise,grader}=item; const runner=createNodeRunner({exercises:[exercise],getConsent:()=>true});
      const source=text=>serializeNodeSource({entry:exercise.workspace.entry,files:Object.fromEntries(exercise.workspace.files.map(file=>[file.path,file.path===exercise.workspace.entry&&text!==undefined?text:file.source]))});
      const request=async text=>({requestId:'desktop-node-'+(++sequence),lessonId:exercise.lessonId,exerciseId:exercise.id,contentRevision:exercise.contentRevision,targetVersion:'ES2026',source:text,sourceFingerprint:await fingerprintSource(text),consent:true});
      const referenceRequest=await request(source(item.reference));
      const prepared=await runner.prepare(referenceRequest);
      const run=await runner.run(await request(source(item.reference)));
      const reference=await runner.submit(await request(source(item.reference)));
      const starter=await runner.submit(await request(source()));
      const incorrectRequest=await request(source(item.incorrect));
      const incorrect=await runner.submit(incorrectRequest);
      let incorrectRejected=rejected(incorrect),recovery;
      const validReference=reference.status==='success'&&reference.checks.length===grader.cases.length&&reference.checks.every((check,index)=>check.passed&&check.id===grader.cases[index].id);
      if(!incorrectRejected&&exercise.lessonId==='node-outbound-requests-and-cancellation'&&validReference&&incorrect.status==='timeout'&&clean(incorrect)&&incorrect.timedOutCaseId==='release-unused-body'&&grader.cases.some(check=>check.id===incorrect.timedOutCaseId)&&['requestId','lessonId','exerciseId','contentRevision','targetVersion','sourceFingerprint'].every(key=>incorrect[key]===incorrectRequest[key])&&incorrect.environmentFingerprint===reference.environmentFingerprint&&incorrect.actualRuntime===reference.actualRuntime) {recovery=await runner.run(await request(source(item.reference)));incorrectRejected=recovery.status==='success'&&clean(recovery)&&recovery.sourceFingerprint===reference.sourceFingerprint;}
      results.push({exerciseId:exercise.id,passed:prepared.status==='ready'&&run.status==='success'&&validReference&&rejected(starter)&&incorrectRejected&&[prepared,run,reference].every(clean),prepared,run,reference,starter,incorrect,recovery});
      await runner.cancel();
    }
    return {passed:results.length===11&&results.every(item=>item.passed),exercises:results};
  })()`);
  await writeFile(path.join(output, 'node-qualification.json'), JSON.stringify(result, null, 2));
  const checks = result.exercises.reduce((sum, item) => sum + item.reference.checks.filter(check => check.passed).length, 0);
  check('Packaged native Node API: all 11 exercises / 110 behavior checks / starter and incorrect rejected', result.passed && checks === 110, { exercises: result.exercises.length, checks });
}

try {
  check('Application security and profile bootstrap begins before Electron ready', !app.isReady());
  controller = await startDesktop({ userDataDirectory: path.join(output, 'user-data'), show: true, reportError: message => { report.errors ??= []; report.errors.push(message); persist(); } });
  if (controller.secondary) { report.status = 'PASS'; report.secondary = true; persist(); }
  else {
    report.origin = controller.origin;
    report.browserOrigin = controller.browserOrigin;
    report.servicePid = controller.service.child.pid;
    report.electronPid = process.pid;
    report.build = JSON.parse(await readFile(path.join(packageRoot, 'BUILD-INFO.json'), 'utf8'));
    app.once('will-quit', () => { report.shutdown = controller.service.diagnostics(); report.completedAt = new Date().toISOString(); persist(); });
    persist();
    await waitFor('!document.querySelector("#boot-note") && document.querySelectorAll("#step-tabs button").length === 5');
    const exercises = JSON.parse(await readFile(path.join(appRoot, 'curriculum', 'exercises.json'), 'utf8')).exercises;
    const nodeExercise = exercises.find(exercise => exercise.lessonId === 'node-esm-packages-and-cli');
    const nodeReference = await readFile(path.join(authorRoot, nodeExercise.referenceFile), 'utf8');
    const note = '데스크톱 복원 검사 — 한글 메모와 레몬 🍋';
    const recoveredNote = '저장 실패 후 재시도한 메모 — 보존 확인';
    if (phase === 'qualify') {
      const preferences = controller.window.webContents.getLastWebPreferences();
      check('Renderer has no Node, preload or privileged bridge', !preferences.nodeIntegration && preferences.sandbox && preferences.contextIsolation && !preferences.preload && !preferences.webviewTag);
      check('DOM execution uses its own loopback origin', controller.origin !== controller.browserOrigin);
      const privateRoutes = await Promise.all(['/_qualification/reference/independent-counter', '/reference/independent-counter.mjs', '/execution/qualification.html', '/desktop/main.mjs'].map(async url => (await fetch(controller.origin + url)).status));
      check('Production does not expose references, qualification or main-process source', privateRoutes.every(status => status === 404), privateRoutes);
      await navigate('bindings-and-closures', 'theory');
      const normal = await capture('desktop-dark-100');
      controller.window.webContents.setZoomFactor(2);
      await frames();
      const zoomed = await capture('desktop-dark-200');
      check('Actual page zoom is 200 percent', controller.window.webContents.getZoomFactor() === 2 && Math.abs(zoomed.dpr / normal.dpr - 2) < 0.02 && Math.abs(zoomed.innerWidth / normal.innerWidth - 0.5) < 0.03, { normal, zoomed });
      await click('#theme-toggle');
      await capture('desktop-light-200');
      await click('#open-glossary');
      await input('#glossary-search', '클로저');
      await frames();
      await capture('desktop-light-200-glossary');
      controller.window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
      controller.window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
      await waitFor('!document.querySelector("#utility-dialog").open');
      check('200 percent glossary Escape restores opener focus', await evaluate('document.activeElement?.id === "open-glossary"'));
      controller.window.webContents.setZoomFactor(1);
      await navigate('bindings-and-closures', 'example');
      check('Packaged offline examples have syntax tokens', await evaluate('Boolean(document.querySelector(".syntax-code .token"))'));
      await capture('desktop-code-example-light');
      await browserQualification(exercises);
      await nodeQualification(exercises);
      await navigate(nodeExercise.lessonId);
      check('Native execution requires fresh explicit consent', await evaluate('!document.querySelector("#node-execution-consent").checked && document.querySelector("[data-execute=run]").disabled'));
      await execute('prepare', 'ready');
      await click('#node-execution-consent');
      const starterStatus = await execute('submit');
      check('UI rejects unfinished Node code', ['checks-failed', 'runtime-error', 'module-load-error', 'compilation-error'].includes(starterStatus), starterStatus);
      await evaluate(`globalThis.__desktopOriginalFetch=globalThis.fetch; globalThis.__desktopCancellation=null;
        globalThis.fetch=async function(url,init){ const response=await globalThis.__desktopOriginalFetch(url,init);
          if(init?.method==='DELETE'&&new URL(url,location.href).pathname.startsWith('/_node/jobs/')) globalThis.__desktopCancellation={status:response.status,body:await response.clone().json()};
          return response; }; void 0;`);
      await input('#code-editor', 'while (true) {}');
      await click('[data-execute=run]');
      await waitFor('!document.querySelector("#cancel-execution").hidden && document.querySelector("#execution-announcement").textContent.includes("현재 코드를 실행")');
      await pause(400);
      await click('#cancel-execution');
      await waitFor('document.querySelector("#cancel-execution").hidden && document.querySelector("#execution-announcement").textContent.includes("작업을 중지했습니다")');
      const cancellation = await waitFor('globalThis.__desktopCancellation');
      check('UI cancellation reaches the real server and confirms cleanup', cancellation.status === 200 && cancellation.body.status === 'cancelled' && !cancellation.body.cleanupWarning && !cancellation.body.cleanupPending, cancellation);
      await evaluate('globalThis.fetch=globalThis.__desktopOriginalFetch; delete globalThis.__desktopOriginalFetch; delete globalThis.__desktopCancellation');
      check('UI cancel restores actions and preserves input without cleanup warnings', await evaluate('document.querySelector("#code-editor").value === "while (true) {}" && !document.querySelector("[data-execute=run]").disabled && !document.querySelector("[data-execute=submit]").disabled && !document.querySelector("#execution-announcement").textContent.includes("확인하지 못했습니다")'));
      await input('#code-editor', nodeReference);
      await frames();
      check('Packaged editor syntax mirror preserves editable source', await evaluate(`(() => { const editor=document.querySelector('#code-editor'); const mirror=document.querySelector('.code-mirror'); return editor.dataset.codeAttached==='true' && Boolean(mirror.querySelector('.token')) && [editor.value, editor.value+'\\n'].includes(mirror.textContent); })()`));
      await execute('run', 'success');
      await execute('submit', 'success');
      check('UI records actual current-code pass', await evaluate('document.querySelector("#learning-achievement").textContent.includes("코딩 통과")'));
      await input('#lesson-note', note);
      await pause(650);
      controller.window.webContents.setZoomFactor(2);
      await capture('desktop-node-200-submission', '.execution-section');
      controller.window.webContents.setZoomFactor(1);
      await capture('desktop-node-100-submission', '.execution-section');
      check('Successful Node result reports the bundled runtime', await evaluate('document.querySelector(".runtime-details").textContent.includes("Node.js 24.22.0")'));
      report.status = 'PASS';
      persist();
      await controller.quit();
    } else if (phase === 'restore') {
      const previous = JSON.parse(await readFile(path.join(output, 'qualify.json'), 'utf8'));
      check('Origin is unchanged after real process restart', controller.origin === previous.origin);
      await navigate(nodeExercise.lessonId);
      check('Code draft and Unicode note restored', await evaluate(`document.querySelector('#code-editor').value===${JSON.stringify(nodeReference)}&&document.querySelector('#lesson-note').value===${JSON.stringify(note)}`));
      check('Theme restored', await evaluate('document.documentElement.dataset.theme === "light"'));
      await waitFor('document.querySelector("#learning-achievement").textContent.includes("코딩 통과")');
      check('Current-code submission achievement restored', true);
      check('Consent is not restored across sessions', await evaluate('!document.querySelector("#node-execution-consent").checked && document.querySelector("[data-execute=run]").disabled'));
      await input('#code-editor', `${nodeReference}\n// changed after restart`);
      check('Editing restored draft invalidates previous pass', await evaluate('!document.querySelector("#learning-achievement").textContent.includes("코딩 통과")'));
      await capture('desktop-restored-session', '#code-workspace');
      const originalDialog = dialog.showMessageBoxSync;
      let dialogCalls = 0, preventedEvents = 0;
      dialog.showMessageBoxSync = () => { dialogCalls++; return 0; };
      controller.window.webContents.on('will-prevent-unload', () => { preventedEvents++; });
      await evaluate("globalThis.__desktopOriginalSetItem=Storage.prototype.setItem; Storage.prototype.setItem=function(){throw new DOMException('Injected QA write failure','QuotaExceededError')}; void 0;");
      await input('#lesson-note', recoveredNote);
      await waitFor('!document.querySelector("#note-save-retry").hidden');
      const cancelledQuit = await controller.quit();
      check('Real beforeunload return choice keeps server, editor and draft alive', cancelledQuit?.cancelled === true && dialogCalls === 1 && preventedEvents === 1 && !controller.window.isDestroyed() && (await fetch(`${controller.origin}/`)).ok && await evaluate(`document.querySelector('#lesson-note').value===${JSON.stringify(recoveredNote)}`));
      dialog.showMessageBoxSync = originalDialog;
      await evaluate('Storage.prototype.setItem=globalThis.__desktopOriginalSetItem; delete globalThis.__desktopOriginalSetItem');
      await click('#note-save-retry');
      await waitFor(`document.querySelector('#note-save-retry').hidden && Object.keys(localStorage).some(key => localStorage.getItem(key).includes(${JSON.stringify(recoveredNote)}))`);
      check('Retry saves preserved draft after storage recovers', true);
      report.beforeUnload = { realStorageWriteFailure: true, realWillPreventUnload: true, nativeDialogReturnStub: 0, dialogCalls, preventedEvents, actualOsDialogInput: false };
      report.status = 'PASS'; persist();
      await controller.quit();
    } else if (phase === 'discard') {
      await navigate(nodeExercise.lessonId);
      check('Previously retried note survived process restart', await evaluate(`document.querySelector('#lesson-note').value===${JSON.stringify(recoveredNote)}`));
      let dialogCalls = 0, preventedEvents = 0;
      dialog.showMessageBoxSync = () => { dialogCalls++; return 1; };
      controller.window.webContents.on('will-prevent-unload', () => { preventedEvents++; });
      await evaluate("Storage.prototype.setItem=function(){throw new DOMException('Injected QA write failure','QuotaExceededError')}; void 0;");
      await input('#lesson-note', 'QA에서 종료 선택한 저장되지 않은 메모');
      await waitFor('!document.querySelector("#note-save-retry").hidden');
      controller.window.once('closed', () => {
        report.beforeUnload = { realStorageWriteFailure: true, realWillPreventUnload: true, nativeDialogReturnStub: 1, dialogCalls, preventedEvents, actualOsDialogInput: false };
        report.status = dialogCalls === 1 && preventedEvents === 1 ? 'PASS' : 'FAIL';
        persist();
      });
      controller.window.close();
    } else if (phase === 'force-parent') {
      await navigate(nodeExercise.lessonId);
      check('Discarding failed save retained the last successfully saved note', await evaluate(`document.querySelector('#lesson-note').value===${JSON.stringify(recoveredNote)}`));
      await click('#node-execution-consent');
      await input('#code-editor', 'while (true) {}');
      await click('[data-execute=run]');
      await waitFor('!document.querySelector("#cancel-execution").hidden && document.querySelector("#execution-announcement").textContent.includes("현재 코드를 실행")');
      await pause(300);
      report.status = 'READY_TO_KILL'; persist();
      // The external controller kills only this Electron main process. The service
      // must observe IPC disconnect and close its own active learner workers.
    }
  }
} catch (error) {
  report.status = 'FAIL'; report.error = error.stack || error.message;
  if (controller?.window && !controller.window.isDestroyed()) {
    report.failureScreen = await evaluate('({url:location.href,boot:document.querySelector("#boot-note")?.textContent,announcement:document.querySelector("#execution-announcement")?.textContent,outcome:document.querySelector(".execution-outcome")?.outerHTML})').catch(() => null);
  }
  persist();
  if (controller && !controller.secondary) await controller.quit().catch(() => {});
  else app.exit(1);
}
})().catch(error => { console.error(error.stack || error); app.exit(1); });
