import { glossary, findTerms, normalizeSearch } from "./glossary-data.mjs";
import { createBrowserRunner, fingerprintSource } from "./execution/browser-runner.mjs";
import { createModuleRunner } from "./execution/module-runner.mjs";
import { loadLearningData, normalizeRoute, trackLabels, conceptAliases, supportsExerciseProvider } from "./features/learning-data.mjs";
import { createExecutionRouter, createExecutionState } from "./features/execution-state.mjs";
import { createLearningProgress, progressIdentity, assessQuiz, validSubmission, quizForRevision } from "./features/learning-progress.mjs";
import { createWorkspaceState, readPreferences, writePreferences } from "./features/workspace-state.mjs";
import { createModuleWorkspaceState } from "./features/module-workspace-state.mjs";

const steps = [
  { id: "theory", name: "이론" },
  { id: "example", name: "예시" },
  { id: "quiz", name: "문제풀이" },
  { id: "practice", name: "실무 심화" },
  { id: "lab", name: "직접 코딩" },
];

let lessons = [];

const byId = id => document.getElementById(id);
const elements = {
  lessonList: byId("lesson-list"), lessonHeading: byId("lesson-heading"),
  lessonKicker: byId("lesson-kicker"), lessonLead: byId("lesson-lead"),
  tabs: byId("step-tabs"), panel: byId("lesson-panel"), footer: byId("step-footer"),
  search: byId("glossary-search"), clear: byId("clear-search"),
  results: byId("glossary-results"), summary: byId("search-summary"),
  searchAnnouncement: byId("search-announcement"),
  glossary: byId("glossary-panel"), toc: byId("toc-panel"),
  dialog: byId("utility-dialog"), dialogScroll: byId("dialog-scroll"),
  dialogBack: byId("dialog-back"), dialogLabel: byId("dialog-label"),
  tocView: byId("dialog-toc-view"), searchView: byId("dialog-search-view"),
  termView: byId("dialog-term-view"), status: byId("navigation-status"),
};

const wideViewport = matchMedia("(min-width: 1280px)");
const navigationViewport = matchMedia("(min-width: 768px)");
let executionState;
let progress;
let validCode = false;
let progressGeneration = 0;
let courseGeneration = 0;
let route;
let modalMode = null;
let modalOpener = null;
let returnToSearch = false;
let searchScroll = 0;
let searchTermId = null;
let composing = false;
let closePending = false;
let backdropPointer = null;
let announcementTimer = null;
let lastFocusedElement = null;
let product;
let workspaceState;
let browserStorage = null;
let preferences;
let saveTimer;
let pendingReset = null;
let resetOpener = null;
const moduleWorkspaces = new WeakMap();

function currentEntry() { return lessons.find(entry => entry.id === route?.lesson); }

function runnableForVersion(entry, version = route.version) {
  const profile = product.profiles.find(item => item.id === (entry.exercise?.profileByVersion?.[version] || entry.exercise?.profileId));
  return Boolean(entry.ready && (entry.moduleWorkspace || (entry.editable && entry.file))
    && supportsExerciseProvider(entry.exercise, profile) && profile.execution?.available === true);
}

function moduleWorkspace(entry = currentEntry()) {
  if (!entry?.moduleWorkspace) return null;
  if (!moduleWorkspaces.has(entry)) moduleWorkspaces.set(entry, createModuleWorkspaceState({
    exercise: entry.exercise, workspaceState, lessonId: entry.id, contentRevision: entry.lesson.contentRevision,
  }));
  return moduleWorkspaces.get(entry);
}

function currentSource(entry = currentEntry()) {
  return moduleWorkspace(entry)?.snapshot() ?? field("code", entry).value;
}

function draftIdentity(kind, entry = currentEntry()) {
  if (kind === "code" && entry.moduleWorkspace) return moduleWorkspace(entry).identity();
  return { lessonId: entry.id, contentRevision: entry.lesson.contentRevision,
    exerciseId: entry.exercise?.id || "reading", fileId: kind === "code" ? entry.file.id : "lesson-note" };
}

function field(kind, entry = currentEntry()) {
  if (kind === "code" && entry.moduleWorkspace) return moduleWorkspace(entry).record();
  return workspaceState.load(draftIdentity(kind, entry), kind === "code" ? entry.initialBody : "");
}

function currentProgress() {
  const entry = currentEntry();
  return entry?.ready ? progress.load(progressIdentity(entry, route.version)) : null;
}

function currentQuiz() {
  const quiz = currentProgress()?.value.quiz;
  const lesson = currentEntry()?.lesson;
  return quizForRevision(quiz, lesson?.quiz?.revision || lesson?.contentRevision);
}

function textParagraphs(text) {
  return String(text || "").split(/\n\s*\n/u).filter(Boolean).map(part => `<p>${escapeHtml(part)}</p>`).join("");
}

function fieldMessage(record) {
  if (record.status === "readonly") return "과제에서 제공하는 읽기 전용 파일입니다. 선택하거나 복사할 수 있습니다.";
  if (record.status === "corrupt") return "저장된 내용을 읽을 수 없어 원본을 보존했습니다. 자동 저장은 멈춰 있습니다. 초기화를 선택하면 저장된 내용을 지우고 다시 시작합니다.";
  if (record.status === "read-error") return "브라우저의 저장 내용을 읽지 못했습니다. 기존 데이터 보호를 위해 자동 저장을 멈췄습니다. 작성한 내용은 복사해 보관해 주세요.";
  if (record.status === "unavailable" || record.status === "write-error") return "브라우저에 저장하지 못했습니다. 현재 화면의 내용은 유지되지만, 닫기 전에 복사해 보관해 주세요.";
  if (record.status === "pending") return "저장 중…";
  if (record.status === "saved") return "이 브라우저에 저장됨";
  return "입력하면 이 브라우저에 자동 저장됩니다.";
}

function updateFieldStatus(kind) {
  const status = byId(`${kind}-save-status`);
  if (!status || !currentEntry()?.ready) return;
  const record = field(kind);
  status.textContent = fieldMessage(record);
  status.classList.toggle("field-warning", ["corrupt", "read-error", "write-error", "unavailable"].includes(record.status));
  const retry = byId(`${kind}-save-retry`);
  if (retry) retry.hidden = !["write-error", "unavailable"].includes(record.status) || !record.dirty;
}

function flushDrafts() {
  clearTimeout(saveTimer);
  if (!workspaceState || !product) return;
  for (const record of workspaceState.records()) workspaceState.save(record.identity);
  if (progress) for (const record of progress.records()) progress.save(record.identity);
  updateFieldStatus("code");
  updateFieldStatus("note");
}

function applyPreferences() {
  document.documentElement.dataset.theme = preferences.theme;
  document.documentElement.dataset.effects = preferences.effects ? "on" : "off";
  byId("theme-toggle").checked = preferences.theme === "dark";
  byId("effects-toggle").checked = preferences.effects;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function termButton(id, label) {
  const entry = glossary.find(item => item.id === id);
  return `<button type="button" class="inline-term" data-term="${id}" aria-haspopup="dialog" aria-label="${escapeHtml(entry.name)} 용어 설명">${escapeHtml(label ?? entry.name)}</button>`;
}

function codeBlock(code, filename = "example.js") {
  return `<div class="code-caption"><span>${escapeHtml(filename)}</span><span>읽기 전용 예제</span></div>
    <pre tabindex="0" aria-label="${escapeHtml(filename)} 코드. 긴 줄은 가로로 스크롤할 수 있습니다."><code>${escapeHtml(code)}</code></pre>
    <p class="code-note">코드와 주석은 설명용입니다. 이 화면에서 실행한 결과가 아닙니다.</p>`;
}

function questionBlock(question) {
  return `<dl class="learning-question"><dt>시작 질문</dt><dd>${escapeHtml(question)}</dd></dl>`;
}

function officialSource() {
  const entry = currentEntry();
  const prerequisites = (entry.lesson.prerequisites || []).map(id => lessons.find(item => item.id === id)).filter(Boolean);
  return `<details class="lesson-source"><summary>학습 목표와 공식 자료</summary><ul>${entry.lesson.goals.map(goal => `<li>${escapeHtml(goal)}</li>`).join("")}</ul>${prerequisites.length ? `<p>먼저 읽을 강의: ${prerequisites.map(item => `<button type="button" class="inline-term" data-lesson="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button>`).join(" · ")}</p>` : ""}${entry.lesson.sources.map(source => {
    let url;
    try { url = new URL(source.url); } catch { return ""; }
    return url.protocol === "https:" ? `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)} ↗ <span class="sr-only">(새 탭)</span></a>` : "";
  }).join("")}</details>`;
}

