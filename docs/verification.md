# 검증 기록

확인일: 2026-10-14. 초기 구조에 대한 검사이며 교육 내용 승인·학습 제출·UI·패키징 검증과 다르다.

| 실제 검사 | 결과 | 범위 |
| --- | --- | --- |
| npm run validate | PASS / 단원 1, 초안 1 | ID·선수 관계·수업/과제/프로필·과제 파일 연결 |
| npm run check:syntax | PASS / .mjs 8개 | 구문 검사, 코드 실행 결과 아님 |
| npm test | PASS / 9개, 실패·건너뜀 0 | 초안 분리·저장 실패·실행 불가·검증기 회귀 |
| git diff --cached --check | 초기 stage PASS | 공백/패치 검사 |
| 커밋 소스와 snapshot 대조 | PASS / 파일 36개 | 기록한 개별 SHA256과 Git blob 일치 |
| GitHub CI | PASS / 환경 4개 | Windows/Ubuntu × Node.js 22/24 |

총괄이 Windows/Node.js 22.17.0에서 npm run check를 실행했다. 저장 어댑터 테스트 4개와 검증기 회귀 테스트 5개가 통과했다. 누락된 starter/testFiles, 프로젝트 밖 경로·외부 링크·디렉토리 참조, 목차/단원 불일치가 실패로 잡힌다. 테스트의 링크는 전용 임시 디렉토리 안에서만 생성·정리한다.

샌드박스 실행은 Windows 링크 생성 EPERM으로 해당 검사 1개를 수행하지 못했다. 네이티브 승인 실행에서 같은 코드로 링크 검사까지 9개 모두 통과했으며 실패를 건너뛰기로 바꾸지 않았다.

독립 리뷰에서 파일 참조·목차 일치 검증 공백(P2)을 발견해 검증기와 좁은 회귀 검사를 보완했고, 독립 재검토 PASS를 받았다. 리뷰어의 소스 검토와 총괄의 실제 실행을 구분한다.

원격 검증 소스는 2803adf62ccea040c58746d670754430d2bee6af이며 [CI 실행 38500101310](https://github.com/jbsim999/JS-edu/actions/runs/38500101310)의 네 job이 모두 success였다. 초기 main 반영 SHA와 로컬 소스 SHA가 일치했다. 후속 인계 문서 갱신은 검증한 코드·데이터를 변경하지 않는다.

현재 소스의 경로·크기·SHA256은 [verification-evidence.json](verification-evidence.json)에 기록한다. 자기 참조를 피하려고 이 검증 기록·현재 상태·증거 JSON은 hash 범위에서 제외한다. Git 커밋/ref는 원격 반영 후 현재 상태 문서에서 확인한다. scaffold-manifest.json은 수정 전 생성기 출력만 기록하므로 현재 소스 검증 증거가 아니다.

미검증: 대표 예제 예상 출력, 교재 내용 승인, 실제 학습 실행/제출·grader, ES2026 기능별 호환성, UI/접근성/반응형, 실제 기기, 설치·서명·배포·릴리스. Windows 개발 골격 검사를 전체 교육 제품 PASS로 확대하지 않는다.
