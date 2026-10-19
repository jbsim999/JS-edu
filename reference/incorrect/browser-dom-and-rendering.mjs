export function renderInventory(root, items) {
  const list = root.ownerDocument.createElement('ul');
  list.dataset.inventoryList = '';
  for (const item of items) {
    const row = root.ownerDocument.createElement('li');
    row.dataset.id = item.id;
    row.innerHTML = '<span data-field="name">' + item.name + '</span><span data-field="quantity">' + item.quantity + '</span>';
    list.append(row);
  }
  root.append(list);
  return items.length;
}
