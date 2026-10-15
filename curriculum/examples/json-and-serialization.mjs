console.log(JSON.stringify({missing:undefined,nan:NaN,date:new Date('2026-01-01T00:00:00Z')}));
console.log(JSON.stringify([undefined,NaN]));
const cyclic={};cyclic.self=cyclic;
try { JSON.stringify(cyclic); } catch(error) { console.log(error.name); }
try { JSON.stringify({value:1n}); } catch(error) { console.log(error.name); }
console.log(String(JSON.parse('{"id":9007199254740993}').id));
console.log(JSON.parse('{"id":"9007199254740993"}').id);
const parsed=JSON.parse('{"version":2,"id":"1","count":0}');
console.log(parsed.version===1?'supported':'unsupported-version');
