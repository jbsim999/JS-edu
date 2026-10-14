# JS-edu 협업 규칙

junbo-github-conventions의 기본안을 이 초기 저장소에 적용한다. 커밋 형식은 [Conventional Commits 1.0.0](https://www.conventionalcommits.org/ko/v1.0.0/)을 따르며 타입·scope·브랜치 목록은 이 프로젝트의 선택이다.

## 브랜치와 PR

기준 브랜치는 main이다. 초기 골격 커밋 이후에는 feat/bindings-lesson, fix/draft-storage처럼 유형/작업설명을 사용한다. 실제 이슈가 있으면 feat/123-bindings-lesson처럼 번호를 연결하고 번호를 꾸며 넣지 않는다. 이름은 영어 소문자와 하이픈으로 작성한다. 하나의 PR은 하나의 목적에 집중한다.

병합 전에 npm run check 통과와 필수 리뷰 의견 해결을 확인한다. 의미 있는 변경은 작성자 외 독립 코드 검토를 받는다. 에이전트 검토와 GitHub 계정의 사람 승인을 구분한다. UI 구현 시 실제 합성 화면 검수를 추가한다. 1인 저장소의 제약은 PR에 기록한다.

Squash merge는 권장한다. 원격 병합 옵션·브랜치 보호·필수 검사 강제 설정은 이번 범위에서 적용하지 않았다. main 강제 푸시·삭제 및 보호 우회를 금지한다. 초기 부트스트랩만 직접 main에 반영하고 이후 외부 변경은 현재 요청의 권한을 확인한다.

## 커밋과 제목

형식: type(scope): 변경 내용. scope는 선택이며 실제 모듈을 쓴다.

| 타입 | 용도 |
| --- | --- |
| feat / fix | 기능 추가 / 결함 수정 |
| refactor / perf | 동작 유지 구조 변경 / 성능 |
| test / docs / style | 검사 / 문서 / 코드 서식 |
| build / ci / chore | 빌드·의존성 / CI / 관리 |

scope 후보: curriculum, web, runtime, desktop, scaffold. 예: feat(curriculum): 클로저 대표 수업 추가, fix(web): 교재 개정별 초안 분리. 호환성을 깨면 ! 또는 BREAKING CHANGE:와 이행 방법을 남긴다.

## 명명과 리뷰

JavaScript 변수·함수는 camelCase, 클래스는 PascalCase, 모듈 파일은 kebab-case.mjs를 사용한다. 불필요한 축약 대신 userCount, createRunner처럼 의미가 드러나는 이름을 쓴다. API, URL, ID 등 통용 약어는 허용하되 apiUrl, lessonId로 일관되게 쓴다. 설명·리뷰는 한국어를 기본으로 한다.

리뷰는 [필수], [제안], [질문], [사소]로 의도를 밝힌다. 주석은 이유와 제약을 설명한다. PR 양식에 문제·변경 후 행동·영향·실제 검사·미검증·필요한 복구 절차를 적는다. 비밀정보와 개인 로컬 경로를 커밋하지 않는다.

## 검증

Node.js 22 이상에서 npm run check를 실행한다. 외부 npm 패키지는 아직 없다. CI workflow scaffold-check의 job structure-and-adapters는 Windows/Ubuntu 및 Node.js 22/24에서 같은 명령을 실행하도록 정의돼 있다. 정의와 실제 원격 실행 결과를 구분한다. 이 검사만으로 교육 내용·학습 제출·UI·패키징을 승인하지 않는다.
