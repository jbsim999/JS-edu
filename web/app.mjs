import { glossary, findTerms, normalizeSearch } from "./glossary-data.mjs";
import { createUnavailableRunner } from "./adapters/runner.mjs";
import { createWorkspaceState, readPreferences, writePreferences } from "./features/workspace-state.mjs";

const steps = [
  { id: "theory", name: "이론" },
  { id: "example", name: "예시" },
  { id: "quiz", name: "문제풀이" },
  { id: "practice", name: "실무 심화" },
  { id: "lab", name: "직접 코딩" },
];

const lessons = [
  {
    id: "values", name: "데이터 타입", title: "값을 복사할 때,\n무엇이 달라질까.",
    lead: "값, 바인딩, 객체의 관계를 구분하면 변경의 범위를 예측할 수 있습니다.",
    question: "복사한 객체를 바꿨는데 왜 원본도 달라질까요?",
    heading: "값의 재할당과 객체의 변경을 구분합니다",
    text: "변수에 다른 값을 할당하는 것과 객체의 프로퍼티를 변경하는 것은 다른 동작입니다. 새 객체를 만들었어도 중첩 객체까지 모두 복제된 것은 아닙니다.",
    code: 'const original = { user: { name: "민" } };\nconst copied = { ...original };\ncopied.user.name = "수";',
    observation: "original과 copied는 서로 다른 바깥 객체지만, user에는 같은 객체를 담고 있습니다.",
    prompt: "original.user.name이 달라지는 이유를 설명해 보세요.",
    answer: "객체 펼침은 얕은 복사입니다. 두 객체의 user가 같은 중첩 객체를 가리키므로 그 객체의 변경이 양쪽에서 관찰됩니다.",
    practice: "화면에 전달할 데이터를 갱신할 때 원본과 공유하는 중첩 상태를 확인합니다. 구조가 정해진 데이터에서는 변경할 경로만 새로 만드는 방법도 비교합니다.",
    task: "정해진 장바구니 구조에서 원본의 중첩 상태를 바꾸지 않고 수량을 갱신하는 함수를 설계합니다.",
    terms: ["reference", "shallow-copy", "immutable"],
  },
  {
    id: "contexts", name: "실행 컨텍스트", title: "코드는 어떤 환경에서\n실행될까.",
    lead: "실행 중인 코드의 위치와 이름을 찾는 환경을 함께 따라갑니다.",
    question: "같은 이름이 여러 범위에 있으면 어떤 값을 읽을까요?",
    heading: "식별자는 정의된 환경을 따라 찾습니다",
    text: "실행 컨텍스트는 코드 실행을 추적하는 명세상의 장치입니다. LexicalEnvironment와 VariableEnvironment는 환경 레코드에 연결되며, 이를 실제 메모리 상자나 JavaScript 객체로 보지는 않습니다.",
    code: 'const label = "바깥";\nfunction read() { return label; }\nfunction run() {\n  const label = "안쪽";\n  return read();\n}',
    observation: "read의 외부 이름 해석은 run 안의 지역 변수가 아니라 read가 정의된 환경과 연결됩니다.",
    prompt: "run()의 결과를 예측하고, 이름을 찾는 경로를 설명해 보세요.",
    answer: "이 예에서 결과는 '바깥'입니다. read는 호출한 위치의 label이 아니라 정의된 환경의 label을 읽습니다.",
    practice: "함수 선언, var, let·const의 생성·초기화 시점을 나눠 초기화 전 접근 오류를 찾습니다. 옛 교재의 환경 도식과 현재 명세 용어를 함께 대응합니다.",
    task: "중첩 함수와 블록에서 이름이 가려지는 코드를 추적하고 초기화 전 접근 결함을 수정합니다.",
    terms: ["execution-context", "lexical-environment", "environment-record"],
  },
  {
    id: "this", name: "this", title: "this는 누가\n결정할까.",
    lead: "함수를 정의한 위치와 함수를 호출하는 형태를 따로 살펴봅니다.",
    question: "메서드를 꺼내 호출하면 this는 그대로일까요?",
    heading: "일반 함수의 this는 호출 방식과 연결됩니다",
    text: "item.read()처럼 부를 때의 receiver와 함수를 변수로 옮겨 호출할 때의 this는 다를 수 있습니다. strict mode, call·apply·bind, 화살표 함수의 규칙을 구분합니다.",
    code: '"use strict";\nconst item = {\n  count: 1,\n  read() { return this.count; }\n};\nconst read = item.read;',
    observation: "read를 일반 함수처럼 직접 호출하면 이 strict 코드에서는 this가 undefined이므로 this.count 접근에 실패합니다.",
    prompt: "read()를 안전하게 호출할 두 가지 방법을 설명해 보세요.",
    answer: "read.call(item)으로 호출 시 this를 정하거나 item.read.bind(item)으로 this를 묶은 새 함수를 만들 수 있습니다.",
    practice: "콜백으로 넘길 메서드의 receiver를 명시합니다. API가 받는 thisArg와 bind를 비교하고 화살표 함수의 this는 둘로 바뀌지 않는다는 점을 확인합니다.",
    task: "메서드 추출과 콜백 전달에서 생긴 this 오류를 고치고 호출 계약을 기록합니다.",
    terms: ["this", "explicit-this", "arrow"],
  },
  {
    id: "callbacks", name: "콜백 함수", title: "함수를 건네고,\n호출을 맡긴다.",
    lead: "누가, 언제, 어떤 인자로 호출하는지가 콜백의 사용법을 결정합니다.",
    question: "함수를 인자로 전달하면 언제 실행될까요?",
    heading: "콜백은 실행의 계약을 함께 전달합니다",
    text: "콜백을 받는 쪽이 호출 시점과 인자를 결정합니다. 콜백이라는 이유만으로 비동기인 것은 아닙니다. map처럼 동기적으로 호출하는 API와 이벤트처럼 나중에 호출하는 호스트 API를 나눠 봅니다.",
    code: "const values = [1, 2, 3];\nconst doubled = values.map((value, index) => {\n  return value * 2;\n});",
    observation: "map은 각 대상 원소에 대해 콜백을 호출하고 그 반환값을 새 배열의 원소로 사용합니다.",
    prompt: "콜백이 반환한 값과 콜백을 받는 함수가 반환한 값은 항상 같을까요?",
    answer: "아닙니다. API마다 콜백 반환값의 사용 규칙이 다릅니다. map은 결과 배열을 만들고, 다른 API는 반환값을 사용하지 않을 수도 있습니다.",
    practice: "호출 횟수·인자·반환값·오류 전파를 계약으로 남깁니다. 비동기 단계가 중첩될 때는 Promise 연결로 성공과 실패의 경로를 드러내는 방법을 이어서 배웁니다.",
    task: "콜백을 정해진 순서와 횟수로 호출하고 오류를 삼키지 않는 변환 파이프라인을 만듭니다.",
    terms: ["callback", "explicit-this", "partial"],
  },
  {
    id: "bindings-and-closures", name: "클로저", title: "호출이 끝나도,\n상태는 이어진다.",
    lead: "함수가 끝난 뒤에도 count를 읽을 수 있는 이유.\n클로저를 값이 아닌 바인딩의 관점에서 살펴봅니다.",
    question: "카운터를 만든 함수가 종료된 뒤에도 count는 어떻게 남아 있을까요?",
    terms: ["closure", "binding", "scope"],
  },
  {
    id: "prototypes", name: "프로토타입", title: "객체는 모르는 이름을\n어디서 찾을까.",
    lead: "인스턴스의 상태와 여러 객체가 공유하는 동작을 분리해서 봅니다.",
    question: "직접 정의하지 않은 메서드를 어떻게 호출할 수 있을까요?",
    heading: "프로퍼티 조회는 연결된 객체로 이어집니다",
    text: "자체 프로퍼티에 이름이 없으면 프로토타입에서 찾을 수 있습니다. 생성자 함수의 prototype 프로퍼티와 인스턴스의 [[Prototype]]은 서로 연결되지만 같은 개념은 아닙니다.",
    code: "const shared = {\n  read() { return this.count; }\n};\nconst item = Object.create(shared);\nitem.count = 2;",
    observation: "read는 shared에서 찾지만 item.read()의 receiver는 item입니다. count는 item에서 읽습니다.",
    prompt: "item에 read 프로퍼티를 새로 만들면 shared의 read도 바뀔까요?",
    answer: "item에 자체 프로퍼티를 정의하면 상위의 같은 이름을 가릴 수 있습니다. 이 동작 자체가 shared의 메서드를 변경하지는 않습니다.",
    practice: "프로토타입에 가변 데이터를 넣어 인스턴스 간에 상태가 섞이는 결함을 점검합니다. constructor 프로퍼티를 고치는 일과 프로토타입 연결을 바꾸는 일을 구분합니다.",
    task: "공유 메서드와 인스턴스별 가변 상태가 분리된 위임 모델을 만듭니다.",
    terms: ["prototype", "prototype-chain", "constructor"],
  },
  {
    id: "classes", name: "클래스", title: "동작은 공유하고,\n상태는 분리한다.",
    lead: "JavaScript의 클래스 문법을 프로토타입 기반 동작과 연결해 이해합니다.",
    question: "클래스는 어떤 상태와 동작을 한 경계로 묶을까요?",
    heading: "객체의 불변식을 함께 설계합니다",
    text: "클래스는 인스턴스의 초기화, 메서드, 비공개 요소 등을 표현합니다. 생성자 함수의 역사적 상속 패턴과 ES2015 이후의 class·extends·super를 비교하며 다른 언어의 규칙을 그대로 대입하지 않습니다.",
    code: "class Counter {\n  #count = 0;\n  next() {\n    return ++this.#count;\n  }\n}",
    observation: "각 인스턴스는 자신의 #count를 갖습니다. 이 메서드는 해당 비공개 요소가 있는 receiver를 필요로 합니다.",
    prompt: "Counter 인스턴스 두 개가 같은 #count를 공유할까요?",
    answer: "이 예제의 인스턴스 필드 #count는 인스턴스별로 초기화됩니다. 프로토타입이나 별도 외부 객체에 둔 가변 상태와 구분해야 합니다.",
    practice: "상속의 초기화 순서와 super 접근을 점검합니다. 확장해야 할 동작만 작은 객체로 주입하는 합성 설계도 비교합니다.",
    task: "비공개 상태를 갖는 모델을 만들고 올바르지 않은 상태 전이와 receiver 오류를 설명합니다.",
    terms: ["class", "super", "prototype"],
  },
];

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
const defaultLesson = "bindings-and-closures";
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

