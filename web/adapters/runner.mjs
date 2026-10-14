// An unavailable adapter is explicit. Never substitute example output for execution.
export function createUnavailableRunner(reason = '실제 실행기를 아직 구현하지 않았습니다.') {
  const environment = Object.freeze({ available: false, reason, actualRuntime: null });
  const reject = async () => { throw Object.assign(new Error(reason), { code: 'RUNNER_UNAVAILABLE' }); };
  return Object.freeze({
    getEnvironment: async () => environment,
    prepare: reject,
    run: reject,
    submit: reject,
    cancel: async () => ({ status: 'idle' }),
  });
}
