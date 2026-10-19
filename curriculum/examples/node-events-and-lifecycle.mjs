import { EventEmitter, once, on } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const events = new EventEmitter();
const first = once(events, 'first');
const second = once(events, 'second');
events.emit('first', 'A');
events.emit('second', 'B');
console.log(JSON.stringify(await Promise.all([first, second])));

const stop = new AbortController();
const stream = on(events, 'value', { signal: stop.signal });
const waiting = stream.next();
events.emit('value', 12);
const item = await waiting;
await stream.return();
console.log(JSON.stringify({ value: item.value[0], valueListeners: events.listenerCount('value'), errorListeners: events.listenerCount('error') }));

const timerController = new AbortController();
const waitingTimer = delay(1000, undefined, { signal: timerController.signal }).catch(error => error.name);
timerController.abort();
console.log(JSON.stringify({ timer: await waitingTimer, listeners: events.eventNames().length }));
