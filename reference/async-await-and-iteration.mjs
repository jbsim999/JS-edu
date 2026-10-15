export async function collectPages(source, limit, mapPage = page => page) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError('limit must be an integer from 1 to 100');
  }
  if (typeof mapPage !== 'function') throw new TypeError('mapPage must be a function');
  const pages = [];
  for await (const page of source) {
    pages.push(await mapPage(page, pages.length));
    if (pages.length === limit) break;
  }
  return pages;
}
