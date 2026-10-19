import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function createTextStore(root, {writeContent = (handle,text)=>handle.writeFile(text,'utf8')} = {}) {
  if (root instanceof URL) root=fileURLToPath(root);
  return {
    readText(name) { return fs.readFile(path.resolve(root,name),'utf8'); },
    async writeText(name,text) {
      const handle=await fs.open(path.resolve(root,name),'w');
      try {await writeContent(handle,text);} finally {await handle.close();}
      return {bytes:text.length};
    }
  };
}
