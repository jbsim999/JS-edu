export function compareInvocations(callback, receiver, args) {
  // 대표 오답: 모든 호출을 같은 receiver에 바인딩해 차이를 지운다.
  const invoke = () => callback.apply(receiver, args);
  return {
    ordinary: invoke(), method: invoke(), call: invoke(), apply: invoke(), bound: invoke(),
    mapped: args.map(value => callback.call(receiver, value))
  };
}
