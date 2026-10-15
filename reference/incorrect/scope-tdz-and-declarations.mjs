export function createScopedReaders(values, prefix) {
  // 대표 오답: 모든 함수가 한 var index와 호출 시점의 원본 배열을 읽는다.
  const readers = [];
  for (var index = 0; index < values.length; index++) {
    readers.push(() => prefix + '[' + index + ']=' + values[index]);
  }
  return readers;
}
