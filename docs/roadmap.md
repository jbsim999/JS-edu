# JavaScript 강의 로드맵

기준일: 2026-10-14. 상태: 상세 기획 검토안. 이용자 요청 7장·71개 항목을 하위 절로 증보하고 용어집 및 작동하는 화면 시안을 추가한다. 대상은 다른 언어 경험자와 현직 개발자다. 공통 언어 32강 → 브라우저 8강 또는 Node.js 8강 → 통합 프로젝트·검증 4강으로 진행한다. 한 경로는 44강, 양쪽 호스트를 모두 선택하면 52강이다. 확장 선택 과정은 이 수에 포함하지 않는다.

아래 순서·과제·평가는 교육 설계이며 공식 기관이 권고한 과정이나 학습 성과 측정값이 아니다. 현재 카탈로그에는 bindings-and-closures 초안 1개만 있다. 계획 번호는 표시 순서이고 영구 ID와 다르다. 기존 수업 ID와 contentRevision:draft-1을 보존하고 실제 계약 변경 시 새 개정을 부여한다. 전체 로드맵을 구현된 카탈로그로 표시하지 않는다.

## 목표와 학습 경로

완료자는 값·바인딩·참조·호출·비동기 실행을 추적하고, 공유 상태와 실패 경로를 고치며, 같은 도메인 로직을 브라우저 또는 Node.js에 연결할 수 있어야 한다. 정상 입력뿐 아니라 오류·취소·대량 데이터에서 동작을 검증하고 선택한 설계의 비용을 설명한다.

변수·반복문 문법을 이미 안다는 전제로 시작하지만 의미 모델은 진단한다. 단계 면제는 코드 해석·결함 수정·선택 이유 설명을 모두 확인한 경우에만 허용한다. 선수 조건은 유지하며 통합 과제는 면제하지 않는다. 진단 기능은 구현 전이다.

React·Vue·Express·TypeScript는 핵심 과정의 필수 선수가 아니다. 먼저 언어와 호스트 경계를 익힌 뒤 선택 과정으로 연결한다. 학습 소요시간과 구현 일정은 대표 수업의 분량·검증 비용을 측정한 뒤 정한다.

## 표준과 실행 환경

| 구분 | 기획 기준 | 구현 시 확인 |
| --- | --- | --- |
| 언어 | ECMAScript 2026, ECMA-262 제17판, 2026년 6월판 [S01–S02] | 정식판 절·기능별 실제 지원 |
| Intl | ECMA-402 제13판, 2026년 6월판 [S19] | locale·시간대·ICU 등 환경 영향 |
| 브라우저 | DOM·HTML·Fetch·Storage·Worker는 웹 호스트 계약 [S04–S09] | 브라우저·엔진·정확한 버전·보안 문맥 |
| Node.js | 24 LTS 우선 후보. 조사 시 v24.21.0 공식 문서 확인 [S10] | 착수 시 패치 재확인·버전 고정·과제 행동 검사 |
| 개발 도구 | 현 골격 Node.js 22 이상, 기존 CI 22/24 | 개발 검사는 교육 런타임의 전체 지원 인증이 아님 |
| 변환 | 현재 직접 실행 설계, 별도 컴파일 대상 없음 | 변환 도구를 도입하면 대상과 런타임을 별도 기록 |

ECMAScript Promise 작업, HTML 이벤트 루프, Node.js 이벤트 루프를 같은 큐 모델로 설명하지 않는다. 호스트별 보장 순서와 조건부 순서를 구분한다. Fetch·setTimeout·AbortSignal·fs는 ECMAScript 표준 API라고 부르지 않는다.

## 모든 수업의 구성과 통과 기준

1. **이론:** 실제 상황/질문 → 용어 → 짧은 코드 → 값·상태·호출 추적 → 반례 → 선택 비용. 명세의 번역·규칙 나열만으로 끝내지 않는다.
2. **예시:** 독립 실행 가능한 정상·실패 코드, 입력·예상 결과·설명·지원 환경. 예상 결과와 실제 실행 증거를 분리한다.
3. **문제풀이:** 코드 해석·결함 수정·설계 선택. 정답 근거와 대표 오답 설명을 갖춘다.
4. **실무 심화:** 제한된 상황에서 대안과 실패 조건을 비교한다. 교육 시나리오를 기업의 실제 채용 과제라고 표현하지 않는다.
5. **직접 코딩:** 아래 결과물을 작성하고 고정 행동 검사를 통과한다. 편집 파일·기준 답안·검사 소유권을 분리한다.

문제 수는 목표에 맞게 정하되 목표마다 하나 이상의 판별 가능한 문제 또는 행동 검사를 연결한다. 코딩은 필수 행동 조건 전부 통과, 퀴즈는 핵심 해석 확인, 설계 메모는 결정·대안·실패 조건 설명으로 평가한다. 이 상태들을 분리하고 모두 충족해야 역량 완료로 표시한다.

평가 주체를 고정한다. 객관식·코드 추적 퀴즈는 고정 정답/근거로 자동 판정하고, 코딩은 실제 행동 검사로 판정한다. 설계 메모는 결정·대안·실패 조건의 명시적 루브릭을 읽고 학습자가 자가 점검한다. 메모 저장·자가 확인을 자동 의미 평가나 전문가 승인으로 표시하지 않는다. 수업 완료 화면에는 코딩/퀴즈 통과와 메모 자가 확인을 각각 표시하며 이 조합의 완료는 자가 학습 과정 완료다. 검토자 평가가 필요한 인증 과정은 별도 범위다.

