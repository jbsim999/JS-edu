import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function lookupRecords({ workspaceRoot, fileName = 'records.ndjson' }) {
  const records = (await readFile(join(workspaceRoot, fileName), 'utf8')).trim().split('\n').map(JSON.parse);
  return { records, total: records.length };
}
export async function runLookupCli(argv, options) {
  options.writeOut(JSON.stringify(await lookupRecords({ ...options, fileName: argv[0] })));
  return 0;
}
export function createLookupServer() { return {}; }
