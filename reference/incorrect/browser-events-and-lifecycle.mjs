export function createInventoryEvents(root, onAction) {
  return {
    connect() {
      for (const button of root.querySelectorAll('button[data-action]')) {
        button.addEventListener('click', () => onAction({
          action: button.dataset.action, id: button.closest('li[data-id]').dataset.id,
        }));
      }
    },
    dispose() {},
  };
}
