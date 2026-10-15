export function summarizeOrders(orders, minimum = 0) {
  const selected = [];
  for (let index = 0; index < orders.length; index++) {
    if (!Object.hasOwn(orders, index)) continue;
    const order = orders[index];
    if (order === null || typeof order !== 'object' || typeof order.id !== 'string' ||
        order.status !== 'paid' || !Number.isFinite(order.amount) ||
        order.amount < 0 || order.amount < minimum) continue;
    selected.push({id: order.id, amount: order.amount, index});
  }
  selected.sort((a, b) => b.amount - a.amount || a.index - b.index);
  const items = selected.map(({id, amount}) => ({id, amount}));
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return {items, count: items.length, total};
}
