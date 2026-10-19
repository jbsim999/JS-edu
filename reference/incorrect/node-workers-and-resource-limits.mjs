export function createSumPool() {
  return { submit: async values => values.reduce((sum, value) => sum + value, 0), close: async () => {}, stats: () => ({ state: 'open', active: 0, queued: 0, workers: 0 }) };
}
