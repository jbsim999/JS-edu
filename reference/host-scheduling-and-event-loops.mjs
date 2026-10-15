export async function traceScheduling(record = () => {}) {
  const events = [];
  const append = label => {
    events.push(label);
    record(label);
  };
  return new Promise(resolve => {
    append('sync:start');
    Promise.resolve().then(() => {
      append('promise');
      queueMicrotask(() => append('nested'));
    });
    queueMicrotask(() => append('queued'));
    setTimeout(() => {
      append('timer');
      Promise.resolve().then(() => {
        append('timer:microtask');
        resolve(events);
      });
    }, 0);
    append('sync:end');
  });
}
