import { Buffer } from 'node:buffer';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { TextDecoder } from 'node:util';

export async function aggregateNdjson(input, output, {maxLineBytes = 1024, signal} = {}) {
  if (!Number.isSafeInteger(maxLineBytes) || maxLineBytes < 1 || maxLineBytes > 1048576) throw new RangeError('invalid line limit');
  let parts = [];
  let lineBytes = 0;
  let count = 0;
  let total = 0;
  const decoder = new TextDecoder('utf-8', {fatal: true});
  function append(part) {
    if (lineBytes + part.length > maxLineBytes) throw new RangeError('line too large');
    if (part.length) { parts.push(part); lineBytes += part.length; }
  }
  function finishLine() {
    let line = Buffer.concat(parts, lineBytes);
    parts = [];
    lineBytes = 0;
    if (line.at(-1) === 13) line = line.subarray(0, -1);
    if (line.length === 0) return;
    const row = JSON.parse(decoder.decode(line));
    if (row === null || typeof row !== 'object' || Array.isArray(row) ||
        typeof row.name !== 'string' || row.name.trim() === '' ||
        !Number.isSafeInteger(row.amount)) throw new TypeError('invalid row');
    if (!Number.isSafeInteger(total + row.amount) || !Number.isSafeInteger(count + 1)) throw new RangeError('unsafe summary');
    count++;
    total += row.amount;
  }
  const aggregate = new Transform({
    transform(chunk, encoding, callback) {
      try {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
        let start = 0;
        for (let index = 0; index < bytes.length; index++) {
          if (bytes[index] !== 10) continue;
          append(bytes.subarray(start, index));
          finishLine();
          start = index + 1;
        }
        append(bytes.subarray(start));
        callback();
      } catch (error) { callback(error); }
    },
    flush(callback) {
      try {
        if (lineBytes) finishLine();
        this.push(JSON.stringify({count, total}) + '\n');
        callback();
      } catch (error) { callback(error); }
    }
  });
  await pipeline(input, aggregate, output, {signal});
  return {count, total};
}
