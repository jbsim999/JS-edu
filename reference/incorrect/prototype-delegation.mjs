export function createDelegationTypes() {
  function BaseRecord(name) { this.name = name; this.events = []; }
  BaseRecord.prototype.record = function (message) { this.events.push(message); return this.events.length; };
  BaseRecord.prototype.describe = function () { return 'record:' + this.name; };
  function NamedRecord(name, tag) { this.name = name; this.tag = tag; }
  // 대표 오답: 부모 인스턴스를 prototype으로 써 events가 공유되고 constructor도 잘못 남는다.
  NamedRecord.prototype = new BaseRecord('prototype');
  NamedRecord.prototype.describe = function () { return BaseRecord.prototype.describe.call(this) + '#' + this.tag; };
  return { BaseRecord, NamedRecord };
}
