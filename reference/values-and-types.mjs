export function classifyInput(record, key) {
  const presence = Object.hasOwn(record, key) ? 'present' : 'missing';
  const value = presence === 'present' ? record[key] : undefined;
  let type = value === null ? 'null' : typeof value;
  if (type === 'function') type = 'object';
  return { presence, type, primitive: type !== 'object' };
}
