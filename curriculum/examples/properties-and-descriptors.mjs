function selectOwnData(source, allowedKeys) {
  const values = Object.create(null);
  const missing = [];
  const undefinedKeys = [];
  const rejected = [];
  for (const key of allowedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (descriptor === undefined) {
      missing.push(key);
    } else if (!Object.hasOwn(descriptor, 'value')) {
      rejected.push({ key, reason: 'accessor' });
    } else if (!descriptor.enumerable) {
      rejected.push({ key, reason: 'non-enumerable' });
    } else {
      Object.defineProperty(values, key, {
        value: descriptor.value, enumerable: true, writable: true, configurable: true,
      });
      if (descriptor.value === undefined) undefinedKeys.push(key);
    }
  }
  return { values, missing, undefinedKeys, rejected };
}

let reads = 0;
const source = Object.create({ inherited: '외부' });
Object.assign(source, { name: '준보', unset: undefined });
Object.defineProperty(source, 'secret', { value: '비열거', enumerable: false });
Object.defineProperty(source, 'computed', { get() { reads++; return '계산'; }, enumerable: true });
const result = selectOwnData(source, ['name','unset','inherited','secret','computed','missing']);
console.log(JSON.stringify({ keys:Object.keys(result.values),missing:result.missing,undefinedKeys:result.undefinedKeys,rejected:result.rejected,reads }));
// 예상: {"keys":["name","unset"],"missing":["inherited","missing"],"undefinedKeys":["unset"],"rejected":[{"key":"secret","reason":"non-enumerable"},{"key":"computed","reason":"accessor"}],"reads":0}
const descriptor = Object.getOwnPropertyDescriptor(source, 'computed');
console.log(typeof descriptor.get, reads);
// 예상: function 0. descriptor를 읽는 것은 getter 실행과 다르다.
console.log(source.computed, reads);
// 예상: 계산 1. 일반 프로퍼티 읽기는 getter를 실행한다.
