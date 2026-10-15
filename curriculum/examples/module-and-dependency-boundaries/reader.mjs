// 순수 내부 모듈: 호스트 API, 시계, 저장소를 호출하지 않습니다.
export function readOrder(order) {
  if (order === null || typeof order !== 'object' || Array.isArray(order) ||
      typeof order.id !== 'string' || order.id.trim() === '' || !Array.isArray(order.items)) {
    throw new TypeError('invalid order');
  }
  const items = [];
  let total = 0;
  for (const item of order.items) {
    if (item === null || typeof item !== 'object' ||
        typeof item.sku !== 'string' || item.sku.trim() === '' ||
        !Number.isSafeInteger(item.quantity) || item.quantity <= 0 ||
        !Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0) {
      throw new TypeError('invalid order item');
    }
    const subtotal = item.quantity * item.unitPrice;
    if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(total + subtotal)) {
      throw new RangeError('order total is not a safe integer');
    }
    total += subtotal;
    items.push({ sku: item.sku, quantity: item.quantity, unitPrice: item.unitPrice });
  }
  return { id: order.id, items, total };
}
