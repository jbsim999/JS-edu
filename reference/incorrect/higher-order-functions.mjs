export function createFunctionalTools(receiver) {
  // 대표 오답: 호출 순서를 뒤집고 부분 인수를 호출 사이에 누적한다.
  return {
    pipe(...stages) {
      return input => {
        let value = input;
        for (let index = stages.length - 1; index >= 0; index--) value = stages[index](value);
        return value;
      };
    },
    partial(fn, ...leading) {
      return (...trailing) => {
        leading.push(...trailing);
        return fn.apply(receiver, leading);
      };
    },
    curry2(fn) {
      return first => second => fn.call(receiver, second, first);
    }
  };
}
