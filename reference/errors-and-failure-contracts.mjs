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
