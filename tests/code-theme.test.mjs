import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { highlightCode, codeLanguage, highlightingLimit } from '../web/features/code-theme.mjs';

const textOf = html => html.replace(/<[^>]*>/gu, '').replace(/&(amp|lt|gt|quot|#39|#13);/gu, (_, name) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#13': '\r' })[name]);

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
