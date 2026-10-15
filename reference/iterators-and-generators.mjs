export function* takeMatching(iterable, limit, predicate) {
  if (!Number.isInteger(limit) || limit < 0) throw new RangeError('limit must be a nonnegative integer');
  if (limit === 0) return;
  let count = 0;
  for (const value of iterable) {
    if (!predicate(value)) continue;
    count++;
    yield value;
    if (count === limit) return;
  }
}
