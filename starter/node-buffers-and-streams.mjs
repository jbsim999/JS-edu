import { Buffer } from 'node:buffer';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { TextDecoder } from 'node:util';

export async function aggregateNdjson(input, output, {maxLineBytes = 1024, signal} = {}) {
  // TODO: 개행 바이트까지 조각을 모으고 줄 바이트 상한을 검사하세요.
  // TODO: 완성된 UTF-8 줄을 엄격하게 해석하고 안전한 정수 amount를 집계하세요.
  // TODO: 입력이 끝난 뒤 요약 JSON 한 줄만 출력하고 pipeline 완료·실패·취소를 기다리세요.
}