초안 저장·환경 준비·실행 성공·제출 검사·퀴즈·메모는 별도 상태다. 제출 결과는 수업 개정·코드 fingerprint·환경 fingerprint·requestId에 연결한다. 코드 변경·수업 전환·늦은 응답으로 오래된 PASS를 새 코드에 붙이지 않는다. 검사 0개·실행 불가·모의 출력은 제출 통과가 아니다.

각 수업의 구현 산출물은 본문 JSON, 독립 예제, starter, reference, grader, 고정 fixture, 실행 프로필 연결, 검증 기록이다. 계획 ID는 초안이며 파일을 만들 때 카탈로그 ID를 고정한다.

## 공통 언어 과정 32강

표의 통과 조건은 핵심 행동 조건이다. 구현 시 허용 입력·결과 타입·오류 계약·검사 fixture까지 확정한다. 기본 학습 순서는 번호 순이며 단원 관문은 06·11·16·22·26·32다.

### 1단원 의미 모델과 바인딩 6강

선수: 다른 언어의 함수·분기·반복문 경험. 목표: 문법의 유사함에서 가져온 잘못된 가정을 찾는다. 근거: [S01–S02, S10].

| 번호와 계획 ID | 내용 | 실습 결과물 | 핵심 통과 조건 |
| --- | --- | --- | --- |
| 01 language-host-boundaries | 언어·엔진·호스트·Script/Module·strict mode | 실행 환경 분류 진단 | Promise/DOM/fs 구분, 지원 불가 명시 |
| 02 values-and-types | 원시값·객체·typeof·null/undefined·Symbol·BigInt | 입력 분류기 | 0/false/빈 문자열과 누락 구분 |
| 03 coercion-and-equality | 명시/암묵 변환·===·Object.is·SameValueZero | 값 정규화 함수 | 숫자 문자열·NaN·-0 정책 일관성 |
| 04 numbers-and-precision | 부동소수·안전 정수·BigInt·반올림 | 정수 단위 금액 계산기 | 범위 초과 거부·정밀도 손상 방지·Number/BigInt 혼합 구분 |
| 05 control-flow-and-operators | truthiness·단락·??/?.·평가 순서·ASI | 설정 해석기 | falsy 유효값 보존·중복 부수 효과 없음 |
| 06 scope-tdz-and-declarations | let/const/var·스코프·TDZ·호이스팅·실행 컨텍스트·환경 레코드 | 범위/초기화 결함 수정 | 바인딩 생성/초기화·환경 연결·초기화 전 접근·반복별 상태 |

관문: 정규화·설정 모듈의 결함을 수정하고 입력별 타입·분기·값을 설명한다. 렉시컬 환경 규칙을 구현 메모리 배치나 GC 시점의 보장으로 확대하지 않는다.

### 2단원 함수와 상태 캡슐화 5강

선수: 02·05·06. 목표: 반환 함수와 콜백의 상태·호출 문맥을 추적한다. 근거: [S02].

| 번호와 계획 ID | 내용 | 실습 결과물 | 핵심 통과 조건 |
| --- | --- | --- | --- |
| 07 bindings-and-closures | 클로저·바인딩·독립 환경·도달 가능성·정보 은닉 | 기존 카운터 + 별도 리스너 수명 과제 | 기존 유한한 number 입력/행동 계약 보존·독립성, 후속 과제의 정리 계약 |
| 08 function-parameters-and-contracts | 함수 형태·기본값·rest·destructuring·반환 계약 | 옵션 기반 처리 함수 | null/undefined 정책·옵션 불변·반환 경로 |
| 09 this-and-arrow-functions | 호스트/strict/module별 this·일반/메서드/콜백/new·call/apply/bind·thisArg·화살표 | 호출 문맥 비교와 콜백 수정 | 각 조건의 receiver·명시 바인딩·화살표/생성자 예외 판별 |
| 10 higher-order-functions | 콜백의 제어권·합성·부분 적용·커링·부수 효과 | 파이프라인과 부분 적용/커링 함수 | 시점/인자/this 계약·순서/횟수·오류 전파 |
| 11 call-stack-and-completion | 스택·return/throw·finally·재귀와 종료 조건 | 중첩 처리와 정리 로직 | 빈/깊은 입력·조기 반환/예외에서 정리·오류 덮어쓰기 방지 |

관문: 전역 가변 상태에 의존하는 콜백을 독립 상태로 고치고 정상·예외의 정리를 설명한다. 07은 현재 존재하는 대표 수업을 검증하며 ID를 새로 만들지 않는다.

### 3단원 객체와 설계 5강

선수: 02·07–11. 목표: 참조·변경·프로퍼티·위임을 분리한다. 근거: [S02].

