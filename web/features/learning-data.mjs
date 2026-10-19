import { moduleSourceContract } from "./module-workspace-state.mjs";

const stepIds = ["theory", "example", "quiz", "practice", "lab"];

export const trackLabels = Object.freeze({ all: "전체 로드맵", common: "공통 언어", browser: "브라우저", node: "Node.js", capstone: "통합 프로젝트" });

export const conceptAliases = Object.freeze({
  values: "values-and-types", contexts: "scope-tdz-and-declarations", this: "this-and-arrow-functions",
  callbacks: "higher-order-functions", prototypes: "prototype-delegation", classes: "classes-and-private-state",
});

export function normalizeTrack(value) {
  if (value === "browser" || String(value).startsWith("browser-")) return "browser";
  if (value === "node" || String(value).startsWith("node-")) return "node";
  if (["capstone", "integration"].includes(value) || String(value).startsWith("capstone-")) return "capstone";
  return "common";
}

export function browserWorkerProfile(profile) {
  return profile?.execution?.provider === "browser-worker"
    || (profile?.id === "ecmascript-2026" && !profile.execution?.provider);
}

export function browserModuleProfile(profile) {
  return profile?.execution?.provider === "browser-module-worker";
}

export function browserDomProfile(profile) {
  return profile?.execution?.provider === "browser-dom";
}

export function nodeNativeProfile(profile) {
  return profile?.execution?.provider === "node-native";
}

export function supportsExerciseProvider(exercise, profile) {
  return (exercise?.runner?.kind === "function-body" && (browserWorkerProfile(profile) || browserDomProfile(profile)))
    || (exercise?.runner?.kind === "module-files" && (browserModuleProfile(profile) || nodeNativeProfile(profile)));
}

export function entryInTrack(entry, track) {
  return track === "all" || entry.track === track
    || (track === "node" && Boolean(entry.exerciseByHost?.node || entry.id === "capstone-domain-core"));
}

export function resolveEntryHost(entry, host) {
  return entry?.hostEntries && Object.hasOwn(entry.hostEntries, host)
    ? entry.hostEntries[host] : entry?.hostEntries?.browser || entry;
}

export function entryHostVariants(entry) {
  return entry?.hostEntries ? Object.values(entry.hostEntries) : [entry];
}

async function resource(path, type = "json", fetchResource = fetch) {
  if (typeof path !== "string" || !/^(?:curriculum|runtime|starter)\/[a-zA-Z0-9/_-]+\.(?:json|mjs|cjs)$/u.test(path)) {
    throw new Error("학습 자료 경로가 올바르지 않습니다.");
  }
  const response = await fetchResource(`/${path}`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`학습 자료를 불러오지 못했습니다 (${response.status}).`);
  return type === "text" ? response.text() : response.json();
}

export function editableDefinition(exercise, starter = "") {
  if (exercise?.editable && ["prefix", "suffix", "initialBody"].every(key => typeof exercise.editable[key] === "string")) {
    return { ...exercise.editable };
  }
  // The first counter draft used a fixed function-body contract. Keep its stored body compatible.
  if (exercise?.id === "independent-counter") {
    const match = (starter || exercise.template || "").match(/^export function createCounter\(initial = 0\) \{\r?\n([\s\S]*?)\r?\n\}\s*$/u);
    if (match) return { prefix: "export function createCounter(initial = 0) {", suffix: "}", initialBody: match[1] };
  }
  return null;
}

export function normalizeRoute(params, entries, versions) {
  const requested = conceptAliases[params.get("lesson")] || params.get("lesson");
  const selected = entries.find(entry => entry.id === requested) || entries.find(entry => entry.ready) || entries[0];
  let track = Object.hasOwn(trackLabels, params.get("track")) ? params.get("track") : "all";
  if (!entryInTrack(selected, track)) track = selected.track;
  const host = selected.hostEntries
    ? track === "node" ? "node" : Object.hasOwn(selected.hostEntries, params.get("host")) ? params.get("host") : "browser"
    : null;
  const supported = selected.lesson?.supportedVersions || versions;
  return {
    lesson: selected.id, step: stepIds.includes(params.get("step")) ? params.get("step") : "theory",
    term: params.get("term") || null, track,
    version: supported.includes(params.get("version")) ? params.get("version") : supported[0],
    ...(host ? { host } : {}),
  };
}

