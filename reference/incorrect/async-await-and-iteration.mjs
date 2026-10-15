export async function collectPages(source, limit, mapPage = page => page) {
  // 의도된 오답: 변환은 기다리지만 limit와 사전 검증을 빠뜨립니다.
  const pages = [];
  for await (const page of source) pages.push(await mapPage(page, pages.length));
  return pages;
}