async function loadResource(path, type = "json") {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) throw new Error(`자료를 불러오지 못했습니다 (${response.status}).`);
  return type === "text" ? response.text() : response.json();
}

async function loadLearningData() {
  const [config, catalog, lesson, exerciseCatalog, runtimeCatalog, starter, example] = await Promise.all([
    loadResource("/education.config.json"), loadResource("/curriculum/catalog.json"),
    loadResource("/curriculum/lessons/bindings-and-closures.json"), loadResource("/curriculum/exercises.json"),
    loadResource("/runtime/profiles.json"), loadResource("/starter/create-counter.mjs", "text"),
    loadResource("/curriculum/examples/bindings-and-closures.mjs", "text"),
  ]);
  const catalogEntry = catalog.lessons?.find(item => item.id === defaultLesson);
  const exercise = exerciseCatalog.exercises?.find(item => item.id === lesson.exerciseId);
  const profile = runtimeCatalog.profiles?.find(item => item.id === exercise?.profileId);
  const file = exercise?.files?.find(item => item.id === "create-counter" && item.editable);
  const bodyMatch = starter.match(/^export function createCounter\(initial = 0\) \{\r?\n([\s\S]*?)\r?\n\}\s*$/u);
  if (typeof config.name !== "string" || typeof config.displayName !== "string" || !catalogEntry
    || lesson.id !== defaultLesson || typeof lesson.contentRevision !== "string" || !lesson.contentRevision
    || !Array.isArray(lesson.supportedVersions) || !lesson.supportedVersions.length
    || !lesson.supportedVersions.every(value => typeof value === "string")
    || !steps.every(step => typeof lesson.steps?.[step.id] === "string")
    || !Array.isArray(lesson.goals) || !Array.isArray(lesson.sources)
    || !exercise || exercise.lessonId !== lesson.id || catalogEntry.exerciseId !== exercise.id
    || exercise.mode !== "body" || !Array.isArray(exercise.instructions) || !Array.isArray(exercise.behaviorCriteria)
    || !profile || !file || file.path !== "starter/create-counter.mjs" || !bodyMatch) {
    throw new Error("학습 자료의 연결을 확인하지 못했습니다. 자료를 복구한 뒤 다시 불러와 주세요.");
  }
  const reason = profile.execution?.available === false && typeof profile.execution.reason === "string"
    ? profile.execution.reason : "이 학습 화면에는 실제 실행기와 제출 검사를 아직 연결하지 않았습니다.";
  const runner = createUnavailableRunner(reason);
  return { config, catalog, lesson, exercise, profile, file, starter, example, initialBody: bodyMatch[1], runner, environment: await runner.getEnvironment() };
}