export async function loadLearningData(fetchResource = fetch) {
  const configResponse = await fetchResource("/education.config.json", { cache: "no-cache" });
  if (!configResponse.ok) throw new Error("과정 설정을 불러오지 못했습니다.");
  const config = await configResponse.json();
  const [catalog, exerciseCatalog, runtimeCatalog] = await Promise.all([
    resource("curriculum/catalog.json", "json", fetchResource),
    resource("curriculum/exercises.json", "json", fetchResource),
    resource("runtime/profiles.json", "json", fetchResource),
  ]);
  if (typeof config.name !== "string" || typeof config.displayName !== "string"
    || !Array.isArray(catalog.lessons) || !catalog.lessons.length || !Array.isArray(exerciseCatalog.exercises)
    || !Array.isArray(runtimeCatalog.profiles) || !Array.isArray(config.languageVersions) || !config.languageVersions.length) {
    throw new Error("과정 설정과 목차의 연결을 확인해 주세요.");
  }
  const merged = new Map((catalog.roadmap || []).map(entry => [entry.id, { ...entry }]));
  for (const entry of catalog.lessons) merged.set(entry.id, { ...merged.get(entry.id), ...entry });
  const ordered = [...merged.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const entries = await Promise.all(ordered.map(async (entry, index) => {
    const base = { ...entry, name: entry.shortTitle || entry.title || entry.id, order: entry.order ?? index + 1,
      track: normalizeTrack(entry.track), ready: false, reason: "교재와 실습을 준비하고 있습니다." };
    if (!entry.file) return base;
    try {
      const lesson = await resource(entry.file, "json", fetchResource);
      if (lesson.id !== entry.id || !lesson.contentRevision || !stepIds.every(id => typeof lesson.steps?.[id] === "string")
        || !Array.isArray(lesson.supportedVersions) || !lesson.supportedVersions.length
        || !Array.isArray(lesson.goals) || !Array.isArray(lesson.sources)) throw new Error("교재 구조를 확인해 주세요.");
      if (entry.exerciseId && entry.exerciseId !== lesson.exerciseId) throw new Error("과제와 교재 개정의 연결을 확인해 주세요.");
      if (lesson.exerciseByHost && (lesson.exerciseByHost.browser !== lesson.exerciseId || typeof lesson.exerciseByHost.node !== "string"
        || !lesson.hostVariants?.node || lesson.hostVariants.node.exerciseId !== lesson.exerciseByHost.node
        || (entry.exerciseByHost && ["browser", "node"].some(host => entry.exerciseByHost[host] !== lesson.exerciseByHost[host])))) {
        throw new Error("호스트별 과제 연결을 확인해 주세요.");
      }
      const loadVariant = async (selectedLesson, host) => {
        const exercise = exerciseCatalog.exercises.find(item => item.id === selectedLesson.exerciseId && item.lessonId === lesson.id);
        if ((exercise?.contentRevision && exercise.contentRevision !== lesson.contentRevision)
          || (host && !exercise)) throw new Error("과제와 교재 개정의 연결을 확인해 주세요.");
        if (exercise && (!Array.isArray(exercise.instructions) || !Array.isArray(exercise.behaviorCriteria))) throw new Error("과제 안내와 검사 조건을 확인해 주세요.");
        if (!stepIds.every(id => typeof selectedLesson.steps?.[id] === "string") || !Array.isArray(selectedLesson.goals) || !Array.isArray(selectedLesson.sources)) throw new Error("호스트별 교재 구조를 확인해 주세요.");
        if (selectedLesson.quiz && (!Array.isArray(selectedLesson.quiz.questions) || !selectedLesson.quiz.questions.every(question => typeof question.id === "string"
          && typeof question.prompt === "string" && Array.isArray(question.choices) && question.choices.length > 1
          && question.choices.every(choice => typeof choice.id === "string" && typeof choice.text === "string")
          && question.choices.some(choice => choice.id === question.correctChoiceId)))) throw new Error("퀴즈 문항과 해설의 연결을 확인해 주세요.");
        let moduleWorkspace = null;
        if (exercise?.runner?.kind === "module-files") {
          const sourceContract = moduleSourceContract(exercise);
          const source = sourceContract.serialize({ entry: exercise.workspace?.entry,
            files: Object.fromEntries((exercise.workspace?.files || []).map(item => [item.path, item.source])) });
          sourceContract.validate(exercise, source);
          moduleWorkspace = structuredClone(exercise.workspace);
        }
        const file = moduleWorkspace ? null : exercise?.files?.find(item => item.editable);
        const profile = runtimeCatalog.profiles.find(item => item.id === exercise?.profileId);
        const exampleFile = (host === "node" ? exercise?.exampleFile : selectedLesson.exampleFile) || exercise?.exampleFile || `curriculum/examples/${lesson.id}.mjs`;
        const [example, starter] = await Promise.all([
          resource(exampleFile, "text", fetchResource),
          file ? resource(file.path, "text", fetchResource) : Promise.resolve(""),
        ]);
        const editable = moduleWorkspace ? null : editableDefinition(exercise, starter);
        return { ...base, name: entry.shortTitle || lesson.shortTitle || entry.title || lesson.title, track: normalizeTrack(entry.track || lesson.track),
          ready: true, lesson: selectedLesson, exercise, file, profile, example, exampleFile, editable, moduleWorkspace,
          host: host || (nodeNativeProfile(profile) ? "node" : "browser"), baseExerciseId: lesson.exerciseId,
          reason: "", runnable: Boolean((moduleWorkspace || (editable && file)) && supportsExerciseProvider(exercise, profile) && profile?.execution?.available === true),
          runtimeReason: !supportsExerciseProvider(exercise, profile) ? "이 과제에 필요한 전용 실행 환경을 준비하고 있습니다."
            : profile?.execution?.reason || "실행 환경을 준비하고 있습니다.",
          initialBody: editable?.initialBody || "" };
      };
      const loaded = await loadVariant(lesson, lesson.exerciseByHost ? "browser" : null);
      if (lesson.exerciseByHost) {
        const nodeLesson = { ...lesson, ...lesson.hostVariants.node, id: lesson.id, contentRevision: lesson.contentRevision,
          supportedVersions: lesson.supportedVersions, exerciseId: lesson.exerciseByHost.node };
        let node;
        try { node = await loadVariant(nodeLesson, "node"); }
        catch (error) { node = { ...base, host: "node", baseExerciseId: lesson.exerciseId, lesson: nodeLesson,
          reason: error instanceof Error ? error.message : "Node 학습 자료를 확인해 주세요.", loadError: true }; }
        return { ...loaded, exerciseByHost: { ...lesson.exerciseByHost }, hostEntries: { browser: loaded, node } };
      }
      return loaded;
    } catch (error) {
      return { ...base, reason: error instanceof Error ? error.message : "자료를 다시 불러와 주세요.", loadError: true };
    }
  }));
  return { config, catalog, entries, exercises: exerciseCatalog.exercises, profiles: runtimeCatalog.profiles };
}