| 번호와 계획 ID | 내용 | 실습 결과물 | 핵심 통과 조건 |
| --- | --- | --- | --- |
| 12 references-mutation-and-copy | 원시 불변값·공유 참조·얕은/깊은 복사·비변경 갱신·clone 한계 | 장바구니와 타입별 복사 비교 | 중첩 원본 보존·순환/함수/Date 정책·freeze 깊이·지원 불가 |
| 13 properties-and-descriptors | own/inherited·열거·descriptor·getter/setter | 허용 필드 추출기 | 상속 필드 제외·누락/undefined 구분·접근자 효과 설명 |
| 14 prototype-delegation | constructor/prototype/instance·constructor 프로퍼티·override·다단계 체인 | 위임 모델과 레거시 상속 수정 | 상태/동작 분리·constructor 복구 한계·종단·빌려쓴 메서드 |
| 15 classes-and-private-state | ES6 class·필드/private/static·extends/super·함수 기반 상속 비교 | 불변식 모델과 상속 리팩터링 | 상태 전이·초기화/상위 접근·prototype 공유 데이터 방지 |
| 16 composition-and-domain-contracts | 팩터리·클로저·클래스·합성·의존성 주입 | 교체 가능한 할인 정책 | 교체 후 행동 유지·숨은 공유 상태 없음 |

관문: 클래스·클로저·상태 객체 중 하나를 선택하고 대안과 비용을 설명한다. Java식 클래스 계층을 기본 정답으로 두지 않는다.

### 4단원 데이터 처리와 표준 API 6강

선수: 03–05·10–13. 목표: 변경·순서·정확성·직렬화의 손실을 통제한다. 근거: [S02, S19].

| 번호와 계획 ID | 내용 | 실습 결과물 | 핵심 통과 조건 |
| --- | --- | --- | --- |
| 17 array-pipelines-and-sorting | map/filter/reduce·sparse·sort·비변경 대안 | 주문 필터/집계/정렬 | 원본 보존·비교 함수·빈/중복/누락 원소 정책 |
| 18 keyed-collections-and-grouping | Map/Set·키 동등성·groupBy·집합 연산 | 이벤트 중복 제거/집계 | 키·순서·없는 키와 undefined 값 구분 |
| 19 iterators-and-generators | iterable/iterator·generator·helpers·지연 처리 | 제한 개수 순회기 | 필요한 만큼만 소비·조기 종료 정리 |
| 20 strings-unicode-and-regexp | 코드 단위/포인트/사용자 문자·정규화·이스케이프 | 검색어 처리기 | 한글·이모지·결합 문자·정규식 특수문자 |
| 21 json-and-serialization | parse/stringify·손실·순환·스키마·복원 | 버전 있는 레코드 디코더 | 파싱과 검증 구분·큰 숫자/잘못된 타입/순환 정책 |
| 22 date-time-and-internationalization | Date·timestamp·시간대·Intl | 시각/숫자 표시 계층 | 주입 시계·명시 locale/시간대·잘못된 날짜 정책 |

관문: 중복·불량 입력·시간 기준을 갖는 데이터 집계를 구현한다. Intl은 ECMA-402 출처를 별도로 붙인다. 사용자가 보는 글자는 UTF-16 길이와 같다고 가정하지 않는다.

### 5단원 모듈과 실패 계약 4강

선수: 08·10–11·16–22. 목표: 호스트와 독립적인 도메인 모듈을 테스트한다. 근거: [S02, S11–S12].

| 번호와 계획 ID | 내용 | 실습 결과물 | 핵심 통과 조건 |
| --- | --- | --- | --- |
| 23 esm-and-live-bindings | import/export·live binding·초기화·순환·부수 효과 | 다중 파일 ESM 모듈 | 변경 바인딩 관찰·초기화 실패 재현·호스트 resolve 분리 |
| 24 module-and-dependency-boundaries | 공개 API·내부 모듈·어댑터·의존성 | 공통 도메인 패키지 | DOM/fs 미참조·import 시 불필요한 I/O 없음 |
| 25 errors-and-failure-contracts | 검증/운영 실패·arbitrary throw·cause·복구/전파 | 오류 경계 서비스 | 원인 보존·오류 삼키기 없음·정리 |
| 26 behavior-tests-and-debugging | assert·테이블 검사·대역·상태 추적·회귀 | 도메인 검사와 대표 오답 | 수정 전 실패/후 통과·미완성/공유 상태 오답 실패 |

관문: 다중 파일 도메인과 실패 fixture를 함께 검증한다. 공통 과제의 검사 제공자는 제품 환경에서 정한다. node:test는 Node API이며 브라우저에 그대로 제공된다고 가정하지 않는다.

### 6단원 비동기와 동시성 6강

선수: 07·10–11·19·23–26. 목표: 대기·병행·취소·오류·늦은 결과의 계약을 설계한다. 근거: [S02, S04, S06, S13–S14].

| 번호와 계획 ID | 내용 | 실습 결과물 | 핵심 통과 조건 |
| --- | --- | --- | --- |
| 27 promise-chains-and-errors | 콜백 지옥→Promise·상태/resolution·then 반환·reaction jobs | 중첩 콜백의 Promise 이행 | 순서/오류/완료 보존·반환 누락·중복 settle·rejection 누락 실패 |
| 28 async-await-and-iteration | async/await·정리·async iterator·for-await·import()/top-level await | 비동기 페이지 수집기 | 종료/실패 정리·소비 순서·무제한 수집 금지 |
| 29 promise-combinators | all/allSettled/any/race·병행과 CPU 병렬 | 다중 조회 집계 | 부분/전부 실패·빈 입력·순서 정책·race는 취소가 아님 |
| 30 host-scheduling-and-event-loops | Promise 작업·HTML task/microtask·Node phases/nextTick | 조건 명시 두 호스트 추적 | 보장 순서만 판정·timer/I/O 절대 순서 미가정 |
| 31 cancellation-and-stale-results | 취소 계약·작업 ID·응답 역전·AbortSignal | 최신 결과 컨트롤러 | A/B 역전·취소 뒤 완료·전환 뒤 결과 미반영 |
| 32 bounded-concurrency-and-retries | 대기열·동시성 상한·backoff·재시도/멱등성 | 제한된 작업 실행기 | 활성 수 상한·동기 throw/reject·슬롯 회수·취소·재시도 상한 |

