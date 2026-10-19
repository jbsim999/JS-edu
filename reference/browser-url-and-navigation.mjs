export function createLessonRouter(root, allowedIds, defaultId) {
  if (!Array.isArray(allowedIds) || allowedIds.length === 0 || allowedIds.some(id => typeof id !== 'string' || id.length === 0) || new Set(allowedIds).size !== allowedIds.length || !allowedIds.includes(defaultId)) throw new TypeError('Invalid allowed IDs');
  const allowed = new Set(allowedIds);
  const drafts = new Map();
  const lifecycle = new AbortController();
  const output = document.createElement('output');
  output.dataset.currentLesson = '';
  const textarea = document.createElement('textarea');
  textarea.dataset.draft = '';
  textarea.setAttribute('aria-label', '학습 메모');
  root.replaceChildren(output, textarea);
  let currentId;
  let disposed = false;
  function readAndRender() {
    const url = new URL(location.href);
    const candidates = url.searchParams.getAll('lesson');
    const id = allowed.has(candidates[0]) ? candidates[0] : defaultId;
    if (candidates.length !== 1 || candidates[0] !== id) {
      url.searchParams.set('lesson', id);
      history.replaceState(history.state, '', url);
    }
    currentId = id;
    output.textContent = id;
    root.dataset.lesson = id;
    textarea.value = drafts.get(id) ?? '';
  }
  textarea.addEventListener('input', () => drafts.set(currentId, textarea.value), {signal: lifecycle.signal});
  window.addEventListener('popstate', readAndRender, {signal: lifecycle.signal});
  readAndRender();
  const getState = () => ({lessonId: currentId, draft: drafts.get(currentId) ?? ''});
  return {
    navigate(id) {
      if (disposed) throw new DOMException('Router disposed', 'InvalidStateError');
      if (!allowed.has(id)) throw new RangeError('Unknown lesson');
      if (id !== currentId) {
        const url = new URL(location.href);
        url.searchParams.set('lesson', id);
        history.pushState(history.state, '', url);
        readAndRender();
      }
      return getState();
    },
    getState,
    dispose() { if (!disposed) { disposed = true; lifecycle.abort(); } }
  };
}
