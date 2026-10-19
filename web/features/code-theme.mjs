import prism from '../vendor/prism/prism.mjs';

// Presentation only. Graders and persistence always read the original textarea value.
export const highlightingLimit = 20_000;
const supportedLanguages = new Set(['javascript', 'json', 'markup', 'css']);
export const escapeCode = value => String(value).replace(/[&<>"'\r]/gu, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '\r': '&#13;',
})[char]);

export function codeLanguage(filename = 'example.js') {
  const extension = String(filename).split('.').at(-1).toLowerCase();
  if (['js', 'mjs', 'cjs'].includes(extension)) return 'javascript';
  if (extension === 'json') return 'json';
  if (['html', 'xml', 'svg'].includes(extension)) return 'markup';
  if (extension === 'css') return 'css';
  return 'plain';
}

export function highlightCode(value, language = 'javascript') {
  const source = String(value);
  if (source.length > highlightingLimit || !supportedLanguages.has(language)) return escapeCode(source);
  // Prism's default HTML encoder normalizes NBSP to a regular space. Render its
  // grammar tokens ourselves so source characters (including string values) survive.
  const render = token => {
    if (typeof token === 'string') return escapeCode(token);
    if (Array.isArray(token)) return token.map(render).join('');
    const classes = [token.type, ...(Array.isArray(token.alias) ? token.alias : [token.alias])]
      .filter(name => typeof name === 'string' && /^[a-z][a-z\d-]*$/u.test(name));
    return `<span class="token ${classes.join(' ')}">${render(token.content)}</span>`;
  };
  try { return render(prism.tokenize(source, prism.languages[language])); }
  catch { return escapeCode(source); }
}

export function syncCodeEditor(input) {
  if (!input) return;
  const surface = input.closest('.code-input');
  const mirror = surface?.querySelector('.code-mirror');
  const code = mirror?.firstElementChild;
  if (!code) return;
  const source = input.value;
  // A final blank line must have a line box, just as in the native textarea.
  code.innerHTML = highlightCode(source, input.dataset.language) + (source.endsWith('\n') ? '\n' : '');
  mirror.style.width = `${input.clientWidth}px`;
  mirror.style.height = `${input.clientHeight}px`;
  mirror.scrollTop = input.scrollTop;
  mirror.scrollLeft = input.scrollLeft;
  surface.classList.add('code-ready');
}

export function attachCodeEditor(input) {
  if (!input) return () => {};
  input.dataset.codeAttached = 'true';
  const controller = new AbortController();
  const { signal } = controller;
  const surface = input.closest('.code-input');
  const scroll = () => {
    const mirror = surface.querySelector('.code-mirror');
    mirror.scrollTop = input.scrollTop;
    mirror.scrollLeft = input.scrollLeft;
  };
  input.addEventListener('input', () => syncCodeEditor(input), { signal });
  input.addEventListener('scroll', scroll, { passive: true, signal });
  input.addEventListener('compositionstart', () => surface.classList.add('code-composing'), { signal });
  input.addEventListener('compositionend', () => {
    syncCodeEditor(input);
    surface.classList.remove('code-composing');
  }, { signal });
  const observer = new ResizeObserver(() => {
    if (!input.isConnected) { observer.disconnect(); return; }
    syncCodeEditor(input);
  });
  observer.observe(input);
  syncCodeEditor(input);
  return () => { observer.disconnect(); controller.abort(); delete input.dataset.codeAttached; };
}
