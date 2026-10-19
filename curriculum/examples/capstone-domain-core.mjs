import { queryProducts, serializeReport } from './capstone-domain-core/main.mjs';
const input = Object.freeze([
  Object.freeze({ id: 'p2', name: ' Pistachio ', price: 230 }),
  Object.freeze({ id: 'p1', name: 'Lemon', price: 120 }),
  Object.freeze({ id: 'p2', name: 'Ignored duplicate', price: 999 })
]);
console.log(serializeReport(queryProducts(input, { limit: 1 })));
console.log(serializeReport(queryProducts(input, { query: ' PISTA ' })));
console.log(serializeReport(queryProducts([], { query: '한글' })));
