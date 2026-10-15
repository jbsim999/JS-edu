export function auditCounterFactory(createCounter) {
  if (typeof createCounter !== 'function') throw new TypeError('factory must be a function');
  const cases = [
    {
      id: 'initial-value', expected: [5],
      run() { const counter = createCounter(5); return [counter.value()]; }
    },
    {
      id: 'increment-and-default', expected: [-1, 3, 3],
      run() { const counter = createCounter(-2); return [counter.increment(), counter.increment(4), counter.value()]; }
    },
    {
      id: 'zero-and-negative', expected: [3, -2, -2],
      run() { const counter = createCounter(3); return [counter.increment(0), counter.increment(-5), counter.value()]; }
    },
    {
      id: 'reset-origin', expected: [11, 7, 7, 8, 8],
      run() { const counter = createCounter(7); return [counter.increment(4), counter.reset(), counter.value(), counter.increment(), counter.value()]; }
    },
    {
      id: 'independent-instances', expected: [5, 5, 10, 8, 5, 8, 2, 2, 8],
      run() {
        const first = createCounter(2);
        const second = createCounter(10);
        return [first.increment(3), first.value(), second.value(), second.increment(-2),
          first.value(), second.value(), first.reset(), first.value(), second.value()];
      }
    }
  ];
  return cases.map(testCase => {
    try {
      const actual = testCase.run();
      const passed = actual.length === testCase.expected.length &&
        actual.every((value, index) => Object.is(value, testCase.expected[index]));
      return { id: testCase.id, passed };
    } catch {
      return { id: testCase.id, passed: false };
    }
  });
}

function good(start) {
  let count = start;
  return {
    value: () => count,
    increment(delta = 1) { count += delta; return count; },
    reset() { count = start; return count; }
  };
}
let sharedCount;
function shared(start) {
  sharedCount = start;
  return {
    value: () => sharedCount,
    increment(delta = 1) { sharedCount += delta; return sharedCount; },
    reset() { sharedCount = start; return sharedCount; }
  };
}
function wrongDefault(start) {
  let count = start;
  return {
    value: () => count,
    increment(delta) { count += delta || 1; return count; },
    reset() { count = start; return count; }
  };
}
console.log('correct ' + auditCounterFactory(good).map(row => row.passed ? 'PASS' : 'FAIL').join(' '));
console.log('shared failed ' + auditCounterFactory(shared).filter(row => !row.passed).map(row => row.id).join(','));
console.log('unfinished failed ' + auditCounterFactory(() => undefined).filter(row => !row.passed).map(row => row.id).join(','));
console.log('zero failed ' + auditCounterFactory(wrongDefault).filter(row => !row.passed).map(row => row.id).join(','));