function notesBlock() {
  const entry = currentEntry();
  const rubric = entry.lesson.memoRubric || ["내가 선택한 방법과 이유를 적었습니다.", "다른 방법과의 차이를 비교했습니다.", "실패할 입력과 확인 방법을 적었습니다."];
  const saved = currentProgress().value;
  const note = field("note").value;
  return `<section class="notes-section" aria-labelledby="notes-title"><div class="field-heading"><h3 id="notes-title">설계 메모</h3><button type="button" class="plain-button" data-reset-field="note">메모 비우기</button></div><label for="lesson-note" class="sr-only">이 수업의 설계 메모</label><textarea id="lesson-note" data-draft="note" rows="4" maxlength="200000" placeholder="선택한 방법, 다른 대안, 실패할 수 있는 조건을 적어 보세요." aria-describedby="note-save-status"></textarea><p id="note-save-status" class="save-status" role="status"></p><button id="note-save-retry" type="button" class="plain-button" data-save-field="note" hidden>저장 다시 시도</button><fieldset class="memo-rubric"><legend>내 메모 점검하기</legend>${rubric.map((text, index) => `<label><input type="checkbox" data-rubric="${index}"${saved.reviewedNote === note && saved.rubric[index] ? " checked" : ""}${note.trim() ? "" : " disabled"}><span>${escapeHtml(text)}</span></label>`).join("")}<p class="code-note">작성한 내용을 직접 확인하는 항목입니다. 메모의 의미를 자동 평가하지 않습니다.</p></fieldset></section>`;
}

function environmentForEntry(entry) {
  return product.environment.exerciseAvailability?.[entry.exercise?.id] || product.environment;
}

function executionContent() {
  const entry = currentEntry();
  const profile = product.profiles.find(item => item.id === (entry.exercise?.profileByVersion?.[route.version] || entry.profile?.id));
  const environment = environmentForEntry(entry);
  const available = runnableForVersion(entry) && environment.available;
  const description = entry.moduleWorkspace
    ? "현재 브라우저의 네이티브 ES 모듈 Worker에서 전체 파일을 실행합니다. 실행은 호출 결과를 확인하고, 제출 검사는 고정된 행동 조건을 모두 확인합니다."
    : "현재 브라우저의 전용 Worker에서 실행합니다. 실행은 호출 결과를 확인하고, 제출 검사는 고정된 행동 조건을 모두 확인합니다.";
  return `<section class="execution-section" aria-labelledby="execution-title"><h3 id="execution-title">실행과 제출 검사</h3><dl class="runtime-details"><div><dt>언어 기준</dt><dd>${escapeHtml(route.version)}</dd></div><div><dt>실제 런타임</dt><dd>${escapeHtml(environment.actualRuntime || "연결할 수 없음")}</dd></div><div><dt>변환 대상</dt><dd>${escapeHtml(profile?.compilerTarget || "별도 변환 없음")}</dd></div></dl><p class="runtime-note" id="runtime-note">${available ? description : escapeHtml((!environment.available && environment.reason) || entry.runtimeReason || profile?.execution?.reason || "이 과제의 실행 환경을 준비하고 있습니다.")}</p><div class="execution-actions"><button type="button" class="plain-button" data-execute="prepare"${available ? "" : " disabled"}>환경 확인</button><button type="button" class="secondary-button" data-execute="run"${available ? "" : " disabled"}>코드 실행</button><button type="button" class="primary-button" data-execute="submit"${available ? "" : " disabled"}>제출 검사</button><button type="button" class="secondary-button" id="cancel-execution" hidden>중지</button></div><p id="execution-announcement" class="save-status" role="status" aria-live="polite"></p><div id="execution-result"></div><p class="code-note">공개된 행동 검사를 이용하는 자가 학습용 결과입니다. 언어 기준과 현재 브라우저의 전체 기능 지원은 별개입니다.</p></section>`;
}

function codingContent() {
  const entry = currentEntry();
  const { exercise, file: sourceFile, editable } = entry;
  if (!exercise || (!entry.moduleWorkspace && (!editable || !sourceFile))) return `<span class="section-number">05 / 직접 코딩</span>${textParagraphs(entry.lesson.steps.lab)}<p class="sample-note">이 강의의 편집 과제를 준비하고 있습니다.</p>`;
  return `<span class="section-number">05 / 직접 코딩</span><h2>${escapeHtml(exercise.title || "조건을 만족하는 코드를 완성하세요")}</h2>${textParagraphs(entry.lesson.steps.lab)}<ul class="reading-list">${exercise.instructions.map(text => `<li>${escapeHtml(text)}</li>`).join("")}</ul>
    ${editorContent()}
    <details><summary>구현할 때 확인할 조건</summary><ul class="reading-list">${exercise.behaviorCriteria.map(text => `<li>${escapeHtml(text)}</li>`).join("")}</ul></details>${executionContent()}`;
}

function editorContent() {
  const entry = currentEntry();
  const module = moduleWorkspace(entry);
  const selectedIndex = module ? module.files.findIndex(file => file.path === module.selectedPath()) : -1;
  const selected = module?.files[selectedIndex];
  const readOnly = selected?.editable === false;
  const filename = selected?.path || entry.file.path;
  const help = module
    ? `${module.files.length}개 파일을 함께 실행·검사합니다. ${readOnly ? "이 파일은 읽기 전용입니다." : "선택한 파일 전체를 편집할 수 있습니다."} Tab 키는 다음 항목으로 이동합니다. 어느 파일이든 수정하면 이전 제출 통과가 해제됩니다.`
    : "본문만 편집할 수 있습니다. Tab 키는 다음 항목으로 이동합니다. 수정하면 이전 제출 통과가 해제됩니다.";
  const fileTabs = module ? `<div class="module-file-tabs" role="tablist" aria-label="과제 파일">${module.files.map((file, index) => `<button type="button" class="module-file-tab" role="tab" id="module-file-${index}" data-module-file="${escapeHtml(file.path)}" aria-controls="module-file-panel" aria-selected="${index === selectedIndex}" tabindex="${index === selectedIndex ? 0 : -1}"><span>${escapeHtml(file.path)}</span><small>${file.editable ? "편집 가능" : "읽기 전용"}${file.entry ? " · 시작 파일" : ""}</small></button>`).join("")}</div>` : "";
  return `<section class="editor-section" id="code-workspace" aria-labelledby="editor-title"><div class="editor-toolbar"><div><h3 id="editor-title">${module ? "모듈 파일" : "함수 본문"}</h3><p>${escapeHtml(filename)}</p></div><div class="editor-actions"><button type="button" class="plain-button" id="copy-code">${module ? "현재 파일 복사" : "전체 코드 복사"}</button>${readOnly ? "" : `<button type="button" class="plain-button" data-reset-field="code">${module ? "현재 파일 초기화" : "초기화"}</button>`}</div></div>
    <p class="editor-help" id="editor-help">${help}</p>${fileTabs}
    <div class="body-editor${module ? " module-editor" : ""}"${module ? ` id="module-file-panel" role="tabpanel" aria-labelledby="module-file-${selectedIndex}"` : ""}>${module ? "" : `<pre class="editor-fixed" aria-label="읽기 전용 함수 선언">${escapeHtml(entry.editable.prefix)}</pre>`}<label class="sr-only" for="code-editor">${escapeHtml(module ? `${filename}${readOnly ? " 읽기 전용 코드" : " 코드"}` : `${entry.exercise.runner?.exportName || "과제"} 함수 본문`)}</label><textarea id="code-editor" data-draft="code"${module ? ` data-module-path="${escapeHtml(filename)}"` : ""}${readOnly ? " readonly" : ""} rows="12" maxlength="200000" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="editor-help code-save-status"></textarea>${module ? "" : `<pre class="editor-fixed" aria-label="읽기 전용 함수 닫기">${escapeHtml(entry.editable.suffix)}</pre>`}</div>
    <p id="code-save-status" class="save-status" role="status"></p><button id="code-save-retry" type="button" class="plain-button" data-save-field="code" hidden>저장 다시 시도</button><p id="copy-status" class="save-status" role="status"></p></section>`;
}

