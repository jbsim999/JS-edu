export function createDraftStorage(storage, prefix, identity) {
  const key = prefix + 'draft:' + identity.lessonId;
  return {
    key,
    load(currentInput) { const raw = storage.getItem(key); return raw === null ? {status: 'empty', text: currentInput, sequence: 0} : {status: 'loaded', text: JSON.parse(raw).text, sequence: 1}; },
    save(text) { storage.setItem(key, JSON.stringify({text})); return {status: 'saved', text, sequence: 1}; },
    migrateFrom(oldRevision, currentInput) { return {status: 'empty', text: currentInput, sequence: 0}; }
  };
}
