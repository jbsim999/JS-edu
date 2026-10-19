export function mountDraftPanel(root, persist, options = {}) {
  const {initialText = '', opener = document.activeElement} = options;
  if (typeof initialText !== 'string' || typeof persist !== 'function') throw new TypeError('Invalid panel inputs');
  const lifecycle = new AbortController();
  const form = document.createElement('form');
  form.noValidate = true;
  form.style.display = 'grid';
  form.style.gap = '0.75rem';
  form.style.minWidth = '0';
  form.style.maxWidth = '100%';
  const label = document.createElement('label');
  const textarea = document.createElement('textarea');
  textarea.id = root.id + '-draft';
  textarea.dataset.draft = '';
  textarea.value = initialText;
  textarea.required = true;
  textarea.rows = 6;
  textarea.style.width = '100%';
  textarea.style.minWidth = '0';
  textarea.style.boxSizing = 'border-box';
  label.htmlFor = textarea.id;
  label.textContent = '초안 내용';
  const help = document.createElement('p');
  help.id = root.id + '-help';
  help.textContent = '입력을 유지한 채 저장하거나 진행 요청을 취소할 수 있습니다.';
  help.style.overflowWrap = 'anywhere';
  const errorNode = document.createElement('p');
  errorNode.id = root.id + '-error';
  errorNode.dataset.error = '';
  errorNode.setAttribute('role', 'alert');
  errorNode.style.overflowWrap = 'anywhere';
  textarea.setAttribute('aria-describedby', help.id + ' ' + errorNode.id);
  textarea.setAttribute('aria-invalid', 'false');
  const statusNode = document.createElement('p');
  statusNode.dataset.status = '';
  statusNode.setAttribute('role', 'status');
  statusNode.style.overflowWrap = 'anywhere';
  const save = document.createElement('button');
  save.type = 'submit';
  save.dataset.save = '';
  save.textContent = '저장';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.dataset.cancel = '';
  cancel.textContent = '취소';
  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.flexWrap = 'wrap';
  actions.style.gap = '0.5rem';
  actions.append(save, cancel);
  form.append(label, textarea, help, actions, statusNode, errorNode);
  root.replaceChildren(form);
  let text = initialText;
  let status = 'idle';
  let error = null;
  let active = null;
  let generation = 0;
  let disposed = false;
  function render() {
    form.setAttribute('aria-busy', status === 'saving' ? 'true' : 'false');
    save.disabled = status === 'saving';
    cancel.disabled = status !== 'saving';
    statusNode.textContent = {idle: '변경 사항 있음', saving: '저장 중', saved: '저장됨', error: '저장 실패', cancelled: '저장 취소'}[status] ?? '';
    errorNode.textContent = error ?? '';
  }
  function invalidate() { generation++; active?.abort(); active = null; }
  function cancelSave() {
    if (disposed || status !== 'saving') return;
    invalidate();
    status = 'cancelled';
    error = null;
    render();
    textarea.focus();
  }
  textarea.addEventListener('input', () => {
    text = textarea.value;
    invalidate();
    status = 'idle';
    error = null;
    textarea.setAttribute('aria-invalid', 'false');
    render();
  }, {signal: lifecycle.signal});
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (disposed || status === 'saving') return;
    text = textarea.value;
    if (!text.trim()) {
      status = 'error';
      error = '내용을 입력하세요.';
      textarea.setAttribute('aria-invalid', 'true');
      render();
      textarea.focus();
      return;
    }
    textarea.setAttribute('aria-invalid', 'false');
    const ownGeneration = ++generation;
    const controller = new AbortController();
    active = controller;
    status = 'saving';
    error = null;
    render();
    try {
      await persist(text, {signal: controller.signal});
      if (disposed || ownGeneration !== generation) return;
      status = 'saved';
      error = null;
    } catch {
      if (disposed || ownGeneration !== generation) return;
      status = 'error';
      error = '저장하지 못했습니다. 입력은 유지됩니다.';
    } finally {
      if (!disposed && ownGeneration === generation) {
        active = null;
        render();
      }
    }
  }, {signal: lifecycle.signal});
  cancel.addEventListener('click', cancelSave, {signal: lifecycle.signal});
  form.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      form.requestSubmit();
    } else if (event.key === 'Escape' && status === 'saving') {
      event.preventDefault();
      cancelSave();
    }
  }, {signal: lifecycle.signal});
  render();
  textarea.focus();
  return {
    getState() { return {text, status, error}; },
    dispose() {
      if (disposed) return;
      text = textarea.value;
      disposed = true;
      invalidate();
      lifecycle.abort();
      status = 'disposed';
      error = null;
      root.replaceChildren();
      if (opener?.isConnected && typeof opener.focus === 'function') opener.focus();
    }
  };
}