function ensureModuleTabVisible(tab) {
  const list = tab?.closest(".module-file-tabs");
  if (!list) return;
  const bounds = tab.getBoundingClientRect();
  const container = list.getBoundingClientRect();
  if (bounds.left < container.left + 4) list.scrollLeft -= container.left + 4 - bounds.left;
  if (bounds.right > container.right - 4) list.scrollLeft += bounds.right - container.right + 4;
}

function selectModuleFile(path) {
  const module = moduleWorkspace();
  if (!module || !module.files.some(file => file.path === path)) return;
  if (module.selectedPath() !== path) {
    flushDrafts();
    module.select(path);
    byId("code-workspace").outerHTML = editorContent();
    byId("code-editor").value = field("code").value;
    updateFieldStatus("code");
  }
  const tab = byId(`module-file-${module.files.findIndex(file => file.path === path)}`);
  tab.focus({ preventScroll: true });
  ensureModuleTabVisible(tab);
}

function quizContent() {
  const questions = currentEntry().lesson.quiz?.questions || [];
  if (!questions.length) return `${textParagraphs(currentEntry().lesson.steps.quiz)}<p class="sample-note">객관식 판정은 준비 중입니다. 읽기만으로 통과하지 않습니다.</p>`;
  const saved = currentQuiz();
  return `<form id="lesson-quiz"><div class="quiz-questions">${questions.map((question, index) => `<fieldset class="quiz-question"><legend>${index + 1}. ${escapeHtml(question.prompt)}</legend>${question.choices.map(choice => `<label class="quiz-choice"><input type="radio" name="question-${escapeHtml(question.id)}" data-question="${escapeHtml(question.id)}" value="${escapeHtml(choice.id)}"${saved?.answers?.[question.id] === choice.id ? " checked" : ""}><span>${escapeHtml(choice.text)}</span></label>`).join("")}</fieldset>`).join("")}</div><button class="primary-button" type="submit">답안 확인</button><div id="quiz-feedback" class="quiz-feedback" role="status"></div></form>`;
}

function lessonContent(step) {
  const entry = currentEntry();
  if (!entry.ready) return `<span class="section-number">준비 중</span><h2>${escapeHtml(entry.name)}</h2><p>${escapeHtml(entry.reason)}</p><p class="sample-note">계획된 강의이며, 학습 완료나 실행 가능 강의로 집계하지 않습니다.</p>`;
  const labels = { theory: ["01 / 이해하기", "개념과 동작을 연결합니다"], example: ["02 / 코드 따라 읽기", "입력부터 결과까지 따라갑니다"], quiz: ["03 / 문제풀이", "이해한 내용을 확인하세요"], practice: ["04 / 실무 심화", "선택의 이유와 실패 조건을 살펴봅니다"] };
  if (step === "lab") return codingContent() + notesBlock();
  const [number, heading] = labels[step];
  let body = step === "quiz" ? quizContent() : textParagraphs(entry.lesson.steps[step]);
  if (step === "example") body += codeBlock(entry.example, entry.exampleFile.split("/").at(-1));
  if (step === "theory") {
    const terms = relatedTerms(entry).slice(0, 4);
    if (terms.length) body += `<aside class="margin-note"><span aria-hidden="true">✳</span><p>함께 읽을 용어<br>${terms.map(term => termButton(term.id)).join(" · ")}</p></aside>`;
  }
  return `<span class="section-number">${number}</span><h2>${escapeHtml(entry.lesson.stepHeadings?.[step] || heading)}</h2>${body}${officialSource()}${notesBlock()}`;
}

function relatedTerms(entry) {
  const ids = entry.lesson?.terms;
  if (Array.isArray(ids)) return glossary.filter(term => ids.includes(term.id));
  return glossary.filter(term => term.lessons.some(id => (conceptAliases[id] || id) === entry.id));
}

function readRoute() {
  return normalizeRoute(new URL(location.href).searchParams, lessons, product.config.languageVersions);
}

function writeRoute(next, { replace = false, termEntry = false } = {}) {
  const url = new URL(location.href);
  const requested = { ...route, ...next };
  for (const key of ["lesson", "step", "version", "track"]) {
    if (requested[key]) url.searchParams.set(key, requested[key]);
  }
  if (requested.term) url.searchParams.set("term", requested.term);
  else url.searchParams.delete("term");
  const normalized = normalizeRoute(url.searchParams, lessons, product.config.languageVersions);
  for (const key of ["lesson", "step", "version", "track"]) url.searchParams.set(key, normalized[key]);
  history[replace ? "replaceState" : "pushState"]({ jsEduWorkspace: true, jsEduWorkspaceTerm: termEntry }, "", url);
  applyRoute(normalized);
}

function ensureActiveTabVisible(target) {
  const tab = target instanceof HTMLElement ? target : elements.tabs.querySelector('[aria-selected="true"]');
  if (!tab) return;
  const bounds = tab.getBoundingClientRect();
  const container = elements.tabs.getBoundingClientRect();
  if (bounds.left < container.left + 4) elements.tabs.scrollLeft -= container.left + 4 - bounds.left;
  if (bounds.right > container.right - 4) elements.tabs.scrollLeft += bounds.right - container.right + 4;
}

function renderNavigation() {
  const visible = lessons.filter(entry => route.track === "all" || entry.track === route.track);
  byId("track-filter").value = route.track;
  const supported = currentEntry().lesson?.supportedVersions || product.config.languageVersions;
  byId("version-filter").innerHTML = supported.map(version => `<option value="${escapeHtml(version)}">${escapeHtml(version)}</option>`).join("");
  byId("version-filter").value = route.version;
  elements.lessonList.innerHTML = visible.map(entry => `<li><button type="button" class="lesson-link" data-lesson="${escapeHtml(entry.id)}"${entry.id === route.lesson ? ' aria-current="page"' : ""}><span class="lesson-number">${escapeHtml(entry.displayNumber || String(entry.order).padStart(2, "0"))}</span><span class="lesson-name">${escapeHtml(entry.name)}${entry.ready ? "" : '<small class="lesson-state">준비 중</small>'}</span></button></li>`).join("");
  const prepared = lessons.filter(entry => entry.ready).length;
  const runnable = lessons.filter(entry => entry.runnable).length;
  byId("catalog-status").textContent = `교재 ${prepared}강 · 실습 연결 ${runnable}강 · 계획 ${lessons.length}강`;
  ensureActiveLessonVisible();
}

function ensureActiveLessonVisible() {
  const selected = elements.lessonList.querySelector('[aria-current="page"]');
  const viewport = elements.lessonList.getBoundingClientRect();
  const bounds = selected?.getBoundingClientRect();
  if (bounds && elements.lessonList.clientHeight < elements.lessonList.scrollHeight) {
    if (bounds.top < viewport.top + 4) elements.lessonList.scrollTop -= viewport.top + 4 - bounds.top;
    if (bounds.bottom > viewport.bottom - 4) elements.lessonList.scrollTop += bounds.bottom - viewport.bottom + 4;
  }
}

function updateCourseProgressLabel(text) {
  const previousHeight = elements.lessonList.clientHeight;
  byId("course-progress").textContent = text;
  if (elements.lessonList.clientHeight !== previousHeight) ensureActiveLessonVisible();
}

