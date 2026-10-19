import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export async function createTextStore(root, {
  writeContent = (handle, text) => handle.writeFile(text, 'utf8')
} = {}) {
  // TODO: 정규화한 실제 root와 상대 이름을 검증하세요.
  // TODO: readText(name), writeText(name,text)를 가진 저장소를 반환하세요.
  // TODO: 임시 파일 → writeContent → close → rename, 실패 시 close와 임시 파일 정리.
}
