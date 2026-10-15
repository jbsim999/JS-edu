import { readOrder } from './reader.mjs';

export function createReceiptService({ now, persist }) {
  const createdAt = now();
  return {
    issue(order) {
      const data = readOrder(order);
      persist(data);
      return { ...data, createdAt };
    }
  };
}
