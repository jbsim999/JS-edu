import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateProject } from '../scripts/validate-project.mjs';
import { verifyCurriculum } from '../scripts/verify-curriculum.mjs';

async function fixture(context) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'js-edu-contract-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const prefix = 'export function sum(initial = 0, ...values) {\n';
  const initialBody = '  // TODO: Add every value to the initial number.';
  const suffix = '\n}\n';
  const files = {
    'education.config.json': { languageVersions: ['ES2026'] },
    'curriculum/catalog.json': { lessons: [{ id: 'sum', file: 'curriculum/lessons/sum.json', prerequisites: [], exerciseId: 'sum-exercise' }] },
    'curriculum/lessons/sum.json': {
      id: 'sum', contentRevision: 'draft-1', status: 'draft', prerequisites: [], supportedVersions: ['ES2026'], exerciseId: 'sum-exercise',
      steps: { theory: 'Numbers and variadic functions.', example: 'Sum values.', quiz: 'Choose a result.', practice: 'Avoid shared state.', lab: 'Implement the sum.' },
      quiz: { questions: [{ id: 'default', prompt: 'What is the default initial value?', choices: [
        { id: 'zero', text: '0', explanation: 'The default parameter is zero.' }, { id: 'one', text: '1', explanation: 'No increment occurs automatically.' },
      ], correctChoiceId: 'zero' }] },
    },
    'curriculum/exercises.json': { exercises: [{
      id: 'sum-exercise', lessonId: 'sum', contentRevision: 'draft-1', graderRevision: 'sum-v1', mode: 'body', profileId: 'standard',
      files: [{ id: 'main', path: 'starter/sum.mjs', editable: true }], testFiles: [], behaviorCriteria: ['Sum all inputs.'], executionVerified: false,
      template: prefix + initialBody + suffix, editable: { prefix, suffix, initialBody },
      runner: { kind: 'function-body', exportName: 'sum', parameters: ['initial = 0', '...values'], async: false },
      graderFile: 'curriculum/checks/sum.json', referenceFile: 'reference/sum.mjs', incorrectFile: 'reference/incorrect/sum.mjs',
      exampleFile: 'curriculum/examples/sum.mjs', exampleExpectedLogs: ['6'],
    }] },
    'runtime/profiles.json': { profiles: [{ id: 'standard', languageVersion: 'ES2026', execution: { available: false, reason: 'Author verification only.' } }] },
    'curriculum/checks/sum.json': { exerciseId: 'sum-exercise', contentRevision: 'draft-1', graderRevision: 'sum-v1', observationMode: 'callback', cases: [
      { id: 'defaults', label: 'Default initial value', probe: 'observe(submission.sum());', expected: 0 },
      { id: 'values', label: 'Every positive and negative value', probe: 'observe([submission.sum(2, 3, 4), submission.sum(-2, 1), submission.sum(5)]);', expected: [9, -1, 5] },
    ] },
    'starter/sum.mjs': prefix + initialBody + suffix,
    'reference/sum.mjs': 'export function sum(initial = 0, ...values) { return values.reduce((total, value) => total + value, initial); }\n',
    'reference/incorrect/sum.mjs': 'export function sum(initial = 0) { return initial; }\n',
    'curriculum/examples/sum.mjs': 'console.log(1 + 2 + 3);\n',
  };
  for (const [name, value] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(directory, name)), { recursive: true });
    await writeFile(path.join(directory, name), typeof value === 'string' ? value : JSON.stringify(value));
  }
  return directory;
}

async function changeJson(directory, name, mutate) {
  const filename = path.join(directory, name);
  const value = JSON.parse(await readFile(filename, 'utf8'));
  mutate(value);
  await writeFile(filename, JSON.stringify(value));
}

test('new function contract accepts default/rest parameters and counts connected lessons only', async context => {
  const directory = await fixture(context);
  await changeJson(directory, 'curriculum/catalog.json', data => { data.roadmap = Array.from({ length: 52 }, (_, index) => ({ id: `planned-${index}` })); });
  const result = await validateProject(directory);
  assert.equal(result.status, 'PASS', result.errors.join('\n'));
  assert.equal(result.lessons, 1);
  assert.equal(result.actualExecutionTestedByValidator, false);
});

