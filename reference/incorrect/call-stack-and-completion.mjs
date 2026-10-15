export function processNested(nodes, visit, cleanup, maxDepth = 32) {
  // 대표 오답: finally의 return이 모든 결과와 오류를 덮어쓴다.
  const output = [];
  function walk(values) {
    for (const value of values) {
      if (Array.isArray(value)) walk(value);
      else output.push(visit(value));
    }
  }
  try {
    walk(nodes);
    return output;
  } finally {
    cleanup();
    return [];
  }
}
