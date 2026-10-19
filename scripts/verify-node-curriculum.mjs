import { createHash, randomUUID } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createNodeExecution } from '../web/server/node-execution.mjs';
import { createBrowserHostServer } from '../web/server/browser-host.mjs';
import { createNodeRunner, fingerprintSource, serializeNodeSource } from '../web/execution/node-runner.mjs';
import { encodeNodeValue, validateNodeSnapshot } from '../runtime/node-contract.mjs';
import { validateGrader } from '../web/execution/protocol.mjs';

export const nodeLessonIds = Object.freeze([
  'node-esm-packages-and-cli', 'node-files-and-paths', 'node-buffers-and-streams', 'node-http-and-validation',
  'node-outbound-requests-and-cancellation', 'node-events-and-lifecycle', 'node-workers-and-resource-limits', 'node-testing-and-delivery',
]);
export const nodeCapstoneVariantIds = Object.freeze(['capstone-host-product-node', 'capstone-failure-and-scale-node', 'capstone-acceptance-review-node']);
const fixedSelectionIds = [...nodeLessonIds, ...nodeCapstoneVariantIds];
const exampleHelpers = Object.freeze({
  'node-esm-packages-and-cli': [{ path: 'node-esm-packages-and-cli/format.cjs', manifestPath: 'format.cjs' }],
  'node-workers-and-resource-limits': [{ path: 'node-workers-and-resource-limits-worker.mjs', manifestPath: 'node-workers-and-resource-limits-worker.mjs' }],
  'node-testing-and-delivery': [
    { path: 'node-testing-and-delivery-example-app.mjs', manifestPath: 'node-testing-and-delivery-example-app.mjs' },
    { path: 'node-testing-and-delivery-acceptance.test.mjs', manifestPath: 'node-testing-and-delivery-acceptance.test.mjs' },
  ],
  ...Object.fromEntries(nodeCapstoneVariantIds.map(id => [id, [
    { path: `${id}/reader/core.mjs`, manifestPath: 'reader/core.mjs' },
    { path: `${id}/reader/normalize.mjs`, manifestPath: 'reader/normalize.mjs' },
  ]])),
});
const digest = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const errorText = error => String(error?.message ?? error).slice(0, 2000);
const workspaceFiles = exercise => Object.fromEntries(exercise.workspace.files.map(file => [file.path, file.source]));
const snapshot = (exercise, replacement) => serializeNodeSource({ entry: exercise.runner.entry, files: { ...workspaceFiles(exercise), ...(replacement === undefined ? {} : { [exercise.runner.entry]: replacement }) } });
const logsFromOutput = value => {
  if (!value) return [];
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
};
const closeServer = server => !server?.listening ? Promise.resolve() : new Promise((resolve, reject) => {
  server.close(error => error ? reject(error) : resolve());
  server.closeAllConnections();
});
const listen = server => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
});

