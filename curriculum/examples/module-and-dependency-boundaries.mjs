import { createReceiptService } from './module-and-dependency-boundaries/main.mjs';

const calls = [];
const saved = [];
let tick = 100;
const service = createReceiptService({
  now() { calls.push('now'); return tick++; },
  persist(receipt) { calls.push('persist'); saved.push(receipt); }
});
console.log('constructed ' + JSON.stringify(calls));
const order = { id: 'order-1', items: [{ sku: 'book', quantity: 2, unitPrice: 1200 }] };
console.log(JSON.stringify(service.issue(order)));
console.log(JSON.stringify(service.issue({ id: 'empty', items: [] })));
console.log('calls ' + JSON.stringify(calls));
console.log('frozen ' + Object.isFrozen(saved[0]) + ', input ' + order.items[0].unitPrice);
