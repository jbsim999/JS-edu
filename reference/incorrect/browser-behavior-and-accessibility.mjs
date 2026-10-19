export function mountDraftPanel(root, persist, options = {}) {
  const textarea = document.createElement('textarea');
  textarea.dataset.draft = '';
  textarea.value = options.initialText ?? '';
  const button = document.createElement('button');
  button.dataset.save = '';
  button.textContent = '저장';
  let status = 'idle';
  root.replaceChildren(textarea, button);
  button.onclick = () => { persist(textarea.value, {}).then(() => { textarea.value = ''; status = 'saved'; }); };
  return {getState: () => ({text: textarea.value, status, error: null}), dispose() {} };
}
