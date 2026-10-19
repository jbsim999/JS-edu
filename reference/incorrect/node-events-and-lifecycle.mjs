import { EventEmitter } from 'node:events';

export function createTaskService(handler) {
  const events = new EventEmitter();
  return { events, submit: value => Promise.resolve().then(() => handler(value)), async *watch() {}, close: async () => {}, stats: () => ({ state: 'open', active: 0, queued: 0, submitted: 0, settled: 0 }) };
}
