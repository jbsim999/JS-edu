export function createStockTypes() {
  class StockItem {
    constructor(name, quantity = 0) { this.name = name; this.quantity = quantity; }
    adjust(delta) { this.quantity += delta; return this.quantity; }
    snapshot() { return { name: this.name, quantity: this.quantity }; }
    static from(record) { return new this(record.name, record.quantity); }
  }
  class TrackedStockItem extends StockItem {
    static changes = [];
    adjust(delta) {
      const before = this.quantity;
      const after = super.adjust(delta);
      TrackedStockItem.changes.push({ before, delta, after });
      return after;
    }
    get history() { return TrackedStockItem.changes; }
  }
  return { StockItem, TrackedStockItem };
}
