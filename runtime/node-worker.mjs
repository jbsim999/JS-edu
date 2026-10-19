import { parentPort, MessagePort } from 'node:worker_threads';

/* Trusted bootstrap: private port and primitives are captured before imports. */
(() => {
  'use strict';
  const protocol = 'javascript-edu-node-v1';
  const self = globalThis;
  const NativeFunction = Function;
  const NativeAsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const apply = Reflect.apply;
  const post = MessagePort.prototype.postMessage;
  const removeListener = parentPort.off;
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
  const stdout = process.stdout;
  const stderr = process.stderr;
  const writeStdout = stdout.write;
  const writeStderr = stderr.write;
  const nativeSetTimeout = setTimeout;
  const nativeSetInterval = setInterval;
  const nativeClearTimeout = clearTimeout;
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

  function initialize(configuration) {
    if (initialized || !configuration || configuration.protocol !== protocol || !configuration.port) return;
    initialized = true;
    apply(removeListener, parentPort, ['message', initialize]);
    const port = configuration.port;
    delete configuration.port;
    const context = Object.freeze(configuration.context);
    let finishing = false;
    const postResult = data => apply(post, port, [{ protocol, ...data }]);
    const send = data => {
      if (finishing) return;
      if (data.type !== 'complete') { postResult(data); return; }
      finishing = true;
      // Only hold the Worker after completion is known: an earlier ref would
      // change native idle/exit behavior (including node:test stream completion).
      // The supervisor receives the private result then explicitly terminates
      // this Worker. A timer carries no observation authority, unlike port.ref().
      apply(nativeSetInterval, undefined, [() => {}, 1000]);
      // Worker stdout uses a different internal port. A completion message may
      // overtake buffered writes, so flush both streams before parent termination.
      let pending = 2;
      let completed = false;
      let flushTimer;
      const complete = truncated => {
        if (completed) return;
        completed = true;
        apply(nativeClearTimeout, undefined, [flushTimer]);
        if (truncated) postResult({ type: 'output', stream: 'stderr', text: '', truncated: true });
        postResult(data);
      };
      // Learner mutation of Node's public MessagePort prototype can stop its
      // internal stdout acknowledgments. Preserve the private observation and
      // report that remaining output could not be confirmed.
      flushTimer = apply(nativeSetTimeout, undefined, [() => complete(true), 150]);
      const flush = (stream, write) => {
        let finished = false;
        const done = error => {
          if (finished) return;
          finished = true;
          if (error) postResult({ type: 'output', stream: 'stderr', text: '', truncated: true });
          if (--pending === 0) complete(false);
        };
        try { apply(write, stream, ['', done]); } catch (error) { done(error); }
      };
      flush(stdout, writeStdout);
      flush(stderr, writeStderr);
    };
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
        if (!process.permission?.has || !process.permission.has('fs.read', configuration.bridgePath) || !process.permission.has('fs.write', context.workspaceRoot) || process.permission.has('child') || process.permission.has('addons') || process.permission.has('worker') !== configuration.allowWorker) throw new NativeError('고정 Node 실행 권한을 확인하지 못했습니다.');
        if (configuration.mode === 'prepare') {
          new NativeFunction('return 1')();
          send({ type: 'complete', status: 'ready' });
          return;
        }
        probes = new NativeArray(configuration.cases.length);
        for (let index = 0; index < configuration.cases.length; index++) define(probes, index, { value: new NativeAsyncFunction('submission', 'observe', 'context', `'use strict';\n${configuration.cases[index].probe}`), writable: false });
        runProbe = new NativeAsyncFunction('submission', 'observe', 'context', `'use strict';\n${configuration.runProbe}`);
      } catch (error) { send({ type: 'complete', status: 'infrastructure-error', error: errorText(error) }); return; }
      let submission;
      try {
        // Import a server-authored namespace wrapper, never the learner namespace
        // directly: an entry export named `then` must not be Promise-assimilated.
        const bridge = await import(configuration.bridgeUrl);
        submission = bridge.submission;
      } catch (error) {
        // Native import rejection does not reliably separate parsing, dependency
        // linking and top-level evaluation (which may itself throw SyntaxError).
        send({ type: 'complete', status: 'module-load-error', error: errorText(error) });
        return;
      }
      if (configuration.mode === 'run') {
        const observation = createObservation({ nodes: 0, characters: 0 });
        let completion;
        let executionError;
        let executionFailed = false;
        try { completion = await apply(runProbe, undefined, [submission, observation.accept, context]); }
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
        try { completion = await apply(probes[index], undefined, [submission, observation.accept, context]); }
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
  parentPort.on('message', initialize);
})();