function renderLesson() {
  const entry = currentEntry();
  document.title = `${entry.name} · ${product.config.displayName}`;
  elements.lessonKicker.textContent = `${trackLabels[entry.track]} / ${entry.displayNumber || String(entry.order).padStart(2, "0")}${entry.unit ? ` · ${entry.unit}` : ""}`;
  elements.lessonHeading.textContent = entry.name;
  elements.lessonLead.textContent = entry.ready ? entry.lesson.title : "확정한 로드맵 순서로 준비하는 강의입니다.";
  byId("lesson-meta").innerHTML = entry.ready
    ? `<span>${entry.lesson.status === "draft" ? "교재 초안" : "학습 교재"}</span><span>${escapeHtml(route.version)}</span><span>${entry.runnable ? "코드 실행·제출" : "실행 환경 준비 중"}</span>`
    : '<span>강의 준비 중</span>';
  byId("lesson-revision").textContent = entry.ready ? `교재 개정 ${entry.lesson.contentRevision}` : "예정 강의";
  renderNavigation();
  renderPanel();
  renderSearch();
}

function renderPanel() {
  const entry = currentEntry();
  const currentIndex = steps.findIndex(item => item.id === route.step);
  elements.tabs.innerHTML = steps.map(item => `<button class="step-tab" type="button" role="tab" id="step-${item.id}" aria-controls="lesson-panel" aria-selected="${item.id === route.step}" tabindex="${item.id === route.step ? 0 : -1}" data-step="${item.id}">${item.name}</button>`).join("");
  elements.panel.setAttribute("aria-labelledby", `step-${route.step}`);
  elements.panel.innerHTML = lessonContent(route.step);
  elements.panel.querySelectorAll("[data-draft]").forEach(input => {
    input.value = field(input.dataset.draft).value;
    updateFieldStatus(input.dataset.draft);
  });
  const next = steps[(currentIndex + 1) % steps.length];
  const following = lessons[lessons.indexOf(entry) + 1];
  elements.footer.innerHTML = `<span>학습 단계 ${currentIndex + 1} / ${steps.length}</span>${currentIndex === steps.length - 1 && following ? `<button type="button" class="next-step" data-lesson="${escapeHtml(following.id)}">다음 강의<span aria-hidden="true">→</span></button>` : `<button type="button" class="next-step" data-step="${next.id}">${currentIndex === steps.length - 1 ? "이론으로 돌아가기" : `다음: ${next.name}`}<span aria-hidden="true">→</span></button>`}`;
  renderQuizFeedback();
  renderExecution();
  void refreshAchievement();
  ensureActiveTabVisible();
}

function formatValue(value) {
  if (value === undefined) return "undefined";
  try { return typeof value === "string" ? value : JSON.stringify(value, null, 2); }
  catch { return String(value); }
}

function renderExecution() {
  const output = byId("execution-result");
  if (!output || !executionState) return;
  const state = executionState.snapshot();
  const entry = currentEntry();
  const profile = product.profiles.find(item => item.id === (entry.exercise?.profileByVersion?.[route.version] || entry.profile?.id));
  const busy = executionState.busy();
  const available = runnableForVersion(entry) && environmentForEntry(entry).available;
  document.querySelectorAll("[data-execute]").forEach(button => { button.disabled = busy || !available; });
  byId("cancel-execution").hidden = !busy;
  byId("execution-announcement").textContent = state.reason;
  output.setAttribute("aria-busy", String(busy));
  const result = state.result;
  if (!result) { output.replaceChildren(); return; }
  const messages = {
    ready: "환경 확인 완료 · 아직 코드를 실행하지 않았습니다",
    success: state.kind === "submit" ? "제출 검사 결과" : "코드 실행 완료 · 제출 통과와는 별도입니다",
    "checks-failed": "일부 행동 조건을 만족하지 못했습니다",
    "compilation-error": "코드 문법을 확인해 주세요", "runtime-error": "실행 중 오류가 발생했습니다",
    "module-load-error": "모듈을 불러오지 못했습니다. 구문·import 경로·초기화 코드를 확인하세요",
    timeout: "실행 시간 제한에 도달했습니다", cancelled: "작업을 중지했습니다",
    "infrastructure-error": "실행 환경에서 문제가 발생했습니다 · 오답으로 판정하지 않습니다",
  };
  const checks = Array.isArray(result.checks) ? result.checks : [];
  const passed = checks.filter(check => check.passed === true).length;
  const checkSummary = state.kind === "submit" && result.status !== "ready"
    ? `<p class="check-summary">${checks.length ? `${checks.length}개 중 ${passed}개 통과${passed === checks.length && result.status === "success" ? " · 현재 코드 통과" : ""}` : "완료된 검사 없음 · 통과로 기록하지 않습니다"}</p>` : "";
  const streams = [["stdout · 표준 출력", result.stdout], ["stderr · 오류 출력", result.stderr], ["문법 진단", result.compilerOutput]]
    .filter(([, text]) => text).map(([name, text]) => `<details class="output-detail" open><summary>${name}</summary><pre tabindex="0"><code>${escapeHtml(text)}</code></pre></details>`).join("");
  output.innerHTML = `<div class="execution-outcome" data-status="${escapeHtml(result.status)}"><h4>${escapeHtml(messages[result.status] || "실행 결과를 확인해 주세요")}</h4>${checkSummary}${state.kind === "run" && Object.hasOwn(result, "runValue") ? `<p class="code-note">호출 결과</p><pre tabindex="0"><code>${escapeHtml(formatValue(result.runValue))}</code></pre>` : ""}${checks.length ? `<ol class="behavior-checks">${checks.map(check => `<li data-passed="${check.passed === true}"><div><strong>${check.passed === true ? "통과" : "확인 필요"}</strong><span>${escapeHtml(check.label || check.id)}</span></div>${check.passed !== true ? `<details><summary>기대값과 실제값 보기</summary><p class="code-note">기대값</p><pre tabindex="0">${escapeHtml(formatValue(check.expected))}</pre><p class="code-note">실제값</p><pre tabindex="0">${escapeHtml(formatValue(check.actual))}</pre>${check.error ? `<p>${escapeHtml(check.error)}</p>` : ""}</details>` : ""}</li>`).join("")}</ol>` : ""}${streams}${result.cleanupWarning || result.cleanupPending ? `<p class="field-warning">${escapeHtml(result.cleanupWarning || "임시 실행 파일을 정리하고 있습니다.")}</p>` : ""}${result.outputTruncated ? '<p class="field-warning">출력 한도에 도달해 나머지 출력을 생략했습니다.</p>' : ""}${Number.isFinite(result.durationMs) ? `<p class="code-note">실행 시간 ${Math.round(result.durationMs)}ms</p>` : ""}</div>`;
  byId("execution-announcement").textContent = `${messages[result.status] || "실행 결과 수신"}${checks.length ? `, ${checks.length}개 중 ${passed}개 통과` : ""}`;
}

function renderQuizFeedback() {
  const output = byId("quiz-feedback");
  if (!output) return;
  const questions = currentEntry().lesson.quiz?.questions || [];
  const quiz = currentQuiz();
  if (!quiz?.assessed) { output.textContent = "답안을 선택한 뒤 확인해 주세요."; return; }
  const assessment = assessQuiz(questions, quiz.answers);
  output.innerHTML = `<p><strong>${assessment.passed ? "퀴즈 통과" : "해설을 읽고 다시 생각해 보세요"}</strong> · ${assessment.checks.filter(check => check.passed).length} / ${questions.length}</p><ol>${questions.map(question => {
    const choice = question.choices.find(item => item.id === quiz.answers[question.id]);
    const correct = question.choices.find(item => item.id === question.correctChoiceId);
    return `<li>${choice ? escapeHtml(choice.explanation || (choice.id === question.correctChoiceId ? "올바른 답입니다." : "다른 선택을 검토해 보세요.")) : "선택하지 않은 문제입니다."}${choice?.id !== question.correctChoiceId && correct ? `<p>정답: ${escapeHtml(correct.text)}<br>${escapeHtml(correct.explanation || "")}</p>` : ""}</li>`;
  }).join("")}</ol>`;
}

