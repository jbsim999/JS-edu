# JS-edu

다른 언어 경험자와 현직 개발자가 JavaScript의 의미 모델부터 실무 설계까지 학습하는 교육 프로젝트입니다.

현재는 프로젝트 연결을 위한 **초기 구조**입니다. 수업·과제 초안, 저장·실행 어댑터, 문서와 CI 정의가 있으며 학습 화면·IDE·실제 실행기·설치 패키지는 다음 단계에서 구현합니다.

## 프로젝트 연결

이 README가 있는 **JS-edu 폴더**를 Codex 프로젝트로 연결하세요. 이어서 [현재 상태](docs/project-state.md)를 읽고 대표 수업 하나의 전체 흐름부터 구현합니다.

표시명·폴더명·GitHub 저장소명은 JS-edu, npm 식별자는 소문자 규칙에 따라 js-edu입니다. 원격 목표는 https://github.com/jbsim999/JS-edu 이며 실제 연결 상태는 현재 상태 문서와 Git 설정을 확인하세요.

## 개발자 빠른 시작

Node.js 22 이상에서 실행합니다. 초기 골격에는 외부 npm 의존성이 없으므로 설치 없이 검사할 수 있습니다.

```sh
npm run check
```

이 명령은 교재 연결 구조·JavaScript 구문·기본 어댑터 동작을 확인합니다. 수업 제출 통과·ES2026 전체 지원·제품 실행을 뜻하지 않습니다. 현재 개발 확인 환경은 Node.js 22.17.0입니다. 제품 런타임은 미선정이며 개발 도구 버전과 별도입니다.

## 학습 설계

언어 기준은 ECMAScript 2026(ECMA-262 제17판)입니다. [공식 표준](https://262.ecma-international.org/17.0/)과 [교육 로드맵](docs/roadmap.md)을 기준으로 이론 → 예시 → 문제풀이 → 실무 심화 → 직접 코딩의 다섯 단계를 구성합니다. 브라우저 API와 Node.js API는 언어 표준과 분리합니다.

대표 초안은 바인딩·스코프·클로저입니다. 교재 검수·대표 정답/오답 실행·학습자 흐름 검증을 완료한 뒤 카탈로그를 확장합니다. 실행 프로필은 available:false, 과제는 executionVerified:false입니다.

## 구조

| 경로 | 책임 |
| --- | --- |
| curriculum/ | 수업 카탈로그·단원·예제·과제 |
| starter/ | 학습자가 편집할 코드 |
| reference/ | 이후 작성할 기준 답안 |
| grader/ | 고정 행동 검사 계약 |
| runtime/ | 버전별 실행 프로필과 호스트 계약 |
| web/ | 화면 기능 경계·저장 및 실행 어댑터 |
| desktop/ | 추후 설치형 앱 연결 경계 |
| scripts/ · tests/ | 구조 검사·구문 검사·어댑터 테스트 |
| .github/ | CI 및 PR 템플릿 |
| docs/ | 기획·로드맵·검증·인계·패키징 |

## 문서와 기여

- [제품 기획](docs/plan.md) · [학습 화면 구조](docs/frontend-structure.md)
- [실행 계약](docs/runtime-design.md) · [추후 패키징](docs/packaging.md)
- [협업 규칙](CONTRIBUTING.md) · [에이전트 지침](AGENTS.md) · [검증 기록](docs/verification.md)

화면 미리보기·학습자 설치 안내·출시 링크는 구현 후 제공합니다. 문의는 저장소 Issue를 사용합니다. 프로젝트 라이선스는 아직 지정하지 않았으며 외부 문서·향후 포함 런타임의 라이선스는 별도로 확인합니다.