function draftIdentity(kind) {
  return { lessonId: product.lesson.id, contentRevision: product.lesson.contentRevision,
    exerciseId: product.exercise.id, fileId: kind === "code" ? product.file.id : "lesson-note" };
}

function field(kind) {
  return workspaceState.load(draftIdentity(kind), kind === "code" ? product.initialBody : "");
}

function fieldMessage(record) {
  if (record.status === "corrupt") return "저장된 내용을 읽을 수 없어 원본을 보존했습니다. 자동 저장은 멈춰 있습니다. 초기화를 선택하면 저장된 내용을 지우고 다시 시작합니다.";
  if (record.status === "read-error") return "브라우저의 저장 내용을 읽지 못했습니다. 기존 데이터 보호를 위해 자동 저장을 멈췄습니다. 작성한 내용은 복사해 보관해 주세요.";
  if (record.status === "unavailable" || record.status === "write-error") return "브라우저에 저장하지 못했습니다. 현재 화면의 내용은 유지되지만, 닫기 전에 복사해 보관해 주세요.";
  if (record.status === "pending") return "저장 중…";
  if (record.status === "saved") return "이 브라우저에 저장됨";
  return "입력하면 이 브라우저에 자동 저장됩니다.";
}

function updateFieldStatus(kind) {
  const record = field(kind);
  const status = byId(`${kind}-save-status`);
  if (!status) return;
  status.textContent = fieldMessage(record);
  status.classList.toggle("field-warning", ["corrupt", "read-error", "write-error", "unavailable"].includes(record.status));
  const retry = byId(`${kind}-save-retry`);
  if (retry) retry.hidden = !["write-error", "unavailable"].includes(record.status) || !record.dirty;
}

