import { escapeCode, highlightCode } from './code-theme.mjs';

// A conservative display vocabulary for the existing, unmarked lesson text.
// This is not a JavaScript parser or a change to stored curriculum/quiz values.
const names = [
  'typeof', 'instanceof', 'let', 'const', 'var', 'function', 'class', 'return',
  'throw', 'try', 'catch', 'finally', 'async', 'await', 'yield', 'new', 'import',
  'export', 'default', 'extends', 'null', 'undefined', 'true', 'false', 'this', 'super',
  'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'JSON', 'Object', 'Array', 'String',
  'Number', 'BigInt', 'Boolean', 'Symbol', 'Date', 'Intl', 'RegExp', 'Error',
  'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'AggregateError',
  'NaN', 'Infinity', 'Proxy', 'Reflect', 'ArrayBuffer', 'SharedArrayBuffer',
  'Uint8Array', 'DataView', 'Atomics', 'WeakRef', 'FinalizationRegistry',
  'document', 'window', 'globalThis', 'console', 'fetch', 'setTimeout',
  'setInterval', 'clearTimeout', 'clearInterval', 'queueMicrotask',
  'requestAnimationFrame', 'cancelAnimationFrame', 'structuredClone',
  'AbortController', 'AbortSignal', 'URL', 'URLSearchParams', 'Request', 'Response',
  'Headers', 'FormData', 'Blob', 'File', 'Worker', 'MessageChannel', 'MessagePort',
  'localStorage', 'sessionStorage', 'indexedDB', 'history', 'location',
  'Buffer', 'EventEmitter', 'process', 'require', 'exports', 'TextEncoder', 'TextDecoder',
];
const identifier = '[A-Za-z_$][\\w$]*';
const member = `${identifier}(?:\\??\\.${identifier})*`;
const atom = `(?:${member}|-?\\d+(?:\\.\\d+)?n?)`;
const patterns = [
  'node:[a-z][a-z0-9_/]*',
  `(?:typeof|void|delete|await|new)\\s+${atom}`,
  `(?:${member})\\([^\\n()]*\\)`,
  `${identifier}(?:\\??\\.${identifier})+`,
  `#[A-Za-z_$][\\w$]*`,
  '(?:"use strict"|\'use strict\')',
  '(?:"[A-Za-z0-9_$][\\w$-]*"|\'[A-Za-z0-9_$][\\w$-]*\')',
  `(?:${names.join('|')})`,
  '(?:===|!==|=>|\\?\\?|\\?\\.|&&|\\|\\|)',
];
const vocabulary = new Set(names);
const proseNames = new Set(['Node.js', 'node.js']);

function codeCandidate(value) {
  if (proseNames.has(value)) return false;
  // An uppercase abbreviation followed by an English explanation, e.g.
  // TDZ(Temporal Dead Zone), is a term label, not a call expression.
  const call = /^([A-Za-z_$][\w$]*)\((.*)\)$/u.exec(value);
  if (call && /^[A-Z]/u.test(call[1]) && !vocabulary.has(call[1])) return false;
  return true;
}

export function learningText(value) {
  const source = String(value ?? '');
  if (source.length > 200_000) return escapeCode(source);
  const matches = new RegExp(`(?<![A-Za-z0-9_$])(?:${patterns.join('|')})(?![A-Za-z0-9_$])`, 'gu');
  let result = '', end = 0;
  for (const match of source.matchAll(matches)) {
    if (!codeCandidate(match[0])) continue;
    result += escapeCode(source.slice(end, match.index));
    result += `<code class="inline-code">${highlightCode(match[0])}</code>`;
    end = match.index + match[0].length;
  }
  return result + escapeCode(source.slice(end));
}
