// ES2015+ 기능을 ES2026 교재 기준에서 설명한다. console은 호스트 기능이다.
let defaultsEvaluated = 0;
function choose(value = (++defaultsEvaluated, 10)) { return value; }
console.log(choose(), choose(undefined), choose(null), defaultsEvaluated);
// 예상: 10 10 null 2

function summarize(values, {scale = 1, offset = 0, label = 'total'} = {}, ...tags) {
  let sum = 0;
  for (const value of values) sum += value;
  return {label, count: values.length, total: sum * scale + offset, tags};
}
const values = [4, 6];
const options = {scale: 0, offset: 2, label: ''};
console.log(JSON.stringify(summarize(values, options, 'report', 'zero')));
// 예상: {"label":"","count":2,"total":2,"tags":["report","zero"]}
console.log(JSON.stringify(values), JSON.stringify(options));
// 예상: [4,6] {"scale":0,"offset":2,"label":""}. 원본 값은 그대로다.
try { summarize([1], null); } catch (error) { console.log(error.name); }
// 예상: TypeError. null에 {} 기본값이 적용되지는 않는다.

const objectExpression = () => ({value: 3});
const blockWithoutReturn = () => { const value = 3; void value; };
console.log(objectExpression().value, blockWithoutReturn()); // 예상: 3 undefined
