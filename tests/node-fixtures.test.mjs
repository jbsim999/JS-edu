import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createNodeExecution } from '../web/server/node-execution.mjs';
import { createNodeRunner, fingerprintSource, serializeNodeSource } from '../web/execution/node-runner.mjs';
import { validateNodeSnapshot } from '../runtime/node-contract.mjs';

const source = `import * as fs from 'node:fs/promises';import path from 'node:path';
export async function inspect(root){return {linked:(await fs.lstat(path.join(root,'allowed','linked'))).isSymbolicLink(),text:await fs.readFile(path.join(root,'outside','secret.txt'),'utf8')};}`;
const exercise = { id: 'node-fixed-link', lessonId: 'node-fixed-link', contentRevision: 'fixture-1', graderRevision: 'fixture-check-1',
  profileByVersion: { ES2026: 'node-native' }, runner: { kind: 'module-files', entry: 'main.mjs', runProbe: "const fs=await import('node:fs/promises');observe(await fs.readdir(context.workspaceRoot));" },
  workspace: { entry: 'main.mjs', files: [{ path: 'main.mjs', source, editable: true }] }, nodeFixtures: [{ caseId: 'link', kind: 'linked-directory' }] };

test('fixed Node fixtures reject unknown, duplicate, and path-shaped metadata', () => {
  const snapshot = serializeNodeSource({ entry: 'main.mjs', files: { 'main.mjs': source } });
  for (const fixtures of [[{caseId:'link',kind:'arbitrary-file'}],[{caseId:'../escape',kind:'linked-directory'}],[...exercise.nodeFixtures,...exercise.nodeFixtures],[{caseId:'link',kind:'linked-directory',path:'outside'}]]) {
    assert.throws(() => validateNodeSnapshot({ ...exercise, nodeFixtures: fixtures }, snapshot), /fixture/);
  }
});

test('trusted parent seeds links only in their fixed case while learner permissions stay unchanged', async t => {
  const executable = process.env.JS_EDU_NODE_EXECUTABLE ? path.resolve(process.env.JS_EDU_NODE_EXECUTABLE) : process.execPath;
  const version = execFileSync(executable, ['--version'], { encoding: 'utf8', windowsHide: true }).trim().slice(1);
  const grader = { exerciseId: exercise.id, contentRevision: exercise.contentRevision, graderRevision: exercise.graderRevision, cases: [
    { id: 'link', label: 'trusted link fixture', probe: 'observe(await submission.inspect(context.workspaceRoot));', expected: { linked: true, text: 'original' } },
    { id: 'empty', label: 'case isolation', probe: "const fs=await import('node:fs/promises');observe(await fs.readdir(context.workspaceRoot));", expected: [] },
  ] };
  const provider = createNodeExecution({ executable, expectedVersion: version, exercises: [exercise], loadGrader: async () => grader });
  let origin;
  const server = createServer((request, response) => { void provider.handle(request, response, origin); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const runner = createNodeRunner({ exercises: [exercise], origin, getConsent: () => true,
    fetcher: (url, init = {}) => fetch(url, { ...init, headers: { ...init.headers, ...(init.method && init.method !== 'GET' ? { Origin: origin } : {}) } }) });
  t.after(async () => { await runner.cancel(); await provider.close(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); });
  const snapshot = serializeNodeSource({ entry: 'main.mjs', files: { 'main.mjs': source } });
  const result = await runner.submit({ requestId: 'fixed-link-1', lessonId: exercise.lessonId, exerciseId: exercise.id, contentRevision: exercise.contentRevision,
    source: snapshot, sourceFingerprint: await fingerprintSource(snapshot), targetVersion: 'ES2026', consent: true });
  assert.equal(result.status, 'success', result.stderr);
  assert.equal(result.checks.length, 2);
  assert.ok(result.checks.every(item => item.passed));
  assert.equal(result.cleanupWarning, undefined);
});
