import http from 'node:http';
import { Buffer } from 'node:buffer';
import { TextDecoder } from 'node:util';

export function createProductServer({maxBodyBytes = 128} = {}) {
  // TODO: 아직 listen하지 않은 실제 http.Server를 반환하세요.
  // TODO: GET /products, GET /products?id=..., POST /lookup의 입력과 상태 코드를 분리하세요.
  // TODO: 본문 바이트 상한, 취소된 요청, 중복 응답, 요청 오류를 처리하세요.
}