관문: 완료 순서를 제어한 대역으로 오래된 성공과 실패, 동시성·정리를 검증한다. 31은 주입 로더의 상태 계약을 먼저 다루고 실제 I/O 취소는 호스트에서 재검증한다. AbortSignal은 Promise 자체의 언어 기능이 아니다.

30의 공통 과정에서는 브라우저 부분을 실제 실행하고, Node 부분은 제작자가 고정한 Node 환경에서 검증한 코드·추적 결과·환경 기록을 근거로 해석 퀴즈를 제공한다. 학생의 Node 실행/제출 통과로 집계하지 않는다. 학생 Node 직접 실행은 M5의 제공자 연결 뒤 트랙에서 검사한다. 제작자 실행 근거가 준비되지 않은 추적 예시는 예상 결과로 남기고 검증 완료로 표시하지 않는다.

## 이용자 요청 7장의 세부 반영

요청 항목은 기존 강의의 하위 절과 후속 과제로 수용하며 중복 7장 과정을 추가하지 않는다. [71개 항목 대조표](requested-topics-audit.md)에 기존 포함/부분/미명시와 최종 매핑을 기록한다. 아래 반영은 기획이며 교재·검사 구현 완료가 아니다.

### 요청 01장 데이터 타입

02·06: 타입 종류, 식별자/변수, 선언/할당, undefined/null. 02·12: 메모리/데이터의 학습용 모델, 원시값과 객체 참조 복사. 실제 주소·스택/힙 배치·문자열 재사용을 모든 엔진의 고정 규칙으로 제시하지 않는다. 객체를 참조로 전달한다고 단순화하지 않고 참조를 나타내는 값의 전달과 객체 변경을 구분한다.

12: 불변값/가변객체, 비변경 갱신, Object.freeze의 얕은 범위, 얕은/깊은 복사. 중첩·순환·Date·함수를 비교하고 JSON 왕복 손실은 21에서 재검증한다. structuredClone은 HTML 호스트 API이며 모든 객체·함수·사용자 정의 프로토타입을 그대로 보존하는 만능 깊은 복사가 아니다 [S21].

### 요청 02장 실행 컨텍스트

06을 바인딩/환경 이론과 선언 추적 실습으로 나누고 08·11의 함수 진입/호출 스택에서 재방문한다. 실행 컨텍스트, VariableEnvironment, LexicalEnvironment, Environment Record, 외부 환경 연결을 명시한다. 두 환경 구성요소는 Environment Record를 가리키는 역할이며 VE=초기 스냅숏, LE=실시간 복제본이라는 모델을 쓰지 않는다 [S02, 9.1·9.4·10.2.11].

environmentRecord/outerEnvironmentReference는 현 명세 Environment Record/[[OuterEnv]]와 대응해 설명·검색한다. 호이스팅은 소스 코드를 실제로 이동하는 단계가 아니라 바인딩 생성·초기화·선언 인스턴스화의 관찰 결과로 다룬다. var의 초기 undefined와 let/const의 TDZ를 함께 추적하고 this는 09에서 이어간다.

### 요청 03장 this

09에 전역·메서드·일반 함수·콜백·생성자 호출 비교와 명시 바인딩 실습을 추가한다. browser classic script/ESM, Node ESM/CommonJS, strict/non-strict 조건을 명시한다. call/apply 인수 방식과 활용, bind의 부분 인수와 new 호출 차이, 화살표의 렉시컬 this·비생성자 성질, API의 thisArg를 검사한다. 모든 콜백의 this가 전역 객체라는 규칙을 만들지 않는다.

### 요청 04장 콜백 함수

08·10: 함수 전달, 호출자가 정하는 시점/인자/this의 제어권, 메서드를 넘겨도 함수라는 점, 동기/비동기 콜백. 09: bind·래퍼·화살표의 문맥 보존 비교. 27·28: 콜백 지옥→Promise→async/await 이행 시 순서·오류·중복 완료·정리 계약을 유지하는 검사. 들여쓰기 축소만으로 개선을 승인하지 않는다.

### 요청 05장 클로저

07: 정의/원리, 도달 가능성, 외부 데이터, 정보 은닉, 리스너/타이머/참조 정리. 카운터의 기존 편집·입력·행동 계약은 보존하고 수명 실습은 별도 과제로 둔다. GC 즉시 실행·정확한 회수 시각을 통과 조건으로 삼지 않는다.

10: 부분 적용(일부 인수 미리 고정)과 커링(여러 인수 함수를 단계별 함수로 변환)을 구분한다. this·인수 순서·부수 효과 횟수 오답을 검사한다. 정보 은닉은 보안 권한 검사와 구분한다.

### 요청 06장 프로토타입

