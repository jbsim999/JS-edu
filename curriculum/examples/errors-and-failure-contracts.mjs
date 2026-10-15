export function runWithCleanup(operation, cleanup) {
  if (typeof operation !== 'function' || typeof cleanup !== 'function') {
    throw new TypeError('operation and cleanup must be functions');
  }
  let value;
  let operationThrew = false;
  let operationReason;
  let cleanupThrew = false;
  let cleanupReason;
  try {
    value = operation();
  } catch (reason) {
    operationThrew = true;
    operationReason = reason;
  } finally {
    try {
      cleanup();
    } catch (reason) {
      cleanupThrew = true;
      cleanupReason = reason;
    }
  }
  if (operationThrew && cleanupThrew) {
    throw new AggregateError([operationReason, cleanupReason], '작업과 정리 실패', { cause: operationReason });
  }
  if (operationThrew) {
    const error = new Error('작업 실패', { cause: operationReason });
    error.name = 'OperationError';
    error.code = 'OPERATION_FAILED';
    throw error;
  }
  if (cleanupThrew) {
    const error = new Error('정리 실패', { cause: cleanupReason });
    error.name = 'CleanupError';
    error.code = 'CLEANUP_FAILED';
    throw error;
  }
  return value;
}

const calls = [];
console.log('success ' + runWithCleanup(() => { calls.push('operation'); return 42; }, () => { calls.push('cleanup'); }) + ' ' + calls.join('>'));
const primary = new Error('storage unavailable');
try { runWithCleanup(() => { throw primary; }, () => {}); }
catch (error) { console.log('primary ' + error.name + ' ' + (error.cause === primary)); }
try { runWithCleanup(() => { throw undefined; }, () => {}); }
catch (error) { console.log('arbitrary ' + error.name + ' ' + (Object.hasOwn(error, 'cause') && error.cause === undefined)); }
const secondary = new Error('close failed');
try { runWithCleanup(() => { throw primary; }, () => { throw secondary; }); }
catch (error) { console.log('combined ' + error.name + ' ' + (error.errors[0] === primary) + ' ' + (error.errors[1] === secondary)); }
try { runWithCleanup(() => 1, () => { throw secondary; }); }
catch (error) { console.log('cleanup ' + error.name + ' ' + (error.cause === secondary)); }
function replaced() {
  try { return 'work'; } finally { return 'cleanup'; }
}
console.log('finally replacement ' + replaced());
