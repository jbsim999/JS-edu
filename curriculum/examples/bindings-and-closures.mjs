function createCounter(initial = 0) {
  let count = initial;
  return () => ++count;
}

const a = createCounter();
const b = createCounter(10);
console.log(a(), a(), b(), a());
// Expected: 1 2 11 3. Not yet an execution verification record.
