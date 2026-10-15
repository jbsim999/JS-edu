const timestamp = Date.UTC(2026, 9, 15);
console.log(new Date(timestamp).toISOString());
const hours = {};
for (const timeZone of ['UTC', 'Asia/Seoul']) {
  const formatter = new Intl.DateTimeFormat('en-US', {timeZone, hour: '2-digit', hourCycle: 'h23'});
  hours[timeZone] = formatter.formatToParts(timestamp).find(part => part.type === 'hour').value;
}
console.log(JSON.stringify(hours));
const parts = new Intl.NumberFormat('en-US', {numberingSystem: 'latn', useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2}).formatToParts(1234.5);
console.log(JSON.stringify({integer: parts.find(part => part.type === 'integer').value, fraction: parts.find(part => part.type === 'fraction').value}));
const invalid = new Date('not-a-date');
console.log(Number.isNaN(invalid.getTime()));
try { invalid.toISOString(); } catch (error) { console.log(error.name); }
let calls = 0;
const clock = () => { calls++; return timestamp + 60000; };
console.log(JSON.stringify({elapsedMs: clock() - timestamp, calls}));