14: constructor/prototype/instance, constructor 프로퍼티의 관례·변경 가능성, 조회/override, 다단계 단일 체인과 null 종단. 다단계 체인은 다중 상속이 아니다. Object.prototype 메서드 빌려쓰기와 내장 메서드의 receiver/내부 슬롯 요구를 비교한다.

prototype 교체 뒤 constructor 복구는 그 프로퍼티가 실제 [[Construct]] 동작이나 prototype 연결을 자동 복구하지 않는다는 반례로 검사한다. __proto__에 의존하지 않고 Object.getPrototypeOf/Object.create 등의 API로 추적한다.

### 요청 07장 클래스

14·15: 함수 기반 상속 읽기, Object.create 체인 연결, prototype에 인스턴스 데이터 공유 방지, constructor 프로퍼티 정비, 상위 메서드 명시 호출. 이후 ES6 class/extends/super로 이행하며 strict/new 요구·초기화·private 등 차이도 검사한다. 16은 클래스/팩터리/클로저/합성 선택이다.

각 요청 장의 정리는 관련 단원 관문에서 상태 추적·오답 이유·설계 선택을 확인하는 것으로 포함한다. 깊어진 06·09·10·12·14·15는 강 안에서 짧은 하위 절로 나누며 대표 수업 검증 후 분량을 점검한다.

## 용어집과 학습 보조 기능

사이드 용어집은 한글/영문/별명 검색 → 1~2문장 설명 → 자세히 보기 팝업으로 이어진다. 상세에는 정의·작은 코드·오해/반례·관련 수업·공식 출처를 둔다. 빈 검색은 현재 수업 핵심 용어 추천이며 결과 없음·초성 미지원·IME 조합·초기화를 구분한다.

초기 범위: VariableEnvironment/LexicalEnvironment/환경 레코드/호이스팅/this/thisArg/콜백/클로저/얕은 복사/깊은 복사/불변객체/부분 적용/커링/prototype/constructor/extends/super 등. 데이터는 안정 ID·별명·짧은/상세 설명·예제·오해·관련 강의 ID·출처·contentRevision을 갖는다. 교재/용어 개정은 따로 관리하고 검색/열람만으로 성취를 만들지 않는다.

반응형·키보드·검색/팝업 계약은 [UI/UX 기획](ui-ux-plan.md)에 따른다. 이번 승인 산출물은 기획과 [작동하는 화면 시안](../prototypes/learning-workspace/index.html)이다. 제품 교재·진도·실행기와는 아직 연결하지 않는다.

## 브라우저 트랙 8강

선수: 공통 01–32 또는 동등한 진단 통과. HTML/CSS는 보조 자료를 제공한다. 목표: 프레임워크 없이 입력·화면·네트워크·저장·수명주기를 연결한다. 근거: [S04–S09].

| 번호와 계획 ID | 내용 | 실습 결과물 | 핵심 통과 조건 |
| --- | --- | --- | --- |
| B01 browser-dom-and-rendering | DOM·안전한 텍스트·상태→렌더링 | 재고 목록 | 위험 문자열 비실행·빈 목록·반복 렌더 중복 없음 |
| B02 browser-events-and-lifecycle | 전파·위임·기본 동작·등록/해제 | 항목 편집/삭제 | 동적 항목·키보드·재연결 중복 없음·dispose 정리 |
| B03 browser-forms-and-input | 폼·focus·한글 조합·debounce·렌더링 기회 | 검색/편집 폼 | invalid 입력·조합 중 제출·예약 작업 취소·오류 안내 |
| B04 browser-fetch-and-http | Fetch·status·본문·스키마·CORS/credentials | API 클라이언트 | 4xx/5xx·잘못된 JSON·네트워크 실패·취소 구분 |
| B05 browser-storage-and-migrations | localStorage·IndexedDB 선택·개정·충돌·실패 | 초안 저장/복원 | 개정/파일 분리·손상/거부 중 입력 보존·명시적 이행 |
| B06 browser-url-and-navigation | URL·query·History·뒤로 가기 | 주소로 복원되는 목록/상세 | reload/back·잘못된 ID·초안 충돌 정책 |
| B07 browser-workers-and-performance | Worker·clone/transfer·메시지·종료·측정 | 큰 입력 집계 Worker | 기준 결과 일치·취소 입력 유지·낡은 메시지 거부·종료 |
| B08 browser-behavior-and-accessibility | 실제 DOM 검사·접근성·반응형·회귀 | 트랙 인수 검사 | 지연/실패/저장 오류·키보드·작은/짧은 화면·확대 |

기본 순서는 B01→B08이다. B04–B08에 공통 31–32의 취소·경쟁 조건을 반복 적용한다. 네트워크 fixture는 제품이 고정한다. CORS는 클라이언트에서 임의 해제할 수 없으며 no-cors를 읽기 권한 해결책으로 사용하지 않는다.

localStorage의 read-modify-write를 잠금 있는 트랜잭션으로 설명하지 않는다. Worker 종료와 정상 정리 콜백 완료도 구분한다. DOM은 Worker에서 실행하지 않는다.

## Node.js 트랙 8강

선수: 공통 01–32 또는 동등한 진단 통과. 목표: CLI·파일·HTTP·스트림의 입력·실패·자원을 검증한다. 제품은 고정 Node 버전과 허용 작업 범위를 제공한다. 근거: [S10–S18].