function renderAchievement() {
  const entry = currentEntry();
  const container = byId("learning-achievement");
  void refreshCourseProgress();
  if (!entry?.ready) { container.replaceChildren(); byId("progress-save-status").textContent = ""; byId("progress-save-retry").hidden = true; return; }
  const record = currentProgress();
  const questions = entry.lesson.quiz?.questions || [];
  const quiz = currentQuiz();
  const quizPassed = Boolean(quiz?.assessed && assessQuiz(questions, quiz.answers).passed);
  const rubric = entry.lesson.memoRubric || [1, 2, 3];
  const note = field("note").value;
  const reviewed = Boolean(note.trim() && rubric.length && record.value.reviewedNote === note
    && rubric.every((_, index) => record.value.rubric[index] === true));
  container.innerHTML = `<span data-complete="${quizPassed}">퀴즈 ${quizPassed ? "통과" : "미확인"}</span><span data-complete="${validCode}">코딩 ${validCode ? "통과" : "미확인"}</span><span data-complete="${reviewed}">메모 ${reviewed ? "자가 확인" : "미확인"}</span>${quizPassed && validCode && reviewed ? '<strong class="self-study-complete">자가 학습 과정 완료</strong>' : ""}`;
  const messages = { corrupt: "저장된 학습 상태가 손상되어 자동 저장을 멈췄습니다. 현재 화면의 새 결과만 유지됩니다.",
    "read-error": "학습 상태를 읽지 못해 기존 데이터를 보존했습니다. 현재 결과는 이 화면에서만 유지됩니다.",
    "write-error": "학습 상태를 저장하지 못했습니다. 현재 결과는 화면에 유지됩니다.", unavailable: "학습 상태 저장 공간을 사용할 수 없습니다. 현재 결과는 이 화면에서만 유지됩니다." };
  byId("progress-save-status").textContent = messages[record.status] || "";
  byId("progress-save-status").classList.toggle("field-warning", Boolean(messages[record.status]));
  byId("progress-save-retry").hidden = !record.dirty || record.blocked;
}

async function refreshAchievement() {
  const generation = ++progressGeneration;
  const entry = currentEntry();
  validCode = false;
  renderAchievement();
  if (!entry?.ready || !runnableForVersion(entry)) return;
  const identity = progressIdentity(entry, route.version);
  const saved = progress.load(identity).value.submission;
  if (!saved) return;
  try {
    const [sourceFingerprint, environment] = await Promise.all([fingerprintSource(currentSource(entry)), product.runner.getEnvironment({ exerciseId: entry.exercise.id })]);
    if (generation !== progressGeneration) return;
    validCode = environment.available && validSubmission(saved, identity, sourceFingerprint, environment.environmentFingerprint);
    renderAchievement();
  } catch { /* Unverifiable saved results are not marked as current achievement. */ }
}

async function refreshCourseProgress() {
  const generation = ++courseGeneration;
  const version = route.version;
  const eligible = lessons.filter(entry => runnableForVersion(entry, version) && entry.lesson.supportedVersions.includes(version));
  try {
    const completion = await Promise.all(eligible.map(async entry => {
      try {
      const environment = await product.runner.getEnvironment({ exerciseId: entry.exercise.id });
      if (!environment.available) return false;
      const identity = progressIdentity(entry, version);
      const saved = progress.load(identity).value;
      const quiz = saved.quiz;
      if (!quiz?.assessed || quiz.revision !== (entry.lesson.quiz?.revision || entry.lesson.contentRevision)
        || !assessQuiz(entry.lesson.quiz?.questions || [], quiz.answers).passed || !saved.submission) return false;
      const note = field("note", entry).value;
      const rubric = entry.lesson.memoRubric || [1, 2, 3];
      if (!note.trim() || saved.reviewedNote !== note || !rubric.length || !rubric.every((_, index) => saved.rubric[index] === true)) return false;
      return validSubmission(saved.submission, identity, await fingerprintSource(currentSource(entry)), environment.environmentFingerprint);
      } catch { return false; }
    }));
    if (generation === courseGeneration) updateCourseProgressLabel(`자가 학습 완료 ${completion.filter(Boolean).length} / ${eligible.length}강`);
  } catch {
    if (generation === courseGeneration) updateCourseProgressLabel("학습 상태를 확인하지 못했습니다.");
  }
}

function renderSearch() {
  if (composing) return;
  const query = elements.search.value;
  const results = normalizeSearch(query) ? findTerms(query, route.lesson) : relatedTerms(currentEntry());
  elements.clear.hidden = query.length === 0;
  elements.summary.textContent = normalizeSearch(query) ? `검색 결과 ${results.length}개` : `이 주제와 연결된 용어 ${results.length}개`;
  clearTimeout(announcementTimer);
  announcementTimer = setTimeout(() => {
    if (!composing) elements.searchAnnouncement.textContent = elements.summary.textContent;
  }, 250);
  elements.results.replaceChildren();
  if (!results.length) {
    const row = document.createElement("li");
    row.className = "no-results";
    const message = document.createElement("p");
    message.textContent = normalizeSearch(query)
      ? `“${query.trim()}”에 맞는 용어가 없습니다. 한글이나 영문 표제어를 짧게 입력해 보세요.`
      : "이 강의에 연결된 용어를 준비하고 있습니다. 검색하면 전체 용어를 찾을 수 있어요.";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "plain-button";
    clear.textContent = normalizeSearch(query) ? "검색 지우고 관련 용어 보기" : "전체 용어 검색하기";
    clear.addEventListener("click", clearSearch);
    row.append(message, clear);
    elements.results.append(row);
    return;
  }
  for (const entry of results) {
    const row = document.createElement("li");
    row.className = "glossary-result";
    row.innerHTML = `<h3>${escapeHtml(entry.name)}<span class="glossary-english" lang="en">${escapeHtml(entry.english)}</span></h3><p>${escapeHtml(entry.summary)}</p><button type="button" class="detail-button" data-term="${entry.id}" aria-label="${escapeHtml(entry.name)} 자세히 보기" aria-haspopup="dialog">자세히 보기<span aria-hidden="true">↗</span></button>`;
    elements.results.append(row);
  }
}

function clearSearch() {
  composing = false;
  elements.search.value = "";
  renderSearch();
  elements.search.focus({ preventScroll: true });
}

function panelsHome() {
  byId("toc-sidebar").append(elements.toc);
  byId("glossary-sidebar").append(elements.glossary);
}

function focusIfVisible(target) {
  if (target?.isConnected && target.getClientRects().length) {
    target.focus({ preventScroll: true });
    return true;
  }
  return false;
}

function closeDialogNow({ restoreFocus = true } = {}) {
  const previousMode = modalMode;
  modalMode = null;
  elements.dialog.close();
  document.body.classList.remove("modal-open");
  panelsHome();
  if (restoreFocus && !focusIfVisible(modalOpener)) {
    focusIfVisible(previousMode === "toc" && navigationViewport.matches
      ? elements.lessonList.querySelector('[aria-current="page"]') : byId("open-glossary"));
  }
  returnToSearch = false;
}

