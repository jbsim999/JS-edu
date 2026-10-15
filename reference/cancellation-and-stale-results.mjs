export async function createLatestController(loader, onCommit, onError) {
  let generation = 0;
  let active = null;
  return {
    async start(query) {
      const ownGeneration = ++generation;
      const previous = active;
      const controller = new AbortController();
      active = controller;
      previous?.abort();
      try {
        const value = await loader(query, controller.signal);
        if (ownGeneration !== generation || controller.signal.aborted) return 'stale';
        onCommit(value, query);
        return 'committed';
      } catch (reason) {
        if (ownGeneration !== generation || controller.signal.aborted) return 'stale';
        onError(reason, query);
        return 'failed';
      } finally {
        if (ownGeneration === generation && active === controller) active = null;
      }
    },
    cancel() {
      generation++;
      const previous = active;
      active = null;
      previous?.abort();
    },
    getState() {
      return { generation, pending: active !== null };
    }
  };
}
