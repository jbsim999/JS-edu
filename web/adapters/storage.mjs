// Inject browser localStorage or a desktop adapter with the same interface.
// Consumers must display persistence failures; this adapter does not hide them.
export function createStorage(storage, namespace) {
  if (!storage || !['getItem', 'setItem', 'removeItem'].every(key => typeof storage[key] === 'function')) {
    throw new TypeError('A getItem/setItem/removeItem adapter is required');
  }
  if (!namespace || typeof namespace !== 'string') throw new TypeError('namespace is required');
  const key = parts => `${namespace}:${JSON.stringify(parts)}`;
  const parts = value => {
    if (!value || !['lessonId', 'contentRevision', 'exerciseId', 'fileId'].every(id => typeof value[id] === 'string' && value[id])) {
      throw new TypeError('Draft identity requires lessonId/contentRevision/exerciseId/fileId');
    }
    return [value.lessonId, value.contentRevision, value.exerciseId, value.fileId];
  };
  return Object.freeze({
    readDraft: identity => storage.getItem(key(parts(identity))),
    writeDraft: (identity, value) => {
      if (typeof value !== 'string') throw new TypeError('Draft must be a string');
      storage.setItem(key(parts(identity)), value);
    },
    removeDraft: identity => storage.removeItem(key(parts(identity))),
  });
}
