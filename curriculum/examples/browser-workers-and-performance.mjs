const values = [1, 2, 3];
const worker = new Worker(context.workerBase + 'sum.js');
let timer;
try {
  const started = performance.now();
  const result = await new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Worker response timed out')), 2000);
    worker.onmessage = event => resolve(event.data);
    worker.onerror = event => reject(new Error(event.message));
    worker.postMessage({requestId: 1, values});
  });
  const elapsedMs = performance.now() - started;
  // elapsedMs는 성능 도구에서 관찰한다. 환경마다 달라 고정 예상 출력에는 넣지 않는다.
  console.log(JSON.stringify({sum: result.sum, input: values}));
  const source = new ArrayBuffer(4);
  const target = structuredClone(source, {transfer: [source]});
  console.log(JSON.stringify({sourceBytes: source.byteLength, targetBytes: target.byteLength}));
} finally {
  clearTimeout(timer);
  worker.terminate();
}
