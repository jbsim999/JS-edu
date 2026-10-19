# 원격 CI 실행 경계 보완 검증

2026-10-19. 기준 커밋은 M5 `5c991e6a19b479d286193c79b012723ccce8c9e2`다. 첫 [일반 CI](https://github.com/jbsim999/JS-edu/actions/runs/39189509471)와 [고정 Node CI](https://github.com/jbsim999/JS-edu/actions/runs/39189509624)의 실패를 원문 로그로 확인했다. Ubuntu 고정 Node110은 통과했지만 Ubuntu/Node22의 직접 stdout, Windows/Node24의 예제는 private 관찰 이전 Worker exit0으로 실패했고 Windows 고정 Node의 canonical 파일 접근은 권한 오류로 실패했다.

## 재현과 수정

로컬에서 실제 Worker가 private 완료 뒤 부모 종료 전 자연 종료하는 것을 FAIL로 재현했다. 완료 응답이 이미 결정된 send('complete') 구간에서만 캡처한 native interval을 유지하며, supervisor가 private 완료를 수신하고 Worker.terminate로 정리한다. private port를 ref하지 않아 활성 핸들에서 관찰 채널을 찾는 위조 경로를 추가하지 않는다. 오류·timeout·취소 정리도 기존 supervisor/프로세스 종료 경로를 사용한다.

initialize부터 interval을 유지했던 중간안은 N06 오답의 자연 종료와 N08 node:test의 idle 완료를 바꿔 실제 전수 검사에서 실패했다. 그 안은 폐기했다. 현재 구현은 완료 전 native beforeExit를 보존한다. Node beforeExit의 실제 probe, 완료 뒤 부모 종료 대기, 직접 stdout 상한과 활성 핸들 위조 거부를 함께 확인했다. 오답 timeout 허용 범위를 넓히지 않았다.

별칭 parent에 생성한 실제 junction/symlink 경로의 파일 실행도 수정 전 FAIL로 재현했다. workspaceParent를 realpath로 해석한 뒤 base/job을 만들고 권한 인자·컨텍스트·정리 경계를 모두 그 canonical 경로에서 파생한다. 파일 읽기는 해당 job, 쓰기는 data/runtime-home 범위를 유지하며 상위 디렉터리 전체로 권한을 넓히지 않는다. 수정 후 canonical 경로 읽기/쓰기와 종료 후 parent가 비는 것을 확인했다.

## 실제 최종 검증

최종 Git index를 `work/m5-ci-review-final`로 분리했다. Windows 제작자Node22.17.0과 실제 실행Node24.22.0에서 `npm run check`는 구문296·회귀281/281·skip0 PASS다. host 없는 제작자33과제271조건·예제33은 PASS이고 호스트 skip22는 PARTIAL이다. 새 경계5회귀도 모두 PASS다.

같은 분리본의 실제 Node 로컬 HTTP 제공자 검증 2026-10-19T02:39:24.514Z–02:40:32.367Z에서11과제 정답110/110·각11개 starter/대표 오답 거부·예제11·종료 정리 PASS다. 원본 입력87개와 canonical reference·예제·readonly helper 지문을 다시 대조하고 과제별 실행 기록11개를 갱신했다.

변경 소스3개는 index·분리본·작업본 byte가 일치하며 SHA256 집계는 `3548312fb82354089a17625ed0517cbeab9b51ec968c4dec70d25d8f7fab897d`다. [검증 스냅샷](runtime-ci-verification-evidence.json)을 따른다. 작성자와 별도인 코드 리뷰어의 최종 소스·로그·지문 대조 판정 PASS이며 미해결 P1/P2가 없다. 리뷰어는 읽기 전용 검토를 수행했고 실제 실행은 총괄의 기록이다. 브라우저/UI 변경은 없으며 [M5 검증](curriculum-m5-verification.md)의 실제 Chrome44과제361조건·화면 증거는 해당 기준선의 검사로 유지한다.

## 범위

후속 제품 커밋 `16b4a45aaa312c16d746395b3653cd34827625d0`의 [고정 Node CI](https://github.com/jbsim999/JS-edu/actions/runs/39191401477)는 Windows/Ubuntu 모두 success다. [일반 CI](https://github.com/jbsim999/JS-edu/actions/runs/39191401370)는 Ubuntu22/24가 success이며 Windows22/24는 오류 주입 테스트의 후처리 경계 비교에서 실패했다. 제품의 canonical target과 테스트의 원래 tmpdir 별칭이 달랐기 때문이다.

테스트 후처리에서 parent와 target을 모두 realpath로 확인하고 기존 descendant·absolute·폴더 prefix 검사를 유지한 뒤 canonical target만 삭제하도록 수정했다. 소유한 별칭 TEMP/TMP의 동일 assertion FAIL을 로컬에서 재현했고, 수정 후 같은 환경과 고정24.22.0으로 학습 서버5회귀·skip0 PASS를 확인했다. 별도 코드 리뷰어가 diff와 전후 로그를 읽기 전용으로 대조해 삭제 범위 완화·외부 경로 우회 없음, PASS로 판정했다. 제품 실행 소스는 이 후처리 수정에서 바뀌지 않았다. 최종 일반 CI는 이 테스트 보완을 포함한 후속 커밋의 결과를 따른다.

후속 커밋의 원격 Windows/Ubuntu 결과는 해당 SHA의 GitHub Actions에서 확인한다. 설치 패키징·main 병합·외부 배포는 수행하지 않았다. 실제 기기·실제200% 확대·OS IME·스크린리더는 미검증이다. Node Permission Model·네트워크 허용·Worker opt-in·힙과 RAM 및 DOM 강제 종료의 기존 한계 고지를 유지한다.
