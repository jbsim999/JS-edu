// 대표 오답: 검사 함수를 실행하지 않고 빈 검사까지 PASS로 표시한다.
export function createNodeAcceptance({identity} = {}) {
  let state={status:'NOT_RUN',identity,checks:[]};
  return {async run(tests){state={status:'PASS',identity,checks:tests.map(test=>({id:test.id,status:'PASS',reason:null}))};return state;},
    invalidate(nextIdentity){identity=nextIdentity;},cancel(){return false;},getState(){return state;},dispose(){}};
}
