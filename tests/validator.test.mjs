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
  for (const name of ['education.config.json', 'curriculum/catalog.json', 'curriculum/exercises.json',
    'curriculum/lessons/bindings-and-closures.json', 'runtime/profiles.json', 'starter/create-counter.mjs']) {
    const destination = path.join(directory, name);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(projectRoot, name), destination);
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
