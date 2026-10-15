function createCheckout(initialPolicy) {
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

const checkout = createCheckout(amount => Math.floor(amount / 10));
console.log(JSON.stringify(checkout.quote(125)));
// 예상: {"amount":125,"discount":12,"total":113}
checkout.setPolicy(amount => Math.min(20,amount));
console.log(JSON.stringify(checkout.quote(125)));
// 예상: {"amount":125,"discount":20,"total":105}
const other=createCheckout(() => 0);
console.log(checkout.quote(50).total, other.quote(50).total);
// 예상: 30 50
try { checkout.setPolicy(null); } catch(error) { console.log(error.name); }
// 예상: TypeError
const {quote}=checkout;
console.log(quote(10).total);
// 예상: 0. 외부 객체의 this에 의존하지 않고 해당 checkout의 정책을 사용한다.
