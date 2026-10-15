export function summarizeValues(values, options = {}, ...tags) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be a non-null options object');
  }
  const {scale = 1, offset = 0, label = 'total'} = options;
  if (!Number.isFinite(scale) || !Number.isFinite(offset) || typeof label !== 'string') {
    throw new TypeError('scale/offset must be finite numbers and label must be a string');
  }
  let sum = 0;
  for (const value of values) sum += value;
  return {label, count: values.length, total: sum * scale + offset, tags};
}
