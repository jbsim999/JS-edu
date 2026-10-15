export function classifyApis(requested, provided) {
  // 대표 오답: 현재 이름이 보이는 모든 API를 ECMAScript로 분류한다.
  return requested.map((name) => ({ name, layer: 'language', available: provided.includes(name) }));
}
