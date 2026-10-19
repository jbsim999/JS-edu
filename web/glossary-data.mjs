import { expandedGlossary } from './glossary-expanded.mjs';

const specification = "https://262.ecma-international.org/17.0/#";

function term(id, name, english, summary, definition, example, misconception, lessons, anchor, aliases = []) {
  return Object.freeze({
    id, name, english, summary, definition, example, misconception, lessons,
    contentRevision: "preview-1",
    scope: ["partial", "currying", "reference", "hoisting", "scope"].includes(id) ? "educational-concept" : "language",
    aliases: [name, english, ...aliases],
    source: { title: "ECMA-262 · ECMAScript 2026 명세", url: `${specification}${anchor}` },
  });
}

// 기존 개념 설명 28개를 재사용한다. 용어 개정은 교재 개정과 독립적이며 성취를 기록하지 않는다.
const legacyGlossary = Object.freeze([
  term("primitive", "원시값", "Primitive value", "객체가 아닌 값. 값 자체의 일부를 바꿀 수 없습니다.",
    "undefined, null, boolean, number, bigint, string, symbol 값은 원시값입니다. 변수에 다른 값을 다시 할당하는 것과 원시값 자체를 변경하는 것은 다릅니다.",
    'let name = "JS";\nname = name + "-edu";\n// 새 문자열을 name에 할당한다.',
    "문자열 변수가 바뀌었다고 해서 기존 문자열이 수정된 것은 아닙니다.", ["values"], "sec-primitive-value", ["기본형", "원시 타입", "primitive type"]),
  term("reference", "객체 참조", "Object reference", "여러 변수가 같은 객체를 가리킬 수 있다는 관계입니다.",
    "객체 값을 다른 변수에 대입해도 객체의 내용이 복사되지는 않습니다. 두 변수로 같은 객체를 관찰할 수 있습니다. 이 설명은 실제 주소나 엔진의 물리적 메모리 배치를 뜻하지 않습니다.",
    "const a = { count: 0 };\nconst b = a;\nb.count = 1;\n// a.count도 1이다.",
    "JavaScript의 객체 인자 전달을 변수 자체를 전달하는 참조 전달로 설명하면 재할당 동작을 오해하기 쉽습니다.", ["values"], "sec-object-type", ["참조형", "reference", "reference type"]),
  term("binding", "바인딩", "Binding", "식별자와 값을 연결하는 관계입니다.",
    "변수 이름으로 값을 읽거나 바꿀 수 있게 해 주는 연결입니다. 클로저는 외부 바인딩을 사용하므로, 함수가 만들어진 순간의 값을 무조건 복사해 보관한다고 설명하지 않습니다.",
    "let count = 0;\nconst read = () => count;\ncount = 3;\n// read()는 현재 count인 3을 읽는다.",
    "const가 막는 것은 바인딩의 재할당입니다. 연결된 객체의 모든 변경까지 막지는 않습니다.", ["contexts", "bindings-and-closures"], "sec-environment-records", ["식별자", "변수", "identifier", "variable"]),
  term("immutable", "불변성", "Immutability", "기존 값을 바꾸지 않고 새 값으로 변화를 표현하는 성질입니다.",
    "원시값은 불변입니다. 객체에는 변경하지 않는 설계나 별도 제한이 필요합니다. Object.freeze는 대상 객체의 자체 프로퍼티를 제한하지만 중첩 객체까지 자동으로 동결하지 않습니다.",
    "const original = { count: 1 };\nconst next = { ...original, count: 2 };\n// original은 그대로 유지한다.",
    "const 선언만으로 객체가 불변 객체가 되지는 않습니다.", ["values", "classes"], "sec-object.freeze", ["불변 객체", "immutable object", "freeze", "Object.freeze"]),
  term("shallow-copy", "얕은 복사", "Shallow copy", "바깥쪽만 복사하고 중첩 객체는 공유하는 복사입니다.",
    "객체 펼침 구문은 열거 가능한 자체 프로퍼티 값을 새 객체에 복사합니다. 프로퍼티 값이 객체라면 그 객체는 공유합니다. 프로토타입과 모든 프로퍼티 특성을 복제하는 동작도 아닙니다.",
    'const a = { user: { name: "민" } };\nconst b = { ...a };\nb.user.name = "수";\n// a.user.name도 "수"다.',
    "객체 펼침 구문을 썼다는 이유만으로 중첩 상태까지 독립됐다고 판단하지 않습니다.", ["values"], "sec-copydataproperties", ["spread", "복사", "얕은복사"]),
  {
    ...term("deep-copy", "깊은 복사", "Deep copy", "필요한 중첩 상태까지 독립시키는 복사 전략입니다.",
      "복제 대상의 타입과 공유 관계를 먼저 정해야 합니다. 웹의 structuredClone은 지원하는 값을 복제하지만 함수 등 모든 값을 복제하지는 않습니다. JSON 왕복 역시 범용 복제 방법이 아닙니다.",
      "const a = { scores: [1, 2] };\nconst b = { scores: [...a.scores] };\nb.scores.push(3);\n// 이 데이터 구조에서는 배열도 독립적이다.",
      "깊은 복사는 모든 JavaScript 값에 대해 동일한 규칙으로 동작하는 단일 언어 연산이 아닙니다.", ["values"], "sec-object-type", ["deep clone", "깊은복사", "structuredClone"]),
    scope: "html-host",
    source: { title: "WHATWG HTML · Structured cloning", url: "https://html.spec.whatwg.org/multipage/structured-data.html#safe-passing-of-structured-data" },
  },
  term("undefined", "undefined", "Undefined", "Undefined 타입의 유일한 값입니다.",
    "초기값 없이 선언한 let 변수, 없는 프로퍼티 조회, 값을 명시하지 않은 반환 등에서 만날 수 있습니다. 선언하지 않은 식별자를 직접 읽어 생기는 오류와는 구분해야 합니다.",
    "let value;\nconst item = {};\n// value와 item.missing은 undefined다.",
    "undefined인 프로퍼티와 프로퍼티 자체가 없는 상태는 항상 같지 않습니다.", ["values"], "sec-ecmascript-language-types-undefined-type", ["미정의", "정의되지 않음"]),
  term("null", "null", "Null", "Null 타입의 유일한 값. 없음을 표현하는 데 자주 씁니다.",
    "null을 사용하는 의미는 데이터 계약에 따라 정합니다. null과 undefined는 서로 다른 값이며 엄격한 동등 비교에서는 같지 않습니다.",
    "const selectedUser = null;\n// 아직 선택한 사용자가 없다는 앱의 계약이다.\n// null === undefined는 false다.",
    "typeof null의 결과가 object여도 null이 객체라는 뜻은 아닙니다.", ["values"], "sec-ecmascript-language-types-null-type", ["널", "빈 값"]),
  term("execution-context", "실행 컨텍스트", "Execution context", "코드 실행을 추적하기 위해 명세가 사용하는 장치입니다.",
    "현재 실행 위치와 환경 등의 정보를 설명하는 명세상의 개념입니다. 함수 호출 시의 컨텍스트 전환을 통해 실행을 이해할 수 있지만, 직접 접근하는 JavaScript 객체나 엔진 메모리 구조는 아닙니다.",
    "function outer() {\n  return inner();\n}\nfunction inner() { return 1; }\nouter();",
    "함수 호출 컨텍스트가 끝났다고 해서 그 함수와 관련된 모든 값이 즉시 회수되지는 않습니다.", ["contexts", "bindings-and-closures"], "sec-execution-contexts", ["컨텍스트", "실행 문맥", "context"]),
  term("lexical-environment", "LexicalEnvironment", "Lexical environment", "실행 컨텍스트가 식별자를 해석할 때 사용하는 환경입니다.",
    "현재 명세에서는 실행 컨텍스트의 LexicalEnvironment 컴포넌트가 Environment Record를 가리킵니다. 중첩된 블록 등에서 식별자를 찾는 출발 환경을 이해하는 데 사용합니다.",
    "let label = " + '"바깥";' + "\n{\n  let label = " + '"안쪽";' + "\n  // 이 블록에서는 안쪽 label을 찾는다.\n}",
    "LexicalEnvironment와 옛 교재의 내부 상자 그림을 실제 엔진 객체 구조로 동일시하지 않습니다.", ["contexts", "bindings-and-closures"], "sec-execution-contexts", ["렉시컬 환경", "어휘 환경", "lexicalenvironment"]),
  term("variable-environment", "VariableEnvironment", "Variable environment", "var 등의 바인딩에 사용할 환경을 추적하는 컴포넌트입니다.",
    "실행 컨텍스트의 VariableEnvironment 역시 Environment Record를 가리킵니다. LexicalEnvironment와 같은 레코드를 가리킬 수 있지만, 블록 등에서는 서로 달라질 수 있습니다.",
    "function read() {\n  { var count = 1; }\n  return count;\n}\n// var는 이 블록만의 바인딩이 아니다.",
    "VariableEnvironment를 실행 시작 때 복사해 두고 영원히 변하지 않는 스냅샷이라고 외우지 않습니다.", ["contexts"], "sec-execution-contexts", ["변수 환경", "variableenvironment"]),
  term("environment-record", "환경 레코드", "Environment Record", "이름과 바인딩, 바깥 환경 관계를 명세에서 다룹니다.",
    "환경 레코드는 바인딩 생성·초기화·읽기 등의 연산을 정의합니다. [[OuterEnv]]는 바깥 환경 레코드 또는 null을 참조합니다. environmentRecord·outerEnvironmentReference라는 옛 도식 용어와 구분해 읽습니다.",
    "const label = " + '"바깥";' + "\nfunction read() {\n  return label;\n}\n// 이름 해석은 바깥 환경으로 이어질 수 있다.",
    "환경 레코드는 일반 객체의 프로퍼티 열거로 들여다볼 수 있는 JavaScript 값이 아닙니다.", ["contexts", "bindings-and-closures"], "sec-environment-records", ["environmentRecord", "environment record", "outerEnvironmentReference", "OuterEnv"]),
  term("scope", "렉시컬 스코프", "Lexical scope", "코드를 작성한 위치에 따라 이름의 유효 범위가 정해집니다.",
    "함수가 호출된 장소가 아니라 정의된 문맥을 바탕으로 외부 식별자를 해석합니다. 스코프 체인은 이런 환경의 바깥 연결을 따라 이름을 찾는 과정을 설명하는 학습 용어입니다.",
    "const value = 1;\nfunction read() { return value; }\nfunction call() {\n  const value = 2;\n  return read(); // 1\n}",
    "호출한 함수에 같은 이름의 변수가 있다고 해서 그 변수를 자동으로 가져오지는 않습니다.", ["contexts", "bindings-and-closures"], "sec-getidentifierreference", ["스코프", "scope chain", "스코프 체인", "정적 스코프"]),
  term("hoisting", "호이스팅", "Hoisting", "선언 처리와 초기화 시점을 설명하는 학습 용어입니다.",
    "선언마다 바인딩 생성과 초기화 규칙이 다릅니다. var, 함수 선언, let·const를 함께 비교해야 합니다. let·const는 초기화 전에 접근하면 오류가 나는 구간(TDZ)이 있습니다.",
    "// 함수 내부의 예\n// var 선언은 undefined로 먼저 초기화된다.\nconsole.log(count);\nvar count = 1;",
    "엔진이 소스 코드를 위로 이동시킨다고 생각하거나 모든 선언이 같은 시점에 사용 가능하다고 생각하지 않습니다.", ["contexts"], "sec-functiondeclarationinstantiation", ["hoist", "TDZ", "일시적 사각지대", "temporal dead zone"]),
  term("this", "this", "This binding", "일반 함수에서는 호출 방식에 영향을 받는 값입니다.",
    "객체의 메서드로 부른 경우와 함수를 꺼내 따로 부른 경우를 구분합니다. strict mode의 일반 함수 호출에서 this는 undefined가 될 수 있으며, 화살표 함수는 자체 this 바인딩을 만들지 않습니다.",
    "const item = {\n  count: 1,\n  read() { return this.count; }\n};\nitem.read(); // receiver는 item",
    "함수가 어느 객체에 저장돼 있었다는 사실만으로 모든 호출의 this가 고정되지는 않습니다.", ["this"], "sec-ordinarycallbindthis", ["디스", "receiver", "리시버"]),
  term("explicit-this", "명시적 this 바인딩", "call / apply / bind", "호출할 때 this를 지정하거나, 지정한 함수를 만듭니다.",
    "call은 인자를 나열하고 apply는 인자 목록을 받아 호출합니다. bind는 this와 앞쪽 인자가 고정된 새 함수를 만듭니다. 화살표 함수의 this는 이 방법으로 바뀌지 않습니다.",
    "function read() { return this.count; }\nconst readItem = read.bind({ count: 2 });\n// readItem()은 2를 반환한다.",
    "bind 호출 자체가 원래 함수를 즉시 실행하는 것은 아닙니다. new로 호출할 때의 규칙도 별도로 다룹니다.", ["this", "callbacks"], "sec-function.prototype.bind", ["call", "apply", "bind", "this 바인딩"]),
  term("this-arg", "콜백의 thisArg", "thisArg", "일부 API가 콜백의 this로 전달할 값을 받는 인자입니다.",
    "Array.prototype.map 같은 API는 두 번째 인자로 thisArg를 받습니다. 일반 함수 콜백은 이 값을 this로 사용할 수 있지만 화살표 함수의 this는 정의된 문맥을 따르므로 바뀌지 않습니다.",
    "const context = { factor: 2 };\nconst values = [1, 2].map(function (value) {\n  return value * this.factor;\n}, context);\n// 화살표로 바꾸면 이 thisArg를 사용하지 않는다.",
    "모든 콜백 API에 thisArg가 있는 것은 아닙니다. 해당 API의 인자와 호출 계약을 확인해야 합니다.", ["this", "callbacks"], "sec-array.prototype.map", ["thisarg", "콜백 this", "별도 this 인자"]),
  term("arrow", "화살표 함수", "Arrow function", "자체 this를 만들지 않는 함수 표현식입니다.",
    "주변의 this를 사용하며 new로 생성자처럼 호출할 수 없습니다. 짧은 문법을 선택하는 문제와 this·arguments 동작을 선택하는 문제를 함께 고려합니다.",
    "function makeReader() {\n  return () => this.count;\n}\nconst read = makeReader.call({ count: 2 });\n// read()는 바깥 호출의 this를 사용한다.",
    "객체 리터럴 안에 화살표 함수를 넣어도 그 객체가 자동으로 this가 되지 않습니다.", ["this"], "sec-arrow-function-definitions", ["arrow", "화살표", "=>"]),
  term("callback", "콜백 함수", "Callback", "다른 코드에 전달해 그 코드가 호출하도록 하는 함수입니다.",
    "호출 시점, 전달 인자, this, 반환값 사용 규칙은 콜백을 받는 API가 정합니다. 배열 순회처럼 동기적으로 호출되는 콜백도 있으므로 비동기와 같은 뜻은 아닙니다.",
    "const values = [1, 2];\nconst doubled = values.map(value => value * 2);\n// map은 콜백을 동기적으로 호출한다.",
    "메서드를 콜백으로 전달하면 원래 객체와의 this 연결이 자동으로 보존된다고 가정하지 않습니다.", ["callbacks", "bindings-and-closures"], "sec-array.prototype.map", ["콜백", "callback function", "제어권"]),
  term("closure", "클로저", "Closure", "함수가 자신이 만들어진 바깥 환경의 바인딩을 사용하는 관계입니다.",
    "함수는 자신이 만들어진 환경과 연결됩니다. 바깥 함수의 호출이 끝난 뒤에도 반환된 함수가 외부 바인딩을 사용할 수 있습니다. 호출할 때마다 새로 만든 환경은 서로 독립적입니다.",
    "function createCounter(initial = 0) {\n  let count = initial;\n  return () => ++count;\n}\nconst a = createCounter();\nconst b = createCounter(10);",
    "클로저가 생성 순간의 값을 항상 복사해 저장한다고 설명하면 나중의 바인딩 변경을 이해할 수 없습니다.", ["bindings-and-closures"], "sec-ordinary-function-objects", ["클로져", "closure", "정보 은닉", "캡슐화"]),
  {
    ...term("garbage-collection", "가비지 컬렉션", "Garbage collection", "더 이상 필요한 경로가 없는 자원의 회수를 엔진이 관리합니다.",
      "사용 중인 함수가 외부 데이터를 참조하면 그 데이터의 생존에 영향을 줄 수 있습니다. 이벤트 리스너·타이머 같은 소유 관계를 정리해야 하며 실제 회수 시점을 코드에서 보장할 수는 없습니다.",
      "let read = (() => {\n  const data = [1, 2, 3];\n  return () => data.length;\n})();\nread = null; // 이 경로의 참조를 놓는다.",
      "null 대입은 특정 참조를 제거할 뿐 즉시 메모리를 회수하라는 명령이 아닙니다.", ["bindings-and-closures"], "sec-ordinary-function-objects", ["GC", "memory", "메모리 관리", "메모리"]),
    scope: "engine-memory",
    source: { title: "MDN · JavaScript 메모리 관리", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management" },
  },
  term("partial", "부분 적용", "Partial application", "일부 인자를 미리 정해 새 함수를 만드는 패턴입니다.",
    "여러 인자를 받는 함수에서 먼저 알고 있는 인자를 고정합니다. 나머지 인자를 받는 함수를 반환해 재사용할 수 있습니다. 이것은 설계 패턴이며 전용 문법 이름은 아닙니다.",
    "const add = (a, b) => a + b;\nconst addTen = b => add(10, b);\n// addTen(2)는 12다.",
    "부분 적용과 모든 인자를 한 번에 하나씩 받도록 바꾸는 커링은 목적이 비슷해도 같은 변환은 아닙니다.", ["bindings-and-closures", "callbacks"], "sec-ordinary-function-objects", ["부분 적용 함수", "partial"]),
  term("currying", "커링", "Currying", "여러 인자를 한 번에 받는 함수를 단계별 함수로 바꾸는 패턴입니다.",
    "각 단계가 인자를 받아 다음 함수를 돌려주도록 구성합니다. 클로저로 앞 단계의 인자를 사용할 수 있습니다. 모든 API를 커링해야 한다는 의미는 아닙니다.",
    "const add = a => b => a + b;\nconst addTen = add(10);\n// addTen(2)는 12다.",
    "중첩 함수를 썼다는 사실만으로 모두 커링이라고 부르지는 않습니다.", ["bindings-and-closures"], "sec-ordinary-function-objects", ["커링 함수", "curry"]),
  term("prototype", "프로토타입", "Prototype", "객체에서 프로퍼티를 찾을 때 이어서 살펴보는 객체입니다.",
    "일반 객체의 [[Prototype]]은 다른 객체 또는 null입니다. 생성자 함수의 prototype 프로퍼티와 인스턴스의 [[Prototype]] 연결은 관계가 있지만 서로 같은 슬롯은 아닙니다.",
    "const shared = { read() { return this.count; } };\nconst item = Object.create(shared);\nitem.count = 2;\n// item.read는 shared에서 찾는다.",
    "모든 객체가 자체 prototype 프로퍼티를 갖는 것은 아닙니다.", ["prototypes", "classes"], "sec-ordinary-object-internal-methods-and-internal-slots", ["prototype", "[[Prototype]]", "__proto__"]),
  term("constructor", "생성자", "Constructor", "new와 함께 호출해 인스턴스를 만들 수 있는 함수 객체입니다.",
    "생성 가능한 함수와 모든 함수는 같은 범위가 아닙니다. 인스턴스에서 조회하는 constructor 프로퍼티는 변경될 수 있어서 생성 경로를 증명하는 절대적인 기록이 아닙니다.",
    "function Counter() { this.count = 0; }\nconst item = new Counter();\n// 일반적인 이 예에서 item은\n// Counter.prototype에 연결된다.",
    "constructor 프로퍼티를 고쳤다고 해서 객체의 프로토타입 연결까지 자동으로 고쳐지는 것은 아닙니다.", ["prototypes", "classes", "this"], "sec-ecmascript-function-objects-construct-argumentslist-newtarget", ["constructor", "인스턴스", "instance", "new", "constructor 복구"]),
  term("prototype-chain", "프로토타입 체인", "Prototype chain", "객체의 프로토타입 연결을 따라 프로퍼티를 찾는 경로입니다.",
    "자체 프로퍼티에 이름이 없으면 상위 프로토타입에서 찾습니다. 같은 이름의 자체 프로퍼티를 만들면 상위 프로퍼티를 가릴 수 있습니다. 여러 단계의 연결은 다중 상속과 다릅니다.",
    "const base = { color: " + '"회색"' + " };\nconst item = Object.create(base);\nitem.color = " + '"벽돌색";' + "\n// base.color는 그대로다.",
    "위쪽 객체의 메서드를 찾았다는 이유만으로 this가 그 프로토타입 객체가 되는 것은 아닙니다.", ["prototypes"], "sec-ordinary-object-internal-methods-and-internal-slots-get-p-receiver", ["상속", "메서드 오버라이드", "override", "delegation", "위임"]),
  term("class", "클래스", "Class", "인스턴스의 초기화와 메서드 등을 정의하는 문법입니다.",
    "JavaScript의 class는 프로토타입 기반 동작 위에서 인스턴스·정적 멤버·비공개 요소 등을 표현합니다. 클래스 본문은 strict mode이며 선언의 초기화 전 접근에도 제한이 있습니다.",
    "class Counter {\n  #count = 0;\n  next() { return ++this.#count; }\n}\nconst item = new Counter();",
    "class를 함수와 완전히 동일한 단순 표기 교체로 취급하면 초기화·호출·비공개 상태 규칙을 놓칩니다.", ["classes"], "sec-class-definitions", ["class", "private", "클래스와 인스턴스", "비공개 필드"]),
  term("super", "extends와 super", "Class inheritance", "부모 클래스의 초기화와 동작에 연결하는 문법입니다.",
    "파생 생성자는 일반적인 경우 super()로 부모 초기화를 거친 뒤 this를 사용합니다. 메서드의 super 접근은 단순히 현재 this의 프로토타입을 한 번 조회하는 것과 같지 않습니다.",
    "class Base { label() { return " + '"기본"' + "; } }\nclass Detail extends Base {\n  label() { return super.label() + " + '" / 상세"' + "; }\n}",
    "공유해야 할 동작과 각 인스턴스의 가변 데이터를 구분해야 합니다. 상속이 항상 합성보다 적합하지는 않습니다.", ["classes", "prototypes"], "sec-super-keyword", ["extends", "super", "클래스 상속", "상위 클래스"]),
]);

const currentLessonLinks = {
  "primitive": [
    "values-and-types",
    "coercion-and-equality",
    "references-mutation-and-copy"
  ],
  "reference": [
    "values-and-types",
    "function-parameters-and-contracts",
    "references-mutation-and-copy"
  ],
  "binding": [
    "scope-tdz-and-declarations",
    "bindings-and-closures",
    "esm-and-live-bindings"
  ],
  "immutable": [
    "references-mutation-and-copy",
    "classes-and-private-state",
    "composition-and-domain-contracts"
  ],
  "shallow-copy": [
    "references-mutation-and-copy",
    "array-pipelines-and-sorting"
  ],
  "deep-copy": [
    "references-mutation-and-copy",
    "json-and-serialization",
    "browser-workers-and-performance"
  ],
  "undefined": [
    "values-and-types",
    "coercion-and-equality",
    "control-flow-and-operators",
    "function-parameters-and-contracts"
  ],
  "null": [
    "values-and-types",
    "coercion-and-equality",
    "control-flow-and-operators"
  ],
  "execution-context": [
    "scope-tdz-and-declarations",
    "bindings-and-closures",
    "call-stack-and-completion"
  ],
  "lexical-environment": [
    "scope-tdz-and-declarations",
    "bindings-and-closures"
  ],
  "variable-environment": [
    "scope-tdz-and-declarations"
  ],
  "environment-record": [
    "scope-tdz-and-declarations",
    "bindings-and-closures"
  ],
  "scope": [
    "scope-tdz-and-declarations",
    "bindings-and-closures"
  ],
  "hoisting": [
    "scope-tdz-and-declarations",
    "esm-and-live-bindings"
  ],
  "this": [
    "this-and-arrow-functions",
    "browser-events-and-lifecycle",
    "node-events-and-lifecycle"
  ],
  "explicit-this": [
    "this-and-arrow-functions",
    "higher-order-functions"
  ],
  "this-arg": [
    "this-and-arrow-functions",
    "array-pipelines-and-sorting"
  ],
  "arrow": [
    "this-and-arrow-functions",
    "higher-order-functions"
  ],
  "callback": [
    "higher-order-functions",
    "bindings-and-closures",
    "browser-events-and-lifecycle",
    "node-events-and-lifecycle"
  ],
  "closure": [
    "bindings-and-closures",
    "higher-order-functions",
    "composition-and-domain-contracts"
  ],
  "garbage-collection": [
    "bindings-and-closures",
    "browser-events-and-lifecycle",
    "node-events-and-lifecycle"
  ],
  "partial": [
    "bindings-and-closures",
    "higher-order-functions"
  ],
  "currying": [
    "bindings-and-closures",
    "higher-order-functions"
  ],
  "prototype": [
    "prototype-delegation",
    "classes-and-private-state"
  ],
  "constructor": [
    "prototype-delegation",
    "classes-and-private-state",
    "this-and-arrow-functions"
  ],
  "prototype-chain": [
    "prototype-delegation",
    "properties-and-descriptors"
  ],
  "class": [
    "classes-and-private-state",
    "composition-and-domain-contracts"
  ],
  "super": [
    "classes-and-private-state",
    "prototype-delegation"
  ]
};

export const glossary = Object.freeze([...legacyGlossary.map(item => Object.freeze({ ...item, lessons: Object.freeze(currentLessonLinks[item.id] ?? item.lessons) })), ...expandedGlossary]);

export function normalizeSearch(value) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").trim().replace(/\s+/gu, " ");
}

export function findTerms(query, lessonId) {
  const normalized = normalizeSearch(query);
  if (!normalized) return glossary.filter(item => item.lessons.includes(lessonId));
  return glossary
    .map((item, index) => {
      const aliases = item.aliases.map(normalizeSearch);
      const score = aliases.some(alias => alias === normalized) ? 0
        : aliases.some(alias => alias.startsWith(normalized)) ? 1
          : aliases.some(alias => alias.includes(normalized)) ? 2 : Infinity;
      return { item, index, score };
    })
    .filter(result => Number.isFinite(result.score))
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name, "ko") || a.index - b.index)
    .map(result => result.item);
}
