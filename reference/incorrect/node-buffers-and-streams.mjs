import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export async function aggregateNdjson(input, output, {maxLineBytes=1024,signal}={}) {
  let count=0; let total=0;
  const aggregate=new Transform({
    transform(chunk,encoding,callback) {
      try {
        for(const line of chunk.toString('utf8').split('\n').filter(Boolean)){
          const row=JSON.parse(line); count++; total+=Number(row.amount);
        }
        callback();
      } catch(error){callback(error);}
    },
    flush(callback) {this.push(JSON.stringify({count,total})+'\n');callback();}
  });
  await pipeline(input,aggregate,output);
  return {count,total};
}
