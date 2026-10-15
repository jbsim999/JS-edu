function createStockTypes() {
  class StockItem {
    #name;
    #quantity;
    constructor(name, quantity = 0) {
      if (typeof name !== 'string' || name.length === 0) throw new TypeError('Invalid name');
      if (!Number.isSafeInteger(quantity) || quantity < 0) throw new RangeError('Invalid quantity');
      this.#name = name;
      this.#quantity = quantity;
    }
    get name() { return this.#name; }
    get quantity() { return this.#quantity; }
    adjust(delta) {
      if (!Number.isSafeInteger(delta)) throw new RangeError('Invalid delta');
      const next = this.#quantity + delta;
      if (!Number.isSafeInteger(next) || next < 0) throw new RangeError('Insufficient stock or overflow');
      this.#quantity = next;
      return next;
    }
    snapshot() { return { name: this.#name, quantity: this.#quantity }; }
    static from(record) { return new this(record.name, record.quantity); }
  }
  class TrackedStockItem extends StockItem {
    #changes = [];
    constructor(name, quantity = 0) { super(name, quantity); }
    adjust(delta) {
      const before = this.quantity;
      const after = super.adjust(delta);
      this.#changes.push({ before, delta, after });
      return after;
    }
    get history() { return this.#changes.map((entry) => ({ ...entry })); }
  }
  return { StockItem, TrackedStockItem };
}

const {StockItem,TrackedStockItem}=createStockTypes();
const item=new TrackedStockItem('연필',3);
item.adjust(-1);
try { item.adjust(-5); } catch(error) { console.log(error.name); }
// 예상: RangeError
console.log(JSON.stringify({item:item.snapshot(),history:item.history}));
// 예상: {"item":{"name":"연필","quantity":2},"history":[{"before":3,"delta":-1,"after":2}]}
const exported=item.history; exported[0].after=999;
console.log(item.history[0].after);
// 예상: 2. 외부에 반환한 기록 객체도 내부 기록과 분리한다.
const restored=TrackedStockItem.from({name:'펜',quantity:4});
console.log(restored instanceof TrackedStockItem, restored.quantity, restored.history.length);
// 예상: true 4 0
class Broken extends StockItem { constructor(){ this.note='bad'; super('A',1); } }
try { new Broken(); } catch(error) { console.log(error.name); }
// 예상: ReferenceError. derived constructor의 this는 super 이전에 초기화되지 않았다.
