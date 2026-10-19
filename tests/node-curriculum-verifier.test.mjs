import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadNodeCurriculum, nodeCapstoneVariantIds, nodeLessonIds, verifyNodeCurriculum } from '../scripts/verify-node-curriculum.mjs';

const executable = process.env.JS_EDU_NODE_EXECUTABLE ? path.resolve(process.env.JS_EDU_NODE_EXECUTABLE) : process.execPath;
const version = execFileSync(executable, ['--version'], { encoding: 'utf8', windowsHide: true }).trim().replace(/^v/, '');
const lessonId = 'node-files-and-paths';
async function fixture(t, id = lessonId) {
  const selectionId = id;
  const variant = nodeCapstoneVariantIds.includes(id);
  const lessonId = variant ? id.slice(0, -'-node'.length) : id;
  const root = await mkdtemp(path.join(tmpdir(), 'javascript-edu-node-curriculum-test-'));
  t.after(async () => {
    const relative = path.relative(tmpdir(), root);
    assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(root).startsWith('javascript-edu-node-curriculum-test-'));
    await rm(root, { recursive: true, force: true });
  });
  const put = async (filename, value) => {
    const target = path.join(root, filename);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const starter = 'export async function read(){throw new Error("TODO");}\n';
  const exercise = {
    id: `${selectionId}-exercise`, lessonId, contentRevision: 'draft-1', graderRevision: 'test-checks-1',
    profileByVersion: { ES2026: 'node-native' }, hostRequirements: ['node-native'],
    runner: { kind: 'module-files', entry: 'main.mjs', runProbe: 'observe(await submission.read());' },
    workspace: { entry: 'main.mjs', files: [{ path: 'main.mjs', source: starter, editable: true }, { path: 'value.mjs', source: 'export const value=42;\n', editable: false }] },
    graderFile: `curriculum/checks/${selectionId}.json`, referenceFile: `reference/${selectionId}.mjs`, incorrectFile: `reference/incorrect/${selectionId}.mjs`, exampleFile: `curriculum/examples/${selectionId}.mjs`,
    exampleExpectedLogs: [JSON.stringify({ value: 42, runtime: version, nativeUrl: true })],
  };
  if (variant) {
    for (const [file, source] of [['reader/core.mjs', "import {normalize} from './normalize.mjs'; export const core=normalize(42);\n"], ['reader/normalize.mjs', 'export const normalize=value=>value;\n']]) {
      exercise.workspace.files.push({ path: file, source, editable: false });
      await put(`curriculum/examples/${selectionId}/${file}`, source);
    }
  }
  await put(`curriculum/exercises/${selectionId}.json`, exercise);
  await put(`curriculum/lessons/${lessonId}.json`, { id: lessonId, exerciseId: variant ? `${lessonId}-exercise` : exercise.id, contentRevision: exercise.contentRevision });
  await put(`starter/${selectionId}.mjs`, starter);
  await put(exercise.referenceFile, "import {value} from './value.mjs'; export async function read(){return value;}\n");
  await put(exercise.incorrectFile, 'export async function read(){return 99;}\n');
  await put(exercise.graderFile, { exerciseId: exercise.id, contentRevision: exercise.contentRevision, graderRevision: exercise.graderRevision, cases: [{ id: 'value', label: 'Native helper value', probe: 'observe(await submission.read());', expected: 42 }] });
  await put(exercise.exampleFile, `${variant ? `import {core as value} from './${selectionId}/reader/core.mjs';` : "import {value} from './value.mjs';"}
import {writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
const context=globalThis.__javascriptEduExampleContext;
const filename=join(context.workspaceRoot,'example.json');
await writeFile(filename,JSON.stringify({value}));
const data=JSON.parse(await readFile(filename,'utf8'));
console.log(JSON.stringify({value:data.value,runtime:context.runtimeVersion,nativeUrl:import.meta.url.startsWith('file:')}));
`);
  const workspaces = path.join(root, 'workspaces');
  await mkdir(workspaces);
  return { root, put, exercise, workspaces };
}

