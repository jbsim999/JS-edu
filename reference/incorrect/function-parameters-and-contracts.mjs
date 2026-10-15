export function summarizeValues(values, options = {}, ...tags) {
  // 대표 오답: falsy 값을 생략값으로 취급하고 공유 옵션을 변경한다.
  options.scale = options.scale || 1;
  options.offset = options.offset || 0;
  let sum = 0;
  for (const value of values) sum += value;
  return {label: options.label || 'total', count: values.length, total: sum * options.scale + options.offset, tags};
}
