const originalURL = location.href;
const originalState = history.state;
let popstateCount = 0;
const onPopState = () => { popstateCount++; };
window.addEventListener('popstate', onPopState);
try {
  const url = new URL(location.href);
  url.searchParams.set('lesson', '한글 & 기초');
  url.searchParams.set('keep', 'yes');
  url.hash = 'notes';
  history.pushState({example: true}, '', url);
  const current = new URL(location.href);
  console.log(JSON.stringify({lesson: current.searchParams.get('lesson'), keep: current.searchParams.get('keep'), hash: current.hash}));
  console.log(JSON.stringify({popstateAfterPush: popstateCount}));
} finally {
  window.removeEventListener('popstate', onPopState);
  history.replaceState(originalState, '', originalURL);
}
