function createAcceptanceReview(root, queryProducts, identity) {
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

function normalizeProduct(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !['id', 'name', 'price'].every(key => Object.hasOwn(value, key)) ||
      typeof value.id !== 'string' || typeof value.name !== 'string' ||
      !Number.isSafeInteger(value.price) || value.price < 0) throw new TypeError('invalid product');
  const id = value.id.trim().normalize('NFC');
  const name = value.name.trim().normalize('NFC');
  if (!id || !name) throw new TypeError('missing product text');
  return { id, name, price: value.price };
}
function normalizeQuery(value) {
  if (typeof value !== 'string') throw new TypeError('query must be a string');
  return value.trim().normalize('NFC').toLowerCase();
}

function queryProducts(records, options = {}) {
  if (!Array.isArray(records) || !options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('records and options are invalid');
  }
  const { query = '', maxPrice = Infinity, limit = Infinity } = options;
  const normalized = normalizeQuery(query);
  if (typeof maxPrice !== 'number' || Number.isNaN(maxPrice) || maxPrice < 0 ||
      !(limit === Infinity || Number.isSafeInteger(limit) && limit >= 0)) throw new TypeError('invalid query options');
  const unique = new Map();
  for (let index = 0; index < records.length; index++) {
    if (!Object.hasOwn(records, index)) throw new TypeError('sparse input');
    const item = normalizeProduct(records[index]);
    if (!unique.has(item.id)) unique.set(item.id, item);
  }
  const matched = [...unique.values()].filter(item => item.name.toLowerCase().includes(normalized) && item.price <= maxPrice);
  matched.sort((a, b) => a.price - b.price || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let total = 0;
  for (const item of matched) {
    total += item.price;
    if (!Number.isSafeInteger(total)) throw new RangeError('unsafe total');
  }
  return { version: 1, query: normalized, count: matched.length, total, items: matched.slice(0, limit) };
}

function serializeReport(report) {
  return JSON.stringify({ version: report.version, query: report.query, count: report.count, total: report.total,
    items: report.items.map(({ id, name, price }) => ({ id, name, price })) });
}

const root=document.getElementById('exercise-root');
const identity={contentRevision:'draft-1',sourceFingerprint:'example-source-a',graderRevision:'example-checks-v1',environmentFingerprint:'browser-fixture'};
const review=createAcceptanceReview(root,queryProducts,identity);
const tests=[{id:'empty',check:({queryProducts})=>queryProducts([]).count===0},{id:'sum',check:({queryProducts})=>queryProducts([{id:'a',name:'A',price:5}]).total===5}];
try {console.log(JSON.stringify({status:(await review.run(tests)).status}));review.invalidate({...identity,sourceFingerprint:'example-source-b'},()=>({count:1,total:0}));console.log(JSON.stringify({status:review.getState().status}));console.log(JSON.stringify({status:(await review.run(tests)).status}));}finally{review.dispose();}
