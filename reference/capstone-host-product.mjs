export function mountSearchDashboard(root, queryProducts, options = {}) {
  const { fetcher = fetch, key = 'capstone-query-v1', endpoint = '/_fixtures/http/products' } = options;
  if (!root || typeof root.replaceChildren !== 'function' || typeof queryProducts !== 'function' || typeof fetcher !== 'function') throw new TypeError('invalid dependencies');
  const doc = root.ownerDocument;
  const normalize = value => {
    if (typeof value !== 'string') throw new TypeError('query must be text');
    const text = value.trim().normalize('NFC');
    if ([...text].length > 40) throw new RangeError('query too long');
    return text;
  };
  let restored = '', storageStatus = 'ready';
  let storage;
  try {
    storage = options.storage === undefined ? globalThis.localStorage : options.storage;
    const raw = storage.getItem(key);
    if (raw !== null) {
      const saved = JSON.parse(raw);
      if (saved?.version !== 1 || typeof saved.query !== 'string') throw new TypeError('invalid saved query');
      restored = normalize(saved.query);
    }
  } catch (error) { storageStatus = error?.name === 'SecurityError' ? 'unavailable' : 'invalid'; }
  const form = doc.createElement('form');
  form.setAttribute('aria-label', '상품 검색');
  form.style.display = 'flex'; form.style.flexWrap = 'wrap'; form.style.gap = '0.5rem';
  const label = doc.createElement('label'); label.textContent = '검색어'; label.style.flex = '1 1 12rem';
  const input = doc.createElement('input'); input.type = 'search'; input.name = 'query'; input.value = restored;
  input.setAttribute('aria-label', '상품 검색어'); input.style.width = '100%'; input.style.boxSizing = 'border-box'; input.style.minWidth = '0';
  label.append(input);
  const submit = doc.createElement('button'); submit.type = 'submit'; submit.textContent = '검색';
  const cancelButton = doc.createElement('button'); cancelButton.type = 'button'; cancelButton.textContent = '취소';
  const status = doc.createElement('output'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const list = doc.createElement('ul'); list.setAttribute('aria-label', '검색 결과');
  form.append(label, submit, cancelButton); root.replaceChildren(form, status, list);
  let state = { status: 'idle', query: restored, report: null, error: null, storageStatus };
  let serial = 0, controller = null, disposed = false;
  const getState = () => JSON.parse(JSON.stringify(state));
  const render = () => {
    if (disposed) return;
    root.setAttribute('aria-busy', String(state.status === 'loading'));
    cancelButton.disabled = state.status !== 'loading';
    status.textContent = state.status === 'ready' ? state.report.count + '개 · 합계 ' + state.report.total :
      ({ idle: '검색어를 입력하세요', loading: '검색 중', empty: '검색 결과 없음', error: '조회 실패', 'input-error': '검색어는 40자 이내로 입력하세요', cancelled: '검색 취소' }[state.status] || '');
    list.replaceChildren();
    for (const item of state.report?.items || []) {
      const row = doc.createElement('li'); row.dataset.id = item.id;
      row.textContent = item.name + ' · ' + item.price; row.style.overflowWrap = 'anywhere'; list.append(row);
    }
  };
  const invalidate = () => { serial++; controller?.abort(); controller = null; return serial; };
  const current = number => !disposed && number === serial;
  function cancel() {
    if (disposed) return;
    invalidate(); state = { ...state, status: 'cancelled', report: null, error: null }; render();
  }
  async function search(value = input.value, url = endpoint) {
    if (disposed) throw new DOMException('dashboard disposed', 'InvalidStateError');
    let query;
    try { query = normalize(value); }
    catch { invalidate(); state = { ...state, status: 'input-error', report: null, error: { kind: 'input', status: null } }; render(); return getState(); }
    const number = invalidate();
    const request = new AbortController(); controller = request;
    input.value = query;
    state = { ...state, status: 'loading', query, report: null, error: null };
    try { storage.setItem(key, JSON.stringify({ version: 1, query })); state.storageStatus = 'ready'; }
    catch { state.storageStatus = 'unavailable'; }
    render();
    const fail = (kind, httpStatus = null) => {
      if (!current(number)) return { status: 'stale' };
      controller = null; state = { ...state, status: 'error', report: null, error: { kind, status: httpStatus } }; render(); return getState();
    };
    let response;
    try { response = await fetcher(url, { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: request.signal }); }
    catch { return current(number) ? fail('network') : { status: 'stale' }; }
    if (!current(number)) return { status: 'stale' };
    if (!response.ok) return fail('http', response.status);
    let records;
    try { records = await response.json(); } catch { return fail('json', response.status); }
    if (!current(number)) return { status: 'stale' };
    let report;
    try { report = queryProducts(records, { query }); } catch { return fail('schema', response.status); }
    if (!current(number)) return { status: 'stale' };
    controller = null; state = { ...state, status: report.count === 0 ? 'empty' : 'ready', report, error: null }; render(); return getState();
  }
  const onSubmit = event => { event.preventDefault(); void search(); };
  const onKey = event => {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter') { event.preventDefault(); void search(); }
    if (event.key === 'Escape') { event.preventDefault(); cancel(); }
  };
  form.addEventListener('submit', onSubmit); input.addEventListener('keydown', onKey); cancelButton.addEventListener('click', cancel);
  render();
  return { search, cancel, getState, dispose() {
    if (disposed) return;
    invalidate(); disposed = true; state = { ...state, status: 'disposed', report: null, error: null };
    form.removeEventListener('submit', onSubmit); input.removeEventListener('keydown', onKey); cancelButton.removeEventListener('click', cancel);
    root.removeAttribute('aria-busy'); root.replaceChildren();
  } };
}
