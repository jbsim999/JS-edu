const identityFields = ["requestId", "lessonId", "exerciseId", "contentRevision", "sourceFingerprint", "targetVersion"];

export function resultMatches(result, request, environmentFingerprint) {
  return Boolean(result && typeof environmentFingerprint === "string" && environmentFingerprint
    && identityFields.every(key => typeof request[key] === "string" && request[key] && result[key] === request[key])
    && result.environmentFingerprint === environmentFingerprint);
}

export function submissionPassed(result) {
  return result?.status === "success" && Array.isArray(result.checks) && result.checks.length > 0
    && result.checks.every(check => check.passed === true);
}

// Generation is advanced synchronously, before hashing or preparing a Worker.
// A pending digest, cancelled job or delayed result cannot attach itself to a later edit.
export function createExecutionState({ runner, fingerprintSource, onChange = () => {}, onResult = () => {} }) {
  let generation = 0;
  let sequence = 0;
  let active = null;
  let state = { phase: "idle", kind: null, result: null, reason: "" };
  const publish = next => { state = { ...state, ...next }; onChange(state); };
  const invalidate = (reason = "") => {
    generation += 1;
    const requestId = active?.requestId;
    active = null;
    if (requestId) void runner.cancel(requestId);
    publish({ phase: "idle", kind: null, result: null, reason });
  };
  const cancel = () => invalidate("작업을 중지했습니다. 현재 코드는 그대로 유지됩니다.");
  const start = async (kind, context, source) => {
    if (!["prepare", "run", "submit"].includes(kind) || active) return null;
    const operation = ++generation;
    const requestId = `ui-${Date.now().toString(36)}-${++sequence}`;
    active = { requestId };
    publish({ phase: "preparing", kind, result: null, reason: "실행 환경을 확인하고 있습니다." });
    try {
      const [environment, sourceFingerprint] = await Promise.all([runner.getEnvironment({ exerciseId: context.exerciseId }), fingerprintSource(source)]);
      if (operation !== generation) return null;
      const request = { requestId, lessonId: context.lessonId, exerciseId: context.exerciseId,
        contentRevision: context.contentRevision, targetVersion: context.targetVersion, source, sourceFingerprint };
      const prepared = await runner.prepare(request);
      if (operation !== generation) return null;
      if (!resultMatches(prepared, request, environment.environmentFingerprint)) throw new Error("환경 응답이 현재 작업과 일치하지 않습니다.");
      if (prepared.status !== "ready" || kind === "prepare") {
        active = null;
        publish({ phase: "idle", result: prepared, reason: "" });
        return prepared;
      }
      publish({ phase: kind === "submit" ? "submitting" : "running", reason: kind === "submit" ? "현재 코드의 행동을 검사하고 있습니다." : "현재 코드를 실행하고 있습니다." });
      const result = await runner[kind](request);
      if (operation !== generation) return null;
      const currentEnvironment = await runner.getEnvironment({ exerciseId: context.exerciseId });
      if (operation !== generation) return null;
      if (!resultMatches(result, request, environment.environmentFingerprint)
        || currentEnvironment.environmentFingerprint !== environment.environmentFingerprint) {
        throw new Error("코드 또는 실행 환경이 바뀌어 이 결과를 반영하지 않았습니다.");
      }
      active = null;
      publish({ phase: "idle", result, reason: "" });
      onResult({ kind, context: { ...context }, request, result });
      return result;
    } catch (error) {
      if (operation !== generation) return null;
      void runner.cancel(requestId);
      active = null;
      publish({ phase: "idle", result: null, reason: error instanceof Error ? error.message : "실행 환경에 연결하지 못했습니다." });
      return null;
    }
  };
  return Object.freeze({ start, invalidate, cancel, snapshot: () => state, busy: () => Boolean(active) });
}
