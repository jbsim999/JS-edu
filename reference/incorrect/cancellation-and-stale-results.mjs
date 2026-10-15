export async function createLatestController(loader, onCommit, onError) {
  // 의도된 오답: abort만 요청하고 오래된 완료를 검증하지 않습니다.
  let generation = 0;
  let active = null;
  return {
    async start(query) {
      generation++;
      active?.abort();
      const controller = new AbortController();
      active = controller;
      try {
        const value = await loader(query, controller.signal);
        onCommit(value, query);
        return 'committed';
      } catch (reason) {
        onError(reason, query);
        return 'failed';
      } finally { active = null; }
    },
    cancel() { generation++; active?.abort(); active = null; },
    getState() { return { generation, pending: active !== null }; }
  };
}
