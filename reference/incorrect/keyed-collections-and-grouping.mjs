export function indexEvents(events) {
  const byId = new Map();
  const groups = new Map();
  for (const event of events) {
    if (byId.get(event.id)) continue;
    byId.set(event.id, event.value);
    const category = String(event.category);
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(event);
  }
  return {byId, groups};
}