| 번호와 계획 ID | 내용 | 실습 결과물 | 핵심 통과 조건 |
| --- | --- | --- | --- |
| N01 node-esm-packages-and-cli | Node resolve·Packages·CJS 경계·argv/env/cwd | 요약 CLI | 다른 cwd·잘못된 인수·stdout/stderr/exit code 구분 |
| N02 node-files-and-paths | fs/promises·URL/path·핸들·쓰기 순서 | 지정 영역 읽기/저장 | 한글/공백 경로·이탈 거부·권한/없음·부분 쓰기·핸들 정리 |
| N03 node-buffers-and-streams | Buffer·encoding·pipeline·backpressure | NDJSON 집계 | 임의 chunk·UTF-8 분할·느린 출력·실패 전파·부분 결과 정책 |
| N04 node-http-and-validation | method/status·URL/본문·byte 상한 | 조회 HTTP API | 정상/404/불량 입력·본문 제한·이중 응답 방지 |
| N05 node-outbound-requests-and-cancellation | Fetch·deadline·AbortSignal·재시도 | 상류 조회 어댑터 | 지연·4xx/5xx·취소·재시도 상한·deadline 의미 구분 |
| N06 node-events-and-lifecycle | phases·EventEmitter·timer·signal·shutdown | 정리 가능한 큐/서비스 | 오류 관찰·리스너 누수·반복/처리 중 종료·신규 작업 거부 |
| N07 node-workers-and-resource-limits | CPU Worker·pool·대기열·프로세스 경계 | 제한된 집계 작업 제공자 | 순차 결과 일치·worker/큐 상한·timeout·종료·낡은 결과 거부 |
| N08 node-testing-and-delivery | node:test·대역·실제 임시 파일/loopback·환경·의존성 | 깨끗한 환경의 인수 검사 | 비동기 대기·오답 실패·포트/파일/worker 정리·재현 |

기본 순서는 N01→N08이다. HTTP requestTimeout은 핸들러의 전체 계산 deadline과 같다고 가정하지 않는다. 같은 파일의 writeFile을 완료 전에 병렬 호출하지 않는다. 스트림 chunk 하나를 레코드 하나로 가정하지 않는다.

학생 제출에 임의 명령 실행을 기본 허용하지 않는다. Node 트랙은 웹에서 교재를 읽을 수 있어도 로컬 어댑터 또는 격리 실행 서비스 연결 전에는 실행 불가다.

## 통합 프로젝트와 검증 4강

선수: 공통과 선택 호스트 트랙. 작은 고정 데이터·실패 fixture·규모 상한을 갖는 조회 제품을 완성한다. 브라우저는 검색 대시보드, Node는 NDJSON CLI/HTTP 조회 도구를 만든다.

| 번호와 계획 ID | 결과물 | 필수 행동 | 실패시킬 대표 오답 |
| --- | --- | --- | --- |
| C01 capstone-domain-core | 정규화·필터·집계·정렬·직렬화의 공유 패키지 | 누락/중복·불변성·ESM·결정적 검사 | 전역 상태·원본 sort·DOM/fs 결합 |
| C02 capstone-host-product | 선택 호스트 조회 제품 | 정상/빈/입력 오류/상류 실패·복원·취소 | HTTP 실패 성공 처리·늦은 응답 덮어쓰기 |
| C03 capstone-failure-and-scale | 장애·큰 입력·관측 정보 보강 | 동시성/입력/출력 상한·정리·반복 실행·측정 | 무제한 재시도·전체 축적·종료 뒤 자원 잔류 |
| C04 capstone-acceptance-review | 인수 검사·설계 메모·사용 설명 | 환경 재현·정답/오답 검사·지원/미지원·선택 이유 | 출력 하드코딩·검사0개 PASS·다른 소스 결과 재사용 |

브라우저 C02는 한글·키보드·접근성·반응형을, Node C02는 작업 경로·exit code·HTTP 종료·스트림 자원을 포함한다. C03의 성능 목표는 fixture·기준 기기·측정 방법을 지정한 뒤 정한다. 검증 전 성능 수치를 약속하지 않는다.

양쪽 트랙 이수자는 동일 core를 브라우저+Node 작업 모니터로 연결하는 후속 프로젝트를 선택할 수 있다. 이는 기본 4강 외 확장이며 요청 ID·작업 ID·취소 경쟁·재접속 상태 복원까지 평가한다.

## 선수 관계의 구현 계약

- 기본 흐름: 의미 모델 → 함수 → 객체 → 데이터 → 모듈/실패/검사 → 비동기 → 호스트 선택 → C01–C04.
- 07←06, 09←08, 12←07·10, 14←13, 16←14·15, 19←10·11·17, 23←06·08·16, 26←24·25, 28←19·23·25·27, 29←27·28, 31←29·30, 32←26·29·31을 최소 필수 연결로 등록한다.
- 22는 20·21, B07/N07은 19·31·32, C02는 선택 트랙 전체, C03은 C02·32, C04는 C01–C03을 요구한다.
- 진단 면제는 이 역량을 충족할 때만 인정한다. 위 관계는 구현 시 실제 ID로 변환하고 중복·참조 누락·순환을 검사한다.
- 번호 순 학습에 필요한 나머지 선수는 본문의 단원 조건을 유지한다. 최소 연결만을 모든 선수의 완전한 목록으로 취급하지 않는다.

