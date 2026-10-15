import { readCount, readReady, initialCount, evaluationTrace } from './reader.mjs';

export let count = 0;
export let ready = 'pending';
// TODO: before-await 기록, initialCount를 top-level await, ready 변경, after-await 기록.
export function add(delta = 1) {
  // TODO: 유한한 숫자만 허용하고 공개 count 바인딩을 갱신하세요.
}
export function snapshot() {
  // TODO: 현재 값과 reader의 관찰, 초기화 기록 복사본을 반환하세요.
}
