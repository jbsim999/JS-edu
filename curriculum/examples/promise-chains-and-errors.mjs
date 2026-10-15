const events = [];
const read = callback => { events.push('read'); callback(null, 4); };
const result = new Promise((resolve, reject) => {
  read((error, value) => error == null ? resolve(value) : reject(error));
}).then(value => {
  events.push('transform:' + value);
  return Promise.resolve(value * 3);
}).then(value => {
  events.push('save:' + value);
  return value;
});
events.push('caller');
console.log(events.join(' > '));
console.log('result', await result);
console.log(events.join(' > '));
const reason = new Error('broken');
let saved = false;
try {
  await Promise.resolve(1).then(() => { throw reason; }).then(() => { saved = true; });
} catch (error) { console.log('same-error', error === reason, 'saved', saved); }
console.log('first', await new Promise(resolve => { resolve({then(done){done(7);}}); resolve(99); }));