## 최신 정식 기능과 선택 심화

ES2026 공식 PDF에서 다음 절을 대조했다 [S02]. 새로운 API가 핵심 개념을 대신하지 않도록 관련 수업의 비교 예제·확장 문제로 배치한다. 실제 환경 미지원은 학습자 오답으로 처리하지 않는다.

| 기능 | 정식판 절 | 배치 |
| --- | --- | --- |
| Map.prototype.getOrInsert / Map.prototype.getOrInsertComputed | 24.1.3.7–8 | 18 집계 기본값과 기존 undefined 값 |
| JSON.parse source 문맥 / JSON.rawJSON | 25.5.2–3 | 21 숫자 정보·직렬화 심화 |
| Iterator.concat | 27.1.3.2.1 | 19 지연 순회 비교 |
| Uint8Array Base64/Hex API | 23.3 | N03 또는 바이너리 선택 심화 |
| Math.sumPrecise | 21.3.2.34 | 04 수치 계산 선택 문제 |
| Error.isError | 20.5.2.1 | 25 오류 식별·realm |
| Array.fromAsync | 23.1.2.2 | 28 비동기 소비와 Promise.all 비교 |

Stage 4는 연간 정식판 포함과 같은 뜻이 아니다 [S03]. Temporal·Explicit Resource Management 등은 ES2026 필수 기능에 넣지 않는다. 채택 시 발행판·실제 런타임을 새 프로필로 확인한다. 복사형 배열 API·groupBy·Set 연산·Iterator helpers·RegExp.escape·Error.cause 등을 모두 2026 신규 기능이라고 묶지 않는다.

확장 선택 6개 묶음: (1) Proxy/Reflect·불변식, (2) TypedArray/ArrayBuffer/DataView·전송·바이너리, (3) WeakMap/WeakSet/WeakRef/FinalizationRegistry·GC와 자원 수명, (4) SharedArrayBuffer/Atomics·메모리 모델, (5) 정규식·Unicode·Intl·수치 심화, (6) TypeScript 타입 계약과 선택 프레임워크. 각 묶음의 강의 수는 핵심 경로 검증 후 정한다.

## 실행 방식과 평가 신뢰 범위

순수 JS는 전용 Worker부터 검증한다. DOM 과제는 별도 iframe/브라우저 환경과 고정 harness가 필요하다. 같은 출처 iframe에 allow-scripts와 allow-same-origin을 함께 부여해 안전하다고 가정하지 않는다. Node는 고정 실행 파일·인자·편집 파일 allowlist·timeout·출력 상한·프로세스 정리를 갖는 별도 제공자가 필요하다 [S20].

Worker/iframe·node:vm·Node Permission Model을 악성 제출에 대한 완전한 OS 보안 격리로 표현하지 않는다. 불특정 원격 제출을 실행하는 서비스는 별도 격리 설계가 필요하다. 로컬 실행의 실제 OS 권한·작업 폴더·네트워크 범위를 표시한다.

공개 저장소와 브라우저에 제공하는 검사 코드는 비밀 채점 또는 위변조 방지 성적 인증이 아니다. 현재 목표는 자가 학습용 행동 검증이다. 공인 성적·서버가 신뢰하는 평가를 도입하려면 별도의 신뢰 경계와 데이터 계약이 필요하다.

## 제품 구현 순서

학습 순서와 제품 구현 순서를 구분한다. 첫 구현은 기존 07 수업 전체 흐름이며, 완성된 과정의 학습 시작은 01이다.

| 단계 | 범위 | 완료 조건 |
| --- | --- | --- |
| M0 기획 고정 | 이 로드맵·수업 계약·실행 방식·기술 선택 | 사용자 검토 반영·핵심/선택 구분·미결정 해소 |
| M1 대표 수업 | 07 교재·정답/오답·편집기·실행/제출·저장 | 정답 통과/오답 실패·취소·저장 실패/복원·코드 수정 후 결과 무효화 |
| M2 공통 앞부분 | 01–11·목차·단계 이동·진단·진도 | 실제 화면·한글/키보드·개정 분리·연결/실행 검사 |
| M3 공통 완성 | 12–32·다중 파일·비동기 fixture | 목표-문제-검사 대응·오류/경쟁/동시성 검사 |
| M4 브라우저 완성 | B01–B08·C01–C04 브라우저 경로 | 실제 DOM/네트워크/저장·접근성·반응형 검사 |
| M5 Node 완성 | 실행 제공자·N01–N08·Node 통합 경로 | 고정 Node·파일/네트워크/자원 경계·실제 실행 |
| M6 확장 | 선택 심화·TypeScript/프레임워크·설치형 | 각 범위 기획·실제 환경 검증·출시 권한 |

웹 우선이므로 M4를 먼저 완성한다. Node는 실행 제공자가 필요해 M5로 둔다. UI 프레임워크·편집기·호스팅·설치형·라이선스·실행 제품은 미선정이다. 후속 요청으로 7장 세부 내용과 용어집·UI/UX 기획을 보강하고 작동하는 화면 시안을 만든다. 제품 기능 구현은 기획 검토 뒤 이어간다. 새 문서의 커밋/푸시·유료 자원·배포는 별도의 현재 승인 범위를 따른다.

