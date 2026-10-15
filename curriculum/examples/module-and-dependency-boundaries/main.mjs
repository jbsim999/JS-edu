import { readOrder } from './reader.mjs';

export function createReceiptService(adapters) {
  if (adapters === null || typeof adapters !== 'object' || Array.isArray(adapters)) {
    throw new TypeError('adapters must be an object');
  }
  const { now, persist } = adapters;
  if (typeof now !== 'function' || typeof persist !== 'function') {
    throw new TypeError('now and persist must be functions');
  }
  return Object.freeze({
    issue(order) {
      const data = readOrder(order);
      const createdAt = now();
      if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
        throw new TypeError('clock must return a finite timestamp');
      }
      const items = Object.freeze(data.items.map(item => Object.freeze(item)));
      const receipt = Object.freeze({ id: data.id, items, total: data.total, createdAt });
      persist(receipt);
      return receipt;
    }
  });
}
