export function createRecordCodec() {
  const failure = error => ({ok: false, error});
  function copyData(value, ancestors = new Set(), depth = 0) {
    if (depth > 20) throw new TypeError('Data depth exceeded');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value === 0 ? 0 : value;
    if (typeof value !== 'object' || ancestors.has(value) || Object.getOwnPropertySymbols(value).length) {
      throw new TypeError('Not a JSON data tree');
    }
    const isArray = Array.isArray(value);
    if (!isArray && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError('Unsupported object');
    ancestors.add(value);
    try {
      const output = isArray ? [] : {};
      const descriptors = Object.getOwnPropertyDescriptors(value);
      if (isArray) {
        const names = Object.getOwnPropertyNames(value).filter(key => key !== 'length');
        if (names.length !== value.length) throw new TypeError('Sparse or decorated array');
        for (let index = 0; index < value.length; index++) {
          const descriptor = descriptors[index];
          if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError('Not a data element');
          output.push(copyData(descriptor.value, ancestors, depth + 1));
        }
      } else {
        for (const key of Object.getOwnPropertyNames(value)) {
          const descriptor = descriptors[key];
          if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError('Not a data property');
          Object.defineProperty(output, key, {value: copyData(descriptor.value, ancestors, depth + 1), enumerable: true, writable: true, configurable: true});
        }
      }
      return output;
    } finally {
      ancestors.delete(value);
    }
  }
  function normalize(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(input)) || Object.getOwnPropertySymbols(input).length) return failure('schema');
    const allowed = ['version', 'id', 'count', 'labels', 'data'];
    for (const key of Object.getOwnPropertyNames(input)) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!allowed.includes(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) return failure('schema');
    }
    if (!Object.hasOwn(input, 'version') || !Number.isInteger(input.version)) return failure('schema');
    if (input.version !== 1) return failure('version');
    if (!Object.hasOwn(input, 'id') || typeof input.id !== 'string' || !/^(0|[1-9][0-9]*)$/.test(input.id) ||
        !Object.hasOwn(input, 'count') || !Number.isSafeInteger(input.count) || input.count < 0) return failure('schema');
    const labels = Object.hasOwn(input, 'labels') ? input.labels : [];
    if (!Array.isArray(labels) || Object.getOwnPropertySymbols(labels).length ||
        Object.getOwnPropertyNames(labels).length !== labels.length + 1) return failure('schema');
    const labelCopy = [];
    for (let index = 0; index < labels.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(labels, index);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string') return failure('schema');
      labelCopy.push(descriptor.value);
    }
    try {
      const data = copyData(Object.hasOwn(input, 'data') ? input.data : null);
      return {ok: true, record: {version: 1, id: input.id, count: input.count === 0 ? 0 : input.count, labels: labelCopy, data}};
    } catch {
      return failure('serialization');
    }
  }
  return {
    decode(text) {
      if (typeof text !== 'string') return failure('input-type');
      let parsed;
      try { parsed = JSON.parse(text); } catch { return failure('parse'); }
      return normalize(parsed);
    },
    encode(record) {
      const normalized = normalize(record);
      if (!normalized.ok) return normalized;
      return {ok: true, text: JSON.stringify(normalized.record)};
    }
  };
}
