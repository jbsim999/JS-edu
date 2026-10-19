export function normalizeProduct(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !['id', 'name', 'price'].every(key => Object.hasOwn(value, key)) ||
      typeof value.id !== 'string' || typeof value.name !== 'string' ||
      !Number.isSafeInteger(value.price) || value.price < 0) throw new TypeError('invalid product');
  const id = value.id.trim().normalize('NFC');
  const name = value.name.trim().normalize('NFC');
  if (!id || !name) throw new TypeError('missing product text');
  return { id, name, price: value.price };
}
export function normalizeQuery(value) {
  if (typeof value !== 'string') throw new TypeError('query must be a string');
  return value.trim().normalize('NFC').toLowerCase();
}
