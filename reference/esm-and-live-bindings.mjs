import { readCount, readReady, initialCount, evaluationTrace } from './reader.mjs';

export let count = 0;
evaluationTrace.push('main:before-await');
count = await initialCount;
export const ready = 'ready';
evaluationTrace.push('main:after-await');

export function add(delta = 1) {
  if (typeof delta !== 'number' || !Number.isFinite(delta)) {
    throw new TypeError('delta must be a finite number');
  }
  const next = count + delta;
  if (!Number.isFinite(next)) throw new RangeError('count must stay finite');
  count = next;
  return count;
}

export function snapshot() {
  return { count, imported: readCount(), ready: readReady(), trace: [...evaluationTrace] };
}
