export function createBoundedQueryBatch(root, queryProducts, options) {
  const { load, now } = options;
  let rows = [];
  return { async run(tasks) {
    const start = now();
    const results = await Promise.all(tasks.map(async task => {
      const report = queryProducts(await load(task, {}), { query: task.query });
      rows.push(...report.items);
      return { id: task.id, status: 'fulfilled', report };
    }));
    return { status: 'done', results, metrics: { returnedItems: rows.length, elapsedMs: now() - start } };
  }, cancel() {}, dispose() {}, getState: () => ({ status: 'done', returnedItems: rows.length }) };
}