test('Node curriculum loader preserves fixed entry snapshots and native example imports', async t => {
  const f = await fixture(t);
  const authored = await loadNodeCurriculum(f.root, { lessonIds: [lessonId] });
  assert.deepEqual(authored.failures, []);
  assert.equal(authored.records.length, 1);
  const item = authored.records[0];
  const source = JSON.parse(item.sources.reference);
  assert.match(source.files['main.mjs'], /import \{value\}/);
  assert.equal(source.files['value.mjs'], 'export const value=42;\n');
  const example = JSON.parse(item.exampleSource);
  assert.match(example.files['qualification-entry.mjs'], /await import\(/);
  assert.equal(example.files[`example/${lessonId}.mjs`], await readFile(path.join(f.root, f.exercise.exampleFile), 'utf8'));
  assert.equal(example.files['example/value.mjs'], source.files['value.mjs']);
  await authored.assertUnchanged();
  await f.put(f.exercise.referenceFile, 'export async function read(){return 99;}');
  await assert.rejects(authored.assertUnchanged(), /source changed/);
});

test('Node curriculum missing lessons and mismatched starter are failures without skips', async t => {
  const f = await fixture(t);
  const missing = await loadNodeCurriculum(f.root);
  assert.equal(missing.records.length, 1);
  assert.equal(missing.failures.length, nodeLessonIds.length - 1);
  assert.ok(missing.failures.every(item => item.status === 'FAIL'));
  await f.put(`starter/${lessonId}.mjs`, 'export function read(){return 42;}');
  const mismatch = await loadNodeCurriculum(f.root, { lessonIds: [lessonId] });
  assert.match(mismatch.failures[0].reason, /Starter source and fixed manifest differ/);
  assert.equal(mismatch.records.length, 0);
});

test('Node curriculum loader refuses unexpected source paths and grader revisions', async t => {
  const f = await fixture(t);
  await f.put(`curriculum/exercises/${lessonId}.json`, { ...f.exercise, referenceFile: '../private.mjs' });
  assert.match((await loadNodeCurriculum(f.root, { lessonIds: [lessonId] })).failures[0].reason, /Unexpected Node referenceFile/);
  await f.put(`curriculum/exercises/${lessonId}.json`, f.exercise);
  const grader = JSON.parse(await readFile(path.join(f.root, f.exercise.graderFile), 'utf8'));
  await f.put(f.exercise.graderFile, { ...grader, graderRevision: 'stale' });
  assert.match((await loadNodeCurriculum(f.root, { lessonIds: [lessonId] })).failures[0].reason, /고정 검사|개정|grader/i);
});

test('Node curriculum example helpers must match their readonly manifest source', async t => {
  const id = 'node-esm-packages-and-cli';
  const f = await fixture(t, id);
  f.exercise.workspace.files.push({ path: 'format.cjs', source: 'module.exports=42;', editable: false });
  await f.put(`curriculum/exercises/${id}.json`, f.exercise);
  await f.put(`curriculum/examples/${id}/format.cjs`, 'module.exports=99;');
  const authored = await loadNodeCurriculum(f.root, { lessonIds: [id] });
  assert.equal(authored.records.length, 0);
  assert.match(authored.failures[0].reason, /Example helper and readonly manifest differ/);
});

test(`Node curriculum CLI contract uses actual ${version} through HTTP and native examples`, { timeout: 30000 }, async t => {
  const f = await fixture(t);
  const report = await verifyNodeCurriculum(f.root, { executable, expectedVersion: version, lessonIds: [lessonId], workspaceParent: f.workspaces });
  assert.equal(report.status, 'PASS', JSON.stringify(report));
  assert.equal(report.environment.runtimeVersion, version);
  assert.equal(report.summary.referenceChecks, 1);
  assert.equal(report.summary.examplesCompared, 1);
  assert.equal(report.summary.skipped, 0);
  assert.equal(report.completeNodeTrackVerified, false);
  assert.equal(report.browserUiVerified, false);
  assert.equal(report.exercises[0].starterRejected, true);
  assert.equal(report.exercises[0].incorrectRejected, true);
  assert.equal(report.examples[0].outputMatches, true);
  assert.match(report.exercises[0].sourceFingerprints.reference, /^sha256:[a-f0-9]{64}$/);
  assert.equal(report.cleanupConfirmed, true);
  assert.deepEqual(await readdir(f.workspaces), []);
});

test('Node curriculum reports expected-output drift and accidentally correct negative fixtures', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  await f.put(`curriculum/exercises/${lessonId}.json`, { ...f.exercise, exampleExpectedLogs: ['incorrect expected output'] });
  await f.put(f.exercise.incorrectFile, await readFile(path.join(f.root, f.exercise.referenceFile), 'utf8'));
  const report = await verifyNodeCurriculum(f.root, { executable, expectedVersion: version, lessonIds: [lessonId], workspaceParent: f.workspaces });
  assert.equal(report.status, 'FAIL');
  assert.equal(report.exercises[0].referencePasses, true);
  assert.equal(report.exercises[0].incorrectRejected, false);
  assert.equal(report.summary.failed, 1);
  assert.equal(report.summary.exampleFailures, 1);
  assert.equal(report.examples[0].execution.status, 'success');
  assert.equal(report.examples[0].outputMatches, false);
  assert.deepEqual(await readdir(f.workspaces), []);
});

