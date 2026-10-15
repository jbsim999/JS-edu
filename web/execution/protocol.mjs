export const runtimeProtocol = 'javascript-edu-worker-v1';
export const executionLimits = Object.freeze({ sourceBytes: 102400, timeoutMs: 2500, outputBytes: 65536, outputLines: 200, resultNodes: 4096, resultDepth: 32, cases: 100 });

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const featurePathPattern = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;

// Required feature paths identify callable platform APIs, not executable expressions.
export function missingRequiredFeatures(paths = [], realm = globalThis) {
  return paths.filter(path => {
    try {
      let value = realm;
      for (const segment of path.split('.')) {
        if (value === null || value === undefined) return true;
        const descriptor = Object.getOwnPropertyDescriptor(value, segment);
        if (!descriptor || !own(descriptor, 'value')) return true;
        value = descriptor.value;
      }
      return typeof value !== 'function';
    } catch { return true; }
  });
}

// This comparator runs only in the clean UI realm. Learner code never decides PASS.
export function equalBehaviorValue(actual, expected) {
  if (Object.is(actual, expected)) return true;
  if (actual === null || expected === null || typeof actual !== 'object' || typeof expected !== 'object') return false;
  if (Array.isArray(actual) !== Array.isArray(expected)) return false;
  if (Array.isArray(actual) && actual.length !== expected.length) return false;
  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);
  if (actualKeys.length !== expectedKeys.length) return false;
  return expectedKeys.every(key => own(actual, key) && equalBehaviorValue(actual[key], expected[key]));
}

export function isBehaviorValue(value) {
  let nodes = 0;
  let characters = 0;
  const ancestors = new Set();
  const visit = (item, depth) => {
    if (++nodes > executionLimits.resultNodes || depth > executionLimits.resultDepth) return false;
    if (item === null || item === undefined || typeof item === 'boolean' || typeof item === 'number') return true;
    if (typeof item === 'string') { characters += item.length; return characters <= executionLimits.outputBytes; }
    if (typeof item !== 'object' || ancestors.has(item)) return false;
    if (!Array.isArray(item) && ![Object.prototype, null].includes(Object.getPrototypeOf(item))) return false;
    ancestors.add(item);
    const keys = Object.keys(item);
    if (keys.length > executionLimits.resultNodes || (Array.isArray(item) && item.length > executionLimits.resultNodes)) return false;
    for (const key of keys) {
      characters += key.length;
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (characters > executionLimits.outputBytes || !descriptor || !own(descriptor, 'value') || !visit(descriptor.value, depth + 1)) return false;
    }
    ancestors.delete(item);
    return true;
  };
  return visit(value, 0);
}

export function validateGrader(grader, exercise) {
  if (!record(grader) || grader.exerciseId !== exercise.id || grader.contentRevision !== exercise.contentRevision || typeof exercise.graderRevision !== 'string' || !exercise.graderRevision || grader.graderRevision !== exercise.graderRevision) throw new Error('과제와 검사기의 개정 정보가 일치하지 않습니다.');
  if (!Array.isArray(grader.cases) || grader.cases.length === 0 || grader.cases.length > executionLimits.cases) throw new Error('제출 검사에는 1개 이상의 고정 행동 검사가 필요합니다.');
  const ids = new Set();
  const cases = grader.cases.map(item => {
    if (!record(item) || typeof item.id !== 'string' || !item.id || item.id.length > 100 || ids.has(item.id) || typeof item.label !== 'string' || typeof item.probe !== 'string' || !item.probe || item.probe.length > executionLimits.sourceBytes || !own(item, 'expected') || !isBehaviorValue(item.expected)) throw new Error('행동 검사 정의가 올바르지 않습니다.');
    ids.add(item.id);
    return Object.freeze({ id: item.id, label: item.label, probe: item.probe, expected: structuredClone(item.expected) });
  });
  return Object.freeze(cases);
}

export function validateExercise(exercise) {
  if (!record(exercise) || typeof exercise.id !== 'string' || !exercise.id || typeof exercise.contentRevision !== 'string' || !exercise.contentRevision) throw new Error('과제 ID와 교재 개정이 필요합니다.');
  if (exercise.requiredFeatures !== undefined && (!Array.isArray(exercise.requiredFeatures) || exercise.requiredFeatures.length > 32 || new Set(exercise.requiredFeatures).size !== exercise.requiredFeatures.length || exercise.requiredFeatures.some(path => typeof path !== 'string' || path.length > 200 || !featurePathPattern.test(path) || path.split('.').length > 8 || path.split('.').includes('__proto__')))) throw new Error('필수 기능은 중복 없는 API 경로 배열이어야 합니다.');
  const runner = exercise.runner;
  if (!record(runner) || runner.kind !== 'function-body' || typeof runner.exportName !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(runner.exportName) || !Array.isArray(runner.parameters) || runner.parameters.length > 16 || runner.parameters.some(parameter => typeof parameter !== 'string' || parameter.length > 200) || (runner.async !== undefined && typeof runner.async !== 'boolean') || (runner.generator !== undefined && typeof runner.generator !== 'boolean') || (runner.runProbe !== undefined && (typeof runner.runProbe !== 'string' || !runner.runProbe || runner.runProbe.length > executionLimits.sourceBytes))) throw new Error('지원하는 함수 본문 실행 계약이 필요합니다.');
  return exercise;
}

export function gradeWorkerResults(message, cases) {
  if (!record(message) || message.type !== 'complete' || message.status !== 'success' || !Array.isArray(message.results) || message.results.length !== cases.length || cases.length === 0) throw new Error('실행기가 반환한 검사 수가 고정 검사와 일치하지 않습니다.');
  return cases.map((item, index) => {
    const result = message.results[index];
    if (!record(result) || result.id !== item.id || typeof result.ok !== 'boolean' || (result.ok && (!own(result, 'actual') || !isBehaviorValue(result.actual))) || (!result.ok && (typeof result.error !== 'string' || result.error.length > 2000))) throw new Error('실행기가 반환한 검사 형식이 올바르지 않습니다.');
    if (!result.ok) return { id: item.id, label: item.label, passed: false, expected: item.expected, error: result.error };
    return { id: item.id, label: item.label, passed: equalBehaviorValue(result.actual, item.expected), actual: result.actual, expected: item.expected };
  });
}
