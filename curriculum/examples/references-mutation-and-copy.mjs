function createCopyTools() {
  function cloneData(value, seen = new WeakMap()) {
    if (typeof value === 'function' || typeof value === 'symbol') throw new TypeError('Unsupported value');
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    const prototype = Object.getPrototypeOf(value);
    if (prototype === Date.prototype) {
      if (Reflect.ownKeys(value).length !== 0) throw new TypeError('Date properties are unsupported');
      const copy = new Date(Date.prototype.getTime.call(value));
      seen.set(value, copy);
      return copy;
    }
    const array = Array.isArray(value);
    if (array && prototype !== Array.prototype) throw new TypeError('Array subclasses are unsupported');
    if (!array && prototype !== Object.prototype && prototype !== null) throw new TypeError('Unsupported object');
    const copy = array ? new Array(value.length) : Object.create(prototype);
    seen.set(value, copy);
    for (const key of Reflect.ownKeys(value)) {
      if (array && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
        throw new TypeError('Only enumerable string data properties are supported');
      }
      Object.defineProperty(copy, key, {
        value: cloneData(descriptor.value, seen), enumerable: true, writable: true, configurable: true,
      });
    }
    return copy;
  }
  function reviseCart(cart, itemId, quantity) {
    if (!Number.isSafeInteger(quantity) || quantity < 0) throw new RangeError('Invalid quantity');
    const copy = cloneData(cart);
    const item = copy.items.find((entry) => entry.id === itemId);
    if (!item) throw new RangeError('Unknown item');
    item.quantity = quantity;
    return copy;
  }
  function deepFreezeCopy(value) {
    const copy = cloneData(value);
    const visited = new WeakSet();
    function freeze(current) {
      if (current === null || typeof current !== 'object' || visited.has(current)) return;
      if (Object.getPrototypeOf(current) === Date.prototype) throw new TypeError('Date cannot be deeply frozen here');
      visited.add(current);
      for (const key of Object.keys(current)) freeze(current[key]);
      Object.freeze(current);
    }
    freeze(copy);
    return copy;
  }
  return { cloneData, reviseCart, deepFreezeCopy };
}

const tools = createCopyTools();
const cart = { items: [{ id: 'p', quantity: 1, detail: { title: '연필' } }] };
const revised = tools.reviseCart(cart, 'p', 3);
revised.items[0].detail.title = '펜';
console.log(JSON.stringify([cart.items[0], revised.items[0]]));
// 예상: [{"id":"p","quantity":1,"detail":{"title":"연필"}},{"id":"p","quantity":3,"detail":{"title":"펜"}}]
const cycle = { value: 1 }; cycle.self = cycle;
const cloned = tools.cloneData(cycle);
console.log(cloned !== cycle, cloned.self === cloned);
// 예상: true true
const frozen = tools.deepFreezeCopy({ detail: { count: 1 } });
console.log(Object.isFrozen(frozen), Object.isFrozen(frozen.detail));
// 예상: true true
const date = Object.freeze(new Date(0)); date.setTime(1000);
console.log(date.getTime());
// 예상: 1000. Object.freeze는 Date의 내부 시간 슬롯을 고정하지 않는다.
