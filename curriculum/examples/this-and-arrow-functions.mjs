// .mjs / strict 예제. 브라우저 script나 CommonJS 전역 실행 기록이 아니다.
function read() { return this === undefined ? 'unbound' : this.tag; }
const account = {tag: 'account', read};
const fn = account.read;
console.log(account.read(), fn(), fn.call({tag: 'other'})); // account unbound other
function label(prefix, value) { return prefix + ':' + this.tag + ':' + value; }
const bound = label.bind({tag: 'fixed'}, 'item');
console.log(bound('A')); // item:fixed:A

function makeArrow() { return () => this.tag; }
const arrow = makeArrow.call({tag: 'outer'});
console.log(arrow.call({tag: 'inner'})); // outer
console.log(JSON.stringify([1, 2].map(function (value) { return this.factor * value; }, {factor: 3})));
// [3,6]

function Item(name) { this.name = name; }
const ignored = {tag: 'ignored'};
const BoundItem = Item.bind(ignored, 'new-name');
const item = new BoundItem();
console.log(item.name, ignored.name); // new-name undefined
try { new arrow(); } catch (error) { console.log(error.name); } // TypeError
