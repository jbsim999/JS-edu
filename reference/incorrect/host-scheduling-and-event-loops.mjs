export async function traceScheduling(record = () => {}) {
  // 의도된 오답: 기대 문자열만 동기적으로 기록해 실제 순서를 재현하지 않습니다.
  const events = ['sync:start','sync:end','promise','queued','nested','timer','timer:microtask'];
  for (const label of events) record(label);
  return events;
}
