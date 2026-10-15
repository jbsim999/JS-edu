import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceState } from '../web/features/workspace-state.mjs';
import { createModuleWorkspaceState } from '../web/features/module-workspace-state.mjs';
import { fingerprintSource, moduleLimits } from '../web/execution/module-runner.mjs';

function memoryStorage() {
  const entries = new Map();
  return { entries, getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
}
function exercise(revision = 'modules-1') {
  return { id: 'module-counter', lessonId: 'esm-contracts', contentRevision: revision, graderRevision: 'checks-1',
    runner: { kind: 'module-files', entry: 'main.mjs' }, workspace: { entry: 'main.mjs', files: [
      { path: 'main.mjs', source: 'export { count } from "./lib/counter.mjs";', editable: true },
      { path: 'lib/counter.mjs', source: 'export const count = 0;', editable: true },
      { path: 'fixtures.mjs', source: 'export const initial = 1;', editable: false },
    ] } };
}
function setup({ backend = memoryStorage(), definition = exercise() } = {}) {
  const drafts = createWorkspaceState(backend, 'javascript-edu');
  const workspace = createModuleWorkspaceState({ exercise: definition, workspaceState: drafts,
    lessonId: definition.lessonId, contentRevision: definition.contentRevision });
  return { backend, drafts, workspace };
}

test('module drafts restore each editable path and isolate lesson revisions', () => {
  const { backend, workspace } = setup();
  workspace.update('main.mjs', 'export const total = 2;');
  workspace.update('lib/counter.mjs', 'export const count = 3;');
  assert.equal(workspace.save('main.mjs').status, 'saved');
  assert.equal(workspace.save('lib/counter.mjs').status, 'saved');
  const restored = setup({ backend }).workspace;
  assert.equal(restored.record('main.mjs').value, 'export const total = 2;');
  assert.equal(restored.record('lib/counter.mjs').value, 'export const count = 3;');
  assert.equal(setup({ backend, definition: exercise('modules-2') }).workspace.record('lib/counter.mjs').value, 'export const count = 0;');
  assert.notDeepEqual(workspace.identity('main.mjs'), workspace.identity('lib/counter.mjs'));
  assert.throws(() => createModuleWorkspaceState({ exercise: exercise(), workspaceState: setup().drafts,
    lessonId: 'esm-contracts', contentRevision: 'modules-2' }), /개정/);
});

test('read-only files ignore stored drafts and cannot be edited, reset, or replaced through metadata', () => {
  const definition = exercise();
  const { backend, drafts, workspace } = setup({ definition });
  const forgedIdentity = workspace.identity('fixtures.mjs');
  drafts.load(forgedIdentity, 'forged');
  drafts.update(forgedIdentity, 'export const initial = 999;');
  drafts.save(forgedIdentity);
  definition.workspace.files[2].source = 'external mutation';
  definition.workspace.entry = 'fixtures.mjs';
  assert.equal(workspace.record('fixtures.mjs').value, 'export const initial = 1;');
  assert.throws(() => { workspace.files[2].source = 'metadata mutation'; }, TypeError);
  assert.throws(() => { workspace.record('fixtures.mjs').value = 'record mutation'; }, TypeError);
  assert.throws(() => workspace.update('fixtures.mjs', 'changed'), /읽기 전용/);
  assert.throws(() => workspace.save('fixtures.mjs'), /읽기 전용/);
  assert.throws(() => workspace.reset('fixtures.mjs'), /읽기 전용/);
  assert.equal(setup({ backend }).workspace.record('fixtures.mjs').status, 'readonly');
  assert.equal(JSON.parse(workspace.snapshot()).entry, 'main.mjs');
  assert.equal(JSON.parse(workspace.snapshot()).files['fixtures.mjs'], 'export const initial = 1;');
});

test('snapshots include all fixed files in canonical order and fingerprint changes outside the selected file', async () => {
  const { workspace } = setup();
  const initial = workspace.snapshot();
  assert.deepEqual(Object.keys(JSON.parse(initial).files), ['fixtures.mjs', 'lib/counter.mjs', 'main.mjs']);
  const originalFingerprint = await fingerprintSource(initial);
  assert.equal(workspace.selectedPath(), 'main.mjs');
  workspace.select('fixtures.mjs');
  assert.equal(workspace.snapshot(), initial);
  workspace.update('lib/counter.mjs', 'export const count = 1;');
  assert.notEqual(await fingerprintSource(workspace.snapshot()), originalFingerprint);
  assert.equal(JSON.parse(workspace.snapshot()).files['main.mjs'], exercise().workspace.files[0].source);
  assert.throws(() => workspace.select('missing.mjs'), /포함된/);
  assert.equal(workspace.selectedPath(), 'fixtures.mjs');
  assert.throws(() => workspace.update('../main.mjs', 'invalid'), /포함된/);
});

test('reset changes only its editable file and a failed deletion preserves unsaved work', () => {
  const { backend, workspace } = setup();
  workspace.update('main.mjs', 'first edit');
  workspace.update('lib/counter.mjs', 'second edit');
  workspace.save('main.mjs');
  workspace.save('lib/counter.mjs');
  assert.equal(workspace.reset('main.mjs').ok, true);
  assert.equal(workspace.record('main.mjs').value, exercise().workspace.files[0].source);
  assert.equal(workspace.record('lib/counter.mjs').value, 'second edit');
  workspace.update('lib/counter.mjs', 'last unsaved edit');
  backend.removeItem = () => { throw new Error('blocked'); };
  assert.equal(workspace.reset('lib/counter.mjs').ok, false);
  assert.equal(workspace.record('lib/counter.mjs').value, 'last unsaved edit');
  assert.equal(workspace.record('lib/counter.mjs').dirty, true);
});

test('a corrupt file draft stays blocked without preventing another file from saving', () => {
  const { backend, workspace } = setup();
  workspace.update('main.mjs', 'saved edit');
  workspace.save('main.mjs');
  const [key] = backend.entries.keys();
  backend.entries.set(key, '{broken');
  const restored = setup({ backend }).workspace;
  assert.equal(restored.record('main.mjs').status, 'corrupt');
  restored.update('main.mjs', 'local recovery');
  assert.equal(restored.save('main.mjs').blocked, true);
  assert.equal(backend.entries.get(key), '{broken');
  restored.update('lib/counter.mjs', 'valid separate edit');
  assert.equal(restored.save('lib/counter.mjs').status, 'saved');
  assert.equal(JSON.parse(restored.snapshot()).files['main.mjs'], 'local recovery');
});

test('oversized execution sources are rejected without discarding the editable draft', () => {
  const { workspace } = setup();
  const text = '가'.repeat(Math.ceil(moduleLimits.fileBytes / 3) + 1);
  workspace.update('lib/counter.mjs', text);
  assert.equal(workspace.save('lib/counter.mjs').status, 'saved');
  assert.throws(() => workspace.snapshot(), /크기/);
  assert.equal(workspace.record('lib/counter.mjs').value, text);
  workspace.update('lib/counter.mjs', 'export const count = 4;');
  assert.equal(JSON.parse(workspace.snapshot()).files['lib/counter.mjs'], 'export const count = 4;');
});

test('initial manifest validation rejects missing entry and unsafe paths before any draft is loaded', () => {
  const missing = exercise();
  missing.workspace.files = missing.workspace.files.filter(file => file.path !== 'main.mjs');
  assert.throws(() => setup({ definition: missing }), /entry/);
  const unsafe = exercise();
  unsafe.workspace.files[1].path = '../counter.mjs';
  assert.throws(() => setup({ definition: unsafe }), /목록/);
});
