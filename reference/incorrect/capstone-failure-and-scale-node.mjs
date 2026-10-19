import { queryProducts } from './reader/core.mjs';

// 대표 오답: Promise.all로 전부 시작하며 취소·상한·실패 분류를 생략한다.
export function createNodeQueryBatch({load = async()=>[], now = ()=>0} = {}) {
  return { async run(tasks) {
    const results = await Promise.all(tasks.map(async task=>({id:task.id,status:'fulfilled',report:queryProducts(await load(task,{}))})));
    return {status:'done',runId:1,results,metrics:{started:tasks.length,active:0,elapsedMs:now()}};
  }, cancel(){return false;}, getState(){return {status:'idle',active:0};}, dispose(){} };
}
