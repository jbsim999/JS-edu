import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { moduleWorkspaceLimits, validateModuleExercise, verifyModuleVariant } from '../scripts/verify-module-curriculum.mjs';
import { validateProject } from '../scripts/validate-project.mjs';
import { verifyCurriculum } from '../scripts/verify-curriculum.mjs';

function fixture() {
  const starter = "import { readCount, evaluations } from './lib/reader.mjs';\nexport let count = 2;\nexport function bump() { /* TODO */ }\nexport function snapshot() { /* TODO */ }\nexport async function helperAgain() { /* TODO */ }\n";
  const helper = "import { count } from '../main.mjs';\nglobalThis.helperEvaluations = (globalThis.helperEvaluations || 0) + 1;\nexport const evaluations = globalThis.helperEvaluations;\nexport function readCount() { return count; }\n";
  const reference = "import { readCount, evaluations } from './lib/reader.mjs';\nexport let count = 2;\nawait Promise.resolve();\nexport function bump() { return ++count; }\nexport function snapshot() { return { count, imported: readCount(), evaluations }; }\nexport async function helperAgain() { const reader = await import('./lib/reader.mjs'); return { count: reader.readCount(), evaluations: reader.evaluations }; }\n";
  const incorrect = "import { readCount, evaluations } from './lib/reader.mjs';\nexport let count = 2;\nexport function bump() { return count + 1; }\nexport function snapshot() { return { count, imported: readCount(), evaluations }; }\nexport async function helperAgain() { return { count, evaluations }; }\n";
  return {
    exercise: { id: 'modules', mode: 'files', runner: { kind: 'module-files', entry: 'main.mjs' }, template: starter,
      files: [{ id: 'main', path: 'starter/main.mjs', editable: true }],
      workspace: { entry: 'main.mjs', files: [
        { path: 'main.mjs', source: starter, editable: true }, { path: 'lib/reader.mjs', source: helper, editable: false },
      ] },
      graderFile: 'curriculum/checks/main.json', referenceFile: 'reference/main.mjs', incorrectFile: 'reference/incorrect/main.mjs',
    },
    reference, incorrect, starter,
    cases: [
      { id: 'live-binding', probe: 'submission.bump(); observe(submission.snapshot());', expected: { count: 3, imported: 3, evaluations: 1 } },
      { id: 'fresh-case', probe: 'observe(submission.snapshot());', expected: { count: 2, imported: 2, evaluations: 1 } },
      { id: 'one-evaluation-per-graph', probe: 'submission.bump(); observe(await submission.helperAgain());', expected: { count: 3, evaluations: 1 } },
    ],
  };
}

test('module manifests retain fixed helpers, one editable entry and matching visible template', () => {
  assert.deepEqual(validateModuleExercise(fixture().exercise), []);
});

test('module manifest traversal, reserved paths, aliases and unknown fields are rejected', async context => {
  const paths = ['../main.mjs', '/main.mjs', 'C:/main.mjs', 'lib\\main.mjs', 'lib//main.mjs', 'lib/./main.mjs',
    'main.mjs?query', 'main%2emjs', '__edu_bridge__.mjs', 'lib/__edu_bridge__.mjs', 'CON.mjs', 'aux/main.mjs', 'lib./main.mjs'];
  for (const invalid of paths) {
    await context.test(invalid, () => {
      const { exercise } = fixture();
      exercise.workspace.files[1].path = invalid;
      assert.ok(validateModuleExercise(exercise).some(message => message.includes('Invalid module file path')));
    });
  }
  const scenarios = [
    [value => { value.workspace.files.push({ ...value.workspace.files[0], path: 'MAIN.mjs' }); }, 'case-colliding'],
    [value => { value.workspace.files.push({ path: 'main.mjs/inside.mjs', source: '', editable: false }); }, 'file/directory path collision'],
    [value => { value.workspace.entry = 'missing.mjs'; }, 'entry mismatch'],
    [value => { value.workspace.files[0].editable = false; }, 'needs an editable file'],
    [value => { delete value.workspace.files[1].editable; }, 'editable flag missing'],
    [value => { value.workspace.files[1].source = null; }, 'source missing'],
    [value => { value.template += 'changed'; }, 'source/template mismatch'],
    [value => { value.editable = { initialBody: '' }; }, 'function-body editable template'],
    [value => { value.workspace.unlisted = true; }, 'Invalid module workspace manifest'],
    [value => { value.workspace.files[1].trustedPath = 'reference/main.mjs'; }, 'Invalid module file declaration'],
    [value => { value.files[0].path = value.referenceFile; }, 'Trusted module file exposed as editable'],
  ];
  for (const [mutate, expected] of scenarios) {
    await context.test(expected, () => {
      const { exercise } = fixture(); mutate(exercise);
      assert.ok(validateModuleExercise(exercise).some(message => message.includes(expected)), JSON.stringify(validateModuleExercise(exercise)));
    });
  }
});

