import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { glossary, findTerms, normalizeSearch } from '../web/glossary-data.mjs';

test('current roadmap lessons have valid related terms without duplicate glossary identities', async () => {
  const catalog = JSON.parse(await readFile(new URL('../curriculum/catalog.json', import.meta.url), 'utf8'));
  const ids = new Set(catalog.roadmap.map(row => row.id));
  assert.equal(new Set(glossary.map(term => term.id)).size, glossary.length);
  for (const term of glossary) {
    assert.ok(term.lessons.length > 0, term.id);
    assert.ok(term.lessons.every(id => ids.has(id)), term.id);
    assert.equal(new URL(term.source.url).protocol, 'https:');
  }
  for (const id of ids) assert.ok(findTerms('', id).length > 0, id);
});

test('normalized English and Korean aliases search the same terms across lesson routes', () => {
  assert.equal(normalizeSearch('  ＣＬＯＳＵＲＥ  '), 'closure');
  assert.equal(findTerms('  ＣＬＯＳＵＲＥ  ', 'values-and-types')[0].id, 'closure');
  assert.equal(findTerms('클로저', 'node-files-and-paths')[0].id, 'closure');
  assert.ok(findTerms('AbortSignal').some(term => term.english.includes('Abort')));
  assert.deepEqual(findTerms('없는말-정확검사-93812'), []);
});
