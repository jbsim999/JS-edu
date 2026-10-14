# 현재 상태

단계: JS-edu 초기 프로젝트 연결 준비. 이번 승인: 로컬 구조 및 비공개 GitHub 저장소 생성·연결·초기 커밋 반영.

완료: 교육 데이터 및 대표 클로저 초안, 웹 기능 경계, 저장/실행 불가 어댑터, 구조/구문 검사, 회귀 테스트, 협업 규칙·PR 양식·CI 정의, 추후 패키징 지침. GitHub 비공개 jbsim999/JS-edu 생성과 origin 연결 완료. 기준 브랜치 main.

실제 로컬 검사: Windows/Node.js 22.17.0, npm run check PASS(구조·구문 8개·테스트 9개). 독립 코드 리뷰에서 파일/목차 연결 검증 공백을 수정했고 수정 후 재검토 PASS. 실행은 총괄, 독립 리뷰는 별도 코드 리뷰 에이전트가 담당했다.

소스 snapshot SHA256: 84c94ff3bd827957f012a7c6c39bb3324273da504ed8fa71c2725734d6fd99e2. 범위·개별 hash와 실제 검사 근거는 docs/verification-evidence.json 및 docs/verification.md 참조. 이 인계 문서와 검증 보고서는 snapshot에서 제외한다. 커밋된 소스 파일 36개를 개별 SHA256과 대조해 모두 일치했다.

검증 소스 커밋: 2803adf62ccea040c58746d670754430d2bee6af. 원격 origin/main에 같은 SHA 반영 및 upstream 연결 확인. [GitHub CI](https://github.com/jbsim999/JS-edu/actions/runs/38500101310): Windows/Ubuntu × Node.js 22/24 네 조합 모두 success. 이것은 구조·구문·어댑터·검증기 테스트 결과이며 제품 런타임 전체 지원 승인이 아니다.

검증 이후 후속 문서 커밋은 이 인계 및 검증 기록만 갱신한다. 현재 HEAD는 git rev-parse HEAD, 원격 동기화는 git status -sb와 git ls-remote origin refs/heads/main으로 확인한다. 저장소는 [jbsim999/JS-edu](https://github.com/jbsim999/JS-edu), 비공개, 기본 브랜치 main이다. 브랜치 보호·강제 필수 검사 설정은 적용하지 않았다.

미구현/미선정: UI·IDE·제품 실행기·grader·설치형·배포·프로젝트 라이선스. 언어 기준 ES2026는 개발 Node.js나 제품 런타임 버전과 별도다. npm 검사 PASS는 학습 제출이나 교육 제품 완료가 아니다.

패키징 요청 시 junbo-desktop-runtime-packaging 스킬 적용. 해당 계약은 AGENTS.md와 docs/packaging.md에 기록됐다. 현재 패키징/배포 권한은 없다.

재개: 이 문서 → education.config.json → CONTRIBUTING.md → docs/plan.md 및 docs/roadmap.md. 다음 단계는 대표 수업 하나의 내용·정답/오답·실제 실행·저장·전체 화면 흐름 구현이다.
