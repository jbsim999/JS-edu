const text = '가😀e\u0301👩‍💻'.normalize('NFC');
const segmenter = new Intl.Segmenter('ko',{granularity:'grapheme'});
console.log(JSON.stringify({text,codeUnits:text.length,codePoints:[...text].length,graphemes:[...segmenter.segment(text)].length}));
console.log(JSON.stringify([...segmenter.segment(text)].map(part=>part.segment)));
const query = 'a.b';
let escaped='';
for (const character of query) escaped += '\\^$.*+?()[]{}|'.includes(character) ? '\\'+character : character;
console.log(JSON.stringify([...'a.b aXb a.b'.matchAll(new RegExp(escaped,'gu'))].map(match=>match.index)));
console.log(String('e\u0301'.normalize('NFC') === 'é'));
