// 동기 호출의 완료 순서를 설명한다. 실제 파일·네트워크 자원은 사용하지 않는다.
const log = [];
function inner() { log.push('inner'); return 4; }
function outer() {
  log.push('outer:start');
  try {
    const value = inner();
    log.push('outer:value:' + value);
    return value;
  } finally {
    log.push('outer:cleanup');
  }
}
log.push('caller:value:' + outer());
console.log(JSON.stringify(log));
// ["outer:start","inner","outer:value:4","outer:cleanup","caller:value:4"]

function maskedFailure() {
  try { throw new Error('work'); }
  finally { return 'masked'; } // 고쳐야 하는 반례
}
console.log(maskedFailure()); // masked

function preserveFailure() {
  let failed = false;
  let failure;
  try { throw new Error('work'); }
  catch (error) { failed = true; failure = error; }
  finally {
    try { throw new Error('cleanup'); }
    catch (error) { if (!failed) { failed = true; failure = error; } }
  }
  if (failed) throw failure;
}
try { preserveFailure(); } catch (error) { console.log(error.message); } // work

function sumNested(values, maxDepth, depth = 0) {
  if (depth > maxDepth) throw new RangeError('Nesting limit exceeded');
  let total = 0;
  for (const value of values) {
    total += Array.isArray(value) ? sumNested(value, maxDepth, depth + 1) : value;
  }
  return total;
}
console.log(sumNested([1, [2, []], 3], 4)); // 6
try { sumNested([[[1]]], 1); } catch (error) { console.log(error.name); } // RangeError