test('legacy exercises without the new runner contract remain structurally supported', async context => {
  const directory = await fixture(context);
  await changeJson(directory, 'curriculum/exercises.json', data => {
    for (const field of ['runner', 'editable', 'contentRevision', 'graderRevision', 'graderFile', 'referenceFile', 'incorrectFile', 'exampleFile', 'exampleExpectedLogs']) delete data.exercises[0][field];
  });
  await changeJson(directory, 'curriculum/lessons/sum.json', data => { delete data.quiz; });
  assert.equal((await validateProject(directory)).status, 'PASS');
});

test('generator templates preserve yield syntax in structural and creator verification', async context => {
  const directory = await fixture(context);
  await changeJson(directory, 'curriculum/exercises.json', data => {
    const exercise = data.exercises[0];
    exercise.runner.generator = true;
    exercise.editable.prefix = 'export function* sum(initial = 0, ...values) {\n';
    exercise.editable.initialBody = '  yield -1;';
    exercise.template = exercise.editable.prefix + exercise.editable.initialBody + exercise.editable.suffix;
  });
  const exercise = JSON.parse(await readFile(path.join(directory, 'curriculum/exercises.json'), 'utf8')).exercises[0];
  await writeFile(path.join(directory, 'starter/sum.mjs'), exercise.template);
  await writeFile(path.join(directory, 'reference/sum.mjs'), 'export function* sum(initial = 0, ...values) { yield initial; yield values.reduce((a,b)=>a+b, initial); }\n');
  await writeFile(path.join(directory, 'reference/incorrect/sum.mjs'), 'export function* sum(initial = 0, ...values) { yield -1; }\n');
  await changeJson(directory, 'curriculum/checks/sum.json', data => {
    data.cases = [{ id: 'yield-values', label: 'Yield preserves generator behavior', probe: 'observe([...submission.sum(2,3,4)]);', expected: [2,9] }];
  });
  assert.equal((await validateProject(directory)).status, 'PASS');
  const result = await verifyCurriculum(directory);
  assert.equal(result.status, 'PASS', JSON.stringify(result));
  assert.equal(result.exercises[0].starterRejected, true);
});

test('duplicate JSON members cannot silently replace a contract', async context => {
  const directory = await fixture(context);
  await writeFile(path.join(directory, 'education.config.json'), '{"languageVersions":["ES5"],"languageVersions":["ES2026"]}');
  const result = await validateProject(directory);
  assert.equal(result.status, 'FAIL');
  assert.ok(result.errors.some(error => error.includes('Duplicate JSON member')));
});

test('runner, grader and editable contracts reject missing or inconsistent declarations', async context => {
  const scenarios = [
    ['curriculum/exercises.json', data => { delete data.exercises[0].contentRevision; }, 'Exercise/lesson revision mismatch'],
    ['curriculum/exercises.json', data => { data.exercises[0].graderRevision = 'stale'; }, 'Stale or mismatched grader'],
    ['curriculum/exercises.json', data => { data.exercises[0].editable.initialBody = 'return 100;'; }, 'Editable/template mismatch'],
    ['curriculum/exercises.json', data => { data.exercises[0].runner.parameters = ['initial = 9', '...values']; }, 'Displayed declaration/runner mismatch'],
    ['curriculum/exercises.json', data => { data.exercises[0].runner.parameters = ['...values', 'next']; }, 'Invalid runner function syntax'],
    ['curriculum/checks/sum.json', data => { data.cases = []; }, 'Grader must contain nonzero cases'],
    ['curriculum/checks/sum.json', data => { delete data.cases[0].expected; }, 'Missing or invalid grader expected'],
    ['curriculum/checks/sum.json', data => { data.cases[1].id = data.cases[0].id; }, 'duplicate ID'],
    ['curriculum/checks/sum.json', data => { data.cases[0].probe = 'return )'; }, 'Invalid grader probe syntax'],
    ['curriculum/checks/sum.json', data => { delete data.observationMode; }, 'Grader requires callback observationMode'],
    ['curriculum/exercises.json', data => { data.exercises[0].referenceFile = data.exercises[0].incorrectFile; }, 'Reference and incorrect files must differ'],
    ['curriculum/exercises.json', data => { data.exercises[0].files[0].path = data.exercises[0].referenceFile; }, 'Trusted file exposed as editable'],
    ['curriculum/catalog.json', data => { data.lessons = []; }, 'Catalog must contain at least one actual lesson'],
  ];
  for (const [name, mutate, message] of scenarios) {
    await context.test(message, async child => {
      const directory = await fixture(child);
      await changeJson(directory, name, mutate);
      const result = await validateProject(directory);
      assert.equal(result.status, 'FAIL');
      assert.ok(result.errors.some(error => error.includes(message)), result.errors.join('\n'));
    });
  }
});

