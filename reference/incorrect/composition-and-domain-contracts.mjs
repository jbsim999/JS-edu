export function createCheckout(initialPolicy) {
  // 대표 오답: 생성 함수의 프로퍼티를 상태 저장소로 사용해 인스턴스 사이에 정책이 섞인다.
  createCheckout.sharedPolicy = initialPolicy;
  return {
    setPolicy(next) { createCheckout.sharedPolicy = next; },
    quote(amount) {
      const discount = createCheckout.sharedPolicy(amount);
      return { amount, discount, total: amount - discount };
    },
  };
}
