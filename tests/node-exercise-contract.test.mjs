import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateNodeExercise } from '../scripts/validate-node-exercise.mjs';

async function fixture() {
  return JSON.parse(await readFile(new URL('../curriculum/exercises/node-esm-packages-and-cli.json', import.meta.url), 'utf8'));
}

test('authored Node package graphs preserve readonly CJS and package exports', async () => {
  const exercise = await fixture();
  assert.deepEqual(validateNodeExercise(exercise), []);
  assert.ok(exercise.workspace.files.some(file => file.path === 'format.cjs' && !file.editable));
  assert.ok(exercise.workspace.files.some(file => file.path === 'package.json' && !file.editable));
});

test('Node manifests reject ambiguous paths and forged editing or host declarations', async t => {
  const scenarios = [
    ['readonly entry', e => { e.workspace.files[0].editable = false; }, /entry must be editable/],
    ['changed entry template', e => { e.template += '\nexport const changed = true;'; }, /source\/template/],
    ['body editor', e => { e.editable = {}; }, /body template/],
    ['missing host', e => { e.hostRequirements = []; }, /host requirement/],
    ['missing run observation', e => { delete e.runner.runProbe; }, /runProbe/],
    ['case collision', e => { e.workspace.files.push({ path: 'Main.mjs', source: '', editable: false }); }, /manifest/],
    ['file directory collision', e => { e.workspace.files.push({ path: 'main.mjs/read.mjs', source: '', editable: false }); }, /path collision/],
    ['path traversal', e => { e.workspace.files.push({ path: '../outside.mjs', source: '', editable: false }); }, /manifest/],
    ['unknown link fixture', e => { e.nodeFixtures = [{caseId:'link',kind:'custom-path'}]; }, /fixture/],
  ];
  for (const [name, mutate, expected] of scenarios) await t.test(name, async () => {
    const exercise = await fixture();
    mutate(exercise);
    assert.ok(validateNodeExercise(exercise).some(message => expected.test(message)), name);
  });
});
