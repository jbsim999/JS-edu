export function createCheckout(initialPolicy) {
  if (typeof initialPolicy !== 'function') throw new TypeError('Policy must be a function');
  let policy = initialPolicy;
  function setPolicy(nextPolicy) {
    if (typeof nextPolicy !== 'function') throw new TypeError('Policy must be a function');
    policy = nextPolicy;
  }
  function quote(amount) {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new RangeError('Invalid amount');
    const selectedPolicy = policy;
    const discount = selectedPolicy(amount);
    if (typeof discount !== 'number') throw new TypeError('Policy must return a number');
    if (!Number.isSafeInteger(discount) || discount < 0 || discount > amount) throw new RangeError('Invalid discount');
    return { amount, discount, total: amount - discount };
  }
  return { quote, setPolicy };
}
