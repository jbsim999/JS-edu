const tasks = [
  () => Promise.resolve().then(() => 'A'),
  () => Promise.resolve('B'),
  () => 'C'
];
let cursor = 0;
const results = new Array(tasks.length);
async function worker() {
  while (cursor < tasks.length) {
    const index = cursor++;
    results[index] = await tasks[index]();
  }
}
await Promise.all([worker(), worker()]);
console.log('ordered', JSON.stringify(results));
const waits = [];
let attempts = 0;
const wait = async delay => { waits.push(delay); };
let value;
for (;;) {
  attempts++;
  try {
    if (attempts < 3) throw new Error('temporary');
    value = 'ok';
    break;
  } catch (error) {
    if (attempts >= 3) throw error;
    await wait(3 * 2 ** (attempts - 1));
  }
}
console.log('retry', value, 'attempts', attempts, 'requested-delays', JSON.stringify(waits));
