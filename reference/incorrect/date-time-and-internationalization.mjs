export function formatSnapshot(timestamp, amount, clock, options = {}) {
  const date = new Date(timestamp);
  const iso = date.toISOString();
  const elapsedMs = Math.max(0, clock() - timestamp);
  const numberText = amount.toFixed(2).split('.');
  return {
    iso,
    date: {year: String(date.getUTCFullYear()), month: String(date.getUTCMonth() + 1).padStart(2, '0'), day: String(date.getUTCDate()).padStart(2, '0'), hour: String(date.getUTCHours()).padStart(2, '0'), minute: String(date.getUTCMinutes()).padStart(2, '0'), second: String(date.getUTCSeconds()).padStart(2, '0')},
    number: {negative: amount < 0, integer: numberText[0].replace('-', ''), fraction: numberText[1]},
    elapsedMs
  };
}