test('quiz question and choice identities and correct answer references are validated', async context => {
  const directory = await fixture(context);
  await changeJson(directory, 'curriculum/lessons/sum.json', data => {
    data.quiz.questions[0].correctChoiceId = 'missing';
    data.quiz.questions[0].choices[1].id = data.quiz.questions[0].choices[0].id;
    data.quiz.questions.push(structuredClone(data.quiz.questions[0]));
  });
  const result = await validateProject(directory);
  assert.equal(result.status, 'FAIL');
  assert.ok(result.errors.some(error => error.includes('quiz:sum: duplicate ID')));
  assert.ok(result.errors.some(error => error.includes('quiz choice:sum:default: duplicate ID')));
  assert.ok(result.errors.some(error => error.includes('Unknown correct quiz choice')));
});

test('verified execution still requires passing nonzero evidence at matching content and grader revisions', async context => {
  const directory = await fixture(context);
  await writeFile(path.join(directory, 'evidence.json'), JSON.stringify({ status: 'passed', exerciseId: 'sum-exercise', contentRevision: 'draft-1', graderRevision: 'old', executedTests: 0 }));
  await changeJson(directory, 'curriculum/exercises.json', data => { data.exercises[0].executionVerified = true; data.exercises[0].verificationRecord = 'evidence.json'; });
  await changeJson(directory, 'runtime/profiles.json', data => { data.profiles[0].execution.available = true; });
  const result = await validateProject(directory);
  assert.equal(result.status, 'FAIL');
  assert.ok(result.errors.some(error => error.includes('Missing passing nonzero-test evidence')));
  assert.ok(result.errors.some(error => error.includes('Stale evidence graderRevision')));
});

test('authored references pass real checks while known incorrect and TODO implementations fail', async context => {
  const directory = await fixture(context);
  const result = await verifyCurriculum(directory);
  assert.equal(result.status, 'PASS', JSON.stringify(result));
  assert.equal(result.exercises[0].referencePasses, true);
  assert.equal(result.exercises[0].incorrectRejected, true);
  assert.equal(result.exercises[0].starterRejected, true);
  assert.equal(result.summary.referenceChecks, 2);
  assert.equal(result.examples[0].status, 'PASS');
  assert.equal(result.summary.examplesCompared, 1);
  assert.equal(result.actualRuntime.version, process.versions.node);
  assert.equal(result.browserExecutionVerified, false);
  assert.equal(result.learnerSubmissionsExecuted, false);
  const exercises = JSON.parse(await readFile(path.join(directory, 'curriculum/exercises.json'), 'utf8'));
  assert.equal(exercises.exercises[0].executionVerified, false);
});

test('a grader that accepts its known incorrect solution is not approved', async context => {
  const directory = await fixture(context);
  await writeFile(path.join(directory, 'reference/incorrect/sum.mjs'), await readFile(path.join(directory, 'reference/sum.mjs')));
  const result = await verifyCurriculum(directory);
  assert.equal(result.status, 'FAIL');
  assert.equal(result.exercises[0].incorrectRejected, false);
  assert.equal(result.exercises[0].referencePasses, true);
});

test('async function bodies and awaited probes are checked in isolated workers', async context => {
  const directory = await fixture(context);
  await changeJson(directory, 'curriculum/exercises.json', data => {
    const exercise = data.exercises[0];
    exercise.runner.async = true;
    exercise.editable.prefix = exercise.editable.prefix.replace('export function', 'export async function');
    exercise.template = exercise.editable.prefix + exercise.editable.initialBody + exercise.editable.suffix;
  });
  const exercise = JSON.parse(await readFile(path.join(directory, 'curriculum/exercises.json'), 'utf8')).exercises[0];
  await writeFile(path.join(directory, 'starter/sum.mjs'), exercise.template);
  await writeFile(path.join(directory, 'reference/sum.mjs'), 'export async function sum(initial = 0, ...values) { await Promise.resolve(); return values.reduce((total, value) => total + value, initial); }');
  await writeFile(path.join(directory, 'reference/incorrect/sum.mjs'), 'export async function sum(initial = 0) { return initial; }');
  await changeJson(directory, 'curriculum/checks/sum.json', data => {
    data.cases[0].probe = 'observe(await submission.sum());';
    data.cases[1].probe = 'observe(await Promise.all([submission.sum(2, 3, 4), submission.sum(-2, 1), submission.sum(5)]));';
  });
  const result = await verifyCurriculum(directory);
  assert.equal(result.status, 'PASS', JSON.stringify(result));
  assert.equal(result.exercises[0].referencePasses, true);
  assert.equal(result.exercises[0].starterRejected, true);
});

