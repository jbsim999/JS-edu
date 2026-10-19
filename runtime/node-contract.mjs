// Shared by Node and the browser; intentionally no filesystem-specific imports.
export function serializeNodeSource({ entry, files }) {
  if (typeof entry !== 'string' || files === null || typeof files !== 'object' || Array.isArray(files)) throw new TypeError('Node entry와 파일 목록이 필요합니다.');
  return JSON.stringify({ entry, files: Object.fromEntries(Object.keys(files).sort().map(name => [name, files[name]])) });
}
export const nodeProtocol = 'javascript-edu-node-v1';
export const nodePolicy = 'node-permission-v1:read-job:write-data-home:no-addons:no-child:nested-worker-opt-in:heap64';
export const nodeLimits = Object.freeze({ files: 16, fileBytes: 102400, totalBytes: 524288, bodyBytes: 800000, bodyTimeoutMs: 5000, active: 1, pending: 1, queue: 0, caseTimeoutMs: 2500, totalTimeoutMs: 15000, outputBytes: 65536, outputLines: 200, resultBytes: 262144, heapMb: 64, hardMemoryLimit: false, networkRestricted: false });
export const nodeLimitations = '자기 PC에서 Node.js 코드를 실행합니다. fs API의 허용 경로를 임시 실습 폴더로 설정하지만 Node Permission Model은 OS 보안 샌드박스가 아니며, 기존 파일 디스크립터·링크·네트워크 접근 전체를 격리하지 않습니다. 64MB는 JavaScript 힙 설정이며 전체 메모리의 강제 상한이 아닙니다. 하위 Worker를 허용한 과제에서는 Worker 실행 옵션으로 권한 제한을 벗어날 수 있습니다. 신뢰할 수 있는 학습 코드만 실행하세요.';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const byteLength = value => new TextEncoder().encode(value).byteLength;
const validPath = value => typeof value === 'string' && value.length <= 180 && /\.(mjs|cjs|json)$/.test(value) && value.split('/').every(part => /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(part) && !part.includes('..') && !/^__edu_/i.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));

export function validateNodeSnapshot(exercise, source) {
  if (!record(exercise) || !['id', 'contentRevision', 'graderRevision'].every(key => typeof exercise[key] === 'string' && exercise[key]) || exercise.runner?.kind !== 'module-files' || !validPath(exercise.runner.entry) || !/\.(mjs|cjs)$/.test(exercise.runner.entry) || exercise.workspace?.entry !== exercise.runner.entry || !Array.isArray(exercise.workspace.files) || !exercise.workspace.files.length || exercise.workspace.files.length > nodeLimits.files) throw new Error('고정 Node 모듈 과제 계약이 필요합니다.');
  if (exercise.nodeCapabilities !== undefined && (!record(exercise.nodeCapabilities) || Object.keys(exercise.nodeCapabilities).some(key => key !== 'allowWorker') || typeof exercise.nodeCapabilities.allowWorker !== 'boolean')) throw new Error('고정 Node capability 정의가 올바르지 않습니다.');
  if (exercise.nodeFixtures !== undefined) {
    const fixtures = exercise.nodeFixtures;
    if (!Array.isArray(fixtures) || fixtures.length > 16 || new Set(fixtures.map(item => item?.caseId)).size !== fixtures.length || fixtures.some(item => !record(item) || Object.keys(item).sort().join(',') !== 'caseId,kind' || !/^[a-z][a-z0-9-]{0,127}$/.test(item.caseId) || item.kind !== 'linked-directory')) throw new Error('고정 Node fixture 정의가 올바르지 않습니다.');
  }
  if (exercise.requiredFeatures !== undefined && (!Array.isArray(exercise.requiredFeatures) || exercise.requiredFeatures.length > 32 || new Set(exercise.requiredFeatures).size !== exercise.requiredFeatures.length || exercise.requiredFeatures.some(path => typeof path !== 'string' || path.length > 200 || !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(path) || path.split('.').length > 8 || path.split('.').includes('__proto__')))) throw new Error('Node 필수 API 경로가 올바르지 않습니다.');
  if (typeof exercise.runner.runProbe !== 'string' || !exercise.runner.runProbe.trim() || byteLength(exercise.runner.runProbe) > nodeLimits.fileBytes) throw new Error('고정 Node 실행 관찰이 필요합니다.');
  if (typeof source !== 'string' || byteLength(source) > nodeLimits.bodyBytes) throw new Error('Node 소스 크기가 제한을 넘었습니다.');
  let snapshot;
  try { snapshot = JSON.parse(source); } catch { throw new Error('Node 작업 공간 JSON을 읽지 못했습니다.'); }
  if (!record(snapshot) || Object.keys(snapshot).sort().join(',') !== 'entry,files' || !record(snapshot.files) || snapshot.entry !== exercise.runner.entry || source !== serializeNodeSource(snapshot) || Object.keys(snapshot.files).length !== exercise.workspace.files.length) throw new Error('정규화된 고정 Node 파일 snapshot이 필요합니다.');
  const names = new Set();
  let totalBytes = 0;
  for (const file of exercise.workspace.files) {
    if (!record(file) || !validPath(file.path) || names.has(file.path.toLowerCase()) || typeof file.source !== 'string' || typeof file.editable !== 'boolean' || !Object.hasOwn(snapshot.files, file.path) || typeof snapshot.files[file.path] !== 'string') throw new Error('Node 파일 목록·경로·대소문자가 올바르지 않습니다.');
    names.add(file.path.toLowerCase());
    const content = snapshot.files[file.path];
    if (!file.editable && content !== file.source) throw new Error(`읽기 전용 Node 파일입니다: ${file.path}`);
    const size = byteLength(content);
    totalBytes += size;
    if (size > nodeLimits.fileBytes || totalBytes > nodeLimits.totalBytes) throw new Error('Node 파일 크기가 제한을 넘었습니다.');
  }
  if (!Object.hasOwn(snapshot.files, exercise.runner.entry)) throw new Error('Node entry 파일이 없습니다.');
  return snapshot;
}

