import { Buffer } from 'node:buffer';
import { TextDecoder } from 'node:util';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const source='한글 🍋';
const bytes=Buffer.from(source);
const chunks=[...bytes].map(byte=>Buffer.from([byte]));
const decoder=new TextDecoder('utf-8',{fatal:true});
let restored='';
for(const chunk of chunks) restored+=decoder.decode(chunk,{stream:true});
restored+=decoder.decode();
// 예상 출력: {"bytes":11,"naiveMatches":false,"restored":"한글 🍋"}
console.log(JSON.stringify({bytes:bytes.length,naiveMatches:chunks.map(chunk=>chunk.toString()).join('')===source,restored}));
let text='';
const output=new Writable({write(chunk,encoding,done){text+=chunk.toString();done();}});
await pipeline(Readable.from(['a','b']),new Transform({transform(chunk,encoding,done){done(null,chunk.toString().toUpperCase());}}),output);
// 예상 출력: {"text":"AB","finished":true}
console.log(JSON.stringify({text,finished:output.writableFinished}));