function flushDrafts() {
  clearTimeout(saveTimer);
  if (!workspaceState || !product) return;
  for (const record of workspaceState.records()) workspaceState.save(record.identity);
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
  return `<details class="lesson-source"><summary>학습 목표와 공식 자료</summary><ul>${product.lesson.goals.map(goal => `<li>${escapeHtml(goal)}</li>`).join("")}</ul>${product.lesson.sources.map(source => {
    let url;
    try { url = new URL(source.url); } catch { return ""; }
    return url.protocol === "https:" ? `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)} ↗ <span class="sr-only">(새 탭)</span></a>` : "";
  }).join("")}</details>`;
}

function notesBlock() {
  return `<section class="notes-section" aria-labelledby="notes-title"><div class="field-heading"><h3 id="notes-title">생각 메모</h3><button type="button" class="plain-button" data-reset-field="note">메모 비우기</button></div><label for="lesson-note" class="sr-only">이 수업의 생각 메모</label><textarea id="lesson-note" data-draft="note" rows="4" maxlength="200000" placeholder="어떤 바인딩이 바뀌었는지, 다음에 확인할 것은 무엇인지 적어 보세요." aria-describedby="note-save-status"></textarea><p id="note-save-status" class="save-status" role="status"></p><button id="note-save-retry" type="button" class="plain-button" data-save-field="note" hidden>저장 다시 시도</button></section>`;
}

