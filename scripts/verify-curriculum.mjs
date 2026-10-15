import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { inspect } from 'node:util';
import { pathToFileURL } from 'node:url';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { validateProject } from './validate-project.mjs';
import { verifyModuleVariant } from './verify-module-curriculum.mjs';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const cloneObservation = globalThis.structuredClone.bind(globalThis);
const shorten = value => String(value).slice(0, 2000);
const errorText = error => shorten(`${error?.name ?? 'Error'}: ${error?.message ?? error}`);
const workerExecArgv = process.execArgv.filter((argument, index, all) => argument !== '--input-type' &&
  !argument.startsWith('--input-type=') && all[index - 1] !== '--input-type');

// This command is a repository-author check, not a learner-code execution endpoint or an OS sandbox.
// Its inputs are the checked-in reference, known-incorrect solution, starter and fixed grader only.
async function runTrustedWorker() {
  try {
    if (workerData.kind === 'example') {
      await import(pathToFileURL(workerData.modulePath).href);
      await new Promise(resolve => process.stdout.write('', resolve));
      await new Promise(resolve => process.stderr.write('', resolve));
      parentPort.postMessage({ status: 'completed' });
      return;
    }
    const { runner, cases } = workerData;
    let submission;
    if (workerData.kind === 'starter') {
      const prefix = `"use strict"; return ${runner.async ? 'async ' : ''}function${runner.generator ? '*' : ''} ${runner.exportName}(${runner.parameters.join(',')}) {\n`;
      submission = { [runner.exportName]: new Function(`${prefix}${workerData.body}\n};`)() };
    } else {
      submission = await import(pathToFileURL(workerData.modulePath).href);
    }
    if (typeof submission[runner.exportName] !== 'function') throw new TypeError(`Missing exported function: ${runner.exportName}`);
    const checks = [];
    for (const check of cases) {
      let actual;
      let observations = 0;
      let captured = false;
      const observe = value => {
        observations++;
        if (observations !== 1) throw new Error('observe must be called exactly once');
        actual = cloneObservation(value);
        captured = true;
      };
      try {
        const returned = await new AsyncFunction('submission', 'observe', `"use strict";\n${check.probe}`)(submission, observe);
        if (observations !== 1 || !captured || returned !== undefined) {
          checks.push({ id: check.id, status: 'FAIL', reason: 'invalid-probe', observations, returnedValue: returned !== undefined });
          continue;
        }
      } catch (error) {
        checks.push({ id: check.id, status: 'FAIL', reason: observations > 1 ? 'invalid-probe' : 'probe-error', error: errorText(error) });
        continue;
      }
      // Snapshot synchronously inside observe; do not return an observed array from AsyncFunction.
      // Expected values and comparisons stay outside this worker and its mutable globals.
      checks.push({ id: check.id, status: 'OBSERVED', actual });
    }
    await new Promise(resolve => process.stdout.write('', resolve));
    await new Promise(resolve => process.stderr.write('', resolve));
    parentPort.postMessage({ status: 'completed', checks });
  } catch (error) {
    parentPort.postMessage({ status: 'ERROR', reason: 'load-or-compile-error', error: errorText(error) });
  }
}

function isolatedRun(data, { timeoutMs, maxOutputBytes }) {
  return new Promise(resolve => {
    const started = performance.now();
    let worker;
    let settled = false;
    let timer;
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    const finish = async result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (worker) await worker.terminate().catch(() => {});
      resolve({ ...result, stdout, stderr, durationMs: Math.round(performance.now() - started) });
    };
    try {
      worker = new Worker(new URL(import.meta.url), {
        workerData: data, stdout: true, stderr: true,
        execArgv: workerExecArgv,
        resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
      });
    } catch (error) { void finish({ status: 'ERROR', reason: 'worker-start-error', error: errorText(error) }); return; }
    const capture = channel => chunk => {
      if (settled) return;
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > maxOutputBytes) { void finish({ status: 'ERROR', reason: 'output-limit' }); return; }
      if (channel === 'stdout') stdout += chunk;
      else stderr += chunk;
    };
    worker.stdout.setEncoding('utf8').on('data', capture('stdout'));
    worker.stderr.setEncoding('utf8').on('data', capture('stderr'));
    timer = setTimeout(() => { void finish({ status: 'ERROR', reason: 'timeout' }); }, timeoutMs);
    worker.once('message', result => { void finish(result); });
    worker.once('error', error => { void finish({ status: 'ERROR', reason: 'worker-error', error: errorText(error) }); });
    worker.once('exit', code => { if (!settled) void finish({ status: 'ERROR', reason: 'worker-exit', exitCode: code }); });
  });
}

