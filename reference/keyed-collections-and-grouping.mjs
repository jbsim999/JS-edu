export function indexEvents(events) {
  const byId = new Map();
  const groups = new Map();
  for (const event of events) {
    if (byId.has(event.id)) continue;
    byId.set(event.id, event.value);
    if (!groups.has(event.category)) groups.set(event.category, []);
    groups.get(event.category).push({id: event.id, value: event.value});
  }
  return {byId, groups};
}
