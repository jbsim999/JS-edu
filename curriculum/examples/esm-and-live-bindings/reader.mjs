import { count, ready } from './main.mjs';

// 순환 그래프를 연결할 때 아직 초기화되지 않은 바인딩은 읽지 않습니다.
export const evaluationTrace = ['reader:evaluated'];
export const initialCount = new Promise(resolve => setTimeout(() => { evaluationTrace.push('reader:initial-resolved'); resolve(4); }, 0));
export function readCount() { return count; }
export function readReady() { return ready; }
