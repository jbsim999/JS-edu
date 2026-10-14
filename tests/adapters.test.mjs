import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../web/adapters/storage.mjs';
import { createUnavailableRunner } from '../web/adapters/runner.mjs';

const identity = { lessonId: 'bindings-and-closures', contentRevision: 'draft-1', exerciseId: 'independent-counter', fileId: 'create-counter' };
function memoryStorage() {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
}
test('drafts remain isolated by content revision and project namespace', () => {
  const backend = memoryStorage();
  const storage = createStorage(backend, 'js-edu:v1');
  const nextRevision = { ...identity, contentRevision: 'draft-2' };
  storage.writeDraft(identity, 'original');
  assert.equal(storage.readDraft(nextRevision), null);
  storage.writeDraft(nextRevision, 'revised');
  assert.equal(storage.readDraft(identity), 'original');
  assert.equal(createStorage(backend, 'other:v1').readDraft(identity), null);
  storage.removeDraft(identity);
  assert.equal(storage.readDraft(identity), null);
  assert.equal(storage.readDraft(nextRevision), 'revised');
});
test('persistence failure propagates so a caller can report lost saving', () => {
  const storage = createStorage({ ...memoryStorage(), setItem: () => { throw new Error('quota exceeded'); } }, 'js-edu:v1');
  assert.throws(() => storage.writeDraft(identity, 'code'), /quota exceeded/);
});
test('incomplete draft identity is rejected', () => {
  const storage = createStorage(memoryStorage(), 'js-edu:v1');
  assert.throws(() => storage.writeDraft({ ...identity, contentRevision: '' }, 'code'), TypeError);
});
test('unimplemented execution refuses preparation, running and submission', async () => {
  const runner = createUnavailableRunner();
  const environment = await runner.getEnvironment();
  assert.equal(environment.available, false);
  assert.equal(environment.actualRuntime, null);
  for (const operation of ['prepare', 'run', 'submit']) {
    await assert.rejects(runner[operation](), { code: 'RUNNER_UNAVAILABLE' });
  }
  assert.deepEqual(await runner.cancel(), { status: 'idle' });
});