test('workspace counts and UTF-8 source limits match the supported module envelope', () => {
  const tooMany = fixture().exercise;
  tooMany.workspace.files = Array.from({ length: moduleWorkspaceLimits.files + 1 }, (_, index) => ({ path: `item${index}.mjs`, source: '', editable: index === 0 }));
  assert.ok(validateModuleExercise(tooMany).some(message => message.includes('needs 1-16 files')));
  const tooLarge = fixture().exercise;
  tooLarge.workspace.files[1].source = '가'.repeat(40000);
  assert.ok(validateModuleExercise(tooLarge).some(message => message.includes('source exceeds size limit')));
  const tooMuch = fixture().exercise;
  for (let index = 0; index < 6; index++) tooMuch.workspace.files.push({ path: `large${index}.mjs`, source: ' '.repeat(moduleWorkspaceLimits.fileBytes), editable: false });
  assert.ok(validateModuleExercise(tooMuch).some(message => message.includes('exceeds total size limit')));
});

test('native module cases preserve live bindings and cycle evaluation, and reset their cache between cases', async () => {
  const f = fixture();
  const result = await verifyModuleVariant({ exercise: f.exercise, entrySource: f.reference, cases: f.cases });
  assert.equal(result.status, 'completed', JSON.stringify(result));
  assert.ok(result.checks.every(check => check.status === 'PASS'), JSON.stringify(result));
  assert.equal(result.checks.length, f.cases.length);
  assert.equal(result.caseExecutions.length, f.cases.length);
  assert.equal(result.freshModuleGraphPerCase, true);
});

test('the same fixed helpers expose the representative incorrect and TODO modules', async () => {
  const f = fixture();
  for (const entrySource of [f.incorrect, f.starter]) {
    const result = await verifyModuleVariant({ exercise: f.exercise, entrySource, cases: f.cases });
    assert.equal(result.status, 'completed', JSON.stringify(result));
    assert.ok(result.checks.some(check => check.status === 'FAIL'));
    assert.equal(result.checks.length, f.cases.length);
  }
});

test('a module export named then is exposed as a native namespace member without invocation', async () => {
  const f = fixture();
  const entrySource = 'export const value = 7; export function then(resolve) { globalThis.thenCalled = true; resolve({ value: 999 }); }';
  const result = await verifyModuleVariant({ exercise: f.exercise, entrySource, cases: [
    { id: 'namespace-then', probe: 'observe({ value: submission.value, called: globalThis.thenCalled === true, type: typeof submission.then });', expected: { value: 7, called: false, type: 'function' } },
  ] });
  assert.equal(result.status, 'completed', JSON.stringify(result));
  assert.equal(result.checks[0].status, 'PASS');
});

test('native top-level await hangs reach the deadline and a later fresh workspace still runs', async () => {
  const f = fixture();
  const hung = await verifyModuleVariant({ exercise: f.exercise, entrySource: 'await new Promise(() => {}); export const count = 2;', cases: f.cases.slice(0, 2) }, { timeoutMs: 300 });
  assert.equal(hung.status, 'ERROR');
  assert.equal(hung.reason, 'timeout');
  assert.equal(hung.checks.length, 2);
  assert.ok(hung.caseExecutions.every(item => item.reason === 'timeout'));
  const recovered = await verifyModuleVariant({ exercise: f.exercise, entrySource: f.reference, cases: f.cases.slice(0, 1) });
  assert.equal(recovered.status, 'completed');
  assert.equal(recovered.checks[0].status, 'PASS');
});

test('an early cyclic read is a native module-load error rather than a fabricated observation', async () => {
  const f = fixture();
  f.exercise.workspace.files[1].source = "import { count } from '../main.mjs'; export const early = count;";
  const result = await verifyModuleVariant({ exercise: f.exercise, entrySource: "import { early } from './lib/reader.mjs'; export const count = early;", cases: f.cases.slice(0, 1) });
  assert.equal(result.status, 'ERROR');
  assert.equal(result.reason, 'module-load-error');
  assert.match(result.checks[0].error, /ReferenceError/);
});

