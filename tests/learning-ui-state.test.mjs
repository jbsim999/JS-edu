import test from "node:test";
import assert from "node:assert/strict";
import { createExecutionState, resultMatches, submissionPassed } from "../web/features/execution-state.mjs";
import { createLearningProgress, assessQuiz, validSubmission, quizForRevision } from "../web/features/learning-progress.mjs";
import { loadLearningData, normalizeRoute, browserWorkerProfile } from "../web/features/learning-data.mjs";

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
});

function memoryStorage() {
  const entries = new Map();
  return { entries, getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
}

test("saved pass binds source, environment, lesson revision and grader/profile identity", () => {
  const result = answer({ ...identity, requestId: "saved", sourceFingerprint: "body" });
  const saved = { identity, result };
  assert.equal(validSubmission(saved, identity, "body", environment.environmentFingerprint), true);
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
});
