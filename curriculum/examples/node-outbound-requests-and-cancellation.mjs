import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

let attempts = 0;
const server = createServer((_request, response) => {
  attempts += 1;
  response.statusCode = attempts === 1 ? 503 : 200;
  response.end(JSON.stringify({ id: 'local', score: 72 }));
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(new Error('deadline')), 1000);
try {
  const statuses = [];
  let value;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await fetch('http://127.0.0.1:' + server.address().port, { signal: controller.signal });
    statuses.push(response.status);
    if (response.ok) { value = await response.json(); break; }
    await response.body.cancel();
    await delay(1, undefined, { signal: controller.signal });
  }
  console.log(JSON.stringify({ statuses, attempts, value }));
  const reason = new Error('user-stop');
  try { await fetch('http://127.0.0.1:' + server.address().port, { signal: AbortSignal.abort(reason) }); }
  catch (error) { console.log(JSON.stringify({ cancelled: error === reason, attempts })); }
} finally {
  clearTimeout(timer);
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
