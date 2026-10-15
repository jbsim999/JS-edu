export function compareInvocations(callback, receiver, args) {
  const ordinary = callback(...args);
  const holder = {tag: 'method', callback};
  const method = holder.callback(...args);
  const byCall = callback.call(receiver, ...args);
  const apply = callback.apply(receiver, args);
  const boundCallback = callback.bind(receiver, ...args);
  const bound = boundCallback();
  const mapped = args.map(callback, receiver);
  return {ordinary, method, call: byCall, apply, bound, mapped};
}