test('module observation snapshots remain independent of mutation and then assimilation', async () => {
  const f = fixture();
  const result = await verifyModuleVariant({ exercise: f.exercise,
    entrySource: 'Array.prototype.then = function (resolve) { resolve([999]); }; export const value = 7;',
    cases: [{ id: 'captured', probe: 'const values = [submission.value]; observe(values); values[0] = 999;', expected: [7] }],
  });
  assert.equal(result.status, 'completed', JSON.stringify(result));
  assert.equal(result.checks[0].status, 'PASS');
});

test('module graders reject missing, duplicate and value-returning observations', async () => {
  const f = fixture();
  const cases = ['submission.count;', 'observe(2); observe(2);', 'observe(2); return 2;'].map((probe, index) => ({ id: `invalid-${index}`, probe, expected: 2 }));
  const result = await verifyModuleVariant({ exercise: f.exercise, entrySource: f.reference, cases });
  assert.equal(result.checks.length, 3);
  assert.ok(result.checks.every(check => check.status === 'FAIL' && check.reason === 'invalid-probe'));
});

test('uncloneable module observations invalidate a probe even when its author catches the error', async () => {
  const f = fixture();
  const cases = ['observe(() => {});', 'try { observe(() => {}); } catch {}'].map((probe, index) => ({ id: `invalid-clone-${index}`, probe, expected: 2 }));
  const result = await verifyModuleVariant({ exercise: f.exercise, entrySource: f.reference, cases });
  assert.ok(result.checks.every(check => check.status === 'FAIL' && check.reason === 'invalid-probe'));
});

test('output budget is shared across all fresh module cases', async () => {
  const f = fixture();
  const result = await verifyModuleVariant({ exercise: f.exercise, entrySource: `console.log('x'.repeat(160));\n${f.reference}`, cases: f.cases.slice(0, 2) }, { maxOutputBytes: 256 });
  assert.equal(result.status, 'ERROR');
  assert.equal(result.reason, 'output-limit');
  assert.ok(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) <= 256);
  assert.equal(result.checks.length, 2);
});

test('author module execution rejects empty graders before creating an execution', async () => {
  const f = fixture();
  await assert.rejects(verifyModuleVariant({ exercise: f.exercise, entrySource: f.reference, cases: [] }), /Nonzero distinct authored cases/);
});

async function projectFixture(context) {
  const f = fixture();
  const directory = await mkdtemp(path.join(os.tmpdir(), 'js-edu-module-contract-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const exercise = { ...f.exercise, lessonId: 'module-lesson', contentRevision: 'draft-1', graderRevision: 'modules-v1',
    profileId: 'standard', testFiles: [], behaviorCriteria: ['Expose live updates through a cyclic helper.'], executionVerified: false,
    exampleFile: 'curriculum/examples/demo.mjs', exampleExpectedLogs: ['{"count":3,"imported":3,"evaluations":1}'],
  };
  const files = {
    'education.config.json': { languageVersions: ['ES2026'] },
    'curriculum/catalog.json': { lessons: [{ id: 'module-lesson', file: 'curriculum/lessons/modules.json', prerequisites: [], exerciseId: exercise.id }] },
    'curriculum/lessons/modules.json': { id: 'module-lesson', contentRevision: 'draft-1', status: 'draft', prerequisites: [], supportedVersions: ['ES2026'], exerciseId: exercise.id,
      steps: { theory: 'Live binding and native module graphs.', example: 'Read the same binding from a helper.', quiz: 'Predict module evaluation.', practice: 'Preserve one evaluation.', lab: 'Implement the main module.' } },
    'curriculum/exercises.json': { exercises: [exercise] },
    'runtime/profiles.json': { profiles: [{ id: 'standard', languageVersion: 'ES2026', execution: { available: false, reason: 'Author checks are not browser qualification.' } }] },
    [exercise.graderFile]: { exerciseId: exercise.id, contentRevision: exercise.contentRevision, graderRevision: exercise.graderRevision,
      observationMode: 'callback', cases: f.cases.map(check => ({ ...check, label: check.id })) },
    [exercise.files[0].path]: f.starter,
    [exercise.referenceFile]: f.reference,
    [exercise.incorrectFile]: f.incorrect,
    [exercise.exampleFile]: "import { bump, snapshot } from './main.mjs'; bump(); console.log(JSON.stringify(snapshot()));\n",
    'curriculum/examples/main.mjs': f.reference,
    'curriculum/examples/lib/reader.mjs': exercise.workspace.files[1].source,
  };
  for (const [filename, value] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(directory, filename)), { recursive: true });
    await writeFile(path.join(directory, filename), typeof value === 'string' ? value : JSON.stringify(value));
  }
  return { directory, exercise };
}

