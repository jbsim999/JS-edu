function createScopedReaders(values, prefix) {
  const readers = [];
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    readers.push(() => prefix + '[' + index + ']=' + value);
  }
  return readers;
}

const source = ['A','B'];
const readers = createScopedReaders(source,'row');
source[0] = 'changed';
console.log(JSON.stringify(readers.map(read => read())));
// 예상: ["row[0]=A","row[1]=B"]. 반복별 index와 본문에서 초기화한 value를 사용한다.
function observeInitialization() {
  const trace = [];
  trace.push(typeof laterVar);
  var laterVar = 1;
  try {
    trace.push(typeof laterLet);
    let laterLet = 1;
  } catch (error) {
    trace.push(error.name);
  }
  trace.push(named());
  function named() { return 'function-ready'; }
  return trace;
}
console.log(JSON.stringify(observeInitialization()));
// 예상: ["undefined","ReferenceError","function-ready"]
const label = 'definition';
function readLabel() { return label; }
function callElsewhere() { const label = 'caller'; return readLabel(); }
console.log(callElsewhere());
// 예상: definition. 식별자 탐색은 호출자의 지역 변수가 아니라 정의 환경을 따른다.
// 예상 출력 주석은 제품 실행기 검증 기록을 대신하지 않는다.
