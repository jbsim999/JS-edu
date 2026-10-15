import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspect } from 'node:util';
import { pathToFileURL } from 'node:url';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';

export const moduleWorkspaceLimits = Object.freeze({ files: 16, pathLength: 180, fileBytes: 102400, totalBytes: 524288 });
const bridgeFilename = '__edu_bridge__.mjs';
const workerKind = 'javascript-edu-authored-module-case';
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const cloneObservation = globalThis.structuredClone.bind(globalThis);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const shorten = value => String(value).slice(0, 2000);
const errorText = error => shorten(`${error?.name ?? 'Error'}: ${error?.message ?? error}`);
const normalizedLines = value => value.replace(/\r\n/g, '\n');
// URL-backed workers must not inherit a flag that applies only to the parent's stdin/eval source.
// Trusted file-backed creator Workers need no parent process or test-runner flags.
const workerExecArgv = [];

export function validModulePath(value) {
  return typeof value === 'string' && value.length <= moduleWorkspaceLimits.pathLength && value.endsWith('.mjs') &&
    value.split('/').every(segment => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u.test(segment) && !segment.includes('..') &&
      !segment.endsWith('.') && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(segment) &&
      segment.toLowerCase() !== bridgeFilename);
}

// Keep the author manifest within the same source sizes and paths as the browser workspace.
// This validates data; it does not execute a learner submission or grant an import permission.
export function validateModuleExercise(exercise) {
  const errors = [];
  const need = (condition, message) => { if (!condition) errors.push(message); };
  const id = exercise?.id ?? 'module';
  const workspace = exercise?.workspace;
  need(exercise?.mode === 'files', `Module exercise mode must be files: ${id}`);
  need(exercise?.runner?.kind === 'module-files', `Module runner kind is required: ${id}`);
  need(exercise?.editable === undefined, `Module exercise cannot have a function-body editable template: ${id}`);
  need(isRecord(workspace) && Object.keys(workspace).sort().join(',') === 'entry,files', `Invalid module workspace manifest: ${id}`);
  need(validModulePath(workspace?.entry), `Invalid module workspace entry: ${id}`);
  need(exercise?.runner?.entry === workspace?.entry, `Module runner/workspace entry mismatch: ${id}`);
  const files = Array.isArray(workspace?.files) ? workspace.files : [];
  need(files.length > 0 && files.length <= moduleWorkspaceLimits.files, `Module workspace needs 1-${moduleWorkspaceLimits.files} files: ${id}`);
  const names = new Set();
  let totalBytes = 0;
  let editableCount = 0;
  for (const file of files) {
    need(isRecord(file) && Object.keys(file).sort().join(',') === 'editable,path,source', `Invalid module file declaration: ${id}`);
    need(validModulePath(file?.path), `Invalid module file path: ${id}:${file?.path}`);
    const canonical = typeof file?.path === 'string' ? file.path.toLowerCase() : '';
    need(!names.has(canonical), `Duplicate or case-colliding module file path: ${id}:${file?.path}`);
    need(![...names].some(name => canonical.startsWith(`${name}/`) || name.startsWith(`${canonical}/`)),
      `Module file/directory path collision: ${id}:${file?.path}`);
    names.add(canonical);
    need(typeof file?.editable === 'boolean', `Module file editable flag missing: ${id}:${file?.path}`);
    need(typeof file?.source === 'string', `Module file source missing: ${id}:${file?.path}`);
    if (file?.editable === true) editableCount++;
    if (typeof file?.source === 'string') {
      const bytes = Buffer.byteLength(file.source);
      totalBytes += bytes;
      need(bytes <= moduleWorkspaceLimits.fileBytes, `Module file source exceeds size limit: ${id}:${file.path}`);
    }
  }
  need(totalBytes <= moduleWorkspaceLimits.totalBytes, `Module workspace exceeds total size limit: ${id}`);
  need(editableCount > 0, `Module workspace needs an editable file: ${id}`);
  const entry = files.find(file => file?.path === workspace?.entry);
  need(entry?.editable === true, `Module entry must be declared and editable: ${id}`);
  need(typeof exercise?.template === 'string' && typeof entry?.source === 'string' &&
    normalizedLines(exercise.template) === normalizedLines(entry.source), `Module entry source/template mismatch: ${id}`);
  const protectedFiles = [exercise?.graderFile, exercise?.referenceFile, exercise?.incorrectFile].filter(nonempty);
  for (const file of Array.isArray(exercise?.files) ? exercise.files : []) {
    const filename = typeof file === 'string' ? file : file?.path;
    if (typeof file === 'string' || file?.editable === true) need(!protectedFiles.includes(filename), `Trusted module file exposed as editable: ${id}:${filename}`);
  }
  return errors;
}

async function executeModuleCase() {
  // An unresolved top-level await must remain alive until the parent deadline can terminate it.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    const probe = new AsyncFunction('submission', 'observe', `"use strict";\n${workerData.probe}`);
    let submission;
    try {
      // The bridge's export is named submission, never then. Awaiting it cannot assimilate
      // the entry namespace's exported then function, and static imports retain live bindings.
      const bridge = await import(pathToFileURL(workerData.bridgePath).href);
      submission = bridge.submission;
    } catch (error) {
      parentPort.postMessage({ status: 'ERROR', reason: 'module-load-error', error: errorText(error) });
      return;
    }
    let count = 0;
    let actual;
    let captured = false;
    let captureError;
    const observe = value => {
      count++;
      if (count !== 1) throw new Error('observe must be called exactly once');
      try { actual = cloneObservation(value); captured = true; }
      catch (error) { captureError = error; throw error; }
    };
    let result;
    try {
      const completion = await probe(submission, observe);
      result = count !== 1 || !captured || captureError || completion !== undefined
        ? { status: 'completed', check: { id: workerData.caseId, status: 'FAIL', reason: 'invalid-probe', observations: count } }
        : { status: 'completed', check: { id: workerData.caseId, status: 'OBSERVED', actual } };
    } catch (error) {
      result = { status: 'completed', check: { id: workerData.caseId, status: 'FAIL', reason: count > 1 || captureError ? 'invalid-probe' : 'probe-error', error: errorText(error) } };
    }
    await new Promise(resolve => process.stdout.write('', resolve));
    await new Promise(resolve => process.stderr.write('', resolve));
    parentPort.postMessage(result);
  } catch (error) {
    parentPort.postMessage({ status: 'ERROR', reason: 'probe-compile-error', error: errorText(error) });
  } finally { clearInterval(keepAlive); }
}

