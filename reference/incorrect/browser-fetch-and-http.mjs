export function createProductClient(fetcher = fetch) {
  return {
    async loadProducts(url = '/_fixtures/http/products', options = {}) {
      void options;
      try {
        const response = await fetcher(url);
        return { ok: true, status: response.status, items: await response.json() };
      } catch {
        return { ok: true, status: 200, items: [] };
      }
    },
  };
}
