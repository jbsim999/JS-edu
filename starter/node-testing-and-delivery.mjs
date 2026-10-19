import { LIMITS, deliveryError, parseMinScore } from './delivery-contract.mjs';

export async function lookupRecords(options = {}) {
  // TODO: actual bounded NDJSON input and deterministic result.
}

export async function runLookupCli(argv, options = {}) {
  // TODO: CLI JSON output and exit value without process.exit().
}

export function createLookupServer(options = {}) {
  // TODO: actual node:http server, with listen/close owned by its caller.
}
