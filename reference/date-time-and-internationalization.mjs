export function formatSnapshot(timestamp, amount, clock, options = {}) {
  function isTimestamp(value) {
    return Number.isInteger(value) && Number.isFinite(new Date(value).getTime());
  }
  if (!isTimestamp(timestamp)) throw new RangeError('Invalid timestamp');
  if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new TypeError('Invalid amount');
  if (typeof clock !== 'function') throw new TypeError('Clock must be a function');
  const {locale = 'en-US', timeZone = 'UTC'} = options;
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    timeZone, calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const numberFormatter = new Intl.NumberFormat(locale, {
    numberingSystem: 'latn', useGrouping: false,
    minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'auto'
  });
  const now = clock();
  if (!isTimestamp(now) || !Number.isSafeInteger(now - timestamp)) throw new RangeError('Invalid clock value or duration');
  const fields = ['year', 'month', 'day', 'hour', 'minute', 'second'];
  const date = {};
  for (const part of dateFormatter.formatToParts(timestamp)) {
    if (fields.includes(part.type)) date[part.type] = part.value;
  }
  const parts = numberFormatter.formatToParts(amount);
  const number = {
    negative: parts.some(part => part.type === 'minusSign'),
    integer: parts.filter(part => part.type === 'integer').map(part => part.value).join(''),
    fraction: parts.find(part => part.type === 'fraction').value
  };
  return {iso: new Date(timestamp).toISOString(), date, number, elapsedMs: now - timestamp};
}
