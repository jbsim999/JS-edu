export function mountSearchDashboard(root, queryProducts, options = {}) {
  const { fetcher = fetch, endpoint = '/_fixtures/http/products' } = options;
  const input = root.ownerDocument.createElement('input');
  const list = root.ownerDocument.createElement('ul'); root.replaceChildren(input, list);
  let state = { status: 'idle' };
  return { async search(query = '', url = endpoint) {
    const response = await fetcher(url);
    const report = queryProducts(await response.json(), { query });
    list.innerHTML = report.items.map(item => '<li>' + item.name + '</li>').join('');
    state = { status: 'ready', report }; return state;
  }, cancel() {}, getState: () => state, dispose() { root.replaceChildren(); } };
}
