import { normalizeProduct, normalizeQuery } from './normalize.mjs';

export function queryProducts(records, options = {}) {
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

export function serializeReport(report) {
  return JSON.stringify({ version: report.version, query: report.query, count: report.count, total: report.total,
    items: report.items.map(({ id, name, price }) => ({ id, name, price })) });
}