function codingContent() {
  const { exercise, environment, profile, file: sourceFile } = product;
  return `<span class="section-number">05 / 직접 코딩</span><h2>독립된 카운터를 완성하세요</h2><p>${escapeHtml(product.lesson.steps.lab)}</p><ul class="reading-list">${exercise.instructions.map(text => `<li>${escapeHtml(text)}</li>`).join("")}</ul>
    <section class="editor-section" aria-labelledby="editor-title"><div class="editor-toolbar"><div><h3 id="editor-title">함수 본문 초안</h3><p>${escapeHtml(sourceFile.path)}</p></div><div class="editor-actions"><button type="button" class="plain-button" id="copy-code">전체 코드 복사</button><button type="button" class="plain-button" data-reset-field="code">초기화</button></div></div>
    <p class="editor-help" id="editor-help">아래 본문만 편집할 수 있습니다. 일반 텍스트 편집기이며 문법 강조·자동 완성은 제공하지 않습니다. Tab 키는 다음 항목으로 이동합니다.</p>
    <div class="body-editor"><pre class="editor-fixed" aria-label="읽기 전용 함수 선언">export function createCounter(initial = 0) {</pre><label class="sr-only" for="code-editor">createCounter 함수 본문</label><textarea id="code-editor" data-draft="code" rows="10" maxlength="200000" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="editor-help code-save-status"></textarea><pre class="editor-fixed" aria-label="읽기 전용 함수 닫기">}</pre></div>
    <p id="code-save-status" class="save-status" role="status"></p><button id="code-save-retry" type="button" class="plain-button" data-save-field="code" hidden>저장 다시 시도</button><p id="copy-status" class="save-status" role="status"></p></section>
    <details><summary>구현할 때 확인할 조건</summary><ul class="reading-list">${exercise.behaviorCriteria.map(text => `<li>${escapeHtml(text)}</li>`).join("")}</ul></details>
    <section class="execution-section" aria-labelledby="execution-title"><h3 id="execution-title">실행 환경</h3><dl class="runtime-details"><div><dt>언어 기준</dt><dd>${escapeHtml(profile.languageVersion)}</dd></div><div><dt>실제 런타임</dt><dd>연결 전</dd></div><div><dt>제출 검사</dt><dd>연결 전 · 성취 기록 없음</dd></div></dl><div class="disabled-actions"><button type="button" disabled aria-describedby="runtime-note">코드 실행</button><button type="button" disabled aria-describedby="runtime-note">제출 검사</button></div><p class="runtime-note" id="runtime-note">${escapeHtml(environment.reason)}. 지금은 코드를 작성하고 저장할 수 있습니다.</p></section>`;
}

