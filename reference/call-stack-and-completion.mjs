export function processNested(nodes, visit, cleanup, maxDepth = 32) {
  const output = [];
  let failed = false;
  let failure;
  try {
    const stack = [{values: nodes, index: 0, depth: 0}];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.index >= frame.values.length) {
        stack.pop();
        continue;
      }
      const value = frame.values[frame.index++];
      if (Array.isArray(value)) {
        const depth = frame.depth + 1;
        if (depth > maxDepth) throw new RangeError('Nesting limit exceeded');
        stack.push({values: value, index: 0, depth});
      } else {
        const converted = visit(value);
        if (converted === null) break;
        output.push(converted);
      }
    }
  } catch (error) {
    failed = true;
    failure = error;
  } finally {
    try {
      cleanup();
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
      }
    }
  }
  if (failed) throw failure;
  return output;
}
