import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readdir, rm, realpath } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { exampleLookup, exampleCli, exampleHttp } from './node-testing-and-delivery-example-app.mjs';

const context = globalThis.__javascriptEduExampleContext;
if (!context?.workspaceRoot) throw new Error('ENVIRONMENT_UNSUPPORTED: Node example data workspace is required');
const options = { clock: () => new Date('2026-10-15T00:00:00.000Z'), revision: 'example-draft-1' };
const rows = [{ id: 'b', score: 80 }, { id: 'a', score: 80 }, { id: 'c', score: 10 }];
const expected = { records: [{ id: 'a', score: 80 }, { id: 'b', score: 80 }], runtime: process.version, revision: 'example-draft-1', generatedAt: '2026-10-15T00:00:00.000Z' };
async function fixture(action) {
  const root = await realpath(context.workspaceRoot);
  const dir = await mkdtemp(join(root, 'n08-example-'));
  const file = join(dir, 'records.ndjson');
  try {
    await writeFile(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    return await action(file, dir);
  } finally {
    if (!dir.startsWith(root + sep)) throw new Error('Fixture escaped data root');
    await rm(dir, { recursive: true, force: true });
  }
}

test('real NDJSON and deterministic clock', async () => {
  await fixture(async file => assert.deepEqual(await exampleLookup(file, 50, options), expected));
});

test('CLI output with a scoped mock', async t => {
  await fixture(async file => {
    const output = t.mock.fn();
    assert.equal(await exampleCli(file, 50, options, output), 0);
    assert.equal(output.mock.callCount(), 1);
    assert.deepEqual(JSON.parse(output.mock.calls[0].arguments[0]), expected);
  });
});

test('loopback HTTP closes its port', async () => {
  await fixture(async file => {
    const server = exampleHttp(file, options);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    try {
      const response = await fetch('http://127.0.0.1:' + server.address().port + '/records?minScore=50', { signal: AbortSignal.timeout(2000) });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), expected);
    } finally {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    assert.equal(server.listening, false);
  });
});

test('a representative wrong result is rejected and fixture files are removed', async () => {
  const root = await realpath(context.workspaceRoot);
  const before = await readdir(root);
  await fixture(async file => {
    const correct = await exampleLookup(file, 50, options);
    const wrong = { ...correct, records: [...correct.records].reverse() };
    assert.throws(() => assert.deepEqual(wrong, expected), { code: 'ERR_ASSERTION' });
  });
  assert.deepEqual(await readdir(root), before);
});
