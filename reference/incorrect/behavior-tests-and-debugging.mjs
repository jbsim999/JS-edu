export function auditCounterFactory(createCounter) {
  if (typeof createCounter !== 'function') throw new TypeError('factory required');
  const ids = ['initial-value','increment-and-default','zero-and-negative','reset-origin','independent-instances'];
  const counter = createCounter(0);
  const passed = counter.increment() === 1 && counter.value() === 1;
  return ids.map(id => ({ id, passed }));
}
