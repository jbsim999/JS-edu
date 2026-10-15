# 이용자 요청 강의 항목 대조

기준일: 2026-10-14. 요청한 7장·71개 항목을 증보 전 로드맵과 비교했다. 기준 로드맵 SHA256은 84738c0c2651347e97d402c65ee940a84ccbf00de7653f634e6fcccef37ae0ee다. 기존 기획 명시 포함 28개·부분 포함 36개·미명시 7개이며, 아래 최종 연결과 [로드맵 증보 절](roadmap.md)의 핵심 내용/실습으로 모두 수용한다.

포함은 기존 기획 문구에 명시됐다는 뜻이다. 부분은 관련 개념이 있으나 요청 구분·사례·평가가 불분명한 상태, 미명시는 독립 설명이 확인되지 않은 상태다. 구현/교재 검수 완료와 다르다. 현 카탈로그는 bindings-and-closures의 draft-1 초안 1개이며 강의 수는 계획대로 공통32·브라우저8·Node8·통합4를 유지한다.

표의 번호는 로드맵 표시 번호다. 실제 구현은 다음 안정 ID에 연결한다: 01 language-host-boundaries, 02 values-and-types, 06 scope-tdz-and-declarations, 07 bindings-and-closures, 08 function-parameters-and-contracts, 09 this-and-arrow-functions, 10 higher-order-functions, 11 call-stack-and-completion, 12 references-mutation-and-copy, 13 properties-and-descriptors, 14 prototype-delegation, 15 classes-and-private-state, 16 composition-and-domain-contracts, 17 array-pipelines-and-sorting, 21 json-and-serialization, 27 promise-chains-and-errors, 28 async-await-and-iteration, B02 browser-events-and-lifecycle, N01 node-esm-packages-and-cli, N06 node-events-and-lifecycle.

## 01장 데이터 타입 16개

| 요청 번호와 제목 | 증보 전 | 최종 연결 | 반영할 설명/검사 |
| --- | --- | --- | --- |
| 1-1 데이터 타입의 종류 | 포함 | 02 | 원시7종/Object·typeof 한계 |
| 1-2 데이터 타입에 관한 배경지식 | 부분 | 02·06 | 이름·바인딩·값·객체 식별성 |
| 1-2-1 메모리와 데이터 | 미명시 | 02 | 추상 상태와 물리 메모리 배치 구분 |
| 1-2-2 식별자와 변수 | 부분 | 02·06 | 같은 이름의 다른 바인딩 |
| 1-3 변수 선언과 데이터 할당 | 부분 | 06 | 선언·초기화·재할당 추적 |
| 1-3-1 변수 선언 | 포함 | 06 | var/let/const·함수 선언 비교 |
| 1-3-2 데이터 할당 | 부분 | 06·12 | 값 대입·공유·프로퍼티 변경 |
| 1-4 기본형 데이터와 참조형 데이터 | 포함 | 02·12 | 원시/객체와 교육용 참조형 대응 |
| 1-4-1 불변값 | 부분 | 02·12 | 원시 불변성과 재할당 구분 |
| 1-4-2 가변값 | 포함 | 12 | 다른 바인딩에서 변경 관찰 |
| 1-4-3 변수 복사 비교 | 부분 | 12·08 | 대입·매개변수 재할당 비교 |
| 1-5 불변 객체(immutable-object) | 부분 | 12 | 비변경 갱신·동결·복사 구분 |
| 1-5-1 불변 객체를 만드는 간단한 방법 | 부분 | 12 | 필요한 경로 복사와 freeze |
| 1-5-2 얕은 복사와 깊은 복사 | 부분 | 12·21 | 중첩·순환·별칭·타입·손실 |
| 1-6 undefined와 null | 포함 | 02·08·13 | 누락/빈 값/미초기화/없는 프로퍼티 |
| 1-7 정리 | 부분 | 02·06·12 | 값/객체 상태 추적과 수정 관문 |

## 02장 실행 컨텍스트 7개

