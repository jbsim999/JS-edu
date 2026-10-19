import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createExecutionRouter, createExecutionState, resultMatches, submissionPassed } from "../web/features/execution-state.mjs";
import { createLearningProgress, progressIdentity, assessQuiz, validSubmission, quizForRevision } from "../web/features/learning-progress.mjs";
import { loadLearningData, normalizeRoute, browserWorkerProfile, browserModuleProfile, browserDomProfile, nodeNativeProfile, supportsExerciseProvider, resolveEntryHost, entryHostVariants, entryInTrack } from "../web/features/learning-data.mjs";

const identity = { lessonId: "counter", exerciseId: "counter-task", contentRevision: "r1", targetVersion: "ES2026", profileId: "worker-1", graderRevision: "g1" };
const environment = { available: true, actualRuntime: "test worker", environmentFingerprint: "environment-1" };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const checkpoint = () => new Promise(resolve => setImmediate(resolve));
const answer = (request, status = "success", checks = [{ id: "one", passed: true }]) => ({ ...request, ...environment, status, checks });

function fakeRunner(overrides = {}) {
  const calls = [];
  return { calls, getEnvironment: async () => environment,
    prepare: async request => { calls.push(["prepare", request]); return answer(request, "ready", []); },
    run: async request => { calls.push(["run", request]); return answer(request, "success", []); },
    submit: async request => { calls.push(["submit", request]); return answer(request); },
    cancel: async requestId => { calls.push(["cancel", requestId]); }, ...overrides };
}

test("an edit while source hashing is pending prevents preparation and submission", async () => {
  const hashing = deferred();
  const runner = fakeRunner();
  const completed = [];
  const state = createExecutionState({ runner, fingerprintSource: () => hashing.promise, onResult: value => completed.push(value) });
  const pending = state.start("submit", identity, "old code");
  assert.equal(state.busy(), true);
  state.invalidate("edited");
  hashing.resolve("old-fingerprint");
  assert.equal(await pending, null);
  assert.equal(runner.calls.some(([kind]) => ["prepare", "submit"].includes(kind)), false);
  assert.deepEqual(completed, []);
});

test("a cancelled late result cannot overwrite a newer successful request", async () => {
  const first = deferred();
  let count = 0;
  const runner = fakeRunner({ submit: async request => ++count === 1 ? first.promise : answer(request) });
  const completed = [];
  const state = createExecutionState({ runner, fingerprintSource: async source => source, onResult: value => completed.push(value) });
  const old = state.start("submit", identity, "old");
  await checkpoint();
  const oldRequest = runner.calls.find(([kind]) => kind === "prepare")[1];
  state.cancel();
  const current = await state.start("submit", identity, "new");
  first.resolve(answer(oldRequest));
  assert.equal(await old, null);
  assert.equal(current.sourceFingerprint, "new");
  assert.equal(state.snapshot().result.sourceFingerprint, "new");
  assert.equal(completed.length, 1);
});

test("one active job is allowed and preparing does not count as submission", async () => {
  const preparation = deferred();
  let request;
  const runner = fakeRunner({ prepare: async value => { request = value; return preparation.promise; } });
  const completed = [];
  const state = createExecutionState({ runner, fingerprintSource: async source => source, onResult: value => completed.push(value) });
  const pending = state.start("prepare", identity, "code");
  await checkpoint();
  assert.equal(await state.start("submit", identity, "code"), null);
  preparation.resolve(answer(request, "ready", []));
  assert.equal((await pending).status, "ready");
  assert.deepEqual(completed, []);
  assert.equal(state.busy(), false);
});

test("a changed environment and mismatched result identity are rejected", async () => {
  let reads = 0;
  const runner = fakeRunner({ getEnvironment: async () => ++reads === 1 ? environment : { ...environment, environmentFingerprint: "changed" } });
  const completed = [];
  const state = createExecutionState({ runner, fingerprintSource: async source => source, onResult: value => completed.push(value) });
  assert.equal(await state.start("submit", identity, "code"), null);
  assert.match(state.snapshot().reason, /환경/u);
  assert.equal(completed.length, 0);
  const request = { requestId: "r", ...identity, sourceFingerprint: "s" };
  assert.equal(resultMatches(answer(request), request, environment.environmentFingerprint), true);
  assert.equal(resultMatches(answer({ ...request, contentRevision: "r2" }), request, environment.environmentFingerprint), false);
});

