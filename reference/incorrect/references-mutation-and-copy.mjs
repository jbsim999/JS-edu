export function createCopyTools() {
  // 대표 오답: 바깥 한 겹만 복사하고 freeze하면 중첩 상태도 독립적이라고 가정한다.
  const cloneData = (value) => Array.isArray(value) ? [...value] : (value && typeof value === 'object' ? { ...value } : value);
  function reviseCart(cart, itemId, quantity) {
    const copy = cloneData(cart);
    copy.items.find((item) => item.id === itemId).quantity = quantity;
    return copy;
  }
  return { cloneData, reviseCart, deepFreezeCopy: (value) => Object.freeze(cloneData(value)) };
}
