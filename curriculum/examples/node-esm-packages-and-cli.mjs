import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import format from './node-esm-packages-and-cli/format.cjs';

// 예상 출력: {"label":"summary","count":3,"total":10}
const values = [3, -1, 8];
console.log(format.formatSummary({label:format.defaultLabel,count:values.length,total:values.reduce((a,b)=>a+b,0)}).trimEnd());
// 예상 출력: {"roundTrip":true,"encoded":true}
const file = resolve('숫자 자료 #1.json');
const url = pathToFileURL(file);
console.log(JSON.stringify({roundTrip:fileURLToPath(url)===file,encoded:url.href.includes('%23')}));
// 예상 출력: ["--file","숫자 자료.json"]
console.log(JSON.stringify(['node','main.mjs','--file','숫자 자료.json'].slice(2)));
