export function analyzeSearch(text, query) {
  const normalizedText = text.normalize('NFC');
  const normalizedQuery = query.trim().normalize('NFC');
  const segmenter = new Intl.Segmenter('ko', {granularity: 'grapheme'});
  const matches = [];
  if (normalizedQuery !== '') {
    let escaped = '';
    const syntax = '\\^$.*+?()[]{}|';
    for (const character of normalizedQuery) {
      escaped += syntax.includes(character) ? '\\' + character : character;
    }
    const pattern = new RegExp(escaped, 'gu');
    for (const match of normalizedText.matchAll(pattern)) {
      matches.push({index: match.index, text: match[0]});
    }
  }
  return {
    normalizedText, normalizedQuery,
    codeUnits: normalizedText.length,
    codePoints: [...normalizedText].length,
    graphemes: [...segmenter.segment(normalizedText)].length,
    matches
  };
}
