import { readCount, readReady, initialCount, evaluationTrace } from './reader.mjs';

evaluationTrace.push('main:before-await');
export const count = await initialCount;
export const ready = 'ready';
evaluationTrace.push('main:after-await');
let localCount = count;

export function add(delta = 1) {
  if (typeof delta !== 'number' || !Number.isFinite(delta)) throw new TypeError('invalid delta');
  const next = localCount + delta;
  if (!Number.isFinite(next)) throw new RangeError('invalid count');
  localCount = next;
  return localCount;
}

export function snapshot() {
  return { count: localCount, imported: readCount(), ready: readReady(), trace: [...evaluationTrace] };
}
