// 함수/배열은 Object 타입이며, typeof의 결과 표기는 언어 타입 목록과 다를 수 있다.
function classifyInput(record, key) {
  const presence = Object.hasOwn(record, key) ? 'present' : 'missing';
  const value = presence === 'present' ? record[key] : undefined;
  let type = value === null ? 'null' : typeof value;
  if (type === 'function') type = 'object';
  return { presence, type, primitive: type !== 'object' };
}

const input = { zero: 0, off: false, blank: '', empty: null, unset: undefined };
console.log(JSON.stringify(['zero','off','blank','empty','unset','absent'].map(key => classifyInput(input,key))));
// 예상: [{"presence":"present","type":"number","primitive":true},{"presence":"present","type":"boolean","primitive":true},{"presence":"present","type":"string","primitive":true},{"presence":"present","type":"null","primitive":true},{"presence":"present","type":"undefined","primitive":true},{"presence":"missing","type":"undefined","primitive":true}]
console.log(typeof null, typeof (() => {}), typeof 1n, typeof Symbol('id'));
// 예상: object function bigint symbol
let first = 'A';
let second = first;
second = 'B';
const original = { score: 1 };
const alias = original;
alias.score = 2;
console.log(first, second, original.score);
// 예상: A B 2. 문자열 값 재할당과 같은 객체의 내용 변경은 다른 작업이다.
// 예상 출력 주석은 제품 실행기 검증 기록을 대신하지 않는다.
