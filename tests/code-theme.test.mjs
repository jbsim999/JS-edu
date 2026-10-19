import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { highlightCode, codeLanguage, highlightingLimit } from '../web/features/code-theme.mjs';
import { learningText } from '../web/features/inline-code.mjs';

const textOf = html => html.replace(/<[^>]*>/gu, '').replace(/&(amp|lt|gt|quot|#39|#13);/gu, (_, name) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#13': '\r' })[name]);

test('inline code keeps typeof expressions together and preserves surrounding Korean prose', () => {
  const source = 'typeof는 진단 도구지만 typeof null은 "object"다. Promise·Map·JSON과 node:fs를 비교한다.';
  const html = learningText(source);
  assert.equal(textOf(html), source);
  assert.match(html, /<code class="inline-code"><span class="token keyword">typeof<\/span> <span class="token keyword">null<\/span><\/code>/u);
  const snippets = [...html.matchAll(/<code class="inline-code">([\s\S]*?)<\/code>/gu)].map(match => textOf(match[1]));
  for (const name of ['typeof', 'typeof null', '"object"', 'Promise', 'Map', 'JSON', 'node:fs']) assert.ok(snippets.includes(name), name);
  assert.doesNotMatch(html, /<code[^>]*>[^<]*진단/u);
});

test('inline display never turns HTML into elements or rewrites whitespace, quotes or template characters', () => {
  for (const source of ['document.querySelector("<img>")와 <script>alert(1)</script>', 'typeof\u00a0null\r\nMap\u202f설명 😀', '`값 ${value}`와 Object.hasOwn(item, "id")', 'return "</code><img src=x onerror=alert(1)>"']) {
    const html = learningText(source);
    assert.equal(textOf(html), source);
    assert.doesNotMatch(html, /<img|<script|onerror="/u);
  }
});

test('ordinary product names and explanatory abbreviations remain prose', () => {
  const source = 'JavaScript와 Node.js, TDZ(Temporal Dead Zone)를 설명합니다. 약속과 지도는 일반 문장입니다.';
  assert.equal(learningText(source), source);
  assert.equal(textOf(learningText('typeofValue와 myMap을 바꾸지 않는다.')), 'typeofValue와 myMap을 바꾸지 않는다.');
});

test('all existing lesson and glossary text keeps its exact visible characters after inline rendering', async () => {
  const catalog = JSON.parse(await readFile(new URL('../curriculum/catalog.json', import.meta.url)));
  const { glossary } = await import('../web/glossary-data.mjs');
  const strings = [];
  const collect = value => {
    if (typeof value === 'string') strings.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  for (const lesson of catalog.lessons) collect(JSON.parse(await readFile(new URL(`../${lesson.file}`, import.meta.url))));
  collect(glossary);
  for (const value of strings) assert.equal(textOf(learningText(value)), value);
  assert.ok(strings.length > 3000);
});

test('inline code has an independently legible dark palette on either page theme', async () => {
  const css = await readFile(new URL('../web/code-theme.css', import.meta.url), 'utf8');
  const rules = /\.inline-code\s*\{([^}]+)\}/u.exec(css)[1];
  const background = /background:\s*(#[a-f\d]{6})/u.exec(rules)[1];
  const colors = [...rules.matchAll(/--syntax-[\w-]+:\s*(#[a-f\d]{6})/gu)].map(match => match[1]);
  const luminance = hex => hex.slice(1).match(/../gu).map(part => parseInt(part, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  for (const color of colors) assert.ok((luminance(color) + .05) / (luminance(background) + .05) >= 4.5, color);
});

test('code highlighting distinguishes JavaScript syntax without changing the source or activating markup', () => {
  const source = 'class Counter { next() { const label = `값 ${42}`; return /ok/.test(label); } }\n// </code><img src=x onerror=alert(1)>\n';
  const html = highlightCode(source);
  for (const type of ['keyword', 'class-name', 'function', 'string', 'number', 'comment', 'regex']) assert.match(html, new RegExp(`token [^"<>]*${type}`));
  assert.equal(textOf(html), source);
  assert.doesNotMatch(html, /<img|<script|onerror="/u);
  assert.equal(globalThis.Prism, undefined, 'token-only bundle does not install a global handler');
});

test('file extensions select JSON, module, CommonJS and markup grammars, with safe plain-text fallback', () => {
  for (const file of ['main.mjs', 'MAIN.JS', 'lib.cjs']) assert.equal(codeLanguage(file), 'javascript');
  const json = '{"enabled": true, "limit": 42}';
  const html = highlightCode(json, codeLanguage('package.json'));
  assert.match(html, /token property/u);
  assert.match(html, /token boolean/u);
  assert.equal(textOf(html), json);
  const markup = '<button aria-label="확인">확인</button>';
  assert.match(highlightCode(markup, codeLanguage('index.html')), /token tag/u);
  assert.equal(textOf(highlightCode(markup, 'markup')), markup);
  assert.equal(highlightCode('<script>&', codeLanguage('notes.txt')), '&lt;script&gt;&amp;');
  assert.equal(highlightCode('<script>', '__proto__'), '&lt;script&gt;');
});

test('large and incomplete edits remain readable and retain every source character', () => {
  for (const source of ['const x = `unfinished ${', '/* 아직 작성 중', '\t\r\n\n', 'const value = "\u00a0\u202f한글😀";', '<'.repeat(highlightingLimit + 1)]) {
    const html = highlightCode(source);
    assert.equal(textOf(html), source);
    if (source.length > highlightingLimit) assert.doesNotMatch(html, /<span/u);
  }
});

test('vendored offline highlighter matches the recorded fixed-version digest and retains its MIT license', async () => {
  const bytes = await readFile(new URL('../web/vendor/prism/prism.mjs', import.meta.url));
  const provenance = JSON.parse(await readFile(new URL('../web/vendor/prism/provenance.json', import.meta.url)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), provenance.bundleSha256);
  assert.equal(provenance.version, '1.30.0');
  assert.equal(provenance.sources.length, 6);
  assert.match(await readFile(new URL('../web/vendor/prism/LICENSE.md', import.meta.url), 'utf8'), /Permission is hereby granted/u);
});

test('both code palettes meet 4.5:1 text contrast on code and editable backgrounds', async () => {
  const css = await readFile(new URL('../web/code-theme.css', import.meta.url), 'utf8');
  const palettes = [...css.matchAll(/:root(?:\[data-theme="dark"\])?\s*\{([^}]+)\}/gu)].map(match => Object.fromEntries([...match[1].matchAll(/--syntax-([\w-]+):\s*(#[a-f\d]{6})/gu)].map(item => [item[1], item[2]])));
  const lightness = hex => {
    const rgb = hex.slice(1).match(/../gu).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  assert.equal(palettes.length, 2);
  for (const [index, palette] of palettes.entries()) for (const background of (index ? ['#1b291f', '#26352b'] : ['#edf1e7', '#fffefa'])) {
    for (const [name, hex] of Object.entries(palette).filter(([name]) => name !== 'selection')) {
      const [bright, dark] = [lightness(hex), lightness(background)].sort((a, b) => b - a);
      assert.ok((bright + .05) / (dark + .05) >= 4.5, `${index}:${name} on ${background}`);
    }
  }
});