각 단계는 작성자 외 독립 검토를 받는다. UI는 실제 합성 화면과 320/360/390 CSS px·태블릿·데스크톱·가로/세로·짧은 높이·200%·키보드/한글·텍스트 선택을 확인한다. 브라우저 에뮬레이션과 실제 기기를 구분한다. npm run check는 연결·구문·어댑터 검사이며 수업 실행/채점/UI 검사와 별개다.

수업 공개 전에는 5단계·공식 절·예제 실행·정답 통과/오답 실패·파일/프로필 연결·개정/초안·결과 상태·독립 검토·실제 화면을 확인한다. 미충족 수업은 draft와 executionVerified:false를 유지한다.

## 공식 조사 근거

확인일: 2026-10-14. 정식판 존재·관련 API와 호스트 규칙의 조사 근거이며 제품 지원 인증은 아니다. 정식 HTML은 도구 4MiB 제한으로 읽기에 실패해 공식 인쇄용 PDF를 보완 사용했다. Ecma는 HTML을 규범적 원본으로 지정한다.

- **S01** [ECMA-262 정식판 안내](https://ecma-international.org/publications-and-standards/standards/ecma-262/): ES2026·제17판·발행 시점.
- **S02** [ES2026 공식 PDF](https://ecma-international.org/wp-content/uploads/ECMA-262_17th_edition_june_2026.pdf), [정식 HTML](https://262.ecma-international.org/17.0/): 언어 의미·정식 API 조항.
- **S03** [TC39 절차](https://tc39.es/process-document/), [완료 제안 목록](https://github.com/tc39/proposals/blob/main/finished-proposals.md): 완성 단계·발행판 분리.
- **S04** [HTML 이벤트 루프](https://html.spec.whatwg.org/multipage/webappapis.html#event-loops): 웹 일정·작업.
- **S05** [DOM](https://dom.spec.whatwg.org/): 문서·이벤트·AbortSignal.
- **S06** [Fetch](https://fetch.spec.whatwg.org/): 네트워크·응답·CORS.
- **S07** [Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html), [IndexedDB 2.0 Recommendation](https://www.w3.org/TR/IndexedDB-2/): 저장 방식·실패·트랜잭션 경계. [IndexedDB 3.0 편집 초안](https://w3c.github.io/IndexedDB/)은 별도 참고이며 정식 권고안으로 표시하지 않는다.
- **S08** [HTML Worker](https://html.spec.whatwg.org/multipage/workers.html), [URL](https://url.spec.whatwg.org/): 메시지·종료·주소.
- **S09** [HTML 폼](https://html.spec.whatwg.org/multipage/forms.html), [UI Events 편집 초안](https://w3c.github.io/uievents/), [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/): 입력·조합·접근성 기준. UI Events의 초안 상태와 실제 구현 검증을 구분한다.
- **S10** [Node 릴리스](https://nodejs.org/en/about/previous-releases), [릴리스 일정](https://github.com/nodejs/Release#release-schedule), [브라우저와의 차이](https://nodejs.org/en/learn/getting-started/differences-between-nodejs-and-the-browser): 버전·호스트.
- **S11** [Node 24 ESM](https://nodejs.org/docs/latest-v24.x/api/esm.html), [Packages](https://nodejs.org/docs/latest-v24.x/api/packages.html): resolve·패키지.
- **S12** [Node 24 Test runner](https://nodejs.org/docs/latest-v24.x/api/test.html): 행동 검사·대역·실패.
- **S13** [Node 24 Globals](https://nodejs.org/docs/latest-v24.x/api/globals.html): Fetch·AbortController 등.
- **S14** [Node 이벤트 루프](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick): phases·timer·nextTick.
- **S15** [Node 24 fs](https://nodejs.org/docs/latest-v24.x/api/fs.html), [Path](https://nodejs.org/docs/latest-v24.x/api/path.html): 파일·경로·핸들.
- **S16** [Node 24 Buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html), [Stream](https://nodejs.org/docs/latest-v24.x/api/stream.html): 인코딩·pipeline·backpressure.
- **S17** [Node 24 HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html), [Events](https://nodejs.org/docs/latest-v24.x/api/events.html), [Process](https://nodejs.org/docs/latest-v24.x/api/process.html): 서버·리스너·종료.
- **S18** [Node 24 Worker](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html), [보안 권장사항](https://nodejs.org/en/learn/getting-started/security-best-practices): CPU 작업·자원·신뢰 경계.
- **S19** [ECMA-402 정식판 안내](https://ecma-international.org/publications-and-standards/standards/ecma-402/), [공식 PDF](https://ecma-international.org/wp-content/uploads/ECMA-402_13th_edition_june_2026.pdf): Intl의 별도 표준.
- **S20** [HTML iframe sandbox](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox), [Node 24 vm](https://nodejs.org/download/release/v24.21.0/docs/api/vm.html), [Permissions](https://nodejs.org/download/release/v24.21.0/docs/api/permissions.html): 실행 격리의 한계.

- **S21** [HTML Structured data](https://html.spec.whatwg.org/multipage/structured-data.html#safe-passing-of-structured-data): structuredClone의 호스트 계약·지원/보존 한계.

채용 공고·기술 사용률·기업 실제 과제·학습 성과는 조사 근거로 주장하지 않는다. 정확한 환경·자원 상한·학습 효과는 후속 실제 검증 대상이다.
