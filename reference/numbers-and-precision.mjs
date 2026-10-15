export function calculateAmount(lines) {
  if (lines.length === 0) return { ok: true, kind: 'number', total: '0' };
  const isNumeric = (value) => typeof value === 'number' || typeof value === 'bigint';
  if (lines.some((line) => !isNumeric(line.unitPrice) || !isNumeric(line.quantity))) {
    return { ok: false, reason: 'type' };
  }
  const kind = typeof lines[0].unitPrice;
  if (lines.some((line) => typeof line.unitPrice !== kind || typeof line.quantity !== kind)) {
    return { ok: false, reason: 'mixed' };
  }
  const valid = (value) => kind === 'bigint'
    ? value >= 0n
    : Number.isSafeInteger(value) && value >= 0;
  if (lines.some((line) => !valid(line.unitPrice) || !valid(line.quantity))) {
    return { ok: false, reason: 'range' };
  }
  let total = kind === 'bigint' ? 0n : 0;
  for (const line of lines) {
    const amount = line.unitPrice * line.quantity;
    if (kind === 'number' && (!Number.isSafeInteger(amount) || !Number.isSafeInteger(total + amount))) {
      return { ok: false, reason: 'range' };
    }
    total += amount;
  }
  return { ok: true, kind, total: String(total) };
}