| 요청 번호와 제목 | 증보 전 | 최종 연결 | 반영할 설명/검사 |
| --- | --- | --- | --- |
| 2-1 실행 컨텍스트란? | 부분 | 06·11 | 실행 상태·호출·중단/복귀·스택 |
| 2-2 VariableEnvironment | 미명시 | 06 | VariableStatement 바인딩의 환경 |
| 2-3 LexicalEnvironment | 부분 | 06·07 | 조회 출발점·블록 진입/복귀 |
| 2-3-1 environmentRecord와 호이스팅(hoisting) | 부분 | 06 | 생성/초기화·TDZ·환경 레코드 |
| 2-3-2 스코프, 스코프 체인, outerEnvironmentReference | 부분 | 06·07 | [[OuterEnv]] 경로·과거 용어 대응 |
| 2-4 this | 포함 | 06·09 | 이름 조회와 this 결정 구분 |
| 2-5 정리 | 부분 | 06·11 | 스택/환경/초기화 상태별 추적 |

## 03장 this 14개

| 요청 번호와 제목 | 증보 전 | 최종 연결 | 반영할 설명/검사 |
| --- | --- | --- | --- |
| 3-1 상황에 따라 달라지는 this | 포함 | 09 | 호출·strict·호스트·코드 종류 |
| 3-1-1 전역 공간에서의 this | 부분 | 01·09·N01 | browser Script/ESM·Node CommonJS |
| 3-1-2 메서드로서 호출할 때 그 메서드 내부에서의 this | 포함 | 09 | 메서드 호출·추출·다른 객체 대입 |
| 3-1-3 함수로서 호출할 때 그 함수 내부에서의 this | 부분 | 09 | 일반 호출 strict/sloppy 비교 |
| 3-1-4 콜백 함수 호출 시 그 함수 내부에서의 this | 포함 | 09·10·B02·N06 | 배열/DOM/EventEmitter 계약 |
| 3-1-5 생성자 함수 내부에서의 this | 부분 | 09·14·15 | new·반환 객체·파생 초기화 |
| 3-2 명시적으로 this를 바인딩하는 방법 | 포함 | 09 | 즉시 호출과 새 함수 생성 |
| 3-2-1 call 메서드 | 포함 | 09 | 인자 나열·receiver·반환 |
| 3-2-2 apply 메서드 | 포함 | 09 | 인자 목록·call/spread 비교 |
| 3-2-3 call / apply 메서드의 활용 | 부분 | 09·13 | 빌려쓰기·receiver 제약 |
| 3-2-4 bind 메서드 | 포함 | 09·10 | 식별성·고정 인자·해제 참조 |
| 3-2-5 화살표 함수의 예외사항 | 부분 | 09 | 렉시컬 this/arguments·new 불가 |
| 3-2-6 별도의 인자로 this를 받는 경우(콜백 함수 내에서의 this) | 미명시 | 09·17 | map/forEach thisArg·화살표 비교 |
| 3-3 정리 | 부분 | 09 | 조건별 호출 판별·결함 수정 |

## 04장 콜백 함수 9개

| 요청 번호와 제목 | 증보 전 | 최종 연결 | 반영할 설명/검사 |
| --- | --- | --- | --- |
| 4-1 콜백 함수란? | 포함 | 10 | 함수 전달의 API 계약 |
| 4-2 제어권 | 부분 | 10 | 시점·인자·횟수·실패 처리 |
| 4-2-1 호출 시점 | 부분 | 10·27 | 동기/비동기 콜백 |
| 4-2-2 인자 | 부분 | 10·17 | API 인자 순서·시그니처 불일치 |
| 4-2-3 this | 포함 | 09·10 | API receiver와 함수 형태 |
| 4-3 콜백 함수는 함수다 | 부분 | 09·10 | obj.method 전달과 호출 문맥 |
| 4-4 콜백 함수 내부의 this에 다른 값 바인딩하기 | 포함 | 09·10·B02 | bind/래퍼/화살표·등록/해제 |
| 4-5 콜백 지옥과 비동기 제어 | 부분 | 10·27·28 | Promise/await 이행 계약 |
| 4-6 정리 | 부분 | 10·27·28 | 호출 계약 카드·이행 과제 |

