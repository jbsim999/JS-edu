const identityFields = ["requestId", "lessonId", "exerciseId", "contentRevision", "sourceFingerprint", "targetVersion"];

// Each provider keeps its own environment identity. A single UI execution state
// controls concurrency; cancellation is forwarded to every provider by request ID.
export function createExecutionRouter(providers) {
  const routes = new Map();
  const runners = new Set();
  for (const { runner, exerciseIds } of providers) {
    if (!["getEnvironment", "prepare", "run", "submit", "cancel"].every(key => typeof runner?.[key] === "function")) {
      throw new TypeError("실행 제공자의 계약을 확인해 주세요.");
    }
    runners.add(runner);
    for (const id of exerciseIds) {
      if (typeof id !== "string" || !id || routes.has(id)) throw new TypeError("중복 없는 과제 실행 경로가 필요합니다.");
      routes.set(id, runner);
    }
  }
  const unavailable = { available: false, actualRuntime: "연결할 수 없음", environmentFingerprint: "javascript-edu-unavailable",
    reason: "이 과제의 전용 실행 환경을 준비하고 있습니다.", missingFeatures: [] };
  const getEnvironment = async context => {
    const exerciseId = typeof context === "string" ? context : context?.exerciseId;
    if (exerciseId !== undefined) return routes.get(exerciseId)?.getEnvironment({ exerciseId }) || { ...unavailable };
    const availability = await Promise.all([...routes].map(async ([id, runner]) => [id, await runner.getEnvironment({ exerciseId: id })]));
    return { ...unavailable, exerciseAvailability: Object.fromEntries(availability) };
  };
  const invoke = async (kind, request) => {
    const runner = routes.get(request.exerciseId);
    if (runner) return runner[kind](request);
    return { ...Object.fromEntries(identityFields.map(key => [key, request[key]])), ...unavailable,
      status: "infrastructure-error", stdout: "", stderr: unavailable.reason, compilerOutput: "", checks: [], durationMs: 0 };
  };
  return Object.freeze({ getEnvironment,
    prepare: request => invoke("prepare", request), run: request => invoke("run", request), submit: request => invoke("submit", request),
    cancel: requestId => Promise.allSettled([...runners].map(runner => runner.cancel(requestId))),
  });
}

export function resultMatches(result, request, environmentFingerprint) {
  return Boolean(result && typeof environmentFingerprint === "string" && environmentFingerprint
    && identityFields.every(key => typeof request[key] === "string" && request[key] && result[key] === request[key])
    && result.environmentFingerprint === environmentFingerprint);
}

export function submissionPassed(result) {
  return result?.status === "success" && !result.cleanupWarning && !result.cleanupPending
    && Array.isArray(result.checks) && result.checks.length > 0
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
    const operation = generation;
    const requestId = active?.requestId;
    active = null;
    publish({ phase: "idle", kind: null, result: null, reason });
    if (requestId) return Promise.resolve(runner.cancel(requestId)).then(result => {
      const warnings = value => Array.isArray(value) ? value.flatMap(warnings)
        : value?.status === "fulfilled" ? warnings(value.value)
        : typeof value?.cleanupWarning === "string" && value.cleanupWarning ? [value.cleanupWarning] : [];
      const messages = [...new Set(warnings(result))];
      if (operation === generation && messages.length) publish({ reason: [reason, ...messages].filter(Boolean).join(" ") });
      return result;
    }).catch(() => {
      if (operation === generation) publish({ reason: [reason, "이전 작업의 중지·정리 완료를 확인하지 못했습니다."].filter(Boolean).join(" ") });
    });
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
      let prepared = await runner.prepare(request);
      if (operation !== generation) return null;
      if (!resultMatches(prepared, request, environment.environmentFingerprint)) throw new Error("환경 응답이 현재 작업과 일치하지 않습니다.");
      if (prepared.cleanupWarning || prepared.cleanupPending) prepared = { ...prepared, status: "infrastructure-error" };
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
