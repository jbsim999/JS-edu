export function createScopedReaders(values, prefix) {
  const readers = [];
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    readers.push(() => prefix + '[' + index + ']=' + value);
  }
  return readers;
}
