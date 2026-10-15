export function selectOwnData(source, allowedKeys) {
  const values = Object.create(null);
  const missing = [];
  const undefinedKeys = [];
  const rejected = [];
  for (const key of allowedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (descriptor === undefined) {
      missing.push(key);
    } else if (!Object.hasOwn(descriptor, 'value')) {
      rejected.push({ key, reason: 'accessor' });
    } else if (!descriptor.enumerable) {
      rejected.push({ key, reason: 'non-enumerable' });
    } else {
      Object.defineProperty(values, key, {
        value: descriptor.value, enumerable: true, writable: true, configurable: true,
      });
      if (descriptor.value === undefined) undefinedKeys.push(key);
    }
  }
  return { values, missing, undefinedKeys, rejected };
}
