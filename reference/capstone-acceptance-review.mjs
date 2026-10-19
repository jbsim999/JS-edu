export function createAcceptanceReview(root, queryProducts, identity) {
  if (!root || typeof root.replaceChildren !== 'function' || typeof queryProducts !== 'function') throw new TypeError('invalid dependencies');
  const copyIdentity = value => {
    const result = {};
    for (const key of ['contentRevision', 'sourceFingerprint', 'graderRevision', 'environmentFingerprint']) {
      if (!value || typeof value[key] !== 'string' || value[key].trim() === '') throw new TypeError('identity field required');
      result[key] = value[key];
    }
    return result;
  };
  let target = copyIdentity(identity), core = queryProducts, active = null, disposed = false;
  let state = { status: 'NOT_RUN', identity: { ...target }, checks: [] };
  const output = root.ownerDocument.createElement('output'); output.setAttribute('role', 'status'); output.setAttribute('aria-live', 'polite');
  const list = root.ownerDocument.createElement('ol'); list.setAttribute('aria-label', '인수 검사 결과');
  root.replaceChildren(output, list);
  const getState = () => JSON.parse(JSON.stringify(state));
  const render = () => {
    if (disposed) return;
    output.textContent = ({ NOT_RUN: '아직 검사하지 않음', RUNNING: '검사 중', PASS: '검사 통과', FAIL: '검사 실패', INVALID: '검사 목록 확인 필요', STALE: '다시 검사 필요' }[state.status] || '') + ' · ' + state.checks.length + '개';
    root.setAttribute('aria-busy', String(state.status === 'RUNNING')); list.replaceChildren();
    for (const check of state.checks) {
      const row = root.ownerDocument.createElement('li'); row.textContent = check.id + ' · ' + (check.status === 'PASS' ? '통과' : '실패'); row.style.overflowWrap = 'anywhere'; list.append(row);
    }
  };
  async function run(tests) {
    if (disposed || active) throw new DOMException('review unavailable', 'InvalidStateError');
    let selected;
    try {
      if (!Array.isArray(tests) || tests.length < 1 || tests.length > 32) throw new RangeError('one to 32 tests required');
      const ids = new Set(); selected = [];
      for (let index = 0; index < tests.length; index++) {
        const test = tests[index];
        if (!Object.hasOwn(tests, index) || !test || typeof test.id !== 'string' || !test.id || ids.has(test.id) || typeof test.check !== 'function') throw new TypeError('invalid test');
        ids.add(test.id); selected.push({ id: test.id, check: test.check });
      }
    } catch (error) { state = { status: 'INVALID', identity: { ...target }, checks: [] }; render(); throw error; }
    const token = { controller: new AbortController(), identity: { ...target }, core }; active = token;
    state = { status: 'RUNNING', identity: { ...token.identity }, checks: [] }; render();
    const checks = [];
    for (const test of selected) {
      let passed = false, reason = 'returned-false';
      try { passed = await test.check({ queryProducts: token.core, signal: token.controller.signal }) === true; }
      catch { reason = 'threw'; }
      if (disposed || active !== token) return { status: 'STALE', identity: { ...token.identity }, checks };
      checks.push({ id: test.id, status: passed ? 'PASS' : 'FAIL', reason: passed ? null : reason });
      state.checks = checks.map(check => ({ ...check })); render();
    }
    active = null;
    state = { status: checks.length > 0 && checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL', identity: { ...token.identity }, checks };
    render(); return getState();
  }
  function invalidate(nextIdentity, nextCore) {
    if (disposed) throw new DOMException('review disposed', 'InvalidStateError');
    const checked = copyIdentity(nextIdentity);
    if (typeof nextCore !== 'function') throw new TypeError('new target function required');
    active?.controller.abort(); active = null; target = checked; core = nextCore;
    state = { status: 'STALE', identity: { ...target }, checks: [] }; render();
  }
  render();
  return { run, invalidate, getState, dispose() {
    if (disposed) return;
    active?.controller.abort(); active = null; disposed = true;
    state = { status: 'DISPOSED', identity: { ...target }, checks: [] };
    root.removeAttribute('aria-busy'); root.replaceChildren();
  } };
}
