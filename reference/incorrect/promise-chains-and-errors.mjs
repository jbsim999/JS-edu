export async function runCallbackPipeline(read, transform, save) {
  // 의도된 오답: 변환 결과를 체인에 반환하지 않아 저장이 원래 입력을 받습니다.
  const value = await new Promise((resolve, reject) => {
    read((error, result) => error ? reject(error) : resolve(result));
  });
  await transform(value);
  return save(value);
}
