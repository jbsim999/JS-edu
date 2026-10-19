import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

// Small, valid-fixture example only. The exercise adds limits and failure contracts.
export async function exampleLookup(file, minimum, { clock, revision }) {
  const text = await readFile(file, 'utf8');
  const records = text.trim().split('\n').map(line => JSON.parse(line))
    .filter(record => record.score >= minimum)
    .sort((left, right) => right.score - left.score || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  return { records, runtime: process.version, revision, generatedAt: clock().toISOString() };
}
export async function exampleCli(file, minimum, options, writeOut) {
  writeOut(JSON.stringify(await exampleLookup(file, minimum, options)) + '\n');
  return 0;
}
export function exampleHttp(file, options) {
  return createServer(async (request, response) => {
    try {
      const minimum = Number(new URL(request.url, 'http://127.0.0.1').searchParams.get('minScore') ?? 0);
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(JSON.stringify(await exampleLookup(file, minimum, options)));
    } catch {
      response.statusCode = 500;
      response.end('{"error":"FILE"}');
    }
  });
}
