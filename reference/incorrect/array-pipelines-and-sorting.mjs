export function summarizeOrders(orders, minimum = 0) {
  const items = orders.filter(order => order && order.status === 'paid' && order.amount >= minimum);
  items.sort((a, b) => String(b.amount).localeCompare(String(a.amount)));
  return {items, count: items.length, total: items.reduce((sum, item) => sum + item.amount, 0)};
}
