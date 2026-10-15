function calculateAmount(lines) {
  if (lines.length === 0) return { ok: true, kind: 'number', total: '0' };
  const isNumeric = (value) => typeof value === 'number' || typeof value === 'bigint';
  if (lines.some((line) => !isNumeric(line.unitPrice) || !isNumeric(line.quantity))) {
    return { ok: false, reason: 'type' };
  }
  const kind = typeof lines[0].unitPrice;
  if (lines.some((line) => typeof line.unitPrice !== kind || typeof line.quantity !== kind)) {
    return { ok: false, reason: 'mixed' };
  }
  const valid = (value) => kind === 'bigint'
    ? value >= 0n
    : Number.isSafeInteger(value) && value >= 0;
  if (lines.some((line) => !valid(line.unitPrice) || !valid(line.quantity))) {
    return { ok: false, reason: 'range' };
  }
  let total = kind === 'bigint' ? 0n : 0;
  for (const line of lines) {
    const amount = line.unitPrice * line.quantity;
    if (kind === 'number' && (!Number.isSafeInteger(amount) || !Number.isSafeInteger(total + amount))) {
      return { ok: false, reason: 'range' };
    }
    total += amount;
  }
  return { ok: true, kind, total: String(total) };
}

console.log(0.1 + 0.2 === 0.3);
// 예상: false. 십진 소수의 일부는 Number에 정확히 표현되지 않는다.
console.log(JSON.stringify(calculateAmount([{unitPrice:199,quantity:3},{unitPrice:1,quantity:1}])));
// 예상: {"ok":true,"kind":"number","total":"598"}
console.log(JSON.stringify(calculateAmount([{unitPrice:9007199254740993n,quantity:2n}])));
// 예상: {"ok":true,"kind":"bigint","total":"18014398509481986"}
console.log(JSON.stringify(calculateAmount([{unitPrice:1n,quantity:2}])));
// 예상: {"ok":false,"reason":"mixed"}
console.log(JSON.stringify(calculateAmount([{unitPrice:Number.MAX_SAFE_INTEGER,quantity:2}])));
// 예상: {"ok":false,"reason":"range"}
// 예상 출력 주석은 제품 실행기 검증 기록을 대신하지 않는다.
