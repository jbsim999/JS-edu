const events = [];
await new Promise(resolve => {
  events.push('sync:start');
  Promise.resolve().then(() => {
    events.push('promise');
    queueMicrotask(() => events.push('nested'));
  });
  queueMicrotask(() => events.push('queued'));
  setTimeout(() => {
    events.push('timer');
    Promise.resolve().then(() => {
      events.push('timer:microtask');
      resolve();
    });
  }, 0);
  events.push('sync:end');
});
console.log(events.join(' > '));
