export function calculateAmount(lines) {
  // 대표 오답: BigInt를 Number로 바꾸고 소수·범위 초과·혼합 타입을 숨긴다.
  const total = lines.reduce((sum, line) => sum + Number(line.unitPrice) * Number(line.quantity), 0);
  return { ok: true, kind: 'number', total: String(Math.round(total)) };
}
