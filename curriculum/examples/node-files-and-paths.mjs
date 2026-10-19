import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = await mkdtemp(path.join(tmpdir(), 'jsedu-files-example-'));
try {
  const file = path.join(root, '한글 노트.txt');
  // 이 예제는 writeFile 완료와 읽기를 확인한다. fsync나 전원 손실 내구성을 검증하지 않는다.
  await writeFile(pathToFileURL(file), '한글 🍋', 'utf8');
  // 예상 출력: {"text":"한글 🍋","bytes":11}
  console.log(JSON.stringify({text:await readFile(file,'utf8'),bytes:Buffer.byteLength('한글 🍋','utf8')}));
  // 예상 출력: {"inside":true,"outside":true}
  console.log(JSON.stringify({inside:!path.relative(root,file).startsWith('..'),outside:path.relative(root,path.join(root,'..','outside.txt')).startsWith('..')}));
  try { await readFile(path.join(root,'missing.txt'),'utf8'); }
  catch (error) {
    // 예상 출력: {"code":"ENOENT"}
    console.log(JSON.stringify({code:error.code}));
  }
} finally {
  await rm(root, {recursive:true,force:true});
}
