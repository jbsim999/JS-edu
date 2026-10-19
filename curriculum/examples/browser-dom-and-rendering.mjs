// 브라우저 DOM 실행 전용. 전용 실행 origin의 iframe에서 실행한다. Node 실행 결과가 아니다.
function renderInventory(root, items) {
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

const root=document.createElement('div');document.body.append(root);
try {
  const items=[{id:'p1',name:'<b>레몬</b>',quantity:2},{id:'p2',name:'피스타치오',quantity:0}];
  renderInventory(root,items);
  console.log(JSON.stringify({names:Array.from(root.querySelectorAll('[data-field="name"]'),n=>n.textContent),parsedB:root.querySelectorAll('b').length}));
  // 예상: {"names":["<b>레몬</b>","피스타치오"],"parsedB":0}
  renderInventory(root,items);
  console.log(JSON.stringify({rows:root.querySelectorAll('li').length}));
  // 예상: {"rows":2}
  renderInventory(root,[]);
  console.log(JSON.stringify({rows:root.querySelectorAll('li').length,message:root.querySelector('[data-empty]').textContent}));
  // 예상: {"rows":0,"message":"등록된 상품이 없습니다."}
} finally { root.remove(); }
