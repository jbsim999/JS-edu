export function normalizeNumber(input) {
  // 대표 오답: 모든 값을 Number로 강제 변환하고 falsy 결과를 누락으로 간주한다.
  const value = Number(input);
  return value ? { ok: true, value } : { ok: false, reason: 'missing' };
}
