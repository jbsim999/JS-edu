export function selectOwnData(source, allowedKeys) {
  // 대표 오답: in과 일반 읽기를 써 상속 필드와 getter까지 수집한다.
  const values = {};
  const missing = [];
  const undefinedKeys = [];
  for (const key of allowedKeys) {
    if (key in source) {
      values[key] = source[key];
      if (values[key] === undefined) undefinedKeys.push(key);
    } else missing.push(key);
  }
  return { values, missing, undefinedKeys, rejected: [] };
}
