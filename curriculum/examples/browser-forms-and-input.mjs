// 브라우저 DOM 실행 전용. 전용 실행 origin의 iframe에서 실행한다. Node 실행 결과가 아니다.
function mountSearchForm(form, onSearch, delay = 200) {
  const input = form?.querySelector('input[name="query"]');
  const error = form?.querySelector('[data-error]');
  if (!input || !error || !error.id || typeof onSearch !== 'function') throw new TypeError('Expected form controls and callback');
  if (!Number.isInteger(delay) || delay < 0 || delay > 60000) throw new RangeError('Invalid debounce delay');
  const originalNoValidate = form.noValidate;
  form.noValidate = true;
  const descriptions = new Set((input.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
  descriptions.add(error.id);
  input.setAttribute('aria-describedby', [...descriptions].join(' '));
  error.setAttribute('aria-live', 'polite');
  let disposed = false;
  let composing = false;
  let timer = null;
  function cancel() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }
  function validate(focusInvalid) {
    const query = input.value.trim();
    let message = query.length === 0 ? '검색어를 입력하세요.'
      : query.length > 40 ? '검색어는 40자 이내로 입력하세요.' : '';
    input.setCustomValidity(message);
    const valid = input.checkValidity();
    if (!valid && message === '') message = '입력 형식을 확인하세요.';
    error.textContent = message;
    input.setAttribute('aria-invalid', valid ? 'false' : 'true');
    if (!valid && focusInvalid) input.focus();
    return valid ? query : null;
  }
  function schedule() {
    cancel();
    const query = validate(false);
    if (query === null) return;
    timer = setTimeout(() => {
      timer = null;
      if (!disposed && !composing) onSearch(query);
    }, delay);
  }
  function onInput(event) {
    if (disposed) return;
    if (composing || event.isComposing) { cancel(); return; }
    schedule();
  }
  function onStart() { composing = true; cancel(); }
  function onEnd() { composing = false; if (!disposed) schedule(); }
  function onSubmit(event) {
    event.preventDefault();
    cancel();
    if (disposed || composing) return;
    const query = validate(true);
    if (query !== null) onSearch(query);
  }
  form.addEventListener('submit', onSubmit);
  input.addEventListener('input', onInput);
  input.addEventListener('compositionstart', onStart);
  input.addEventListener('compositionend', onEnd);
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel();
      form.removeEventListener('submit', onSubmit);
      input.removeEventListener('input', onInput);
      input.removeEventListener('compositionstart', onStart);
      input.removeEventListener('compositionend', onEnd);
      form.noValidate = originalNoValidate;
    },
  };
}

const form=document.createElement('form');const input=document.createElement('input');input.name='query';input.required=true;
const error=document.createElement('p');error.dataset.error='';error.id='example-query-error';const button=document.createElement('button');button.type='submit';button.textContent='검색';form.append(input,error,button);document.body.append(form);
const searches=[];const controller=mountSearchForm(form,value=>searches.push(value),10);
try {
  input.value='   ';form.dispatchEvent(new SubmitEvent('submit',{bubbles:true,cancelable:true}));
  console.log(JSON.stringify({count:searches.length,error:error.textContent,focused:document.activeElement===input}));
  // 예상: {"count":0,"error":"검색어를 입력하세요.","focused":true}
  input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.value='ㅎ';input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
  form.dispatchEvent(new SubmitEvent('submit',{bubbles:true,cancelable:true}));
  await new Promise(resolve=>setTimeout(resolve,30));
  console.log(JSON.stringify({duringComposition:searches.length}));
  // 예상: {"duringComposition":0}
  input.value='한글';input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'한글'}));input.dispatchEvent(new InputEvent('input',{bubbles:true}));
  await new Promise(resolve=>setTimeout(resolve,30));
  console.log(JSON.stringify({searches,error:error.textContent}));
  // 예상: {"searches":["한글"],"error":""}
} finally {controller.dispose();form.remove();}
