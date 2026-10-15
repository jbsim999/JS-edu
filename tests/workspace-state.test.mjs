import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceState, readPreferences, writePreferences } from '../web/features/workspace-state.mjs';

const identity = { lessonId: 'bindings-and-closures', contentRevision: 'draft-1', exerciseId: 'independent-counter', fileId: 'create-counter' };
function memoryStorage() {
  const entries = new Map();
  return { entries, getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
}

test('workspace restores code and notes separately and does not reuse an older revision', () => {
  const backend = memoryStorage();
  const state = createWorkspaceState(backend, 'js-edu');
  const notes = { ...identity, fileId: 'notes' };
  state.load(identity, '// TODO');
  state.load(notes);
  state.update(identity, 'let count = initial;\nreturn () => ++count;');
  state.update(notes, '카운터별 바인딩');
  assert.equal(state.save(identity).status, 'saved');
  assert.equal(state.save(notes).status, 'saved');
  const reopened = createWorkspaceState(backend, 'js-edu');
  assert.match(reopened.load(identity).value, /return/);
  assert.equal(reopened.load(notes).value, '카운터별 바인딩');
  assert.equal(reopened.load({ ...identity, contentRevision: 'draft-2' }, '// new').value, '// new');
  assert.equal(createWorkspaceState(backend, 'other').load(identity, '// other').value, '// other');
});

test('failed persistence keeps the latest edit in memory and permits retry', () => {
  const backend = memoryStorage();
  const originalWrite = backend.setItem;
  backend.setItem = () => { throw new Error('quota'); };
  const state = createWorkspaceState(backend, 'js-edu');
  state.load(identity, 'initial');
  state.update(identity, 'unsaved edit');
  assert.equal(state.save(identity).status, 'write-error');
  assert.equal(state.load(identity).value, 'unsaved edit');
  assert.equal(state.load(identity).dirty, true);
  backend.setItem = originalWrite;
  assert.equal(state.save(identity).status, 'saved');
  assert.equal(createWorkspaceState(backend, 'js-edu').load(identity).value, 'unsaved edit');
});

test('corrupt records survive autosave and only explicit reset releases the blocked record', () => {
  const backend = memoryStorage();
  const seed = createWorkspaceState(backend, 'js-edu');
  seed.load(identity, 'starter');
  seed.update(identity, 'saved');
  seed.save(identity);
  const [key] = backend.entries.keys();
  backend.entries.set(key, '{broken');
  const state = createWorkspaceState(backend, 'js-edu');
  assert.equal(state.load(identity, 'starter').status, 'corrupt');
  state.update(identity, 'temporary edit');
  state.save(identity);
  assert.equal(backend.entries.get(key), '{broken');
  assert.equal(state.load(identity).value, 'temporary edit');
  assert.equal(state.reset(identity).ok, true);
  assert.equal(backend.entries.has(key), false);
  assert.equal(state.load(identity).value, 'starter');
});

test('blocked reads and failed deletion do not discard edited work', () => {
  const backend = memoryStorage();
  backend.getItem = () => { throw new Error('blocked'); };
  backend.removeItem = () => { throw new Error('blocked'); };
  const state = createWorkspaceState(backend, 'js-edu');
  assert.equal(state.load(identity, 'starter').status, 'read-error');
  state.update(identity, 'local work');
  assert.equal(state.reset(identity).ok, false);
  assert.equal(state.load(identity).value, 'local work');
  const unavailable = createWorkspaceState(null, 'js-edu');
  unavailable.load(identity);
  unavailable.update(identity, 'in memory');
  assert.equal(unavailable.save(identity).status, 'unavailable');
  assert.equal(unavailable.load(identity).dirty, true);
});

test('settings restore independently and invalid settings do not erase stored data', () => {
  const backend = memoryStorage();
  assert.deepEqual(readPreferences(backend, 'js-edu').value, { theme: 'dark', effects: true });
  assert.equal(writePreferences(backend, 'js-edu', { theme: 'light', effects: false }), true);
  assert.deepEqual(readPreferences(backend, 'js-edu').value, { theme: 'light', effects: false });
  const [key] = backend.entries.keys();
  backend.entries.set(key, '{broken');
  assert.equal(readPreferences(backend, 'js-edu').status, 'corrupt');
  assert.equal(backend.entries.get(key), '{broken');
  assert.equal(readPreferences(null, 'js-edu').status, 'unavailable');
  assert.equal(writePreferences(null, 'js-edu', { theme: 'light', effects: true }), false);
});
