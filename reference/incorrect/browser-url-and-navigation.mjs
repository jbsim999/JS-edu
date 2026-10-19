export function createLessonRouter(root, allowedIds, defaultId) {
  let currentId = defaultId;
  const output = document.createElement('output');
  output.dataset.currentLesson = '';
  output.textContent = currentId;
  const textarea = document.createElement('textarea');
  textarea.dataset.draft = '';
  root.replaceChildren(output, textarea);
  return {
    navigate(id) { currentId = id; history.pushState({}, '', '?lesson=' + id); output.textContent = id; textarea.value = ''; return {lessonId: id, draft: ''}; },
    getState() { return {lessonId: currentId, draft: textarea.value}; },
    dispose() {}
  };
}