function setDialogMode(mode, { returning = false } = {}) {
  modalMode = mode;
  elements.dialog.dataset.mode = mode;
  elements.tocView.hidden = mode !== "toc";
  elements.searchView.hidden = mode !== "glossary";
  elements.termView.hidden = mode !== "term";
  elements.dialogBack.hidden = !(mode === "term" && returnToSearch);
  elements.dialogLabel.textContent = mode === "toc" ? "개념 목차" : mode === "term" ? "용어집 · 상세 보기" : "용어집";
  elements.dialog.setAttribute("aria-labelledby", mode === "term" ? "term-title" : "dialog-label");
  if (mode === "toc") elements.tocView.append(elements.toc);
  if (mode === "glossary") elements.searchView.append(elements.glossary);
  if (!elements.dialog.open) {
    document.body.classList.add("modal-open");
    elements.dialog.showModal();
  }
  elements.dialogScroll.scrollTop = 0;
  if (mode === "term") focusIfVisible(byId("term-title"));
  if (mode === "toc") {
    const selected = elements.lessonList.querySelector('[aria-current="page"]');
    focusIfVisible(selected);
    if (selected) {
      const bounds = selected.getBoundingClientRect();
      const viewport = elements.dialogScroll.getBoundingClientRect();
      if (bounds.bottom > viewport.bottom - 12) elements.dialogScroll.scrollTop += bounds.bottom - viewport.bottom + 12;
    }
  }
  if (mode === "glossary") {
    if (returning) {
      const target = elements.results.querySelector(`[data-term="${searchTermId}"]`);
      if (!focusIfVisible(target)) focusIfVisible(elements.search);
      elements.dialogScroll.scrollTop = searchScroll;
    } else focusIfVisible(elements.search);
  }
}

function renderTerm(id) {
  const entry = glossary.find(item => item.id === id);
  if (!entry) {
    elements.termView.innerHTML = '<section class="term-detail"><p class="section-eyebrow">GLOSSARY / 용어집</p><h2 id="term-title" tabindex="-1">용어를 찾을 수 없습니다</h2><p class="term-definition">요청한 용어는 현재 사전에 없습니다. 창을 닫고 용어집에서 다른 한글·영문 표기를 찾아보세요.</p><p class="term-misconception">주소로 열었던 수업과 학습 단계는 그대로 유지됩니다.</p></section>';
    setDialogMode("term");
    return;
  }
  elements.termView.innerHTML = `<section class="term-detail"><p class="section-eyebrow">GLOSSARY / 용어 설명</p><h2 id="term-title" tabindex="-1">${escapeHtml(entry.name)}</h2><p class="term-english" lang="en">${escapeHtml(entry.english)}</p><p class="term-definition">${escapeHtml(entry.definition)}</p><h3>짧은 코드로 읽기</h3><pre tabindex="0" aria-label="${escapeHtml(entry.name)} 설명용 코드"><code>${escapeHtml(entry.example)}</code></pre><p class="code-note">직접 작성한 설명용 예제 · 실행 결과 아님</p><h3>이렇게 오해하기 쉬워요</h3><p class="term-misconception">${escapeHtml(entry.misconception)}</p><h3>연결된 개념으로 이동</h3><ul class="related-lessons">${entry.lessons.map(lessonId => {
    const lesson = lessons.find(item => item.id === (conceptAliases[lessonId] || lessonId));
    return lesson ? `<li><button type="button" class="plain-button" data-lesson="${escapeHtml(lesson.id)}">${escapeHtml(lesson.name)} <span aria-hidden="true">↗</span></button></li>` : "";
  }).join("")}</ul><div class="term-source"><p>개념의 근거와 더 읽을 자료</p><a href="${escapeHtml(entry.source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.source.title)} ↗ <span class="sr-only">(새 탭)</span></a><p>이 설명은 원문을 그대로 옮긴 것이 아닌 학습용 요약입니다.</p></div></section>`;
  setDialogMode("term");
}

function applyRoute(next) {
  const lessonChanged = !route || route.lesson !== next.lesson;
  const stepChanged = !route || route.step !== next.step;
  const versionChanged = !route || route.version !== next.version;
  const filterChanged = !route || route.track !== next.track;
  if (lessonChanged || stepChanged || versionChanged) {
    flushDrafts();
    executionState?.invalidate();
    progressGeneration += 1;
    validCode = false;
    if (byId("reset-dialog").open) byId("reset-dialog").close("cancel");
  }
  route = next;
  if (lessonChanged || versionChanged) renderLesson();
  else if (stepChanged) renderPanel();
  else if (filterChanged) renderNavigation();
  if (next.term) {
    renderTerm(next.term);
  } else if (modalMode === "term") {
    if (returnToSearch && !wideViewport.matches && !lessonChanged && !stepChanged) setDialogMode("glossary", { returning: true });
    else closeDialogNow({ restoreFocus: !lessonChanged && !stepChanged });
  } else if ((lessonChanged || stepChanged) && elements.dialog.open) {
    closeDialogNow({ restoreFocus: false });
  }
  closePending = false;
}

function openTerm(id, trigger) {
  if (!glossary.some(item => item.id === id)) return;
  if (modalMode === "glossary") {
    searchScroll = elements.dialogScroll.scrollTop;
    searchTermId = id;
    returnToSearch = true;
  } else if (!elements.dialog.open) {
    modalOpener = trigger;
    returnToSearch = false;
  }
  writeRoute({ ...route, term: id }, { termEntry: true });
}

function closeTerm() {
  if (closePending) return;
  if (history.state?.jsEduWorkspaceTerm) {
    closePending = true;
    history.back();
  } else {
    writeRoute({ ...route, term: null }, { replace: true });
  }
}

function dismissUtility() {
  if (modalMode === "term") closeTerm();
  else closeDialogNow();
}

function openGlossary() {
  if (wideViewport.matches) {
    elements.search.focus({ preventScroll: true });
    byId("glossary-sidebar").scrollTop = 0;
    return;
  }
  modalOpener = byId("open-glossary");
  returnToSearch = false;
  setDialogMode("glossary");
}

function selectLesson(id) {
  id = conceptAliases[id] || id;
  if (!lessons.some(item => item.id === id)) return;
  returnToSearch = false;
  if (elements.dialog.open) closeDialogNow({ restoreFocus: false });
  writeRoute({ lesson: id, step: "theory", term: null });
  elements.lessonHeading.focus({ preventScroll: true });
  elements.lessonHeading.scrollIntoView({ block: "start", behavior: "instant" });
  elements.status.textContent = `${lessons.find(item => item.id === id).name} · 이론`;
}

function selectStep(id, { scroll = false } = {}) {
  if (!steps.some(item => item.id === id)) return;
  if (route.step !== id) writeRoute({ ...route, step: id, term: null });
  byId(`step-${id}`).focus({ preventScroll: true });
  ensureActiveTabVisible();
  if (scroll) elements.tabs.scrollIntoView({ block: "start", behavior: "instant" });
}

document.addEventListener("click", event => {
  if (!product) return;
  const target = event.target instanceof Element ? event.target : null;
  const moduleFile = target?.closest("[data-module-file]");
  if (moduleFile) return selectModuleFile(moduleFile.dataset.moduleFile);
  const term = target?.closest("[data-term]");
  if (term) return openTerm(term.dataset.term, term);
  const lesson = target?.closest("[data-lesson]");
  if (lesson) return selectLesson(lesson.dataset.lesson);
  const step = target?.closest("[data-step]");
  if (step) selectStep(step.dataset.step, { scroll: step.classList.contains("next-step") });
});

elements.tabs.addEventListener("keydown", event => {
  if (!event.target.matches('[role="tab"]')) return;
  const index = steps.findIndex(item => item.id === event.target.dataset.step);
  let next;
  if (event.key === "ArrowRight") next = (index + 1) % steps.length;
  if (event.key === "ArrowLeft") next = (index - 1 + steps.length) % steps.length;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = steps.length - 1;
  if (next !== undefined) {
    event.preventDefault();
    const nextTab = byId(`step-${steps[next].id}`);
    elements.tabs.querySelectorAll('[role="tab"]').forEach(tab => { tab.tabIndex = tab === nextTab ? 0 : -1; });
    nextTab.focus({ preventScroll: true });
    ensureActiveTabVisible(nextTab);
  }
});
elements.tabs.addEventListener("focusout", event => {
  if (!elements.tabs.contains(event.relatedTarget)) {
    elements.tabs.querySelectorAll('[role="tab"]').forEach(tab => { tab.tabIndex = tab.getAttribute("aria-selected") === "true" ? 0 : -1; });
  }
});

