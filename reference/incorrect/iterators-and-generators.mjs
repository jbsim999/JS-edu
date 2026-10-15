export function* takeMatching(iterable, limit, predicate) {
  // 대표 오답: 먼저 전부 읽어 지연 처리와 조기 정리를 잃는다.
  const values = [...iterable].filter(predicate).slice(0, limit);
  for (const value of values) yield value;
}
