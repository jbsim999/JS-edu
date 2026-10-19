import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProject } from '../scripts/validate-project.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
async function fixture(context) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'js-edu-validator-'));
  context.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const directory = path.join(temporaryRoot, 'project');
  const catalog = JSON.parse(await readFile(path.join(projectRoot, 'curriculum/catalog.json'), 'utf8'));
  const exerciseData = JSON.parse(await readFile(path.join(projectRoot, 'curriculum/exercises.json'), 'utf8'));
  const names = new Set(['education.config.json', 'curriculum/catalog.json', 'curriculum/exercises.json', 'runtime/profiles.json']);
  for (const lesson of catalog.lessons) names.add(lesson.file);
  for (const exercise of exerciseData.exercises) {
    for (const reference of [...exercise.files, ...exercise.testFiles]) names.add(typeof reference === 'string' ? reference : reference.path);
    for (const field of ['graderFile', 'referenceFile', 'incorrectFile', 'exampleFile', 'verificationRecord']) {
      if (exercise[field]) names.add(exercise[field]);
    }
  }
  // Follow the current connected curriculum, not planned roadmap metadata or a frozen starter list.
  for (const name of names) {
    assert.equal(typeof name, 'string');
    const source = path.resolve(projectRoot, name);
    assert.ok(!path.isAbsolute(name) && source.startsWith(projectRoot), `Unsafe fixture path: ${name}`);
    const destination = path.join(directory, name);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
  return { directory, temporaryRoot };
}
async function changeJson(directory, name, mutate) {
  const filename = path.join(directory, name);
  const document = JSON.parse(await readFile(filename, 'utf8'));
  mutate(document);
  await writeFile(filename, JSON.stringify(document));
}

test('valid curriculum, exercise and source connections pass', async context => {
  const { directory } = await fixture(context);
  assert.equal((await validateProject(directory)).status, 'PASS');
});
test('Node trusted fixture declarations must name an actual fixed grader case', async context => {
  const { directory } = await fixture(context);
  await changeJson(directory, 'curriculum/exercises.json', value => {
    const exercise = value.exercises.find(item => item.id === 'node-files-and-paths-exercise');
    assert.ok(exercise.nodeFixtures.length > 0);
    exercise.nodeFixtures[0].caseId = 'missing-fixed-case';
  });
  const result = await validateProject(directory);
  assert.equal(result.status, 'FAIL');
  assert.ok(result.errors.some(error => error.includes('Node fixture references unknown grader case')));
});
test('project validation rejects reused host quizzes and a prerequisite cycle hidden in the Node variant', async context => {
  const { directory } = await fixture(context);
  await changeJson(directory, 'curriculum/lessons/capstone-host-product.json', value => {
    value.hostVariants.node.quiz.revision = value.quiz.revision ?? value.contentRevision;
    value.hostVariants.node.prerequisites = [value.id];
  });
  const result = await validateProject(directory);
  assert.equal(result.status, 'FAIL');
  assert.ok(result.errors.some(error => error.includes('Host quiz revision must be distinct')));
  assert.ok(result.errors.some(error => error.includes('Host prerequisite cycle: node:capstone-host-product')));
});
test('missing starter and trusted test references fail', async context => {
  const { directory } = await fixture(context);
  await changeJson(directory, 'curriculum/exercises.json', value => {
    value.exercises[0].files[0].path = 'starter/missing.mjs';
    value.exercises[0].testFiles = ['grader/missing.test.mjs'];
  });
  const result = await validateProject(directory);
  assert.equal(result.status, 'FAIL');
  assert.ok(result.errors.some(error => error.includes('files[0]') && error.includes('missing.mjs')));
  assert.ok(result.errors.some(error => error.includes('testFiles[0]')));
});
test('exercise traversal and directory references fail', async context => {
  const { directory, temporaryRoot } = await fixture(context);
  await writeFile(path.join(temporaryRoot, 'outside.mjs'), 'export {};');
  await changeJson(directory, 'curriculum/exercises.json', value => {
    value.exercises[0].files = ['../outside.mjs', 'starter'];
  });
  const result = await validateProject(directory);
  assert.equal(result.status, 'FAIL');
  assert.ok(result.errors.some(error => error.includes('File path escapes project')));
  assert.ok(result.errors.some(error => error.includes('Not a file')));
});
test('linked exercise files cannot escape the project', async context => {
  const { directory, temporaryRoot } = await fixture(context);
  const outside = path.join(temporaryRoot, 'outside');
  await mkdir(outside);
  await writeFile(path.join(outside, 'hidden.mjs'), 'export {};');
  // A directory junction is available on Windows without file-symlink privilege.
  await symlink(outside, path.join(directory, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await changeJson(directory, 'curriculum/exercises.json', value => {
    value.exercises[0].files = ['linked/hidden.mjs'];
  });
  const result = await validateProject(directory);
  assert.equal(result.status, 'FAIL');
  assert.ok(result.errors.some(error => error.includes('Linked file escapes project')));
});
test('catalog prerequisites and exercise ID must match the lesson', async context => {
  const { directory } = await fixture(context);
  await changeJson(directory, 'curriculum/catalog.json', value => {
    value.lessons[0].prerequisites = ['missing-lesson'];
    value.lessons[0].exerciseId = 'missing-exercise';
  });
  const result = await validateProject(directory);
  assert.equal(result.status, 'FAIL');
  assert.ok(result.errors.some(error => error.includes('Catalog/lesson prerequisites mismatch')));
  assert.ok(result.errors.some(error => error.includes('Catalog/lesson exercise mismatch')));
});