test("successful execution or empty checks never imply submission pass", () => {
  assert.equal(submissionPassed({ status: "success", checks: [] }), false);
  assert.equal(submissionPassed({ status: "ready", checks: [{ passed: true }] }), false);
  assert.equal(submissionPassed({ status: "success", checks: [{ passed: true }, { passed: false }] }), false);
  assert.equal(submissionPassed({ status: "success", checks: [{ passed: true }] }), true);
  assert.equal(submissionPassed({ status: "success", checks: [{ passed: true }], cleanupWarning: "cleanup failed" }), false);
  assert.equal(submissionPassed({ status: "success", checks: [{ passed: true }], cleanupPending: true }), false);
});

test("preparation cleanup warnings block execution and submission callbacks", async () => {
  for (const cleanup of [{ cleanupWarning: "cleanup failed" }, { cleanupPending: true }]) {
    let submissions = 0;
    const completed = [];
    const runner = fakeRunner({ prepare: async request => ({ ...answer(request, "ready", []), ...cleanup }),
      submit: async request => { submissions++; return answer(request); } });
    const state = createExecutionState({ runner, fingerprintSource: async source => source, onResult: result => completed.push(result) });
    assert.equal((await state.start("submit", identity, "code")).status, "infrastructure-error");
    assert.equal(submissions, 0);
    assert.deepEqual(completed, []);
    assert.equal(state.busy(), false);
  }
});

test("cancel cleanup warnings reach the UI through router results without replacing a newer generation", async () => {
  const cancellation = deferred();
  const preparation = deferred();
  const runner = fakeRunner({ prepare: () => preparation.promise,
    cancel: async () => [{ status: "fulfilled", value: await cancellation.promise }] });
  const state = createExecutionState({ runner, fingerprintSource: async source => source });
  const pending = state.start("submit", identity, "code");
  await checkpoint();
  const cancelling = state.cancel();
  cancellation.resolve({ status: "cancelled", cleanupWarning: "cleanup failed" });
  await cancelling;
  assert.match(state.snapshot().reason, /cleanup failed/);
  state.invalidate("newer code");
  preparation.resolve({});
  assert.equal(await pending, null);
  assert.equal(state.snapshot().reason, "newer code");
  const lateCancellation = deferred();
  const latePreparation = deferred();
  const later = createExecutionState({ runner: fakeRunner({ prepare: () => latePreparation.promise, cancel: () => lateCancellation.promise }), fingerprintSource: async source => source });
  const old = later.start("submit", identity, "old code");
  await checkpoint();
  const oldCancellation = later.cancel();
  later.invalidate("new generation");
  lateCancellation.resolve({ status: "cancelled", cleanupWarning: "old cleanup warning" });
  await oldCancellation;
  latePreparation.resolve({});
  assert.equal(await old, null);
  assert.equal(later.snapshot().reason, "new generation");
});

