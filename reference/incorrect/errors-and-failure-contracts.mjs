export function runWithCleanup(operation, cleanup) {
  if (typeof operation !== 'function' || typeof cleanup !== 'function') {
    throw new TypeError('callbacks required');
  }
  try {
    return operation();
  } catch (reason) {
    const error = new Error('작업 실패');
    error.name = 'OperationError';
    error.code = 'OPERATION_FAILED';
    throw error;
  } finally {
    cleanup();
  }
}
