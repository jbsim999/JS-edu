import { Worker } from 'node:worker_threads';
import { once } from 'node:events';

const worker = new Worker(new URL('./node-workers-and-resource-limits-worker.mjs', import.meta.url), { resourceLimits: { maxOldGenerationSizeMb: 32 } });
const timer = setTimeout(() => { void worker.terminate(); }, 2000);
try {
  const result = once(worker, 'message');
  worker.postMessage({ id: 1, values: [4, -1, 8] });
  const [message] = await result;
  console.log(JSON.stringify({ id: message.id, sum: message.sum, oldGenerationMb: worker.resourceLimits.maxOldGenerationSizeMb }));
} finally {
  clearTimeout(timer);
  await worker.terminate();
}
console.log(JSON.stringify({ terminated: true }));
