export function createFunctionalTools(receiver) {
  return {
    pipe(...stages) {
      return function (input) {
        let value = input;
        for (const stage of stages) value = stage.call(receiver, value);
        return value;
      };
    },
    partial(fn, ...leading) {
      return function (...trailing) {
        return fn.apply(receiver, [...leading, ...trailing]);
      };
    },
    curry2(fn) {
      return first => second => fn.call(receiver, first, second);
    }
  };
}
