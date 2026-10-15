import { submissionPassed } from "./execution-state.mjs";

const identityFields = ["lessonId", "contentRevision", "exerciseId", "targetVersion", "profileId", "graderRevision"];
const empty = () => ({ quiz: null, submission: null, rubric: [], reviewedNote: "" });

export function progressIdentity(entry, targetVersion) {
  return { lessonId: entry.id, contentRevision: entry.lesson.contentRevision,
    exerciseId: entry.exercise?.id || "reading", targetVersion,
    profileId: entry.exercise?.profileByVersion?.[targetVersion] || entry.exercise?.profileId || "unavailable",
    graderRevision: entry.exercise?.graderRevision || entry.exercise?.contentRevision || entry.lesson.contentRevision };
}

export function assessQuiz(questions, answers = {}) {
  const checks = questions.map(question => ({ id: question.id, answered: question.choices.some(choice => choice.id === answers[question.id]),
    passed: answers[question.id] === question.correctChoiceId }));
  return { checks, passed: checks.length > 0 && checks.every(check => check.answered && check.passed) };
}

export function quizForRevision(quiz, revision) {
  return quiz?.revision === revision ? quiz : null;
}

export function validSubmission(saved, identity, sourceFingerprint, environmentFingerprint) {
  return Boolean(saved && identityFields.every(key => saved.identity?.[key] === identity[key])
    && typeof saved.result?.requestId === "string" && saved.result.requestId
    && typeof saved.result?.actualRuntime === "string" && saved.result.actualRuntime
    && saved.result?.lessonId === identity.lessonId
    && saved.result?.sourceFingerprint === sourceFingerprint && saved.result?.environmentFingerprint === environmentFingerprint
    && saved.result?.exerciseId === identity.exerciseId && saved.result?.contentRevision === identity.contentRevision
    && saved.result?.targetVersion === identity.targetVersion && submissionPassed(saved.result));
}

export function createLearningProgress(storage, namespace) {
  const records = new Map();
  const keyOf = identity => {
    if (!identityFields.every(key => typeof identity?.[key] === "string" && identity[key])) throw new TypeError("Complete progress identity required");
    return `${namespace}:progress:v1:${JSON.stringify(identityFields.map(key => identity[key]))}`;
  };
  const load = identity => {
    const key = keyOf(identity);
    if (records.has(key)) return records.get(key);
    const record = { identity: { ...identity }, value: empty(), status: "initial", blocked: false, dirty: false };
    records.set(key, record);
    if (!storage) { record.status = "unavailable"; return record; }
    try {
      const raw = storage.getItem(key);
      if (raw === null) return record;
      let saved;
      try { saved = JSON.parse(raw); } catch { /* Preserve corrupt source. */ }
      if (!saved || saved.version !== 1 || !saved.value || !Array.isArray(saved.value.rubric)
        || !saved.value.rubric.every(value => typeof value === "boolean") || typeof saved.value.reviewedNote !== "string"
        || saved.value.reviewedNote.length > 200000 || (saved.value.quiz !== null && (typeof saved.value.quiz !== "object"
          || !saved.value.quiz.answers || typeof saved.value.quiz.answers !== "object" || typeof saved.value.quiz.assessed !== "boolean"))) {
        record.status = "corrupt"; record.blocked = true;
      } else { record.value = { ...empty(), ...saved.value }; record.status = "saved"; }
    } catch { record.status = "read-error"; record.blocked = true; }
    return record;
  };
  const save = identity => {
    const record = load(identity);
    if (record.blocked || !record.dirty) return record;
    if (!storage) { record.status = "unavailable"; return record; }
    try {
      storage.setItem(keyOf(identity), JSON.stringify({ version: 1, value: record.value }));
      record.status = "saved"; record.dirty = false;
    } catch { record.status = "write-error"; }
    return record;
  };
  const update = (identity, changes) => {
    const record = load(identity);
    record.value = { ...record.value, ...changes };
    record.dirty = true;
    return save(identity);
  };
  return Object.freeze({ load, update, save, records: () => [...records.values()] });
}
