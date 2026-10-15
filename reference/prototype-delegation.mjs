export function createDelegationTypes() {
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