## 05장 클로저 8개

| 요청 번호와 제목 | 증보 전 | 최종 연결 | 반영할 설명/검사 |
| --- | --- | --- | --- |
| 5-1 클로저의 의미 및 원리 이해 | 포함 | 07 | 현재 초안·바인딩과 스냅숏 |
| 5-2 클로저와 메모리 관리 | 부분 | 07·B02·N06 | 도달 가능성·정리·GC 시점 한계 |
| 5-3 클로저 활용 사례 | 부분 | 07·10·16 | 은닉·설정·부분 적용·커링 |
| 5-3-1 콜백 함수 내부에서 외부 데이터를 사용하고자 할 때 | 포함 | 07·10 | 공유/분리된 바인딩 |
| 5-3-2 접근 권한 제어(정보 은닉) | 포함 | 07·16 | 닫힌 상태·private 비교 |
| 5-3-3 부분 적용 함수 | 미명시 | 10 | 고정 인자·bind/래퍼 |
| 5-3-4 커링 함수 | 미명시 | 10 | 단계별 함수 호출 변환 |
| 5-4 정리 | 부분 | 07·10·16 | 상태·함수 형태·정리 관문 |

## 06장 프로토타입 9개

| 요청 번호와 제목 | 증보 전 | 최종 연결 | 반영할 설명/검사 |
| --- | --- | --- | --- |
| 6-1 프로토타입의 개념 이해 | 포함 | 14 | own과 위임 조회 |
| 6-1-1 constructor, prototype, instance | 부분 | 14 | .prototype/[[Prototype]] 구분 |
| 6-1-2 constructor 프로퍼티 | 미명시 | 14 | 변경·가림·타입 판별 한계 |
| 6-2 프로토타입 체인 | 포함 | 14 | 단계·조회 종료 |
| 6-2-1 메서드 오버라이드 | 포함 | 14·15 | own 가림·삭제·super |
| 6-2-2 프로토타입 체인 | 포함 | 14 | 체인→null 추적 |
| 6-2-3 객체 전용 메서드의 예외사항 | 부분 | 13·14 | Object.*와 Object.prototype.*·null prototype |
| 6-2-4 다중 프로토타입 체인 | 부분 | 14·16 | 다단계 단일 체인·다중 상속/합성 구분 |
| 6-3 정리 | 부분 | 13·14 | 소유자·조회 결과·receiver 구분 |

## 07장 클래스 8개

| 요청 번호와 제목 | 증보 전 | 최종 연결 | 반영할 설명/검사 |
| --- | --- | --- | --- |
| 7-1 클래스와 인스턴스의 개념 이해 | 포함 | 15 | 인스턴스 필드·공유 메서드·static |
| 7-2 자바스크립트의 클래스 | 포함 | 14·15 | 프로토타입 위임과 class |
| 7-3 클래스 상속 | 포함 | 15·16 | 초기화·동작·합성 대안 |
| 7-3-1 기본 구현 | 부분 | 14·15 | 함수 기반 상속 읽기·이행 |
| 7-3-2 클래스가 구체적인 데이터를 지니지 않게 하는 방법 | 부분 | 14·15 | 인스턴스 가변 상태와 공유 동작 분리 |
| 7-3-3 constructor 복구하기 | 미명시 | 14 | 프로퍼티 복구와 생성 동작 분리 |
| 7-3-4 상위 클래스에의 접근 수단 제공 | 포함 | 14·15 | 부모 명시 호출과 super |
| 7-4 ES6의 클래스 및 클래스 상속 | 포함 | 15 | ES2015 도입과 이후 fields/private 확장 구분 |

## 정확성 기준과 실습 계약