function closureContent(step) {
  const content = product.lesson.steps[step];
  if (step === "lab") return codingContent() + notesBlock();
  const labels = {
    theory: ["01 / 이해하기", "함수는 자신이 만들어진 환경과 연결됩니다"],
    example: ["02 / 코드 따라 읽기", "카운터 두 개, 각각의 상태"],
    quiz: ["03 / 생각해 보기", "다른 카운터의 호출은 영향을 줄까요?"],
    practice: ["04 / 실무에 연결하기", "독립된 상태가 필요한 순간"],
  };
  const [number, heading] = labels[step];
  let body;
  if (step === "quiz") {
    const [question, explanation = ""] = content.split("정답:");
    body = `<p>${escapeHtml(question)}</p><details><summary>해설 펼치기</summary><p>${escapeHtml(explanation.replace("퀴즈 UI와 채점은 미구현이다.", ""))}</p></details><p class="sample-note">생각을 메모하고 해설과 비교하는 문제입니다. 답안 채점과 성취 기록은 아직 연결하지 않았습니다.</p>`;
  } else {
    body = `<p>${escapeHtml(content)}</p>`;
  }
  if (step === "theory") {
    body += `<aside class="margin-note"><span aria-hidden="true">✳</span><p>핵심 용어를 연결해 보세요.<br>${termButton("closure")} · ${termButton("binding")} · ${termButton("scope")}</p></aside>`;
  }
  if (step === "example") body += codeBlock(product.example, "bindings-and-closures.mjs") + '<p class="sample-note">예상 출력: <code>1 2 11 3</code> · 실제 실행 결과가 아닙니다.</p>';
  return `<span class="section-number">${number}</span><h2>${heading}</h2>${body}${officialSource()}${notesBlock()}`;
}
function sampleContent(lesson, step) {
  const notice = `<p class="sample-note">${escapeHtml(lesson.name)} 개념 미리보기입니다. 이 주제의 교재와 직접 코딩 과제는 준비 중입니다.</p>`;
  if (step === "theory") return `${questionBlock(lesson.question)}${notice}
    <span class="section-number">01 / 개념 미리보기</span><h2>${escapeHtml(lesson.heading)}</h2>
    <p>${escapeHtml(lesson.text)}</p>${codeBlock(lesson.code)}
    <p>${escapeHtml(lesson.observation)}</p>
    <h3>함께 읽을 용어</h3><p>${lesson.terms.map(id => termButton(id)).join(" · ")}</p>`;
  if (step === "example") return `${notice}<span class="section-number">02 / 예시 미리보기</span>
    <h2>작은 코드로 관계를 확인합니다</h2>${codeBlock(lesson.code)}<p>${escapeHtml(lesson.observation)}</p>`;
  if (step === "quiz") return `${notice}<span class="section-number">03 / 문제 미리보기</span>
    <h2>${escapeHtml(lesson.prompt)}</h2>${codeBlock(lesson.code)}
    <details><summary>해설 펼치기</summary><p>${escapeHtml(lesson.answer)}</p></details>
    <p class="code-note">해설 열기는 채점이나 학습 완료로 기록되지 않습니다.</p>`;
  if (step === "practice") return `${notice}<span class="section-number">04 / 적용 미리보기</span>
    <h2>실제 설계에서 확인할 질문</h2><p>${escapeHtml(lesson.practice)}</p>
    <h3>용어를 연결해서 읽기</h3><p>${lesson.terms.map(id => termButton(id)).join(" · ")}</p>
    <aside class="margin-note"><span aria-hidden="true">※</span><p>구현의 편의뿐 아니라 잘못된 입력과 상태 변경, 호출 계약이 드러나는지도 함께 비교합니다.</p></aside>`;
  return `${notice}<span class="section-number">05 / 과제 방향</span><h2>작성할 결과물</h2>
    <p>${escapeHtml(lesson.task)}</p><div class="disabled-actions"><button type="button" disabled aria-describedby="runtime-note">코드 실행</button><button type="button" disabled aria-describedby="runtime-note">제출 검사</button></div>
    <p class="runtime-note" id="runtime-note">이 주제의 starter·편집기·실행기·검사기는 연결 전입니다. 과제 방향을 검토하는 화면입니다.</p>`;
}

function readRoute() {
  const params = new URL(location.href).searchParams;
  return {
    lesson: lessons.some(item => item.id === params.get("lesson")) ? params.get("lesson") : defaultLesson,
    step: steps.some(item => item.id === params.get("step")) ? params.get("step") : "theory",
    term: params.get("term") || null,
    version: product.lesson.supportedVersions.includes(params.get("version")) ? params.get("version") : product.lesson.supportedVersions[0],
  };
}

function writeRoute(next, { replace = false, termEntry = false } = {}) {
  next = { ...next, version: next.version || route?.version || product.lesson.supportedVersions[0] };
  const url = new URL(location.href);
  url.searchParams.set("lesson", next.lesson);
  url.searchParams.set("step", next.step);
  url.searchParams.set("version", next.version);
  if (next.term) url.searchParams.set("term", next.term);
  else url.searchParams.delete("term");
  history[replace ? "replaceState" : "pushState"]({ jsEduWorkspace: true, jsEduWorkspaceTerm: termEntry }, "", url);
  applyRoute(next);
}

