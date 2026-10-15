export function analyzeSearch(text, query) {
  const normalizedText = text;
  const normalizedQuery = query.trim();
  const matches = normalizedQuery === '' ? [] : [...text.matchAll(new RegExp(normalizedQuery, 'g'))].map(match => ({index: match.index, text: match[0]}));
  return {normalizedText, normalizedQuery, codeUnits: text.length, codePoints: text.length, graphemes: text.length, matches};
}