function logsFromOutput(output) {
  if (!output) return [];
  const lines = output.replace(/\r\n/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function compareObservations(result, cases) {
  if (result.status !== 'completed' || !Array.isArray(result.checks)) return result;
  return { ...result, checks: result.checks.map((check, index) => {
    if (check.id !== cases[index]?.id) return { id: check.id, status: 'FAIL', reason: 'invalid-case-response' };
    if (check.status !== 'OBSERVED') return check;
    try {
      assert.deepStrictEqual(check.actual, cases[index].expected);
      return { id: check.id, status: 'PASS' };
    } catch {
      return { id: check.id, status: 'FAIL', reason: 'value-mismatch',
        actual: shorten(inspect(check.actual, { depth: 4, maxArrayLength: 20, maxStringLength: 500 })),
        expected: shorten(inspect(cases[index].expected, { depth: 4, maxArrayLength: 20, maxStringLength: 500 })) };
    }
  }) };
}

export async function verifyCurriculum(directory, options = {}) {
  const limits = { timeoutMs: options.timeoutMs ?? 5000, maxOutputBytes: options.maxOutputBytes ?? 32768 };
  if (!Number.isInteger(limits.timeoutMs) || limits.timeoutMs < 50 || limits.timeoutMs > 60000) throw new RangeError('timeoutMs must be an integer from 50 to 60000');
  if (!Number.isInteger(limits.maxOutputBytes) || limits.maxOutputBytes < 256 || limits.maxOutputBytes > 1048576) throw new RangeError('maxOutputBytes must be an integer from 256 to 1048576');
  const root = await realpath(directory);
  const structure = await validateProject(root);
  const report = {
    status: 'FAIL', scope: 'trusted-authored-curriculum-only',
    actualRuntime: { name: 'Node.js', version: process.versions.node, engine: `V8 ${process.versions.v8}`, platform: process.platform, architecture: process.arch },
    limits: { ...limits, concurrentWorkers: 1, oldGenerationMbPerWorker: 64 },
    browserExecutionVerified: false, learnerSubmissionsExecuted: false, modifiesExecutionVerified: false,
    structure, exercises: [], examples: [],
    summary: { exercises: 0, passed: 0, failed: 0, skipped: 0, referenceChecks: 0, examplesRun: 0, examplesCompared: 0, exampleFailures: 0 },
  };
  if (structure.status !== 'PASS') return report;
  // Validation has already rejected absolute, traversing and linked paths. Resolve again immediately
  // before loading source so a changed link is never accepted merely because a previous check passed.
  const sourcePath = async relative => {
    const actual = await realpath(path.resolve(root, relative));
    if (!actual.startsWith(root + path.sep)) throw new Error(`Source escapes project: ${relative}`);
    return actual;
  };
  const json = async relative => JSON.parse(await readFile(await sourcePath(relative), 'utf8'));
  const { exercises } = await json('curriculum/exercises.json');
  const catalog = await json('curriculum/catalog.json');
  const lessons = new Map();
  for (const entry of catalog.lessons) lessons.set(entry.id, await json(entry.file));
  for (const exercise of exercises) {
    report.summary.exercises++;
    const identity = { exerciseId: exercise.id, contentRevision: exercise.contentRevision ?? lessons.get(exercise.lessonId)?.contentRevision, graderRevision: exercise.graderRevision ?? null };
    const requirements = [...new Set([...(exercise.hostRequirements ?? []), ...(exercise.runner?.hostRequirements ?? [])])];
    if (!exercise.runner || requirements.length) {
      report.exercises.push({ ...identity, status: 'SKIP', reason: !exercise.runner ? 'No authored execution runner' : `Host-specific verification required: ${requirements.join(', ')}` });
      report.summary.skipped++;
      continue;
    }
    const grader = await json(exercise.graderFile);
    let reference;
    let incorrect;
    let starter;
    if (exercise.runner.kind === 'module-files') {
      // Read only the authored repository entries after rechecking their real paths. Fixed helper
      // sources come from the validated manifest, never a learner request or an HTTP workspace.
      const authoredVariant = async filename => verifyModuleVariant({ exercise, cases: grader.cases,
        entrySource: await readFile(await sourcePath(filename), 'utf8') }, limits);
      reference = await authoredVariant(exercise.referenceFile);
      incorrect = await authoredVariant(exercise.incorrectFile);
      starter = await verifyModuleVariant({ exercise, cases: grader.cases,
        entrySource: exercise.workspace.files.find(file => file.path === exercise.workspace.entry).source }, limits);
    } else {
      const shared = { runner: exercise.runner, cases: grader.cases.map(({ id, probe }) => ({ id, probe })) };
      reference = compareObservations(await isolatedRun({ ...shared, kind: 'reference', modulePath: await sourcePath(exercise.referenceFile) }, limits), grader.cases);
      incorrect = compareObservations(await isolatedRun({ ...shared, kind: 'incorrect', modulePath: await sourcePath(exercise.incorrectFile) }, limits), grader.cases);
      starter = compareObservations(await isolatedRun({ ...shared, kind: 'starter', body: exercise.editable.initialBody }, limits), grader.cases);
    }
    const completeChecks = result => result.status === 'completed' && result.checks?.length === grader.cases.length && result.checks.length > 0 &&
      result.checks.every(check => !['invalid-probe', 'invalid-case-response'].includes(check.reason));
    const referencePasses = completeChecks(reference) && reference.checks.every(check => check.status === 'PASS');
    const incorrectRejected = completeChecks(incorrect) && incorrect.checks.some(check => check.status === 'FAIL');
    const starterRejected = completeChecks(starter) && starter.checks.some(check => check.status === 'FAIL');
    const passed = referencePasses && incorrectRejected && starterRejected;
    report.exercises.push({ ...identity, status: passed ? 'PASS' : 'FAIL', referencePasses, incorrectRejected, starterRejected, reference, incorrect, starter });
    report.summary[passed ? 'passed' : 'failed']++;
    report.summary.referenceChecks += reference.checks?.length ?? 0;

    const expectedLogs = exercise.exampleExpectedLogs ?? lessons.get(exercise.lessonId)?.example?.expectedLogs;
    const example = await isolatedRun({ kind: 'example', modulePath: await sourcePath(exercise.exampleFile) }, limits);
    const actualLogs = logsFromOutput(example.stdout);
    let outputMatches = null;
    if (example.status === 'completed' && expectedLogs !== undefined) {
      try { assert.deepStrictEqual(actualLogs, expectedLogs); outputMatches = true; } catch { outputMatches = false; }
      report.summary.examplesCompared++;
    }
    const examplePassed = example.status === 'completed' && outputMatches !== false;
    report.examples.push({ ...identity, file: exercise.exampleFile,
      expectedOutputChecked: outputMatches !== null, outputMatches, actualLogs, ...example, executionStatus: example.status,
      // Keep execution and assertion outcomes distinct; completed is not an expected-output assertion.
      status: examplePassed ? (outputMatches === null ? 'EXECUTED_NOT_COMPARED' : 'PASS') : 'FAIL' });
    if (example.status === 'completed') report.summary.examplesRun++;
    if (!examplePassed) report.summary.exampleFailures++;
  }
  report.status = report.summary.exercises === 0 || report.summary.failed || report.summary.exampleFailures ? 'FAIL' : report.summary.skipped ? 'PARTIAL' : 'PASS';
  return report;
}

if (!isMainThread && workerData?.kind) {
  await runTrustedWorker();
} else if (isMainThread && process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [directory, option, timeout] = process.argv.slice(2);
    if (!directory || (option && option !== '--timeout-ms') || (option && timeout === undefined) || process.argv.length > 5) {
      throw new Error('Usage: node scripts/verify-curriculum.mjs <project-directory> [--timeout-ms 5000]');
    }
    const result = await verifyCurriculum(directory, option ? { timeoutMs: Number(timeout) } : {});
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === 'PASS' ? 0 : 1;
  } catch (error) {
    console.log(JSON.stringify({ status: 'FAIL', scope: 'trusted-authored-curriculum-only', error: errorText(error) }, null, 2));
    process.exitCode = 1;
  }
}
