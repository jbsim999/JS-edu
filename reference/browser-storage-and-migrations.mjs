export function createDraftStorage(storage, prefix, identity) {
  if (typeof prefix !== 'string' || !prefix.startsWith('javascript-edu-dom:')) throw new TypeError('Invalid prefix');
  const {lessonId, contentRevision, fileId} = identity;
  if (![lessonId, contentRevision, fileId].every(value => typeof value === 'string' && value.length > 0)) throw new TypeError('Invalid identity');
  const keyFor = revision => prefix + 'draft:' + JSON.stringify([lessonId, revision, fileId]);
  const key = keyFor(contentRevision);
  const result = (status, text, sequence = 0) => ({status, text, sequence});
  const textInput = text => { if (typeof text !== 'string') throw new TypeError('Text must be a string'); };
  function inspect(raw, revision, version) {
    if (raw === null) return {kind: 'empty'};
    let record;
    try { record = JSON.parse(raw); } catch { return {kind: 'corrupt'}; }
    if (!record || typeof record !== 'object' || Array.isArray(record) || !Number.isInteger(record.schemaVersion)) return {kind: 'corrupt'};
    if (record.schemaVersion !== version) return {kind: 'unsupported'};
    if (record.lessonId !== lessonId || record.contentRevision !== revision || record.fileId !== fileId) return {kind: 'corrupt'};
    if (version === 2 && (!Number.isSafeInteger(record.sequence) || record.sequence < 1 || typeof record.text !== 'string')) return {kind: 'corrupt'};
    if (version === 1 && typeof record.code !== 'string') return {kind: 'corrupt'};
    return {kind: 'ready', record};
  }
  const envelope = (text, sequence) => ({schemaVersion: 2, lessonId, contentRevision, fileId, sequence, text});
  return {
    key,
    load(currentInput) {
      textInput(currentInput);
      try {
        const found = inspect(storage.getItem(key), contentRevision, 2);
        return found.kind === 'ready' ? result('loaded', found.record.text, found.record.sequence) : result(found.kind, currentInput);
      } catch { return result('unavailable', currentInput); }
    },
    save(text, expectedSequence) {
      textInput(text);
      if (!Number.isSafeInteger(expectedSequence) || expectedSequence < 0) throw new TypeError('Invalid sequence');
      try {
        const found = inspect(storage.getItem(key), contentRevision, 2);
        if (!['empty', 'ready'].includes(found.kind)) return result(found.kind, text);
        const sequence = found.kind === 'ready' ? found.record.sequence : 0;
        if (sequence !== expectedSequence) return result('conflict', text, sequence);
        if (!Number.isSafeInteger(sequence + 1)) return result('corrupt', text);
        storage.setItem(key, JSON.stringify(envelope(text, sequence + 1)));
        return result('saved', text, sequence + 1);
      } catch { return result('unavailable', text, expectedSequence); }
    },
    migrateFrom(oldRevision, currentInput) {
      textInput(currentInput);
      if (typeof oldRevision !== 'string' || oldRevision.length === 0 || oldRevision === contentRevision) throw new TypeError('Invalid old revision');
      try {
        const current = inspect(storage.getItem(key), contentRevision, 2);
        if (current.kind === 'ready') return result('conflict', currentInput, current.record.sequence);
        if (current.kind !== 'empty') return result(current.kind, currentInput);
        const old = inspect(storage.getItem(keyFor(oldRevision)), oldRevision, 1);
        if (old.kind !== 'ready') return result(old.kind, currentInput);
        storage.setItem(key, JSON.stringify(envelope(old.record.code, 1)));
        return result('migrated', old.record.code, 1);
      } catch { return result('unavailable', currentInput); }
    }
  };
}