- 실행 컨텍스트의 LexicalEnvironment/VariableEnvironment는 Environment Record를 가리키는 역할이며 초기/실시간 복제본 모델을 쓰지 않는다. 환경 레코드의 [[OuterEnv]]와 과거 교재 용어를 연결한다. 명세의 장치는 엔진 메모리 배치를 규정하지 않는다. [ES2026 §9.1·9.4·10.2.11](https://ecma-international.org/wp-content/uploads/ECMA-262_17th_edition_june_2026.pdf), [ES2015 §8.1](https://262.ecma-international.org/6.0/#sec-lexical-environments).
- 원시값 불변성·변수 재할당·객체 동결·복사를 분리한다. 필요한 경로만 복사하는 갱신과 전체 복제의 비용을 비교한다. structuredClone은 HTML 호스트 API이고 함수/사용자 클래스 상태를 만능 복원하지 않는다. 순환·같은 객체의 두 별칭·Date·Map·함수 입력에 허용/거부/변환 정책을 검사한다. JSON 손실도 비교한다. [ES2026 §20.1.2.6·25.5](https://ecma-international.org/wp-content/uploads/ECMA-262_17th_edition_june_2026.pdf), [HTML structured data](https://html.spec.whatwg.org/multipage/structured-data.html).
- this는 실행 호스트·Script/Module·strict와 호출 형태를 명시한다. 배열 thisArg, DOM currentTarget, Node EventEmitter는 각 API 계약이다. 콜백이 항상 비동기라는 설명을 하지 않는다. map(parseInt)의 인자 불일치 같은 실패도 검사한다. [DOM inner invoke](https://dom.spec.whatwg.org/#concept-event-listener-inner-invoke), [Node 24 Events](https://nodejs.org/download/release/v24.21.0/docs/api/events.html#passing-arguments-and-this-to-listeners), [ES2026 §10.2.1.2·23.1.3.21](https://ecma-international.org/wp-content/uploads/ECMA-262_17th_edition_june_2026.pdf).
- 클로저 수명은 리스너/타이머 정리·같은 핸들러 참조·반복 연결 중복 방지로 검사한다. GC 발생 시각은 검사하지 않는다. 카운터 기존 ID/개정/입력 계약은 그대로이고 후속 과제는 별도 ID·개정에 연결한다. 부분 적용과 커링은 작은 고정 호출 계약·인수 순서·독립 상태로 검사한다.
- 프로토타입 탐색은 own/inherited·가림/삭제·null 종단·receiver를 추적하고 전역 내장 프로토타입을 수정하지 않는다. constructor 프로퍼티는 생성 동작 복구 스위치나 신뢰 가능한 타입 증명이 아니다. 인스턴스별 가변 데이터를 prototype에 공유하는 결함과 의도된 static 데이터를 구분한다. 레거시 상속은 읽기/이행 사례이며 새 설계는 class와 합성을 비교한다. [ES2026 §10.1·10.2·15.7](https://ecma-international.org/wp-content/uploads/ECMA-262_17th_edition_june_2026.pdf).

06·09 등 커진 강의는 핵심 항목을 선택 읽을거리로만 밀어내지 않고 하위 절·상태 추적·코딩 검사에 연결한다. 대표 수업 분량 검증 후 필요하면 수업 분리를 다시 기획하며 현재 강의 수를 임의로 늘리지 않는다.

## 조사와 검증 범위

교육 연구자가 읽기 전용으로 기존 계획·교재·공식 자료를 대조했고 총괄이 이 파일과 로드맵을 통합했다. 연구자 보고: Windows/Node v22.17.0의 메모리 내 의미 검사11개 PASS(선언/TDZ·공유·복사/freeze·clone·JSON·this/arrow/thisArg·클로저·부분 적용/커링·constructor·class). 이는 교육 의미 조사이며 제품 grader/브라우저 검증이 아니다. 총괄은 그 의미 검사를 재실행하지 않았고 항목 수/번호/연결과 통합 문서·시안은 별도 검증한다.

정식판은 ECMA-262 제17판으로 확인했다. TC39 최신 multipage는 ES2027 초안이므로 ES2026 정식 근거로 혼용하지 않았다. 공식 HTML은 도구 용량 제한이 있어 Ecma 공식 PDF를 대조했다. 확인일과 실제 제품 지원은 구분한다.

현재 판정: 전수 조사/기획 통합 완료, 수업 본문·실행·학습 제출은 미구현. 최종 독립 검토·시안 검증은 [verification.md](verification.md)에 기록한다.
