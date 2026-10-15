import { readOrder } from './reader.mjs';

// 공개 export는 이 팩터리 하나입니다. 시계·저장은 호출자로부터 받습니다.
export function createReceiptService(adapters) {
  // TODO: 의존성 검증 뒤 issue(order)를 가진 서비스를 반환하세요.
  // TODO: issue 호출 때 주문 검증 → now → 불변 영수증 생성 → persist 순서입니다.
}
