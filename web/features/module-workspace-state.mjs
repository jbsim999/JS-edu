import { serializeModuleSource, validateModuleSnapshot } from "../execution/module-runner.mjs";
import { serializeNodeSource, validateNodeSnapshot } from "../../runtime/node-contract.mjs";

export function moduleSourceContract(exercise) {
  return exercise?.profileId === "node-native"
    ? { serialize: serializeNodeSource, validate: validateNodeSnapshot }
    : { serialize: serializeModuleSource, validate: validateModuleSnapshot };
}

// The shared draft adapter owns persistence and its failure states. This wrapper
// adds a fixed, revision-bound file manifest; read-only sources never read drafts.
export function createModuleWorkspaceState({ exercise, workspaceState, lessonId, contentRevision }) {
  if (typeof lessonId !== "string" || !lessonId || typeof contentRevision !== "string" || !contentRevision
    || exercise?.contentRevision !== contentRevision || (exercise.lessonId && exercise.lessonId !== lessonId)) {
    throw new TypeError("모듈 초안의 수업과 교재 개정이 일치해야 합니다.");
  }
  if (!["load", "update", "save", "reset"].every(key => typeof workspaceState?.[key] === "function")) {
    throw new TypeError("파일별 초안을 저장할 작업 공간이 필요합니다.");
  }
  const definition = structuredClone(exercise);
  const sourceContract = moduleSourceContract(definition);
  const initialSource = sourceContract.serialize({ entry: definition.workspace?.entry,
    files: Object.fromEntries((definition.workspace?.files || []).map(file => [file.path, file.source])) });
  sourceContract.validate(definition, initialSource);
  const files = Object.freeze(definition.workspace.files.map(file => Object.freeze({
    path: file.path, source: file.source, editable: file.editable, entry: file.path === definition.workspace.entry,
  })));
  const byPath = new Map(files.map(file => [file.path, file]));
  const identities = new Map(files.map(file => [file.path, Object.freeze({
    lessonId, contentRevision, exerciseId: definition.id, fileId: `module:${file.path}`,
  })]));
  const fixedRecords = new Map();
  let selectedPath = files.find(file => file.editable)?.path || definition.workspace.entry;

  const fileFor = path => {
    const file = byPath.get(path);
    if (!file) throw new TypeError("과제에 포함된 모듈 파일을 선택해 주세요.");
    return file;
  };
  const identity = (path = selectedPath) => {
    fileFor(path);
    return identities.get(path);
  };
  const record = (path = selectedPath) => {
    const file = fileFor(path);
    if (file.editable) return workspaceState.load(identity(path), file.source);
    if (!fixedRecords.has(path)) fixedRecords.set(path, Object.freeze({
      identity: identity(path), value: file.source, initialValue: file.source,
      dirty: false, blocked: false, status: "readonly",
    }));
    return fixedRecords.get(path);
  };
  const editableIdentity = path => {
    if (!fileFor(path).editable) throw new TypeError(`읽기 전용 파일은 수정할 수 없습니다: ${path}`);
    record(path);
    return identity(path);
  };
  const snapshot = () => {
    const source = sourceContract.serialize({ entry: definition.workspace.entry,
      files: Object.fromEntries(files.map(file => [file.path, record(file.path).value])) });
    // Byte limits apply to execution. An oversized edit stays in the draft so it
    // can be shortened or copied instead of being silently lost on submission.
    sourceContract.validate(definition, source);
    return source;
  };

  return Object.freeze({
    entry: definition.workspace.entry, files, identity, record, snapshot,
    selectedPath: () => selectedPath,
    select: path => { fileFor(path); selectedPath = path; return record(path); },
    update: (path, value) => workspaceState.update(editableIdentity(path), value),
    save: (path = selectedPath) => workspaceState.save(editableIdentity(path)),
    reset: (path = selectedPath) => workspaceState.reset(editableIdentity(path)),
  });
}
