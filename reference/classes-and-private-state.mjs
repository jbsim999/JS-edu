export function createStockTypes() {
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
