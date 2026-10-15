async function collect(source, limit, mapPage) {
  const pages = [];
  for await (const page of source) {
    pages.push(await mapPage(page, pages.length));
    if (pages.length === limit) break;
  }
  return pages;
}
const events = [];
async function* source() {
  try {
    for (const page of [1, 2, 3]) { events.push('pull:' + page); yield page; }
  } finally { await Promise.resolve(); events.push('closed'); }
}
const pages = await collect(source(), 2, async (page, index) => {
  events.push('map:' + index);
  return page * 10;
});
console.log(JSON.stringify(pages));
console.log(events.join(' > '));
const reason = new Error('mapper');
let closed = false;
async function* failingSource() { try { yield 1; yield 2; } finally { closed = true; } }
try { await collect(failingSource(), 5, async () => { throw reason; }); }
catch (error) { console.log('same-error', error === reason, 'closed', closed); }
