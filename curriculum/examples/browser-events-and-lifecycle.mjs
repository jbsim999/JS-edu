// 브라우저 DOM 실행 전용. 전용 실행 origin의 iframe에서 실행한다. Node 실행 결과가 아니다.
function createInventoryEvents(root, onAction) {
  if (!root || root.nodeType !== 1 || typeof onAction !== 'function') throw new TypeError('Expected root and callback');
  let connected = false;
  function onClick(event) {
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    const button = target?.closest('button[data-action]');
    if (!button || !root.contains(button) || button.disabled) return;
    const row = button.closest('li[data-id]');
    const action = button.dataset.action;
    if (!row || row.parentElement !== root || (action !== 'edit' && action !== 'delete')) return;
    event.preventDefault();
    onAction({ action, id: row.dataset.id });
  }
  function onKeydown(event) {
    const row = event.target;
    if (event.key !== 'Delete' || event.isComposing || event.repeat || event.ctrlKey || event.altKey || event.metaKey
      || row?.nodeType !== 1 || !row.matches('li[data-id]') || row.parentElement !== root) return;
    event.preventDefault();
    onAction({ action: 'delete', id: row.dataset.id });
  }
  return {
    connect() {
      if (connected) return;
      connected = true;
      root.addEventListener('click', onClick);
      root.addEventListener('keydown', onKeydown);
    },
    dispose() {
      if (!connected) return;
      connected = false;
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeydown);
    },
  };
}

const root=document.createElement('ul');document.body.append(root);
function addRow(id) {
  const row=document.createElement('li');row.dataset.id=id;row.tabIndex=0;
  for(const action of ['edit','delete']){const button=document.createElement('button');button.type='button';button.dataset.action=action;const span=document.createElement('span');span.textContent=action;button.append(span);row.append(button);}
  root.append(row);return row;
}
const actions=[];const controller=createInventoryEvents(root,value=>actions.push(value));
try {
  const first=addRow('p1');controller.connect();controller.connect();
  const click=new MouseEvent('click',{bubbles:true,cancelable:true});first.querySelector('span').dispatchEvent(click);
  console.log(JSON.stringify({actions:[...actions],prevented:click.defaultPrevented}));
  // 예상: {"actions":[{"action":"edit","id":"p1"}],"prevented":true}
  const later=addRow('p2');later.querySelector('[data-action="delete"]').click();
  first.focus();first.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true}));
  console.log(JSON.stringify(actions));
  // 예상: [{"action":"edit","id":"p1"},{"action":"delete","id":"p2"},{"action":"delete","id":"p1"}]
  controller.dispose();first.querySelector('button').click();
  console.log(JSON.stringify({count:actions.length}));
  // 예상: {"count":3}
} finally { controller.dispose();root.remove(); }