elements.panel.addEventListener("keydown", event => {
  const tab = event.target instanceof Element ? event.target.closest("[data-module-file]") : null;
  if (!tab) return;
  const tabs = [...tab.closest(".module-file-tabs").querySelectorAll("[data-module-file]")];
  const index = tabs.indexOf(tab);
  let next;
  if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
  if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = tabs.length - 1;
  if (next !== undefined) {
    event.preventDefault();
    tabs.forEach((item, position) => { item.tabIndex = position === next ? 0 : -1; });
    tabs[next].focus({ preventScroll: true });
    ensureModuleTabVisible(tabs[next]);
  }
});
elements.panel.addEventListener("focusout", event => {
  const list = event.target instanceof Element ? event.target.closest(".module-file-tabs") : null;
  if (list && !list.contains(event.relatedTarget)) list.querySelectorAll("[data-module-file]").forEach(tab => {
    tab.tabIndex = tab.getAttribute("aria-selected") === "true" ? 0 : -1;
  });
});

elements.search.addEventListener("compositionstart", () => {
  composing = true;
  clearTimeout(announcementTimer);
  announcementTimer = null;
});
elements.search.addEventListener("compositionend", () => { composing = false; renderSearch(); });
elements.search.addEventListener("input", event => { if (!event.isComposing && !composing) renderSearch(); });
elements.search.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.isComposing && !composing) event.preventDefault();
});
byId("glossary-form").addEventListener("submit", event => event.preventDefault());
elements.clear.addEventListener("click", clearSearch);
byId("open-glossary").addEventListener("click", openGlossary);
byId("open-toc").addEventListener("click", () => {
  modalOpener = byId("open-toc");
  returnToSearch = false;
  setDialogMode("toc");
});
byId("dialog-close").addEventListener("click", dismissUtility);
elements.dialogBack.addEventListener("click", closeTerm);
elements.dialog.addEventListener("cancel", event => { event.preventDefault(); if (!composing) dismissUtility(); });

elements.dialog.addEventListener("keydown", event => {
  // Search inputs clear themselves on Escape in some browsers. Close one view
  // instead, while allowing an active IME composition to handle its own keys.
  if (event.key === "Escape" && !event.isComposing && !composing) {
    event.preventDefault();
    event.stopPropagation();
    dismissUtility();
    return;
  }
  if (event.key !== "Tab" || event.isComposing || composing) return;
  const focusable = [...elements.dialog.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
  )].filter(element => element.tabIndex >= 0 && element.getClientRects().length
    && !element.closest('[hidden], [inert]') && getComputedStyle(element).visibility !== "hidden");
  if (!focusable.length) return;
  const index = focusable.indexOf(document.activeElement);
  if (event.shiftKey && index <= 0) {
    event.preventDefault();
    focusable.at(-1).focus();
  } else if (!event.shiftKey && (index === focusable.length - 1 || index < 0)) {
    event.preventDefault();
    focusable[0].focus();
  }
}, { capture: true });

function outsideDialog(event) {
  const bounds = elements.dialog.getBoundingClientRect();
  return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
}
elements.dialog.addEventListener("pointerdown", event => {
  backdropPointer = event.target === elements.dialog && outsideDialog(event) ? event.pointerId : null;
});
elements.dialog.addEventListener("pointerup", event => {
  const dismiss = backdropPointer === event.pointerId && event.target === elements.dialog && outsideDialog(event);
  backdropPointer = null;
  if (dismiss) dismissUtility();
});
elements.dialog.addEventListener("pointercancel", () => { backdropPointer = null; });
window.addEventListener("blur", () => { backdropPointer = null; });
window.addEventListener("popstate", () => { if (product) applyRoute(readRoute()); });
window.addEventListener("resize", ensureActiveTabVisible);
document.addEventListener("focusin", event => {
  // A breakpoint can blur a hidden control before matchMedia's change event.
  // Remember its region so keyboard focus can move to that region's opener.
  if (event.target instanceof HTMLElement && event.target !== document.body) lastFocusedElement = event.target;
});
wideViewport.addEventListener("change", event => {
  if (event.matches && modalMode === "glossary") {
    closeDialogNow({ restoreFocus: false });
    elements.search.focus({ preventScroll: true });
  } else if (!event.matches && !elements.dialog.open && byId("glossary-sidebar").contains(lastFocusedElement)) {
    byId("open-glossary").focus({ preventScroll: true });
  }
});
navigationViewport.addEventListener("change", event => {
  if (event.matches && modalMode === "toc") closeDialogNow();
  else if (!event.matches && !elements.dialog.open && byId("toc-sidebar").contains(lastFocusedElement)) {
    byId("open-toc").focus({ preventScroll: true });
  }
});
if (typeof ResizeObserver === "function") {
  const navigationResize = new ResizeObserver(() => ensureActiveLessonVisible());
  navigationResize.observe(elements.lessonList);
}

document.addEventListener("input", event => {
  const input = event.target;
  if (!(input instanceof HTMLTextAreaElement) || !input.dataset.draft || !product || input.readOnly) return;
  if (input.dataset.draft === "code" && currentEntry().moduleWorkspace) {
    const module = moduleWorkspace();
    if (input.dataset.modulePath !== module.selectedPath()) return;
    module.update(input.dataset.modulePath, input.value);
  } else workspaceState.update(draftIdentity(input.dataset.draft), input.value);
  if (input.dataset.draft === "code") {
    executionState.invalidate("코드가 바뀌었습니다. 다시 제출하면 현재 코드를 검사합니다.");
    progress.update(progressIdentity(currentEntry(), route.version), { submission: null });
    progressGeneration += 1;
    validCode = false;
  } else {
    progress.update(progressIdentity(currentEntry(), route.version), { rubric: [], reviewedNote: "" });
    document.querySelectorAll("[data-rubric]").forEach(control => { control.checked = false; control.disabled = !input.value.trim(); });
  }
  renderAchievement();
  updateFieldStatus(input.dataset.draft);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushDrafts, 500);
});

byId("track-filter").addEventListener("change", event => {
  const track = event.target.value;
  const entry = currentEntry();
  const selected = track === "all" || entry.track === track ? entry : lessons.find(item => item.track === track);
  if (selected) writeRoute({ ...route, track, lesson: selected.id, step: selected.id === entry.id ? route.step : "theory", term: null });
});
byId("version-filter").addEventListener("change", event => writeRoute({ ...route, version: event.target.value, term: null }));
byId("progress-save-retry").addEventListener("click", () => {
  progress.save(progressIdentity(currentEntry(), route.version));
  renderAchievement();
});

document.addEventListener("change", event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !currentEntry()?.ready) return;
  if (input.dataset.question) {
    const record = currentProgress();
    progress.update(record.identity, { quiz: { answers: { ...currentQuiz()?.answers, [input.dataset.question]: input.value }, assessed: false,
      revision: currentEntry().lesson.quiz?.revision || currentEntry().lesson.contentRevision } });
    renderQuizFeedback();
    renderAchievement();
  }
  if (input.dataset.rubric !== undefined) {
    const record = currentProgress();
    const rubric = [...record.value.rubric];
    rubric[Number(input.dataset.rubric)] = input.checked;
    progress.update(record.identity, { rubric: Array.from(rubric, Boolean), reviewedNote: field("note").value });
    renderAchievement();
  }
});

document.addEventListener("submit", event => {
  if (event.target.id !== "lesson-quiz") return;
  event.preventDefault();
  const record = currentProgress();
  progress.update(record.identity, { quiz: { answers: { ...currentQuiz()?.answers }, assessed: true,
    revision: currentEntry().lesson.quiz?.revision || currentEntry().lesson.contentRevision } });
  renderQuizFeedback();
  renderAchievement();
});

document.addEventListener("click", event => {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("#cancel-execution")) {
    executionState.cancel();
    byId("code-editor")?.focus({ preventScroll: true });
    return;
  }
  const button = target?.closest("[data-execute]");
  if (!button || button.disabled || !runnableForVersion(currentEntry()) || executionState.busy()) return;
  const kind = button.dataset.execute;
  const identity = progressIdentity(currentEntry(), route.version);
  flushDrafts();
  if (kind === "submit") {
    progress.update(identity, { submission: null });
    validCode = false;
    progressGeneration += 1;
    renderAchievement();
  }
  try { void executionState.start(kind, identity, currentSource()); }
  catch (error) { executionState.invalidate(error instanceof Error ? error.message : "실행할 파일을 확인해 주세요."); }
});

