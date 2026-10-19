import { normalizeProduct, normalizeQuery } from './reader.mjs';
let previous = [];
export function queryProducts(records, options = {}) {
  records.sort((a, b) => a.price - b.price);
  previous.push(...records);
  const items = previous.filter(item => item.name.includes(options.query || ''));
  return { version: 1, query: options.query || '', count: items.length, total: items.reduce((sum, item) => sum + item.price, 0), items };
}
export function serializeReport(report) { return JSON.stringify(report); }
