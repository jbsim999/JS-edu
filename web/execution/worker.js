/* Classic Dedicated Worker: no imports. Its response CSP permits eval, not network or child workers. */
(() => {
  'use strict';
  const protocol = 'javascript-edu-worker-v1';
  const NativeFunction = Function;
  const NativeAsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const apply = Reflect.apply;
  const post = MessagePort.prototype.postMessage;
  const removeListener = self.removeEventListener;
  const define = Object.defineProperty;
  const getDescriptor = Object.getOwnPropertyDescriptor;
  const getPrototype = Object.getPrototypeOf;
  const objectPrototype = Object.prototype;
  const objectKeys = Object.keys;
  const objectCreate = Object.create;
  const isArray = Array.isArray;
  const NativeArray = Array;
  const NativeString = String;
  const NativeError = Error;
  const slice = String.prototype.slice;
  const split = String.prototype.split;
  const join = Array.prototype.join;
  const stringify = JSON.stringify;
  const maximum = Math.max;
  const encode = TextEncoder.prototype.encode;
  const decode = TextDecoder.prototype.decode;
  const byteSlice = Uint8Array.prototype.slice;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let initialized = false;

  function featureDataProperty(value, key) {
    try {
      for (let depth = 0; depth < 16 && value !== null && value !== undefined; depth++) {
        const descriptor = getDescriptor(value, key);
        if (descriptor) return getDescriptor(descriptor, 'value') ? descriptor.value : undefined;
        value = getPrototype(value);
      }
    } catch { /* Unreadable descriptors are unsupported, not invoked. */ }
    return undefined;
  }

  function initialize(event) {
    if (initialized || !event.data || event.data.protocol !== protocol || !event.ports || event.ports.length !== 1) return;
    initialized = true;
    apply(removeListener, self, ['message', initialize]);
    const configuration = event.data;
    const port = event.ports[0];
    const send = data => apply(post, port, [{ protocol, ...data }]);
    const limits = configuration.limits;
    let outputBytes = 0;
    let outputLines = 0;
    let truncated = false;
    const streams = { stdout: 0, stderr: 0 };
    let formattingTruncated = false;

    const short = (text, size) => apply(slice, text, [0, size]);
    function errorText(error) {
      try {
        if (typeof error === 'string') return short(error, 2000) || '학습 코드에서 오류가 발생했습니다.';
        const message = error && getDescriptor(error, 'message');
        if (message && typeof message.value === 'string') return short(message.value, 2000) || '학습 코드에서 오류가 발생했습니다.';
      } catch { /* Hostile thrown objects must not hide the original failure. */ }
      return '학습 코드에서 오류가 발생했습니다.';
    }
    function copyValue(value, budget = { nodes: 0, characters: 0 }, depth = 0, ancestors = []) {
      if (++budget.nodes > limits.resultNodes || depth > limits.resultDepth) throw new NativeError('실행 결과가 크기 또는 깊이 제한을 넘었습니다.');
      if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') return value;
      if (typeof value === 'string') {
        budget.characters += value.length;
        if (budget.characters > limits.outputBytes) throw new NativeError('실행 결과 문자열이 제한을 넘었습니다.');
        return value;
      }
      if (typeof value !== 'object') throw new NativeError('검사 결과는 원시값·배열·데이터 객체여야 합니다.');
      for (let index = 0; index < ancestors.length; index++) if (ancestors[index] === value) throw new NativeError('순환 참조는 검사 결과로 반환할 수 없습니다.');
      const keys = objectKeys(value);
      const array = isArray(value);
      if (!array && getPrototype(value) !== objectPrototype && getPrototype(value) !== null) throw new NativeError('검사 결과 객체의 종류를 지원하지 않습니다.');
      if (keys.length > limits.resultNodes || (array && value.length > limits.resultNodes)) throw new NativeError('실행 결과 항목 수가 제한을 넘었습니다.');
      const output = array ? new NativeArray(value.length) : objectCreate(null);
      const nextAncestors = new NativeArray(ancestors.length + 1);
      for (let index = 0; index < ancestors.length; index++) define(nextAncestors, index, { value: ancestors[index], enumerable: true, writable: true, configurable: true });
      define(nextAncestors, ancestors.length, { value, enumerable: true, writable: true, configurable: true });
      for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        budget.characters += key.length;
        const descriptor = getDescriptor(value, key);
        if (budget.characters > limits.outputBytes || !descriptor || !getDescriptor(descriptor, 'value')) throw new NativeError('접근자 또는 너무 큰 결과는 검사할 수 없습니다.');
        define(output, key, { value: copyValue(descriptor.value, budget, depth + 1, nextAncestors), enumerable: true, configurable: true, writable: true });
      }
      return output;
    }
    function display(value) {
      if (typeof value === 'string') {
        if (value.length > limits.outputBytes) formattingTruncated = true;
        return short(value, limits.outputBytes);
      }
      if (value === undefined) return 'undefined';
      if (typeof value === 'function') return '[Function]';
      if (typeof value === 'symbol') return '[Symbol]';
      if (typeof value !== 'object' || value === null) return NativeString(value);
      try { return stringify(copyValue(value)); } catch { return '[표시할 수 없는 객체]'; }
    }
    function log(stream, values) {
      if (truncated) return;
      formattingTruncated = false;
      const parts = new NativeArray(values.length);
      for (let index = 0; index < values.length; index++) define(parts, index, { value: display(values[index]), enumerable: true, writable: true, configurable: true });
      const joined = apply(join, parts, [' ']);
      if (joined.length > limits.outputBytes) formattingTruncated = true;
      let text = short(joined, limits.outputBytes);
      const originalLength = text.length;
      const lines = apply(split, text, ['\n']);
      const availableLines = limits.outputLines - outputLines;
      if (lines.length > availableLines) { lines.length = availableLines; text = apply(join, lines, ['\n']); truncated = true; }
      const bytes = apply(encode, encoder, [text]);
      const separatorBytes = streams[stream] > 0 ? 1 : 0;
      const availableBytes = maximum(0, limits.outputBytes - outputBytes - separatorBytes);
      if (bytes.byteLength > availableBytes) {
        text = apply(decode, decoder, [apply(byteSlice, bytes, [0, availableBytes])]);
        // A split UTF-8 character decodes to U+FFFD, which can exceed the remaining bytes.
        while (apply(encode, encoder, [text]).byteLength > availableBytes) text = apply(slice, text, [0, -1]);
        truncated = true;
      }
      if (formattingTruncated || text.length < originalLength || outputLines >= limits.outputLines || outputBytes >= limits.outputBytes) truncated = true;
      if (text || !truncated) {
        outputBytes += apply(encode, encoder, [text]).byteLength + separatorBytes;
        outputLines += apply(split, text, ['\n']).length;
        streams[stream]++;
      }
      send({ type: 'output', stream, text, truncated });
    }
    const capturedConsole = objectCreate(null);
    for (const method of ['log', 'info', 'debug', 'warn', 'error', 'dir', 'table']) define(capturedConsole, method, { value: (...values) => log(method === 'warn' || method === 'error' ? 'stderr' : 'stdout', values), enumerable: true });
    define(capturedConsole, 'assert', { value: (condition, ...values) => { if (!condition) log('stderr', ['Assertion failed:', ...values]); }, enumerable: true });
    define(self, 'console', { value: capturedConsole, writable: false, configurable: false });

    function createObservation(budget) {
      let count = 0;
      let snapshot;
      let snapshotError;
      const observer = objectCreate(null);
      observer.accept = value => {
        count++;
        if (count === 1) {
          try { snapshot = copyValue(value, budget); }
          catch (error) { snapshotError = error; throw error; }
        }
      };
      observer.finish = (completion, executionError, executionFailed) => {
        const result = objectCreate(null);
        // Observations cross the boundary before Promise resolution can assimilate
        // an inherited learner-provided `then`. The async probe returns only void.
        if (count > 1 || (!executionFailed && (count !== 1 || completion !== undefined))) {
          result.contractError = '고정 검사는 observe(actual)를 정확히 한 번 호출하고 값을 반환하지 않아야 합니다.';
        } else if (snapshotError || executionFailed) {
          result.error = errorText(snapshotError || executionError);
        } else {
          result.actual = snapshot;
        }
        return result;
      };
      return observer;
    }

    async function execute() {
      let probes;
      let runProbe;
      try {
        const missingFeatures = [];
        const requiredFeatures = configuration.requiredFeatures || [];
        for (let index = 0; index < requiredFeatures.length; index++) {
          const path = requiredFeatures[index];
          const segments = apply(split, path, ['.']);
          let value = self;
          for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
            value = featureDataProperty(value, segments[segmentIndex]);
          }
          if (typeof value !== 'function') define(missingFeatures, missingFeatures.length, { value: path, enumerable: true, writable: true, configurable: true });
        }
        if (missingFeatures.length > 0) {
          send({ type: 'complete', status: 'infrastructure-error', missingFeatures, error: `이 과제에 필요한 Worker 기능을 지원하지 않습니다: ${apply(join, missingFeatures, [', '])}` });
          return;
        }
        if (configuration.mode === 'prepare') {
          new NativeFunction('return 1')();
          send({ type: 'complete', status: 'ready' });
          return;
        }
        probes = new NativeArray(configuration.cases.length);
        for (let index = 0; index < configuration.cases.length; index++) define(probes, index, { value: new NativeAsyncFunction('submission', 'observe', `'use strict';\n${configuration.cases[index].probe}`), writable: false });
        runProbe = new NativeAsyncFunction('submission', 'observe', `'use strict';\n${configuration.runProbe}`);
      } catch (error) { send({ type: 'complete', status: 'infrastructure-error', error: errorText(error) }); return; }
      let factory;
      try {
        const runner = configuration.runner;
        // The outer strict scope allows default parameters without an illegal inner directive.
        const parameters = apply(join, runner.parameters, [', ']);
        factory = new NativeFunction(`'use strict';\nreturn { ${runner.exportName}: ${runner.async ? 'async ' : ''}function${runner.generator ? '*' : ''} ${runner.exportName}(${parameters}) {\n${configuration.source}\n} };`);
      } catch (error) { send({ type: 'complete', status: 'compilation-error', error: errorText(error) }); return; }
      let submission;
      try { submission = apply(factory, undefined, []); }
      catch (error) { send({ type: 'complete', status: 'runtime-error', error: errorText(error) }); return; }
      if (configuration.mode === 'run') {
        const observation = createObservation({ nodes: 0, characters: 0 });
        let completion;
        let executionError;
        let executionFailed = false;
        try { completion = await apply(runProbe, undefined, [submission, observation.accept]); }
        catch (error) { executionError = error; executionFailed = true; }
        const result = observation.finish(completion, executionError, executionFailed);
        if (result.contractError) send({ type: 'complete', status: 'infrastructure-error', error: result.contractError });
        else if (result.error) send({ type: 'complete', status: 'runtime-error', error: result.error });
        else send({ type: 'complete', status: 'success', runValue: result.actual });
        return;
      }
      const results = new NativeArray(probes.length);
      const resultBudget = { nodes: 0, characters: 0 };
      for (let index = 0; index < probes.length; index++) {
        const id = configuration.cases[index].id;
        const observation = createObservation(resultBudget);
        let completion;
        let executionError;
        let executionFailed = false;
        try { completion = await apply(probes[index], undefined, [submission, observation.accept]); }
        catch (error) { executionError = error; executionFailed = true; }
        const observed = observation.finish(completion, executionError, executionFailed);
        if (observed.contractError) { send({ type: 'complete', status: 'infrastructure-error', error: observed.contractError }); return; }
        const result = observed.error ? { id, ok: false, error: observed.error } : { id, ok: true, actual: observed.actual };
        define(results, index, { value: result, enumerable: true, writable: false });
      }
      send({ type: 'complete', status: 'success', results });
    }
    void execute();
  }
  self.addEventListener('message', initialize);
})();
