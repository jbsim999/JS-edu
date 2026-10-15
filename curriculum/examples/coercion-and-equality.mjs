function normalizeNumber(input) {
  if (input === null || input === undefined) return { ok: false, reason: 'missing' };
  if (typeof input !== 'number' && typeof input !== 'string') return { ok: false, reason: 'type' };
  let value = input;
  if (typeof input === 'string') {
    const text = input.trim();
    if (!/^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(text)) return { ok: false, reason: 'invalid' };
    value = Number(text);
  }
  if (!Number.isFinite(value)) return { ok: false, reason: 'invalid' };
  return { ok: true, value: Object.is(value, -0) ? 0 : value };
}

console.log(JSON.stringify([' 12.50 ', '', '0x10', '-0', null, false].map(normalizeNumber)));
// 예상: [{"ok":true,"value":12.5},{"ok":false,"reason":"invalid"},{"ok":false,"reason":"invalid"},{"ok":true,"value":0},{"ok":false,"reason":"missing"},{"ok":false,"reason":"type"}]
console.log('2' + 1, Number('2') + 1, Number(''));
// 예상: 21 3 0. 성공한 변환이 입력 정책에 맞는 변환이라는 뜻은 아니다.
console.log(NaN === NaN, Object.is(NaN, NaN), Object.is(-0, 0), [-0].includes(0));
// 예상: false true false true
console.log(Object.is(normalizeNumber('-0').value, -0));
// 예상: false. 이 과제의 정책은 -0을 +0으로 합친다.
// 예상 출력 주석은 제품 실행기 검증 기록을 대신하지 않는다.
