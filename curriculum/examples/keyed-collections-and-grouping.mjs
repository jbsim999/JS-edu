const events = [{id:'a',category:'x',value:undefined},{id:'a',category:'y',value:'later'},{id:'b',category:'x',value:'B'}];
const byId = new Map();
const groups = new Map();
for (const event of events) {
  if (byId.has(event.id)) continue;
  byId.set(event.id,event.value);
  if (!groups.has(event.category)) groups.set(event.category,[]);
  groups.get(event.category).push(event.id);
}
console.log(JSON.stringify({size:byId.size,present:byId.has('a'),missing:byId.has('none'),valueType:typeof byId.get('a')}));
console.log(JSON.stringify([...groups]));
console.log(String(new Set([NaN,NaN,-0,0]).size));
const first = {name:'same'}, second = {name:'same'};
console.log(String(new Map([[first,'A'],[second,'B']]).size));
const allowed = new Set(['read','write']);
const requested = new Set(['write','delete']);
console.log(JSON.stringify([...requested].filter(value=>allowed.has(value))));