test('project validation and creator verification accept native file modules with matching author artifacts', async context => {
  const { directory } = await projectFixture(context);
  const structure = await validateProject(directory);
  assert.equal(structure.status, 'PASS', structure.errors.join('\n'));
  const result = await verifyCurriculum(directory);
  assert.equal(result.status, 'PASS', JSON.stringify(result));
  assert.equal(result.summary.referenceChecks, 3);
  assert.equal(result.exercises[0].reference.freshModuleGraphPerCase, true);
  assert.equal(result.exercises[0].incorrectRejected, true);
  assert.equal(result.exercises[0].starterRejected, true);
  assert.equal(result.examples[0].outputMatches, true);
  assert.equal(result.browserExecutionVerified, false);
  assert.equal(result.learnerSubmissionsExecuted, false);
  assert.equal(result.modifiesExecutionVerified, false);
  const after = JSON.parse(await readFile(path.join(directory, 'curriculum/exercises.json'), 'utf8'));
  assert.equal(after.exercises[0].executionVerified, false);
});

test('module validation retains revision, callback, template, evidence and source boundary checks', async context => {
  const scenarios = [
    ['exercise', value => { value.runner.kind = 'function-body'; }, 'Files mode requires a module-files runner'],
    ['exercise', value => { value.workspace.files[0].source += '// drift'; }, 'source/template mismatch'],
    ['exercise', value => { value.referenceFile = '../outside.mjs'; }, 'escapes project'],
    ['exercise', value => { value.graderRevision = 'stale'; }, 'Stale or mismatched grader'],
    ['exercise', value => { value.executionVerified = true; }, 'Missing passing nonzero-test evidence'],
    ['grader', value => { delete value.observationMode; }, 'callback observationMode'],
    ['grader', value => { value.cases = []; }, 'nonzero cases'],
    ['grader', value => { delete value.cases[0].expected; }, 'Missing or invalid grader expected'],
    ['grader', value => { value.cases[1].id = value.cases[0].id; }, 'duplicate ID'],
  ];
  for (const [kind, mutate, expected] of scenarios) {
    await context.test(expected, async inner => {
      const { directory, exercise } = await projectFixture(inner);
      const filename = path.join(directory, kind === 'exercise' ? 'curriculum/exercises.json' : exercise.graderFile);
      const data = JSON.parse(await readFile(filename, 'utf8'));
      mutate(kind === 'exercise' ? data.exercises[0] : data);
      await writeFile(filename, JSON.stringify(data));
      const result = await validateProject(directory);
      assert.equal(result.status, 'FAIL');
      assert.ok(result.errors.some(message => message.includes(expected)), JSON.stringify(result));
    });
  }
});

test('creator API invoked from module eval does not pass stdin-only flags to file-backed workers', async context => {
  const { directory } = await projectFixture(context);
  const verifier = new URL('../scripts/verify-curriculum.mjs', import.meta.url).href;
  const source = `import { verifyCurriculum } from ${JSON.stringify(verifier)}; const result = await verifyCurriculum(${JSON.stringify(directory)}); console.log(JSON.stringify(result));`;
  const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '--eval', source], { timeout: 10000, maxBuffer: 524288 });
  const result = JSON.parse(stdout);
  assert.equal(result.status, 'PASS', JSON.stringify(result));
  assert.equal(result.examples[0].status, 'PASS');
});

test('module host requirements remain explicit partial author verification', async context => {
  const { directory } = await projectFixture(context);
  const filename = path.join(directory, 'curriculum/exercises.json');
  const data = JSON.parse(await readFile(filename, 'utf8'));
  data.exercises[0].hostRequirements = ['browser-dom'];
  await writeFile(filename, JSON.stringify(data));
  const result = await verifyCurriculum(directory);
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.summary.passed, 0);
  assert.equal(result.summary.skipped, 1);
  assert.equal(result.summary.referenceChecks, 0);
  assert.equal(result.examples.length, 0);
  assert.match(result.exercises[0].reason, /browser-dom/);
});