test('Node curriculum refuses an unavailable pinned runtime without marking code as graded', async t => {
  const f = await fixture(t);
  const report = await verifyNodeCurriculum(f.root, { executable, expectedVersion: '99.0.0', lessonIds: [lessonId], workspaceParent: f.workspaces });
  assert.equal(report.status, 'FAIL');
  assert.equal(report.environment.available, false);
  assert.equal(report.summary.referenceChecks, 0);
  assert.equal(report.summary.examplesRun, 0);
  assert.equal(report.summary.skipped, 0);
  assert.match(report.error, /99\.0\.0/);
  assert.deepEqual(await readdir(f.workspaces), []);
});

test('Node N05 unrelated case timeout is not an accepted incorrect fixture', { timeout: 30000 }, async t => {
  const id = 'node-outbound-requests-and-cancellation';
  const f = await fixture(t, id);
  await f.put(f.exercise.incorrectFile, 'export async function read(){await new Promise(resolve=>setTimeout(resolve,10000));return 99;}');
  const report = await verifyNodeCurriculum(f.root, { executable, expectedVersion: version, lessonIds: [id], workspaceParent: f.workspaces });
  assert.equal(report.status, 'FAIL');
  const exercise = report.exercises[0];
  assert.equal(exercise.referencePasses, true);
  assert.equal(exercise.incorrect.status, 'timeout');
  assert.equal(exercise.incorrect.timedOutCaseId, 'value');
  assert.equal(exercise.incorrectRejected, false);
  assert.equal(exercise.incorrectRejectedBy, null);
  assert.equal(exercise.timeoutRecovery, undefined);
  assert.deepEqual(await readdir(f.workspaces), []);
});

test('Node N05 release-unused-body timeout requires fixed identity and successful recovery', { timeout: 30000 }, async t => {
  const id = 'node-outbound-requests-and-cancellation';
  const f = await fixture(t, id);
  const grader = JSON.parse(await readFile(path.join(f.root, f.exercise.graderFile), 'utf8'));
  grader.cases[0].id = 'release-unused-body';
  await f.put(f.exercise.graderFile, grader);
  await f.put(f.exercise.incorrectFile, 'export async function read(){await new Promise(resolve=>setTimeout(resolve,10000));return 99;}');
  const report = await verifyNodeCurriculum(f.root, { executable, expectedVersion: version, lessonIds: [id], workspaceParent: f.workspaces });
  assert.equal(report.status, 'PASS', JSON.stringify(report));
  const exercise = report.exercises[0];
  assert.equal(exercise.referencePasses, true);
  assert.equal(exercise.incorrect.status, 'timeout');
  assert.equal(exercise.incorrectRejected, true);
  assert.equal(exercise.incorrectRejectedBy, 'timeout');
  assert.equal(exercise.incorrectTimedOutCaseId, 'release-unused-body');
  assert.equal(exercise.timeoutRecovery.status, 'success');
  assert.equal(exercise.timeoutRecovery.sourceFingerprint, exercise.sourceFingerprints.reference);
  assert.deepEqual(await readdir(f.workspaces), []);
});

test('Node capstone selectors retain shared lesson IDs and native readonly example helpers', { timeout: 30000 }, async t => {
  const selectionId = 'capstone-host-product-node';
  const f = await fixture(t, selectionId);
  const authored = await loadNodeCurriculum(f.root, { lessonIds: [selectionId] });
  assert.deepEqual(authored.failures, []);
  assert.equal(authored.records[0].exercise.lessonId, 'capstone-host-product');
  assert.equal(authored.records[0].exercise.id, `${selectionId}-exercise`);
  const report = await verifyNodeCurriculum(f.root, { executable, expectedVersion: version, lessonIds: [selectionId], workspaceParent: f.workspaces });
  assert.equal(report.status, 'PASS', JSON.stringify(report));
  assert.equal(report.exercises[0].selectionId, selectionId);
  assert.equal(report.exercises[0].lessonId, 'capstone-host-product');
  assert.equal(report.completeNodeTrackVerified, false);
  assert.equal(report.completeNodeCapstonesVerified, false);
  assert.equal(report.examples[0].outputMatches, true);
  assert.deepEqual(await readdir(f.workspaces), []);
  const defaultScope = await loadNodeCurriculum(f.root);
  assert.equal(defaultScope.records.length, 0);
  assert.equal(defaultScope.failures.length, 8);
  await assert.rejects(loadNodeCurriculum(f.root, { lessonIds: ['capstone-arbitrary-node'] }), /fixed Node/);
});
