// 브라우저 DOM 실행 전용. 전용 실행 origin의 iframe에서 실행한다. Node 실행 결과가 아니다.
function createProductClient(fetcher = fetch) {
  if (typeof fetcher !== 'function') throw new TypeError('Expected fetch function');
  const failure = (kind, status = null) => ({ ok: false, kind, status });
  return {
    async loadProducts(url = '/_fixtures/http/products', { signal } = {}) {
      if (signal?.aborted) return failure('aborted');
      let response;
      try {
        response = await fetcher(url, {
          method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' }, signal,
        });
      } catch (error) {
        return failure(signal?.aborted || error?.name === 'AbortError' ? 'aborted' : 'network');
      }
      if (signal?.aborted) return failure('aborted');
      if (!response.ok) return failure('http', response.status);
      let data;
      try {
        data = await response.json();
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') return failure('aborted');
        return error?.name === 'SyntaxError' ? failure('json', response.status) : failure('network');
      }
      if (signal?.aborted) return failure('aborted');
      const ids = new Set();
      if (!Array.isArray(data) || !data.every(item => {
        if (!item || typeof item.id !== 'string' || item.id.length === 0 || ids.has(item.id)
          || typeof item.name !== 'string' || item.name.length === 0
          || !Number.isSafeInteger(item.price) || item.price < 0) return false;
        ids.add(item.id);
        return true;
      })) return failure('schema', response.status);
      return { ok: true, status: response.status, items: data.map(({ id, name, price }) => ({ id, name, price })) };
    },
  };
}

// /_fixtures/http/*는 실행 origin이 제공하는 교육용 고정 응답이다.
const client=createProductClient((url,init)=>fetch(url,init));
for(const path of ['products','empty','not-found','invalid-json','invalid-schema']) {
  const result=await client.loadProducts('/_fixtures/http/'+path);
  console.log(JSON.stringify(result));
}
// 예상 순서:
// {"ok":true,"status":200,"items":[{"id":"p1","name":"Lemon","price":120},{"id":"p2","name":"Pistachio","price":230}]}
// {"ok":true,"status":200,"items":[]}
// {"ok":false,"kind":"http","status":404}
// {"ok":false,"kind":"json","status":200}
// {"ok":false,"kind":"schema","status":200}
