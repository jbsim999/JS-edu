export function renderInventory(root, items) {
  if (!root || root.nodeType !== 1 || !Array.isArray(items)) throw new TypeError('Expected element and array');
  const ids = new Set();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || item.id.length === 0 || ids.has(item.id)
      || typeof item.name !== 'string' || !Number.isSafeInteger(item.quantity) || item.quantity < 0) {
      throw new TypeError('Invalid inventory item');
    }
    ids.add(item.id);
  }
  const doc = root.ownerDocument;
  const fragment = doc.createDocumentFragment();
  const list = doc.createElement('ul');
  list.dataset.inventoryList = '';
  for (const item of items) {
    const row = doc.createElement('li');
    row.dataset.id = item.id;
    row.tabIndex = 0;
    const name = doc.createElement('span');
    name.dataset.field = 'name';
    name.textContent = item.name;
    const quantity = doc.createElement('span');
    quantity.dataset.field = 'quantity';
    quantity.textContent = String(item.quantity);
    row.append(name, quantity);
    for (const [action, label] of [['edit', '편집'], ['delete', '삭제']]) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.dataset.action = action;
      button.textContent = label;
      button.setAttribute('aria-label', item.name + ' ' + label);
      row.append(button);
    }
    list.append(row);
  }
  fragment.append(list);
  if (items.length === 0) {
    const empty = doc.createElement('p');
    empty.dataset.empty = '';
    empty.textContent = '등록된 상품이 없습니다.';
    fragment.append(empty);
  }
  root.replaceChildren(fragment);
  return items.length;
}
