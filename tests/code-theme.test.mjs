import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { highlightCode, codeLanguage, highlightingLimit } from '../web/features/code-theme.mjs';
import { learningText, learningParagraphs } from '../web/features/inline-code.mjs';

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

test('inline display never turns HTML into elements or rewrites whitespace or quotes', () => {
  for (const source of ['document.querySelector("<img>")와 <script>alert(1)</script>', 'typeof\u00a0null\r\nMap\u202f설명 😀', 'return "</code><img src=x onerror=alert(1)>"']) {
    const html = learningText(source);
    assert.equal(textOf(html), source);
    assert.doesNotMatch(html, /<img|<script|onerror="/u);
  }
});

test('marked functions, declarations, nested calls and literal backticks are each one code region', () => {
  for (const code of ["function f() { 'use strict'; return this; }", "let a = 'A'; const x = { n: 1 };", 'outer(inner({ value: [1, 2] }))', '`값 ${value}`', 'const empty = ``;', '<script>alert("<img>")</script>', 'const x = 1;\r\nreturn x;']) {
    const delimiter = '`'.repeat(Math.max(0, ...[...code.matchAll(/`+/gu)].map(match => match[0].length)) + 1);
    const padding = delimiter.length > 1 ? ' ' : '';
    const html = learningText(`정의 ${delimiter}${padding}${code}${padding}${delimiter} 다음 문장`);
    const snippets = [...html.matchAll(/<code class="inline-code">([\s\S]*?)<\/code>/gu)];
    assert.equal(snippets.length, 1);
    assert.equal(textOf(snippets[0][1]), code);
    assert.equal(textOf(html), `정의 ${code} 다음 문장`);
    assert.doesNotMatch(html, /<img|<script/u);
  }
  assert.equal(textOf(learningText('일반 문장 `닫히지 않은 표시')), '일반 문장 `닫히지 않은 표시');
});

test('ordinary product names and explanatory abbreviations remain prose', () => {
  const source = 'JavaScript와 Node.js, TDZ(Temporal Dead Zone)를 설명합니다. 약속과 지도는 일반 문장입니다.';
  assert.equal(learningText(source), source);
  assert.equal(textOf(learningText('typeofValue와 myMap을 바꾸지 않는다.')), 'typeofValue와 myMap을 바꾸지 않는다.');
});

test('blank lines split prose paragraphs without splitting a marked function body', () => {
  const code = "function f() {\n  'use strict';\n\n  return this;\n}";
  const html = learningParagraphs(`앞 문단\n\n함수 \`${code}\`를 호출한다.\n\n뒤 문단`);
  assert.equal([...html.matchAll(/<p>/gu)].length, 3);
  const snippets = [...html.matchAll(/<code class="inline-code">([\s\S]*?)<\/code>/gu)];
  assert.equal(snippets.length, 1);
  assert.equal(textOf(snippets[0][1]), code);
  assert.equal(learningParagraphs(''), '');
});

test('mismatched delimiters stay text and the large input limit applies to both render paths', () => {
  for (const source of ['닫히지 않은 ``표현`', '첫째 `미완성', '한 개 `와 두 개 ``는 짝이 아니다']) assert.equal(textOf(learningText(source)), source);
  const source = '`' + 'x'.repeat(200_000) + '`';
  assert.equal(textOf(learningText(source)), source);
  assert.equal(learningText(source).includes('<code'), false);
  assert.equal(textOf(learningParagraphs(source)), source);
  const exactLimit = '`' + 'x'.repeat(199_998) + '`';
  assert.equal(textOf(learningText(exactLimit)), 'x'.repeat(199_998));
});

test('the first lesson defines a valid whole function before explaining its invocation', async () => {
  const lesson = JSON.parse(await readFile(new URL('../curriculum/lessons/language-host-boundaries.json', import.meta.url)));
  const functionSource = /`(function f\(\)[^`]+)`/u.exec(lesson.steps.theory)?.[1];
  assert.ok(functionSource, 'a complete named declaration is shown');
  const f = runInNewContext(`(${functionSource})`, {}, { timeout: 1000 });
  assert.equal(f(), undefined);
  const obj = { f };
  assert.equal(obj.f(), obj);
  const html = learningText(lesson.steps.theory);
  const snippets = [...html.matchAll(/<code class="inline-code">([\s\S]*?)<\/code>/gu)].map(match => textOf(match[1]));
  assert.equal(snippets.filter(code => code === functionSource).length, 1);
  assert.match(lesson.steps.theory, /`f`는 함수의 이름이고, `f\(\)`는 그 함수를 호출하는 표현/u);
});

test('all existing lesson and glossary text preserves visible content except explicit code delimiters', async () => {
  const catalog = JSON.parse(await readFile(new URL('../curriculum/catalog.json', import.meta.url)));
  const { glossary } = await import('../web/glossary-data.mjs');
  const strings = [];
  const authored = [];
  const collect = value => {
    if (typeof value === 'string') strings.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  for (const lesson of catalog.lessons) {
    const data = JSON.parse(await readFile(new URL(`../${lesson.file}`, import.meta.url)));
    collect(data);
    const prose = value => {
      if (typeof value === 'string') authored.push(value);
      else if (Array.isArray(value)) value.forEach(prose);
      else if (value && typeof value === 'object') Object.values(value).forEach(prose);
    };
    prose(data.steps); prose(data.quiz); prose(data.goals); prose(data.hostVariants);
  }
  collect(glossary);
  for (const value of strings) {
    const expected = value.replace(/(?<!`)(`+)(?!`)([\s\S]*?)(?<!`)\1(?!`)/gu, (_, delimiter, code) => delimiter.length > 1 && code.startsWith(' ') && code.endsWith(' ') && /\S/u.test(code) ? code.slice(1, -1) : code);
    assert.equal(textOf(learningText(value)), expected);
  }
  for (const term of glossary) authored.push(term.summary, term.definition, term.misconception);
  for (const value of authored) assert.doesNotMatch(value, /(?:\.)?`[A-Za-z_$][\w$]*`\(\)/u, 'the call parentheses belong inside its code region: '+value);
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
