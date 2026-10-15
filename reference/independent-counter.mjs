export function createCounter(initial = 0) {
  let count = initial;
  return () => ++count;
}
