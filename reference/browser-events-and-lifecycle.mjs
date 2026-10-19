export function createInventoryEvents(root, onAction) {
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
