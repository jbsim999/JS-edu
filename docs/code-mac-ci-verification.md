# 0.1.1 원격 검증 보완

첫 소스 `043d8f6f21bfd208db5a7ff3d7f07c895fce3b57`은 [데스크톱39209629600](https://github.com/jbsim999/JS-edu/actions/runs/39209629600)에서 전체 FAIL이다. Windows와 Mac x64는 검사 하네스가 비동기 파일 읽기 뒤 초기화하면서 Electron ready보다 늦게 `enableSandbox()`를 호출했다. Mac arm64는 고정 공식 원본 Electron.app의 `codesign --deep --strict`에서 resource envelope 부재 오류가 발생했다. 원본 재서명·바이트 수정·임의 오류 허용으로 PASS 처리하지 않는다. 정확한 서명 형상과 코드 서명 검사를 후속 근거로 구분한다.

두 Mac CPU에서 Unix 전용5개 회귀는 실제 PASS다. 서비스 timeout SIGKILL 후 독립 supervisor/같은 PGID의 자식·포트 회수, 다른 PGID 통제 서버 생존, 미소유 그룹 거부를 포함한다. 해당 부분 PASS를 최종 앱 전체 PASS로 올리지 않는다. 원시는 `artifacts/ci-043-mac-x64.log`, `ci-043-mac-arm64.log`에 보존한다.

[고정 Node39209629750](https://github.com/jbsim999/JS-edu/actions/runs/39209629750)은 Windows/Linux 모두 PASS다. [일반39209629691](https://github.com/jbsim999/JS-edu/actions/runs/39209629691)은 Ubuntu22/24와 Windows24가 PASS, Windows22.23.3에서 DOM fixture의 감사 기록 수집 순서가 경합해 FAIL이었다. 실행 결과 MessagePort와 감사 parentPort가 독립 채널인데 결과 반환 직후 감사가 이미 도착했다고 가정했다.

감사 전달을 의도적으로40ms 늦춘 fixture로 기존0!==1 실패를 재현했다(`artifacts/dom-audit-before.log`). 제품 코드와 기존 성공·경계 assertions는 유지하고, Worker 종료/메시지 배달과 예약된 감사 배달을 모두 기다린 뒤 검증하도록 테스트를 보완했다. 동일 파일27/27 PASS(`dom-audit-after.log`)이며 독립 읽기 검토도 PASS다. 일반 sandbox 실행의 로컬 HTTP EACCES3개는 `dom-audit-sandbox-denied.log`에 구분하며 제품 결함이나 성공 근거로 사용하지 않는다. 새로운 소스 커밋의 전체 검사와 native 결과로 최종 판정한다.

보완 소스의 Windows/고정 Node24.22.0 전체 `npm run check`는 exit0 PASS다. 구조52·구문317·회귀316중311PASS/Unix5skip/FAIL0, 제작자33실습271조건·예제33PASS/호스트22skip(PARTIAL)다. 전후504입력 SHA256 `4a764b271ca9292825f3b9d1b410110e0f398afdaeeaebe625a4a7e2ca1f104b`가 동일하다. 원시는 `artifacts/code-mac-check.log`, `code-mac-check-source.json`이며 이전043 검사는 `code-mac-check-043.log`, `code-mac-check-source-043.json`에 구분해 보존한다.

별도 Windows 후보 ZIP의 전체 실제 앱 검사는 2026-10-19 06:46:37–06:49:17 UTC PASS다(`artifacts/code-mac-native-candidate-01/desktop-smoke-report.json`). 55실습471조건·코드 토큰/원문·정상/강제종료·이동 경로·저장/복원·실제200%를 포함하며 최종 원본/이동본 파일은 불변이다. 총괄이 코드 예시 light와 dark200% 합성 화면을 직접 확인했다. 이 후보는 sourceDirty:true이므로 배포 완료나 clean 최종 산출물로 표시하지 않는다. 후속 clean 커밋의 Windows 및 Mac 두 CPU native/ZIP 검사가 남아 있다.