function ensureActiveTabVisible(target) {
  const tab = target instanceof HTMLElement ? target : elements.tabs.querySelector('[aria-selected="true"]');
  if (!tab) return;
  const bounds = tab.getBoundingClientRect();
  const container = elements.tabs.getBoundingClientRect();
  if (bounds.left < container.left + 4) elements.tabs.scrollLeft -= container.left + 4 - bounds.left;
  if (bounds.right > container.right - 4) elements.tabs.scrollLeft += bounds.right - container.right + 4;
}

function renderLesson() {
  const lesson = lessons.find(item => item.id === route.lesson);
  const index = lessons.indexOf(lesson);
  document.title = `${lesson.name} · ${product.config.displayName}`;
  elements.lessonKicker.textContent = `JavaScript 핵심 / ${String(index + 1).padStart(2, "0")} ${lesson.name}`;
  elements.lessonHeading.textContent = lesson.name;
  elements.lessonLead.textContent = lesson.id === defaultLesson ? product.lesson.title : lesson.lead;
  byId("lesson-meta").innerHTML = lesson.id === defaultLesson
    ? `<span>교재 초안</span><span>${escapeHtml(route.version)}</span><span>코딩 초안 저장 가능</span>`
    : '<span>개념 미리보기</span><span>교재·과제 준비 중</span>';
  byId("lesson-revision").textContent = lesson.id === defaultLesson ? `교재 개정 ${product.lesson.contentRevision}` : "개념 미리보기";
  elements.lessonList.innerHTML = lessons.map((item, number) => `<li><button type="button" class="lesson-link" data-lesson="${item.id}"${item.id === lesson.id ? ' aria-current="page"' : ""}><span class="lesson-number">${String(number + 1).padStart(2, "0")}</span><span class="lesson-name">${escapeHtml(item.name)}</span></button></li>`).join("");
  renderPanel();
  renderSearch();
}

function renderPanel() {
  const lesson = lessons.find(item => item.id === route.lesson);
  const currentIndex = steps.findIndex(item => item.id === route.step);
  elements.tabs.innerHTML = steps.map(item => `<button class="step-tab" type="button" role="tab" id="step-${item.id}" aria-controls="lesson-panel" aria-selected="${item.id === route.step}" tabindex="${item.id === route.step ? 0 : -1}" data-step="${item.id}">${item.name}</button>`).join("");
  elements.panel.setAttribute("aria-labelledby", `step-${route.step}`);
  elements.panel.innerHTML = lesson.id === defaultLesson ? closureContent(route.step) : sampleContent(lesson, route.step);
  elements.panel.querySelectorAll("[data-draft]").forEach(input => {
    input.value = field(input.dataset.draft).value;
    updateFieldStatus(input.dataset.draft);
  });
  const next = steps[(currentIndex + 1) % steps.length];
  elements.footer.innerHTML = `<span>학습 단계 ${currentIndex + 1} / ${steps.length}</span><button type="button" class="next-step" data-step="${next.id}">${currentIndex === steps.length - 1 ? "이론으로 돌아가기" : `다음: ${next.name}`}<span aria-hidden="true">→</span></button>`;
  ensureActiveTabVisible();
}

function renderSearch() {
  if (composing) return;
  const query = elements.search.value;
  const results = findTerms(query, route.lesson);
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
    message.textContent = `“${query.trim()}”에 맞는 용어가 없습니다. 한글이나 영문 표제어를 짧게 입력해 보세요.`;
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "plain-button";
    clear.textContent = "검색 지우고 관련 용어 보기";
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
  if (mode === "toc") focusIfVisible(elements.lessonList.querySelector('[aria-current="page"]'));
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
    const lesson = lessons.find(item => item.id === lessonId);
    return `<li><button type="button" class="plain-button" data-lesson="${lessonId}">${escapeHtml(lesson.name)} <span aria-hidden="true">↗</span></button></li>`;
  }).join("")}</ul><p class="code-note">클로저는 교재 초안, 다른 주제는 개념 미리보기로 연결됩니다.</p><div class="term-source"><p>개념의 근거와 더 읽을 자료</p><a href="${escapeHtml(entry.source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.source.title)} ↗ <span class="sr-only">(새 탭)</span></a><p>이 설명은 원문을 그대로 옮긴 것이 아닌 학습용 요약입니다.</p></div></section>`;
  setDialogMode("term");
}

