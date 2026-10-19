import { run } from 'node:test';
import { fileURLToPath } from 'node:url';

if (!globalThis.__javascriptEduExampleContext?.workspaceRoot) {
  throw new Error('ENVIRONMENT_UNSUPPORTED: Node example data workspace is required');
}
const events = run({
  isolation: 'none',
  files: [fileURLToPath(new URL('./node-testing-and-delivery-acceptance.test.mjs', import.meta.url))]
});
const result = { mode: 'node:test isolation=none', passed: 0, failed: 0, runtime: process.version };
for await (const event of events) {
  if (event.type === 'test:pass') result.passed += 1;
  if (event.type === 'test:fail') result.failed += 1;
}
console.log(JSON.stringify(result));
if (result.failed > 0 || result.passed !== 4) throw new Error('Example acceptance failed');
