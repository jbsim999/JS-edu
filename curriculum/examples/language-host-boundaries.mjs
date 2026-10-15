// ES2026 교재의 분류 예제. DOM/fs를 호출하지 않는 순수 JavaScript다.
// 아래 provided는 실제 탐지 결과가 아닌, 이 예제에서 고정한 환경 프로필이다.
function classifyApis(requested, provided) {
  const language = ['Promise', 'Map', 'JSON'];
  const web = ['document', 'fetch'];
  const node = ['node:fs', 'node:path'];
  return requested.map((name) => {
    let layer = 'unknown';
    if (language.includes(name)) layer = 'language';
    else if (web.includes(name)) layer = 'web';
    else if (node.includes(name)) layer = 'node';
    else if (name === 'setTimeout') layer = 'host';
    return { name, layer, available: layer !== 'unknown' && provided.includes(name) };
  });
}

const workerProfile = ['Promise', 'Map', 'JSON', 'fetch', 'setTimeout'];
console.log(JSON.stringify(classifyApis(['Promise', 'document', 'node:fs'], workerProfile)));
// 예상: [{"name":"Promise","layer":"language","available":true},{"name":"document","layer":"web","available":false},{"name":"node:fs","layer":"node","available":false}]
console.log(JSON.stringify(classifyApis(['fetch'], ['fetch'])));
// 예상: [{"name":"fetch","layer":"web","available":true}]
// API가 현재 존재한다는 사실과 그 API의 명세가 어디에 속하는지는 별개다.
console.log((function strictReceiver() { 'use strict'; return this; })() === undefined);
// 예상: true. strict 함수의 일반 호출이며 메서드 호출과 다르다.
// 예상 출력 주석은 제품 실행기 검증 기록을 대신하지 않는다.