function applyRoute(next) {
  const lessonChanged = !route || route.lesson !== next.lesson;
  const stepChanged = !route || route.step !== next.step;
  if (lessonChanged || stepChanged) {
    flushDrafts();
    if (byId("reset-dialog").open) byId("reset-dialog").close("cancel");
  }
  route = next;
  if (lessonChanged) renderLesson();
  else if (stepChanged) renderPanel();
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

document.addEventListener("input", event => {
  const input = event.target;
  if (!(input instanceof HTMLTextAreaElement) || !input.dataset.draft || !product) return;
  workspaceState.update(draftIdentity(input.dataset.draft), input.value);
  updateFieldStatus(input.dataset.draft);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushDrafts, 500);
});

document.addEventListener("click", async event => {
  const target = event.target instanceof Element ? event.target : null;
  if (!product) return;
  const reset = target?.closest("[data-reset-field]");
  if (reset) {
    flushDrafts();
    pendingReset = reset.dataset.resetField;
    resetOpener = reset;
    byId("reset-title").textContent = pendingReset === "code" ? "코드 초안을 처음으로 되돌릴까요?" : "메모를 비울까요?";
    byId("reset-description").textContent = pendingReset === "code"
      ? "이 브라우저의 현재 과제 초안과 작성 중인 내용을 지우고 처음 코드로 돌아갑니다. 생각 메모는 유지됩니다."
      : "이 수업의 생각 메모를 지웁니다. 코드 초안은 유지됩니다.";
    byId("reset-error").hidden = true;
    byId("reset-dialog").returnValue = "";
    document.body.classList.add("modal-open");
    byId("reset-dialog").showModal();
  }
  const save = target?.closest("[data-save-field]");
  if (save) {
    workspaceState.save(draftIdentity(save.dataset.saveField));
    updateFieldStatus(save.dataset.saveField);
  }
  if (target?.closest("#copy-code")) {
    const status = byId("copy-status");
    const code = `export function createCounter(initial = 0) {\n${field("code").value}\n}\n`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(code);
      if (status.isConnected) status.textContent = "함수 선언을 포함한 전체 코드를 복사했습니다.";
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
  const result = workspaceState.reset(draftIdentity(pendingReset));
  if (!result.ok) {
    byId("reset-error").textContent = "저장 공간을 변경하지 못했습니다. 작성한 내용과 저장된 내용은 유지됩니다.";
    byId("reset-error").hidden = false;
    return;
  }
  const input = byId(pendingReset === "code" ? "code-editor" : "lesson-note");
  if (input) input.value = result.record.value;
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
window.addEventListener("pagehide", flushDrafts);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushDrafts(); });
window.addEventListener("beforeunload", event => {
  flushDrafts();
  if (workspaceState?.records().some(record => record.dirty)) {
    event.preventDefault();
    event.returnValue = "";
  }
});

try {
  product = await loadLearningData();
  try { browserStorage = window.localStorage; } catch { /* Storage access can be blocked. */ }
  workspaceState = createWorkspaceState(browserStorage, product.config.name);
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
  byId("catalog-status").textContent = `교재 초안 ${product.catalog.lessons.length}개 · 개념 미리보기 ${lessons.length - 1}개`;
  byId("course-label").textContent = `${product.lesson.supportedVersions.join(" · ")} · 공통 과정`;
  byId("glossary-count").textContent = glossary.length;
  byId("header-actions").inert = false;
  elements.search.disabled = false;
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
