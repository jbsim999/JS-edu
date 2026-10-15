function resolveSettings(options, loadDefaults) {
  const retries = options?.retries;
  const ui = options?.ui;
  const enabled = ui?.enabled;
  const label = ui?.label;
  const needsDefaults = retries === null || retries === undefined
    || enabled === null || enabled === undefined
    || label === null || label === undefined;
  const defaults = needsDefaults ? loadDefaults() : undefined;
  return {
    retries: retries ?? defaults.retries,
    enabled: enabled ?? defaults.enabled,
    label: label ?? defaults.label,
  };
}

let loads = 0;
const loadDefaults = () => { loads++; return {retries:3,enabled:true,label:'기본'}; };
console.log(JSON.stringify(resolveSettings({retries:0,ui:{enabled:false,label:''}},loadDefaults)), loads);
// 예상: {"retries":0,"enabled":false,"label":""} 0
console.log(JSON.stringify(resolveSettings({ui:{enabled:false}},loadDefaults)), loads);
// 예상: {"retries":3,"enabled":false,"label":"기본"} 1
let index = 0;
const list = null;
console.log(list?.[index++], index);
// 예상: undefined 0. optional chain이 건너뛴 인덱스 식은 평가되지 않는다.
function brokenReturn() {
  return
    { ready: true };
}
console.log(brokenReturn());
// 예상: undefined. return 뒤 줄바꿈으로 반환 값이 사라진다.
// 예상 출력 주석은 제품 실행기 검증 기록을 대신하지 않는다.
