import { count, add, snapshot } from './esm-and-live-bindings/main.mjs';

console.log(JSON.stringify(snapshot()));
const copied = count;
add(3);
console.log('live ' + count + ', copied ' + copied + ', reader ' + snapshot().imported);
try { count = 99; } catch (error) { console.log('rebind ' + error.name); }
try {
  await import('./esm-and-live-bindings/early-a.mjs');
} catch (error) {
  console.log('early cycle ' + error.name);
}