function memoryStorage() {
  const entries = new Map();
  return { entries, getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
}

test("saved pass binds source, environment, lesson revision and grader/profile identity", () => {
  const result = answer({ ...identity, requestId: "saved", sourceFingerprint: "body" });
  const saved = { identity, result };
  assert.equal(validSubmission(saved, identity, "body", environment.environmentFingerprint), true);
  assert.equal(validSubmission({ ...saved, result: { ...result, cleanupWarning: "cleanup failed" } }, identity, "body", environment.environmentFingerprint), false);
  assert.equal(validSubmission({ ...saved, result: { ...result, cleanupPending: true } }, identity, "body", environment.environmentFingerprint), false);
  for (const changed of [{ ...identity, contentRevision: "r2" }, { ...identity, graderRevision: "g2" }, { ...identity, profileId: "worker-2" }]) {
    assert.equal(validSubmission(saved, changed, "body", environment.environmentFingerprint), false);
  }
  assert.equal(validSubmission(saved, identity, "edited", environment.environmentFingerprint), false);
  assert.equal(validSubmission(saved, identity, "body", "changed-environment"), false);
  const storage = memoryStorage();
  createLearningProgress(storage, "test").update(identity, { submission: saved });
  const reopened = createLearningProgress(storage, "test");
  assert.equal(reopened.load(identity).value.submission.result.requestId, "saved");
  assert.equal(reopened.load({ ...identity, graderRevision: "g2" }).value.submission, null);
  reopened.update(identity, { submission: null });
  assert.equal(createLearningProgress(storage, "test").load(identity).value.submission, null);
});

test("quiz requires nonempty fixed questions and every correct answer", () => {
  const questions = [{ id: "q1", choices: [{ id: "a" }, { id: "b" }], correctChoiceId: "b" }];
  assert.equal(assessQuiz([], {}).passed, false);
  assert.equal(assessQuiz(questions, {}).passed, false);
  assert.equal(assessQuiz(questions, { q1: "a" }).passed, false);
  assert.equal(assessQuiz(questions, { q1: "b" }).passed, true);
  const saved = { answers: { q1: "b" }, assessed: true, revision: "quiz-1" };
  assert.equal(quizForRevision(saved, "quiz-1"), saved);
  assert.equal(quizForRevision(saved, "quiz-2"), null);
  assert.deepEqual({ ...quizForRevision(saved, "quiz-2")?.answers, q2: "a" }, { q2: "a" });
});

test("corrupt progress is preserved and failed writes retain the in-memory answer", () => {
  const storage = memoryStorage();
  createLearningProgress(storage, "test").update(identity, { quiz: { answers: { q: "a" }, assessed: false } });
  const [key] = storage.entries.keys();
  storage.entries.set(key, "{broken");
  const reopened = createLearningProgress(storage, "test");
  assert.equal(reopened.load(identity).status, "corrupt");
  reopened.update(identity, { rubric: [true] });
  assert.equal(storage.entries.get(key), "{broken");
  assert.deepEqual(reopened.load(identity).value.rubric, [true]);
  const failureStorage = memoryStorage();
  failureStorage.setItem = () => { throw new Error("quota"); };
  const failed = createLearningProgress(failureStorage, "test");
  assert.equal(failed.update(identity, { quiz: { answers: { q: "b" }, assessed: true } }).status, "write-error");
  assert.equal(failed.load(identity).value.quiz.answers.q, "b");
});

test("catalog merges planned metadata with real lessons and never invents ready lessons", async () => {
  const data = {
    "/education.config.json": { name: "test", displayName: "Test", languageVersions: ["ES2026"] },
    "/curriculum/catalog.json": { roadmap: [{ id: "first", order: 1, displayNumber: "01", title: "첫 강의", track: "common" }, { id: "later", order: 2, title: "예정 강의", track: "browser" }], lessons: [{ id: "first", file: "curriculum/lessons/first.json", exerciseId: "first-task" }] },
    "/curriculum/exercises.json": { exercises: [{ id: "first-task", lessonId: "first", profileId: "worker", instructions: [], behaviorCriteria: [], runner: { kind: "function-body" }, files: [{ id: "first", path: "starter/first.mjs", editable: true }], editable: { prefix: "function first() {", initialBody: "return 1;", suffix: "}" } }] },
    "/runtime/profiles.json": { profiles: [{ id: "worker", execution: { available: true, provider: "browser-worker" } }] },
    "/curriculum/lessons/first.json": { id: "first", contentRevision: "r1", title: "첫 강의 설명", exerciseId: "first-task", supportedVersions: ["ES2026"], goals: [], sources: [], steps: { theory: "설명", example: "예시", quiz: "문제", practice: "설계", lab: "코딩" } },
    "/curriculum/examples/first.mjs": "console.log(1);", "/starter/first.mjs": "function first() {}",
  };
  const loaded = await loadLearningData(async path => ({ ok: Object.hasOwn(data, path), status: 404, json: async () => data[path], text: async () => data[path] }));
  assert.equal(loaded.entries.length, 2);
  assert.equal(loaded.entries[0].name, "첫 강의");
  assert.equal(loaded.entries[0].initialBody, "return 1;");
  assert.equal(loaded.entries[0].runnable, true);
  assert.equal(loaded.entries[1].ready, false);
  const route = normalizeRoute(new URLSearchParams("lesson=later&track=common&step=lab&version=invalid"), loaded.entries, ["ES2026"]);
  assert.deepEqual(route, { lesson: "later", track: "browser", step: "lab", version: "ES2026", term: null });
});

test("only dedicated browser-worker profiles are passed to the Worker provider", () => {
  assert.equal(browserWorkerProfile({ id: "ecmascript-2026", execution: { available: false } }), true);
  assert.equal(browserWorkerProfile({ id: "custom", execution: { provider: "browser-worker" } }), true);
  assert.equal(browserWorkerProfile({ id: "node", execution: { available: true, provider: "node-process" } }), false);
  assert.equal(browserWorkerProfile({ id: "ecmascript-2026", execution: { provider: "dom-iframe" } }), false);
  assert.equal(browserWorkerProfile(undefined), false);
  const moduleProfile = { execution: { available: true, provider: "browser-module-worker" } };
  assert.equal(browserModuleProfile(moduleProfile), true);
  assert.equal(browserWorkerProfile(moduleProfile), false);
  assert.equal(supportsExerciseProvider({ runner: { kind: "module-files" } }, moduleProfile), true);
  assert.equal(supportsExerciseProvider({ runner: { kind: "function-body" } }, moduleProfile), false);
  assert.equal(supportsExerciseProvider({ runner: { kind: "module-files" } }, { execution: { provider: "browser-worker" } }), false);
  const domProfile = { id: "browser-dom", execution: { provider: "browser-dom" } };
  assert.equal(browserDomProfile(domProfile), true);
  assert.equal(browserWorkerProfile(domProfile), false);
  assert.equal(browserModuleProfile(domProfile), false);
  assert.equal(supportsExerciseProvider({ runner: { kind: "function-body" } }, domProfile), true);
  assert.equal(supportsExerciseProvider({ runner: { kind: "module-files" } }, domProfile), false);
  assert.equal(browserDomProfile({ id: "browser-dom", execution: { provider: "node-process" } }), false);
  const nodeProfile = { id: "node-native", execution: { provider: "node-native" } };
  assert.equal(nodeNativeProfile(nodeProfile), true);
  assert.equal(browserModuleProfile(nodeProfile), false);
  assert.equal(supportsExerciseProvider({ runner: { kind: "module-files" } }, nodeProfile), true);
  assert.equal(supportsExerciseProvider({ runner: { kind: "function-body" } }, nodeProfile), false);
});

test("the complete catalog keeps stable host variants and normalizes the Node learning path", async () => {
  const data = await loadLearningData(async pathname => {
    try {
      const text = await readFile(new URL(`..${pathname}`, import.meta.url), "utf8");
      return { ok: true, text: async () => text, json: async () => JSON.parse(text) };
    } catch { return { ok: false, status: 404 }; }
  });
  assert.equal(data.entries.length, 52);
  assert.equal(data.entries.filter(entry => entry.ready && entry.runnable).length, 52);
  assert.equal(data.entries.flatMap(entryHostVariants).length, 55);
  assert.equal(data.entries.filter(entry => entryInTrack(entry, "node")).length, 12);
  assert.equal(entryInTrack(data.entries.find(entry => entry.id === "capstone-domain-core"), "node"), true);
  const base = data.entries.find(entry => entry.id === "capstone-host-product");
  const browser = resolveEntryHost(base, "browser");
  const node = resolveEntryHost(base, "node");
  assert.equal(resolveEntryHost(base, "node"), node);
  assert.equal(resolveEntryHost(base, "invalid"), browser);
  assert.equal(node.lesson.id, browser.lesson.id);
  assert.equal(node.lesson.contentRevision, browser.lesson.contentRevision);
  assert.equal(node.baseExerciseId, browser.exercise.id);
  assert.notEqual(node.exercise.id, browser.exercise.id);
  assert.notEqual(node.lesson.quiz.revision, browser.lesson.quiz.revision);
  assert.match(node.exampleFile, /capstone-host-product-node\.mjs$/);
  assert.equal(node.profile.execution.provider, "node-native");
  assert.match(node.lesson.steps.lab, /queryProductFile/);
  assert.match(browser.lesson.steps.lab, /mountSearchDashboard/);
  const routeFor = query => normalizeRoute(new URLSearchParams(query), data.entries, ["ES2026"]);
  assert.equal(routeFor("lesson=capstone-host-product&track=node&host=browser").host, "node");
  assert.equal(routeFor("lesson=capstone-host-product&track=node").track, "node");
  assert.equal(routeFor("lesson=capstone-host-product&track=all").host, "browser");
  assert.equal(routeFor("lesson=capstone-host-product&track=capstone&host=node").host, "node");
  assert.equal(routeFor("lesson=capstone-domain-core&track=node&host=node").track, "node");
  assert.equal(routeFor("lesson=capstone-domain-core&track=node&host=node").host, undefined);
  assert.equal(routeFor("lesson=node-esm-packages-and-cli&host=browser").host, undefined);
  const storage = memoryStorage();
  const progress = createLearningProgress(storage, "host-test");
  const browserIdentity = progressIdentity(browser, "ES2026");
  const nodeIdentity = progressIdentity(node, "ES2026");
  progress.update(browserIdentity, { quiz: { revision: browser.lesson.quiz.revision, answers: { q: "a" }, assessed: true }, submission: { marker: "browser" } });
  assert.equal(progress.load(nodeIdentity).value.quiz, null);
  assert.equal(progress.load(nodeIdentity).value.submission, null);
  progress.update(nodeIdentity, { quiz: { revision: node.lesson.quiz.revision, answers: { q: "b" }, assessed: false } });
  const reopened = createLearningProgress(storage, "host-test");
  assert.equal(reopened.load(browserIdentity).value.quiz.answers.q, "a");
  assert.equal(reopened.load(nodeIdentity).value.quiz.answers.q, "b");
});

test("provider routing preserves each exercise environment and keeps unavailable feature reasons", async () => {
  const envCalls = [];
  const moduleEnvironment = { available: false, actualRuntime: "module worker", environmentFingerprint: "native-module-1",
    reason: "feature missing", missingFeatures: ["Intl.Segmenter"] };
  const body = fakeRunner();
  const module = fakeRunner({ getEnvironment: async context => { envCalls.push(context); return moduleEnvironment; },
    prepare: async request => ({ ...answer(request, "infrastructure-error", []), ...moduleEnvironment }) });
  const router = createExecutionRouter([{ runner: body, exerciseIds: [identity.exerciseId] }, { runner: module, exerciseIds: ["module-task"] }]);
  assert.equal((await router.getEnvironment({ exerciseId: identity.exerciseId })).environmentFingerprint, environment.environmentFingerprint);
  const selected = await router.getEnvironment({ exerciseId: "module-task" });
  assert.equal(selected.environmentFingerprint, "native-module-1");
  assert.equal(selected.available, false);
  assert.deepEqual(selected.missingFeatures, ["Intl.Segmenter"]);
  const all = await router.getEnvironment();
  assert.equal(all.exerciseAvailability[identity.exerciseId].available, true);
  assert.equal(all.exerciseAvailability["module-task"].reason, "feature missing");
  assert.ok(envCalls.every(context => context.exerciseId === "module-task"));
  const request = { ...identity, exerciseId: "module-task", requestId: "module-request", sourceFingerprint: "snapshot", source: "complete snapshot" };
  assert.equal((await router.prepare(request)).status, "infrastructure-error");
  assert.deepEqual(body.calls, []);
  assert.equal((await router.getEnvironment({ exerciseId: "unknown" })).available, false);
  assert.deepEqual((await router.submit({ ...request, exerciseId: "unknown" })).checks, []);
  await router.cancel("module-request");
  assert.deepEqual(module.calls.at(-1), ["cancel", "module-request"]);
  assert.throws(() => createExecutionRouter([{ runner: body, exerciseIds: ["duplicate"] }, { runner: module, exerciseIds: ["duplicate"] }]), /중복/);
});

test("switching from a pending module submission to a function exercise rejects the late module result", async () => {
  const delayed = deferred();
  const moduleEnvironment = { ...environment, environmentFingerprint: "module-env", actualRuntime: "native module worker" };
  let moduleRequest;
  const module = fakeRunner({ getEnvironment: async () => moduleEnvironment,
    prepare: async request => ({ ...answer(request, "ready", []), ...moduleEnvironment }),
    submit: async request => { moduleRequest = request; return delayed.promise; } });
  const body = fakeRunner();
  const router = createExecutionRouter([{ runner: body, exerciseIds: [identity.exerciseId] }, { runner: module, exerciseIds: ["module-task"] }]);
  const completed = [];
  const state = createExecutionState({ runner: router, fingerprintSource: async source => source, onResult: value => completed.push(value) });
  const pending = state.start("submit", { ...identity, exerciseId: "module-task" }, "whole module snapshot");
  await checkpoint();
  state.invalidate("lesson changed");
  const current = await state.start("submit", identity, "function body");
  delayed.resolve({ ...answer(moduleRequest), ...moduleEnvironment });
  assert.equal(await pending, null);
  assert.equal(current.environmentFingerprint, environment.environmentFingerprint);
  assert.equal(state.snapshot().result.exerciseId, identity.exerciseId);
  assert.equal(completed.length, 1);
  assert.ok(module.calls.some(([kind, id]) => kind === "cancel" && id === moduleRequest.requestId));
});

test("module catalog loads fixed embedded files without fetching virtual source paths", async () => {
  const exercise = { id: "modules-task", lessonId: "modules", contentRevision: "r1", graderRevision: "g1", profileId: "browser-esm",
    instructions: [], behaviorCriteria: [], files: [{ id: "main", path: "starter/legacy.mjs", editable: true }],
    runner: { kind: "module-files", entry: "main.mjs" }, workspace: { entry: "main.mjs", files: [
      { path: "main.mjs", source: "export { value } from './fixed.mjs';", editable: true },
      { path: "fixed.mjs", source: "export const value = 3;", editable: false },
    ] } };
  const data = {
    "/education.config.json": { name: "test", displayName: "Test", languageVersions: ["ES2026"] },
    "/curriculum/catalog.json": { lessons: [{ id: "modules", file: "curriculum/lessons/modules.json" }] },
    "/curriculum/exercises.json": { exercises: [exercise] },
    "/runtime/profiles.json": { profiles: [{ id: "browser-esm", execution: { provider: "browser-module-worker", available: true } }] },
    "/curriculum/lessons/modules.json": { id: "modules", title: "모듈", contentRevision: "r1", exerciseId: "modules-task",
      supportedVersions: ["ES2026"], goals: [], sources: [], steps: { theory: "이론", example: "예시", quiz: "퀴즈", practice: "심화", lab: "실습" } },
    "/curriculum/examples/modules.mjs": "export const value = 3;",
  };
  const requested = [];
  const fetcher = async path => { requested.push(path); return { ok: Object.hasOwn(data, path), status: 404, json: async () => data[path], text: async () => data[path] }; };
  const loaded = (await loadLearningData(fetcher)).entries[0];
  assert.equal(loaded.ready, true);
  assert.equal(loaded.runnable, true);
  assert.equal(loaded.editable, null);
  assert.equal(loaded.file, null);
  assert.equal(loaded.moduleWorkspace.files[1].source, "export const value = 3;");
  assert.equal(requested.some(path => path.includes("starter/") || path === "/main.mjs"), false);
  data["/runtime/profiles.json"].profiles[0].execution.available = false;
  assert.equal((await loadLearningData(fetcher)).entries[0].runnable, false);
  exercise.workspace.files[1].path = "../fixed.mjs";
  assert.equal((await loadLearningData(fetcher)).entries[0].ready, false);
});
