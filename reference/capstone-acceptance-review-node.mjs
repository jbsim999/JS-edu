import path from 'node:path';
import { fileURLToPath } from 'node:url';

const identityKeys = ['contentRevision', 'sourceRevision', 'environmentFingerprint', 'graderRevision'];
const targetKeys = ['queryProductFile', 'runProductCli', 'createProductServer'];
const invalidState = () => Object.assign(new Error('not available'), { name: 'InvalidStateError' });
function copyIdentity(identity) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity) ||
      identityKeys.some(key => !Object.hasOwn(identity, key) || typeof identity[key] !== 'string' || !identity[key].trim() || identity[key].length > 128)) throw new TypeError('complete identity required');
  return Object.fromEntries(identityKeys.map(key => [key, identity[key]]));
}
function copyTarget(target) {
  if (!target || typeof target !== 'object' || Array.isArray(target) || targetKeys.some(key => typeof target[key] !== 'function')) throw new TypeError('target methods required');
  // Bind method receivers while isolating subsequent replacement of target properties.
  return Object.freeze(Object.fromEntries(targetKeys.map(key => [key, target[key].bind(target)])));
}

export function createNodeAcceptance({ workspaceRoot, target, identity } = {}) {
  if (workspaceRoot instanceof URL && workspaceRoot.protocol === 'file:') workspaceRoot = fileURLToPath(workspaceRoot);
  if (typeof workspaceRoot !== 'string' || !workspaceRoot || workspaceRoot.includes('\0') || !path.isAbsolute(workspaceRoot)) throw new TypeError('absolute data workspace required');
  let currentIdentity = copyIdentity(identity);
  let currentTarget = copyTarget(target);
  let state = { status: 'NOT_RUN', identity: currentIdentity, checks: [] };
  let activeRun = null;
  let disposed = false;
  const snapshot = () => structuredClone(state);
  function stop(status) {
    state = { status, identity: currentIdentity, checks: [] };
    if (activeRun) {
      activeRun.invalidatedAs = status;
      activeRun.controller.abort();
    }
  }
  function copyTests(tests) {
    if (!Array.isArray(tests)) throw new TypeError('test array required');
    if (!tests.length || tests.length > 32) throw new RangeError('1 to 32 checks required');
    const copy = [];
    const ids = new Set();
    for (let index = 0; index < tests.length; index++) {
      if (!Object.hasOwn(tests, index)) throw new TypeError('sparse checks');
      const test = tests[index];
      if (!test || typeof test !== 'object' || Array.isArray(test) || !Object.hasOwn(test, 'id') || !Object.hasOwn(test, 'check') ||
          typeof test.id !== 'string' || !test.id.trim() || ids.has(test.id) || typeof test.check !== 'function') throw new TypeError('invalid check');
      ids.add(test.id);
      copy.push({ id: test.id, check: test.check });
    }
    return copy;
  }
  async function run(tests) {
    if (disposed || activeRun) throw invalidState();
    let copied;
    try { copied = copyTests(tests); }
    catch (error) { state = { status: 'INVALID', identity: currentIdentity, checks: [] }; throw error; }
    const current = { identity: { ...currentIdentity }, target: currentTarget, controller: new AbortController(), invalidatedAs: null };
    activeRun = current;
    state = { status: 'RUNNING', identity: current.identity, checks: [] };
    const checks = [];
    try {
      for (const test of copied) {
        if (current.controller.signal.aborted) break;
        let outcome;
        try {
          const passed = await test.check({ target: current.target, workspaceRoot, identity: { ...current.identity }, signal: current.controller.signal });
          outcome = { id: test.id, status: passed === true ? 'PASS' : 'FAIL', reason: passed === true ? null : 'returned-false' };
        } catch { outcome = { id: test.id, status: 'FAIL', reason: 'threw' }; }
        if (current.controller.signal.aborted) break;
        checks.push(outcome);
        state = { status: 'RUNNING', identity: current.identity, checks: structuredClone(checks) };
      }
      if (current.invalidatedAs) return structuredClone({ status: current.invalidatedAs, identity: current.identity, checks: [] });
      state = { status: checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL', identity: current.identity, checks };
      return snapshot();
    } finally { if (activeRun === current) activeRun = null; }
  }
  return Object.freeze({
    run, getState: snapshot,
    invalidate(nextIdentity, nextTarget) {
      if (disposed) throw invalidState();
      const checkedIdentity = copyIdentity(nextIdentity);
      const checkedTarget = copyTarget(nextTarget);
      currentIdentity = checkedIdentity; currentTarget = checkedTarget;
      stop('STALE');
    },
    cancel() {
      if (!activeRun || activeRun.controller.signal.aborted || disposed) return false;
      stop('CANCELLED'); return true;
    },
    dispose() { if (disposed) return; disposed = true; stop('DISPOSED'); },
  });
}
