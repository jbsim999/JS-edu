// 동기 콜백만 합성한다. pipe/partial/curry2는 이 예제에서 정의한 함수다.
const log = [];
function pipe(...stages) {
  return input => {
    let value = input;
    for (const stage of stages) value = stage(value);
    return value;
  };
}
const run = pipe(
  value => { log.push('double:' + value); return value * 2; },
  value => { log.push('add:' + value); return value + 1; }
);
console.log(JSON.stringify([...log])); // []
console.log(run(3), JSON.stringify([...log])); // 7 ["double:3","add:6"]
console.log(run(4)); // 9

const partial = (fn, ...leading) => (...trailing) => fn(...leading, ...trailing);
const curry2 = fn => first => second => fn(first, second);
const join = (...parts) => parts.join('/');
console.log(partial(join, 'A')('B', 'C')); // A/B/C
let pairCalls = 0;
const pair = (a, b) => { pairCalls++; return a + ':' + b; };
const waiting = curry2(pair)('A');
console.log(pairCalls); // 0
console.log(waiting('B'), pairCalls); // A:B 1

const failedLog = [];
const fail = pipe(
  value => { failedLog.push('first'); return value; },
  () => { failedLog.push('fail'); throw new Error('stop'); },
  () => { failedLog.push('unexpected'); return 0; }
);
try { fail(1); } catch (error) { console.log(error.message, JSON.stringify(failedLog)); }
// stop ["first","fail"]