// HTTP JSON alone loses undefined, holes, -0 and nonfinite numbers. Encode only
// observation fields, and tag every value so learner object keys cannot collide.
export function encodeNodeValue(value) {
  if (value === undefined) return ['undefined'];
  if (typeof value === 'number') return ['number', Object.is(value, -0) ? '-0' : String(value)];
  if (value === null || ['string', 'boolean'].includes(typeof value)) return ['scalar', value];
  return [Array.isArray(value) ? 'array' : 'object', Array.isArray(value) ? value.length : null, Object.keys(value).map(key => [key, encodeNodeValue(value[key])])];
}

export function decodeNodeValue(encoded) {
  let nodes = 0;
  let characters = 0;
  const visit = (value, depth = 0) => {
    if (++nodes > 4096 || depth > 32 || !Array.isArray(value)) throw new Error('Node 관찰값 형식이 올바르지 않습니다.');
    if (value[0] === 'undefined' && value.length === 1) return undefined;
    if (value[0] === 'scalar' && value.length === 2 && (value[1] === null || ['string', 'boolean'].includes(typeof value[1]))) { if (typeof value[1] === 'string' && (characters += value[1].length) > 65536) throw new Error('Node 관찰 문자열이 제한을 넘었습니다.'); return value[1]; }
    if (value[0] === 'number' && value.length === 2 && typeof value[1] === 'string' && /^(?:NaN|[-]?Infinity|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?)$/i.test(value[1])) return Number(value[1]);
    if (!['array', 'object'].includes(value[0]) || value.length !== 3 || !Array.isArray(value[2]) || value[2].length > 4096 || (value[0] === 'array' && (!Number.isInteger(value[1]) || value[1] < 0 || value[1] > 4096))) throw new Error('Node 관찰값 항목이 올바르지 않습니다.');
    const output = value[0] === 'array' ? new Array(value[1]) : Object.create(null);
    for (const entry of value[2]) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || Object.hasOwn(output, entry[0]) || (value[0] === 'array' && entry[0] === 'length')) throw new Error('중복 Node 관찰값 키입니다.');
      characters += entry[0].length;
      if (characters > 65536 || (value[0] === 'array' && /^(?:0|[1-9][0-9]*)$/.test(entry[0]) && Number(entry[0]) >= value[1])) throw new Error('Node 관찰값 크기가 제한을 넘었습니다.');
      Object.defineProperty(output, entry[0], { value: visit(entry[1], depth + 1), enumerable: true, writable: true, configurable: true });
    }
    return output;
  };
  return visit(encoded);
}

export function nodeEnvironmentFingerprint(base, exercise) {
  return `${base}:nested-worker=${exercise?.nodeCapabilities?.allowWorker === true ? 1 : 0}:grader=${encodeURIComponent(exercise?.graderRevision ?? '')}`;
}
