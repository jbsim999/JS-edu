const root = document.getElementById(context.rootId);
const lifecycle = new AbortController();
const form = document.createElement('form');
const label = document.createElement('label');
const input = document.createElement('textarea');
const button = document.createElement('button');
input.id = context.rootId + '-example-text';
input.value = '한글 초안';
label.htmlFor = input.id;
label.textContent = '초안 내용';
button.type = 'submit';
button.textContent = '저장';
let calls = 0;
try {
  form.append(label, input, button);
  root.replaceChildren(form);
  form.addEventListener('submit', event => {
    event.preventDefault();
    console.log(JSON.stringify({text: input.value, label: input.labels[0].textContent}));
  }, {signal: lifecycle.signal});
  form.requestSubmit();
  input.addEventListener('click', () => { calls++; }, {signal: lifecycle.signal});
  input.click();
  lifecycle.abort();
  input.click();
  console.log(JSON.stringify({calls}));
} finally {
  lifecycle.abort();
  root.replaceChildren();
}