function runCase(data, { timeoutMs, maxOutputBytes }) {
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
        workerData: { type: workerKind, ...data }, stdout: true, stderr: true,
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

function compareObservation(result, expectedCase) {
  const check = result.check;
  if (result.status !== 'completed') return { id: expectedCase.id, status: 'FAIL', reason: result.reason, error: result.error };
  if (check?.id !== expectedCase.id || !['OBSERVED', 'FAIL'].includes(check.status)) return { id: expectedCase.id, status: 'FAIL', reason: 'invalid-case-response' };
  if (check.status === 'FAIL') return check;
  try { assert.deepStrictEqual(check.actual, expectedCase.expected); return { id: check.id, status: 'PASS' }; }
  catch {
    return { id: check.id, status: 'FAIL', reason: 'value-mismatch',
      actual: shorten(inspect(check.actual, { depth: 4, maxArrayLength: 20, maxStringLength: 500 })),
      expected: shorten(inspect(expectedCase.expected, { depth: 4, maxArrayLength: 20, maxStringLength: 500 })) };
  }
}

// Author-only entry point: sources have already been read from the trusted repository. There is
// no HTTP handler, learner-code endpoint, node:vm evaluator, shell command or browser qualification.
export async function verifyModuleVariant({ exercise, entrySource, cases }, options = {}) {
  const errors = validateModuleExercise(exercise);
  if (errors.length) throw new TypeError(errors.join('\n'));
  if (typeof entrySource !== 'string') throw new TypeError('An authored module entry source is required');
  const sourceBytes = Buffer.byteLength(entrySource);
  const helperBytes = exercise.workspace.files.filter(file => file.path !== exercise.workspace.entry).reduce((sum, file) => sum + Buffer.byteLength(file.source), 0);
  if (sourceBytes > moduleWorkspaceLimits.fileBytes || sourceBytes + helperBytes > moduleWorkspaceLimits.totalBytes) throw new RangeError('Authored module source exceeds workspace limits');
  if (!Array.isArray(cases) || cases.length === 0 || new Set(cases.map(check => check?.id)).size !== cases.length ||
    cases.some(check => !nonempty(check?.id) || !nonempty(check?.probe) || !Object.hasOwn(check, 'expected'))) throw new TypeError('Nonzero distinct authored cases with expected values are required');
  const limits = { timeoutMs: options.timeoutMs ?? 5000, maxOutputBytes: options.maxOutputBytes ?? 32768 };
  if (!Number.isInteger(limits.timeoutMs) || limits.timeoutMs < 50 || limits.timeoutMs > 60000) throw new RangeError('timeoutMs must be an integer from 50 to 60000');
  if (!Number.isInteger(limits.maxOutputBytes) || limits.maxOutputBytes < 256 || limits.maxOutputBytes > 1048576) throw new RangeError('maxOutputBytes must be an integer from 256 to 1048576');
  const started = performance.now();
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'js-edu-authored-module-'));
  const temporaryRoot = await realpath(temporary);
  let stdout = '';
  let stderr = '';
  let firstError;
  const checks = [];
  const caseExecutions = [];
  try {
    for (const file of exercise.workspace.files) {
      const destination = path.resolve(temporaryRoot, file.path);
      if (!destination.startsWith(temporaryRoot + path.sep)) throw new Error('Module destination escapes its temporary workspace');
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, file.path === exercise.workspace.entry ? entrySource : file.source, { flag: 'wx' });
    }
    const bridgePath = path.join(temporaryRoot, bridgeFilename);
    await writeFile(bridgePath, `import * as submission from ${JSON.stringify(`./${exercise.workspace.entry}`)};\nexport { submission };\n`, { flag: 'wx' });
    for (const check of cases) {
      const remaining = Math.max(0, limits.maxOutputBytes - Buffer.byteLength(stdout) - Buffer.byteLength(stderr));
      // A new Worker creates a new native module cache for every fixed case, including failed imports.
      // Neither expected values nor other cases enter the module's execution environment.
      const result = await runCase({ bridgePath, caseId: check.id, probe: check.probe }, { ...limits, maxOutputBytes: remaining });
      stdout += result.stdout;
      stderr += result.stderr;
      if (result.status !== 'completed') firstError ??= result.reason;
      checks.push(compareObservation(result, check));
      caseExecutions.push({ id: check.id, status: result.status, reason: result.reason, durationMs: result.durationMs });
    }
  } finally {
    // Remove only this freshly created directory, after rechecking its resolved identity.
    if (await realpath(temporary) !== temporaryRoot) throw new Error('Temporary module workspace identity changed; cleanup refused');
    await rm(temporaryRoot, { recursive: true, force: true });
  }
  return { status: firstError ? 'ERROR' : 'completed', ...(firstError ? { reason: firstError } : {}),
    checks, caseExecutions, stdout, stderr, durationMs: Math.round(performance.now() - started), freshModuleGraphPerCase: true };
}

if (!isMainThread && workerData?.type === workerKind) await executeModuleCase();