document.addEventListener("click", async event => {
  const target = event.target instanceof Element ? event.target : null;
  if (!product) return;
  const reset = target?.closest("[data-reset-field]");
  if (reset) {
    flushDrafts();
    pendingReset = reset.dataset.resetField;
    resetOpener = reset;
    const selectedFile = pendingReset === "code" ? moduleWorkspace()?.selectedPath() : null;
    byId("reset-title").textContent = pendingReset === "code" ? "코드 초안을 처음으로 되돌릴까요?" : "메모를 비울까요?";
    byId("reset-description").textContent = pendingReset === "code"
      ? selectedFile ? `${selectedFile}의 초안과 작성 중인 내용을 지우고 처음 코드로 돌아갑니다. 다른 파일과 생각 메모는 유지됩니다.`
        : "이 브라우저의 현재 과제 초안과 작성 중인 내용을 지우고 처음 코드로 돌아갑니다. 생각 메모는 유지됩니다."
      : "이 수업의 생각 메모를 지웁니다. 코드 초안은 유지됩니다.";
    byId("reset-error").hidden = true;
    byId("reset-dialog").returnValue = "";
    document.body.classList.add("modal-open");
    byId("reset-dialog").showModal();
  }
  const save = target?.closest("[data-save-field]");
  if (save) {
    if (save.dataset.saveField === "code" && currentEntry().moduleWorkspace) moduleWorkspace().save();
    else workspaceState.save(draftIdentity(save.dataset.saveField));
    updateFieldStatus(save.dataset.saveField);
  }
  if (target?.closest("#copy-code")) {
    const status = byId("copy-status");
    const { editable, moduleWorkspace: isModule } = currentEntry();
    const code = isModule ? field("code").value : `${editable.prefix}\n${field("code").value}\n${editable.suffix}\n`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(code);
      if (status.isConnected) status.textContent = isModule ? "현재 파일의 코드를 복사했습니다." : "함수 선언을 포함한 전체 코드를 복사했습니다.";
    } catch {
      if (status.isConnected) status.textContent = "자동 복사를 사용할 수 없습니다. 본문을 선택해 직접 복사해 주세요.";
      byId("code-editor")?.focus({ preventScroll: true });
      byId("code-editor")?.select();
    }
  }
});

byId("reset-dialog").querySelector("form").addEventListener("submit", event => {
  if (event.submitter?.value !== "reset" || !pendingReset) return;
  event.preventDefault();
  const result = pendingReset === "code" && currentEntry().moduleWorkspace
    ? moduleWorkspace().reset() : workspaceState.reset(draftIdentity(pendingReset));
  if (!result.ok) {
    byId("reset-error").textContent = "저장 공간을 변경하지 못했습니다. 작성한 내용과 저장된 내용은 유지됩니다.";
    byId("reset-error").hidden = false;
    return;
  }
  const input = byId(pendingReset === "code" ? "code-editor" : "lesson-note");
  if (input) input.value = result.record.value;
  if (pendingReset === "code") {
    executionState.invalidate("처음 코드로 돌아왔습니다. 현재 코드의 제출 검사를 다시 실행해 주세요.");
    progress.update(progressIdentity(currentEntry(), route.version), { submission: null });
    progressGeneration += 1;
    validCode = false;
  } else {
    progress.update(progressIdentity(currentEntry(), route.version), { rubric: [], reviewedNote: "" });
    document.querySelectorAll("[data-rubric]").forEach(control => { control.checked = false; control.disabled = true; });
  }
  renderAchievement();
  updateFieldStatus(pendingReset);
  byId("reset-dialog").close("reset");
});
byId("reset-dialog").addEventListener("close", () => {
  pendingReset = null;
  if (!elements.dialog.open) document.body.classList.remove("modal-open");
  focusIfVisible(resetOpener);
});

for (const control of ["theme-toggle", "effects-toggle"]) {
  byId(control).addEventListener("change", () => {
    preferences = { theme: byId("theme-toggle").checked ? "dark" : "light", effects: byId("effects-toggle").checked };
    applyPreferences();
    const saved = writePreferences(browserStorage, product.config.name, preferences);
    byId("preference-notice").hidden = saved;
    byId("preference-notice").textContent = saved ? "" : "화면 설정을 이 브라우저에 저장하지 못했습니다. 현재 선택은 이 화면에서 유지됩니다.";
    elements.status.textContent = `${preferences.theme === "dark" ? "다크" : "라이트"} 모드 · 효과 ${preferences.effects ? "켜짐" : "꺼짐"}`;
  });
}
window.addEventListener("pagehide", () => { flushDrafts(); executionState?.invalidate(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushDrafts(); });
window.addEventListener("beforeunload", event => {
  flushDrafts();
  if (workspaceState?.records().some(record => record.dirty) || progress?.records().some(record => record.dirty)) {
    event.preventDefault();
    event.returnValue = "";
  }
});

try {
  product = await loadLearningData();
  lessons = product.entries;
  const supported = lessons.filter(entry => entry.ready && supportsExerciseProvider(entry.exercise, entry.profile));
  const functionExercises = supported.filter(entry => entry.exercise.runner.kind === "function-body").map(entry => entry.exercise);
  const moduleExercises = supported.filter(entry => entry.exercise.runner.kind === "module-files").map(entry => entry.exercise);
  const providers = [];
  if (functionExercises.length) providers.push({ runner: createBrowserRunner({ exercises: functionExercises }), exerciseIds: functionExercises.map(exercise => exercise.id) });
  if (moduleExercises.length) providers.push({ runner: createModuleRunner({ exercises: moduleExercises }), exerciseIds: moduleExercises.map(exercise => exercise.id) });
  product.runner = createExecutionRouter(providers);
  product.environment = await product.runner.getEnvironment();
  try { browserStorage = window.localStorage; } catch { /* Storage access can be blocked. */ }
  workspaceState = createWorkspaceState(browserStorage, product.config.name);
  progress = createLearningProgress(browserStorage, product.config.name);
  executionState = createExecutionState({ runner: product.runner, fingerprintSource, onChange: renderExecution,
    onResult: ({ kind, context, result }) => {
      if (kind !== "submit") return;
      progress.update(context, { submission: { identity: { ...context }, result } });
      void refreshAchievement();
    } });
  const restored = readPreferences(browserStorage, product.config.name);
  preferences = restored.value;
  applyPreferences();
  if (["corrupt", "unavailable"].includes(restored.status)) {
    byId("preference-notice").textContent = restored.status === "corrupt"
      ? "저장된 화면 설정을 읽지 못해 기본 화면을 적용했습니다. 설정을 바꾸면 새 선택을 저장합니다."
      : "이 브라우저의 저장 공간을 사용할 수 없습니다. 초안은 창을 닫기 전에 복사해 보관해 주세요.";
    byId("preference-notice").hidden = false;
  }
  document.querySelector(".wordmark-name").textContent = product.config.displayName;
  byId("course-label").textContent = `${product.config.languageVersions.join(" · ")} · JavaScript 과정`;
  byId("glossary-count").textContent = glossary.length;
  byId("header-actions").inert = false;
  elements.search.disabled = false;
  byId("track-filter").disabled = false;
  byId("version-filter").disabled = false;
  writeRoute(readRoute(), { replace: true });
  byId("boot-note").remove();
} catch (error) {
  product = null;
  byId("boot-note").textContent = `학습 자료를 불러오지 못했습니다. ${error instanceof Error ? error.message : "다시 시도해 주세요."}`;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "secondary-button";
  retry.textContent = "다시 불러오기";
  retry.addEventListener("click", () => location.reload());
  byId("boot-note").append(retry);
}