// This author-only CLI executes fixed repository files through the same local
// HTTP adapter and native Node provider as the product. It is not an OS sandbox.
export async function createNodeQualificationSession({ exercises, loadGrader, executable, expectedVersion = '24.22.0', workspaceParent } = {}) {
  let provider;
  let fixtures;
  let runner;
  let origin;
  let closed = false;
  const server = createServer((request, response) => {
    void (async () => {
      if (provider && await provider.handle(request, response, origin)) return;
      response.writeHead(404); response.end('Not found');
    })().catch(() => { if (!response.headersSent && !response.destroyed) { response.writeHead(500); response.end('Node qualification request failed'); } });
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  const close = async () => {
    if (closed) return;
    closed = true;
    const failures = [];
    for (const operation of [() => runner?.cancel(), () => provider?.close(), () => closeServer(fixtures), () => closeServer(server)]) {
      try { await operation(); } catch (error) { failures.push(errorText(error)); }
    }
    if (failures.length) throw new Error(`Node qualification cleanup failed: ${failures.join('; ')}`);
  };
  try {
    await listen(server);
    origin = `http://127.0.0.1:${server.address().port}`;
    fixtures = createBrowserHostServer({ parentOrigin: origin });
    await listen(fixtures);
    const httpBase = `http://127.0.0.1:${fixtures.address().port}/_fixtures/http/`;
    provider = createNodeExecution({ executable, expectedVersion, exercises, loadGrader, httpBase, workspaceParent });
    const fetcher = (url, init = {}) => fetch(url, { ...init, headers: { ...(init.method && init.method !== 'GET' ? { Origin: origin } : {}), ...init.headers } });
    runner = createNodeRunner({ exercises, fetcher, origin });
    return Object.freeze({ runner, origin, fetcher, close });
  } catch (error) { await close(); throw error; }
}

function makeExampleExercise(exercise, exampleSource, helpers) {
  const examplePath = `example/${path.posix.basename(exercise.exampleFile)}`;
  const entry = 'qualification-entry.mjs';
  const entrySource = `export async function runExample(context) {\n  globalThis.__javascriptEduExampleContext = Object.freeze({workspaceRoot:context.workspaceRoot,runtimeVersion:context.runtimeVersion,httpBase:context.httpBase});\n  await import(${JSON.stringify(`./${examplePath}`)});\n}\n`;
  const files = new Map([[entry, entrySource], [examplePath, exampleSource]]);
  for (const file of exercise.workspace.files) if (!file.editable) files.set(`example/${file.path}`, file.source);
  for (const helper of helpers) files.set(`example/${helper.path}`, helper.source);
  const result = {
    id: `${exercise.id}-example`, lessonId: exercise.lessonId, contentRevision: exercise.contentRevision,
    graderRevision: `${exercise.graderRevision}-example`, profileByVersion: { ES2026: 'node-native' }, hostRequirements: ['node-native'],
    ...(exercise.nodeCapabilities ? { nodeCapabilities: exercise.nodeCapabilities } : {}),
    ...(exercise.requiredFeatures ? { requiredFeatures: exercise.requiredFeatures } : {}),
    runner: { kind: 'module-files', entry, runProbe: 'await submission.runExample(context); observe(true);' },
    workspace: { entry, files: [...files].map(([file, source]) => ({ path: file, source, editable: false })) },
  };
  validateNodeSnapshot(result, snapshot(result));
  return result;
}

export async function loadNodeCurriculum(directory, { lessonIds = nodeLessonIds } = {}) {
  if (!Array.isArray(lessonIds) || !lessonIds.length || new Set(lessonIds).size !== lessonIds.length || lessonIds.some(id => !fixedSelectionIds.includes(id))) throw new TypeError('Select distinct fixed Node lesson or capstone variant IDs.');
  const root = await realpath(directory);
  const inputs = new Map();
  const read = async relative => {
    if (typeof relative !== 'string' || !relative.split('/').every(part => /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(part) && part !== '..')) throw new Error('Invalid fixed curriculum path');
    const filename = await realpath(path.resolve(root, relative));
    const within = path.relative(root, filename);
    if (!within || within.startsWith(`..${path.sep}`) || within === '..' || path.isAbsolute(within)) throw new Error(`Curriculum file escapes project: ${relative}`);
    const source = await readFile(filename, 'utf8');
    const sourceFingerprint = digest(source);
    if (inputs.has(relative) && inputs.get(relative) !== sourceFingerprint) throw new Error(`Authored source changed while loading: ${relative}`);
    inputs.set(relative, sourceFingerprint);
    return source;
  };
  const records = [];
  const failures = [];
  for (const selectionId of lessonIds) {
    const capstoneVariant = nodeCapstoneVariantIds.includes(selectionId);
    const lessonId = capstoneVariant ? selectionId.slice(0, -'-node'.length) : selectionId;
    try {
      const exercise = JSON.parse(await read(`curriculum/exercises/${selectionId}.json`));
      const lesson = JSON.parse(await read(`curriculum/lessons/${lessonId}.json`));
      // A capstone's shared lesson keeps its browser exercise as the default;
      // the fixed -node selector names the separately authored Node variant.
      if (exercise.id !== `${selectionId}-exercise` || exercise.lessonId !== lessonId || lesson.id !== lessonId || (!capstoneVariant && lesson.exerciseId !== exercise.id) || lesson.contentRevision !== exercise.contentRevision || exercise.runner?.kind !== 'module-files' || exercise.profileByVersion?.ES2026 !== 'node-native') throw new Error('Fixed Node lesson/exercise identity mismatch');
      for (const [field, expected] of Object.entries({ referenceFile: `reference/${selectionId}.mjs`, incorrectFile: `reference/incorrect/${selectionId}.mjs`, graderFile: `curriculum/checks/${selectionId}.json`, exampleFile: `curriculum/examples/${selectionId}.mjs` })) if (exercise[field] !== expected) throw new Error(`Unexpected Node ${field}`);
      const entry = exercise.workspace?.files?.find(file => file.path === exercise.runner.entry);
      if (!entry?.editable || exercise.workspace.files.filter(file => file.editable).length !== 1) throw new Error('Node verifier requires exactly one editable entry');
      const starter = await read(`starter/${selectionId}.mjs`);
      if (entry.source !== starter) throw new Error('Starter source and fixed manifest differ');
      const reference = await read(exercise.referenceFile);
      const incorrect = await read(exercise.incorrectFile);
      const grader = JSON.parse(await read(exercise.graderFile));
      validateGrader(grader, exercise);
      const sources = { reference: snapshot(exercise, reference), starter: snapshot(exercise), incorrect: snapshot(exercise, incorrect) };
      for (const source of Object.values(sources)) validateNodeSnapshot(exercise, source);
      if (!Array.isArray(exercise.exampleExpectedLogs) || !exercise.exampleExpectedLogs.length || exercise.exampleExpectedLogs.some(line => typeof line !== 'string')) throw new Error('Fixed example logs are required');
      const exampleSource = await read(exercise.exampleFile);
      const helpers = [];
      for (const helper of exampleHelpers[selectionId] ?? []) {
        const source = await read(`curriculum/examples/${helper.path}`);
        const manifest = exercise.workspace.files.find(file => file.path === helper.manifestPath && !file.editable);
        if (!manifest || manifest.source !== source) throw new Error(`Example helper and readonly manifest differ: ${helper.path}`);
        helpers.push({ path: helper.path, source });
      }
      const example = makeExampleExercise(exercise, exampleSource, helpers);
      records.push({ selectionId, exercise, grader, sources, example, exampleSource: snapshot(example) });
    } catch (error) {
      const message = error?.code === 'ENOENT' ? `Required Node lesson file is missing: ${selectionId}` : errorText(error).replaceAll(root, '<project>');
      failures.push({ selectionId, lessonId, status: 'FAIL', reason: message });
    }
  }
  const assertUnchanged = async () => {
    for (const [relative, fingerprint] of [...inputs]) if (digest(await read(relative)) !== fingerprint) throw new Error(`Authored source changed during execution: ${relative}`);
  };
  return { records, failures, inputs: [...inputs].map(([file, sourceFingerprint]) => ({ file, sourceFingerprint })), assertUnchanged };
}

const resultEvidence = result => ({
  status: result.status, sourceFingerprint: result.sourceFingerprint, actualRuntime: result.actualRuntime,
  environmentFingerprint: result.environmentFingerprint, durationMs: result.durationMs,
  stdout: result.stdout ?? '', stderr: result.stderr ?? '', outputTruncated: result.outputTruncated === true,
  checks: (result.checks ?? []).map(check => ({ id: check.id, passed: check.passed, ...(check.error ? { error: check.error } : {}), ...(check.passed === false && Object.hasOwn(check, 'actual') ? { actualEncoded: encodeNodeValue(check.actual) } : {}), ...(check.passed === false && Object.hasOwn(check, 'expected') ? { expectedEncoded: encodeNodeValue(check.expected) } : {}) })),
  ...(result.timedOutCaseId ? { timedOutCaseId: result.timedOutCaseId } : {}),
  ...(result.cleanupWarning ? { cleanupWarning: result.cleanupWarning } : {}),
});
const cleanResult = result => !result.cleanupWarning && result.outputTruncated !== true;
const rejected = result => cleanResult(result) && ((result.status === 'checks-failed' && result.checks.some(check => check.passed === false)) || ['module-load-error', 'compilation-error', 'runtime-error'].includes(result.status));
function knownTimeoutCandidate(exercise, grader, reference, incorrect, request) {
  return exercise.lessonId === 'node-outbound-requests-and-cancellation'
    && reference.status === 'success' && reference.checks.length === grader.cases.length && grader.cases.length > 0
    && reference.checks.every((check, index) => check.passed === true && check.id === grader.cases[index].id)
    && incorrect.status === 'timeout' && cleanResult(incorrect)
    && incorrect.timedOutCaseId === 'release-unused-body'
    && grader.cases.some(check => check.id === incorrect.timedOutCaseId)
    && ['requestId', 'lessonId', 'exerciseId', 'contentRevision', 'targetVersion', 'sourceFingerprint'].every(field => incorrect[field] === request[field])
    && request.sourceFingerprint === digest(request.source) && request.sourceFingerprint !== reference.sourceFingerprint
    && incorrect.environmentFingerprint === reference.environmentFingerprint && incorrect.actualRuntime === reference.actualRuntime;
}

export async function verifyNodeCurriculum(directory, options = {}) {
  const lessonIds = options.lessonIds ?? nodeLessonIds;
  const expectedVersion = options.expectedVersion ?? '24.22.0';
  const report = {
    status: 'FAIL', scope: 'trusted-authored-node-curriculum-via-local-provider', targetRuntimeVersion: '24.22.0', expectedRuntimeVersion: expectedVersion,
    verifierRuntimeVersion: process.versions.node, lessonIds: [...lessonIds], completeNodeTrackVerified: false, completeNodeCapstonesVerified: false,
    browserUiVerified: false, modifiesExecutionVerified: false, learnerSubmissionsExecuted: false,
    exercises: [], examples: [], inputs: [],
    summary: { exercises: lessonIds.length, passed: 0, failed: 0, skipped: 0, referenceChecks: 0, examplesRun: 0, examplesCompared: 0, exampleFailures: 0 },
  };
  let session;
  const started = Date.now();
  try {
    const authored = await loadNodeCurriculum(directory, { lessonIds });
    report.inputs = authored.inputs;
    report.exercises.push(...authored.failures);
    report.summary.failed += authored.failures.length;
    if (!authored.records.length) return report;
    const executable = path.resolve(options.executable ?? process.env.JS_EDU_NODE_EXECUTABLE ?? process.execPath);
    const graders = new Map(authored.records.map(item => [item.exercise.id, item.grader]));
    for (const item of authored.records) graders.set(item.example.id, { exerciseId: item.example.id, contentRevision: item.example.contentRevision, graderRevision: item.example.graderRevision, cases: [{ id: 'example-completed', label: 'Native example completed', probe: item.example.runner.runProbe, expected: true }] });
    session = await createNodeQualificationSession({ executable, expectedVersion, exercises: authored.records.flatMap(item => [item.exercise, item.example]), loadGrader: async exercise => structuredClone(graders.get(exercise.id)), workspaceParent: options.workspaceParent });
    const environment = await session.runner.getEnvironment();
    report.environment = { available: environment.available, actualRuntime: environment.actualRuntime, runtimeVersion: environment.runtimeVersion, environmentFingerprint: environment.environmentFingerprint, limits: environment.limits, limitations: environment.limitations, ...(environment.reason ? { reason: environment.reason } : {}) };
    if (!environment.available || environment.runtimeVersion !== expectedVersion) throw new Error(environment.reason ?? 'Pinned Node runtime is unavailable');
    const request = async (exercise, source) => ({ requestId: `node-qualification-${randomUUID()}`, lessonId: exercise.lessonId, exerciseId: exercise.id, contentRevision: exercise.contentRevision, targetVersion: 'ES2026', sourceFingerprint: await fingerprintSource(source), source, consent: true });
    for (const item of authored.records) {
      const { exercise, grader, sources, example } = item;
      const identity = { selectionId: item.selectionId, lessonId: exercise.lessonId, exerciseId: exercise.id, contentRevision: exercise.contentRevision, graderRevision: exercise.graderRevision };
      const prepared = await session.runner.prepare(await request(exercise, sources.reference));
      const run = await session.runner.run(await request(exercise, sources.reference));
      const reference = await session.runner.submit(await request(exercise, sources.reference));
      const starter = await session.runner.submit(await request(exercise, sources.starter));
      const incorrectRequest = await request(exercise, sources.incorrect);
      const incorrect = await session.runner.submit(incorrectRequest);
      const referencePasses = reference.status === 'success' && reference.checks.length === grader.cases.length && reference.checks.every((check, index) => check.passed === true && check.id === grader.cases[index].id);
      const starterRejected = rejected(starter);
      let incorrectRejected = rejected(incorrect);
      let incorrectRejectedBy = incorrectRejected ? incorrect.status : null;
      let timeoutRecovery;
      // This authored N05 counterexample deliberately ignores cancellation.
      // A known case timeout is a rejection only after correct code recovers.
      if (!incorrectRejected && knownTimeoutCandidate(exercise, grader, reference, incorrect, incorrectRequest)) {
        timeoutRecovery = await session.runner.run(await request(exercise, sources.reference));
        incorrectRejected = timeoutRecovery.status === 'success' && cleanResult(timeoutRecovery) && timeoutRecovery.sourceFingerprint === reference.sourceFingerprint;
        if (incorrectRejected) incorrectRejectedBy = 'timeout';
      }
      const passed = prepared.status === 'ready' && run.status === 'success' && referencePasses && starterRejected && incorrectRejected && [prepared, run, reference].every(cleanResult);
      report.exercises.push({ ...identity, status: passed ? 'PASS' : 'FAIL', sourceFingerprints: Object.fromEntries(Object.entries(sources).map(([kind, source]) => [kind, digest(source)])), caseIds: grader.cases.map(check => check.id), referencePasses, starterRejected, incorrectRejected, incorrectRejectedBy, ...(incorrectRejectedBy === 'timeout' ? { incorrectTimedOutCaseId: incorrect.timedOutCaseId } : {}), ...(timeoutRecovery ? { timeoutRecovery: resultEvidence(timeoutRecovery) } : {}), prepared: resultEvidence(prepared), run: resultEvidence(run), reference: resultEvidence(reference), starter: resultEvidence(starter), incorrect: resultEvidence(incorrect) });
      report.summary[passed ? 'passed' : 'failed']++;
      report.summary.referenceChecks += reference.checks.filter(check => check.passed === true).length;
      const executed = await session.runner.run(await request(example, item.exampleSource));
      const actualLogs = logsFromOutput(executed.stdout);
      const outputMatches = JSON.stringify(actualLogs) === JSON.stringify(exercise.exampleExpectedLogs);
      const examplePassed = executed.status === 'success' && outputMatches && cleanResult(executed) && executed.stderr === '';
      report.examples.push({ ...identity, file: exercise.exampleFile, status: examplePassed ? 'PASS' : 'FAIL', sourceFingerprint: digest(item.exampleSource), expectedOutputChecked: true, outputMatches, expectedLogs: exercise.exampleExpectedLogs, actualLogs, execution: resultEvidence(executed) });
      if (executed.status === 'success') report.summary.examplesRun++;
      report.summary.examplesCompared++;
      if (!examplePassed) report.summary.exampleFailures++;
      options.onProgress?.({ selectionId: item.selectionId, lessonId: exercise.lessonId, status: passed && examplePassed ? 'PASS' : 'FAIL', referenceChecks: reference.checks.filter(check => check.passed === true).length, caseCount: grader.cases.length });
    }
    await authored.assertUnchanged();
    report.status = report.summary.failed || report.summary.exampleFailures ? 'FAIL' : 'PASS';
    report.completeNodeTrackVerified = report.status === 'PASS' && nodeLessonIds.every(id => lessonIds.includes(id)) && environment.runtimeVersion === '24.22.0';
    report.completeNodeCapstonesVerified = report.status === 'PASS' && nodeCapstoneVariantIds.every(id => lessonIds.includes(id)) && environment.runtimeVersion === '24.22.0';
  } catch (error) { report.error = errorText(error); }
  finally {
    try { await session?.close(); report.cleanupConfirmed = true; } catch (error) { report.cleanupConfirmed = false; report.cleanupError = errorText(error); report.status = 'FAIL'; report.completeNodeTrackVerified = false; report.completeNodeCapstonesVerified = false; }
    report.durationMs = Date.now() - started;
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const arguments_ = process.argv.slice(2);
    const directory = arguments_.shift();
    const options = {};
    while (arguments_.length) {
      const option = arguments_.shift();
      if (option === '--executable' && options.executable === undefined && arguments_.length) options.executable = arguments_.shift();
      else if (option === '--lesson' && arguments_.length) (options.lessonIds ??= []).push(arguments_.shift());
      else throw new Error('Usage: node scripts/verify-node-curriculum.mjs <project-directory> [--executable <node-path>] [--lesson <fixed-id>]');
    }
    if (!directory) throw new Error('A project directory is required');
    const result = await verifyNodeCurriculum(directory, options);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === 'PASS' ? 0 : 1;
  } catch (error) { console.log(JSON.stringify({ status: 'FAIL', scope: 'trusted-authored-node-curriculum-via-local-provider', error: errorText(error) }, null, 2)); process.exitCode = 1; }
}
