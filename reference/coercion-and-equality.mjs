export function normalizeNumber(input) {
  if (input === null || input === undefined) return { ok: false, reason: 'missing' };
  if (typeof input !== 'number' && typeof input !== 'string') return { ok: false, reason: 'type' };
  let value = input;
  if (typeof input === 'string') {
    const text = input.trim();
    if (!/^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(text)) return { ok: false, reason: 'invalid' };
    value = Number(text);
  }
  if (!Number.isFinite(value)) return { ok: false, reason: 'invalid' };
  return { ok: true, value: Object.is(value, -0) ? 0 : value };
}