test('missing, duplicate and value-returning observations cannot approve a grader', async context => {
  for (const probe of ['submission.sum();', 'observe(0); observe(0);', 'observe(0); return 0;']) {
    await context.test(probe, async child => {
      const directory = await fixture(child);
      await changeJson(directory, 'curriculum/checks/sum.json', data => { data.cases[0].probe = probe; });
      const result = await verifyCurriculum(directory);
      assert.equal(result.status, 'FAIL');
      assert.equal(result.exercises[0].reference.checks[0].reason, 'invalid-probe');
      assert.equal(result.exercises[0].referencePasses, false);
    });
  }
});

test('Array.prototype.then changes cannot turn an observed incorrect array into expected output', async context => {
  const directory = await fixture(context);
  await writeFile(path.join(directory, 'reference/incorrect/sum.mjs'), 'Array.prototype.then = function (resolve) { resolve([9, -1, 5]); }; export function sum() { return 0; }');
  const result = await verifyCurriculum(directory);
  assert.equal(result.status, 'PASS', JSON.stringify(result));
  assert.equal(result.exercises[0].incorrectRejected, true);
  const check = result.exercises[0].incorrect.checks.find(item => item.id === 'values');
  assert.equal(check.status, 'FAIL');
  assert.equal(check.reason, 'value-mismatch');
  assert.equal(check.actual, '[ 0, 0, 0 ]');
});

test('observed values are captured before later probe mutations', async context => {
  const directory = await fixture(context);
  await changeJson(directory, 'curriculum/checks/sum.json', data => {
    data.cases[1].probe = 'const values = [submission.sum(2, 3, 4), submission.sum(-2, 1), submission.sum(5)]; observe(values); values[0] = 999;';
  });
  const result = await verifyCurriculum(directory);
  assert.equal(result.status, 'PASS', JSON.stringify(result));
  assert.equal(result.exercises[0].referencePasses, true);
});

test('a broken reference is reported separately from the negative checks', async context => {
  const directory = await fixture(context);
  await writeFile(path.join(directory, 'reference/sum.mjs'), 'export function sum() { return 999; }');
  const result = await verifyCurriculum(directory);
  assert.equal(result.status, 'FAIL');
  assert.equal(result.exercises[0].referencePasses, false);
  assert.equal(result.exercises[0].incorrectRejected, true);
});

test('example output mismatch fails independently of exercise behavior checks', async context => {
  const directory = await fixture(context);
  await changeJson(directory, 'curriculum/exercises.json', data => { data.exercises[0].exampleExpectedLogs = ['7']; });
  const result = await verifyCurriculum(directory);
  assert.equal(result.exercises[0].status, 'PASS');
  assert.equal(result.examples[0].status, 'FAIL');
  assert.equal(result.status, 'FAIL');
});

test('an infinite authored reference is terminated at its deadline rather than hanging validation', async context => {
  const directory = await fixture(context);
  await writeFile(path.join(directory, 'reference/sum.mjs'), 'export function sum() { while (true) {} }');
  const result = await verifyCurriculum(directory, { timeoutMs: 1000 });
  assert.equal(result.status, 'FAIL');
  assert.equal(result.exercises[0].reference.reason, 'timeout');
  assert.equal(result.exercises[0].referencePasses, false);
});

test('output limits terminate noisy author examples and preserve bounded reports', async context => {
  const directory = await fixture(context);
  await writeFile(path.join(directory, 'curriculum/examples/sum.mjs'), 'console.log("x".repeat(4096));');
  const result = await verifyCurriculum(directory, { maxOutputBytes: 256 });
  assert.equal(result.status, 'FAIL');
  assert.equal(result.examples[0].reason, 'output-limit');
  assert.ok(result.examples[0].stdout.length <= 256);
});

test('host-specific lessons are explicitly skipped without being counted as execution passes', async context => {
  const directory = await fixture(context);
  await changeJson(directory, 'curriculum/exercises.json', data => { data.exercises[0].hostRequirements = ['browser-dom']; });
  const result = await verifyCurriculum(directory);
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.summary.passed, 0);
  assert.equal(result.summary.skipped, 1);
  assert.equal(result.summary.referenceChecks, 0);
  assert.equal(result.examples.length, 0);
  assert.match(result.exercises[0].reason, /browser-dom/);
});
