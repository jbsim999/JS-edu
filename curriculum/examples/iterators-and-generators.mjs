const log = [];
function* source() {
  try { for (const value of [1,2,3,4,5]) { log.push(value); yield value; } }
  finally { log.push('closed'); }
}
function* takeEven(iterable,limit) {
  if (limit===0) return;
  let count=0;
  for (const value of iterable) {
    if (value%2!==0) continue;
    count++;
    yield value;
    if (count===limit) return;
  }
}
const iterator=takeEven(source(),2);
console.log(JSON.stringify(log));
console.log(JSON.stringify(iterator.next()));
console.log(JSON.stringify(log));
console.log(JSON.stringify(iterator.next()));
console.log(String(iterator.next().done));
console.log(JSON.stringify(log));
console.log(JSON.stringify([...iterator]));
