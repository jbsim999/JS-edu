function createDelegationTypes() {
  function BaseRecord(name) {
    this.name = name;
    this.events = [];
  }
  BaseRecord.prototype.record = function record(message) {
    this.events.push(message);
    return this.events.length;
  };
  BaseRecord.prototype.describe = function describe() {
    return 'record:' + this.name;
  };
  function NamedRecord(name, tag) {
    BaseRecord.call(this, name);
    this.tag = tag;
  }
  NamedRecord.prototype = Object.create(BaseRecord.prototype, {
    constructor: { value: NamedRecord, writable: true, configurable: true, enumerable: false },
  });
  NamedRecord.prototype.describe = function describe() {
    return BaseRecord.prototype.describe.call(this) + '#' + this.tag;
  };
  return { BaseRecord, NamedRecord };
}

const { BaseRecord, NamedRecord } = createDelegationTypes();
const a = new NamedRecord('A','one');
const b = new NamedRecord('B','two');
a.record('saved');
console.log(JSON.stringify({a:a.describe(),b:b.describe(),aEvents:a.events,bEvents:b.events}));
// 예상: {"a":"record:A#one","b":"record:B#two","aEvents":["saved"],"bEvents":[]}
console.log(Object.getPrototypeOf(a) === NamedRecord.prototype, Object.getPrototypeOf(NamedRecord.prototype) === BaseRecord.prototype);
// 예상: true true
NamedRecord.prototype.constructor = function Other() {};
const c = new NamedRecord('C','three');
console.log(c instanceof NamedRecord, c.describe());
// 예상: true record:C#three. constructor 프로퍼티는 new의 실행 대상을 바꾸지 않는다.
console.log(BaseRecord.prototype.describe.call({name:'borrowed'}));
// 예상: record:borrowed
try { Date.prototype.getTime.call({}); } catch (error) { console.log(error.name); }
// 예상: TypeError. 모든 내장 메서드가 일반 객체에 빌려 쓸 수 있는 것은 아니다.
