export function classifyInput(record, key) {
  // 대표 오답: falsy 값을 누락으로, typeof null을 실제 언어 타입으로 간주한다.
  const value = record[key];
  return { presence: value ? 'present' : 'missing', type: typeof value, primitive: typeof value !== 'object' };
}
