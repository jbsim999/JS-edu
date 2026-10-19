# 현재 상태

## 2026-10-19 0.1.1 원격 검사 보완 후 로컬 PASS

첫043d8f6의 데스크톱 CI는 하네스 ready 경합과 Mac 원본 bundle 서명 상태에서 FAIL이었다. 원본 바이트/서명 상태를 보존하고 실제 존재하는 코드 서명 검증 범위를 분리했다. Windows22 DOM 감사 fixture 경합도 재현·보완했다. [원격 검증 보완](code-mac-ci-verification.md)에 실패 원시와 변경 이유를 기록한다.

보완 소스 전체 검사는 구조52·구문317·회귀316중311PASS/Unix5skip/FAIL0, 제작자33/271·예제33PASS/호스트22skip(PARTIAL)다. 전후504입력 SHA256은 `4a764b271ca9292825f3b9d1b410110e0f398afdaeeaebe625a4a7e2ca1f104b`로 동일하다. Windows 별도 후보의 실제 전체 native 검사도 PASS이나 sourceDirty:true이며 전달용 최종 패키지는 아니다. clean 후속 소스의 Windows/Mac x64/Mac arm64 native 검사 후 main에 반영한다. 기존 사용자0.1.0 ZIP·미리보기4179·학습 기록을 보존한다.

## 2026-10-19 코드 문법 테마와 macOS 추가 패키징

사용자가 Windows0.1.0의 정상 실행을 확인한 뒤 코드 예시/편집 문법 테마, macOS Intel·Apple Silicon 패키징과 완료 후 main 반영을 승인했다. 패키징 스킬의 원본 전체 보존·실제 네이티브 검증·최종 해제본 대조를 적용한다. 버전은0.1.1로 올리고 기존0.1.0 ZIP과 학습 데이터를 보존한다. 공개 Release 게시 권한을 추가하지 않는다.

코드 테마는 개별5회귀와 별도 Chrome155의11묶음(실제 카운터 제출/한글 복원/색상·선택·스크롤·고대비/320–1440·짧은 창/JSON·용어집/특수 공백·CRLF 원문 보존) PASS다. 최종 소스 필수 검사도 구조52·구문316·회귀313중308PASS/Unix5skip/FAIL0, 제작자33과제271조건·예제33PASS/호스트22skip(PARTIAL)로 통과했다. 검사 전후503파일 지문은 `db0479e7d7888a414938f9c07e548b9c6121c39bdb936984f11439aa876d53b2`로 동일하며 정적 독립 검토도 PASS·미해결 P1/P2 없음이다.

[코드 계약](code-theme.md), [Mac 패키징 계약](macos-packaging-implementation.md), [비공개 수신자 전송](desktop-private-transfer.md)을 따른다. Mac 공식 네 원본의 SHA/실제 CPU를 확인했고 최소OS는 포함 Node24.22.0에 맞춰13.5다. 최종 Mac native·서명·ZIP·LaunchServices 및 Unix5개 실제 검사는 후속 CI로 확정한다. main에는 최종 검증 후 반영한다. 아래는 기존0.1.0과 과정별 보존 이력이다.

## 2026-10-19 최종 Windows 로컬 패키지 PASS

최종 ZIP은 `dist/JavaScript-edu-0.1.0-win-x64.zip`(315,315,450바이트), SHA256 `9e9be81a981502ac6a3bcbfd2e56b5d1f8ed8a12c3cb085386e555b0e38d493e`다. 빌드 소스는 `23154a3c3cc2f718469a3e03e158bc5db041c6b2`, sourceDirty:false이며 후속 문서 커밋과 구분한다. 원본 vendor73+1994와 최종해제2410파일을 독립 대조했다.

전체294회귀·55실습471조건·실제200%·동의/취소/복원·저장실패양분기·정상/강제종료정리·실제EXE한글/공백/&경로이동을 확인했고 독립 최종 PASS, 미해결 P1/P2 없음. [최종 검증](desktop-packaging-verification.md)과 [소스/산출물/원시지문 요약](desktop-packaging-evidence.json)을 재개 근거로 사용한다. 원격 commit/push/CI는 실제 현재브랜치의 ref·Actions를 대조한다. 패키지는 미서명·미게시이며 main 병합/공개바이너리게시/대응소스조건완료를 주장하지 않는다. 사용자4179탭·초안은 보존했다. 실제OSdialog입력·IME·스크린리더·물리모바일·모든Electron하위PID소멸은 미검증이다. 아래는 과정별 보존 이력이다.

## 2026-10-19 Windows 소스 검증 완료 / 최종 ZIP 생성 전

Windows portable 구현·소스 동결·전체 검사·독립 코드 게이트 PASS다. 구조52·구문306·회귀294/294/skip0와 제작자33/271·예제33 PASS, 호스트22 skip PARTIAL을 구분했다. 입력486파일 지문집계b3cb3e353dbcea697524e8dd46940219ea6c17dc608a0b33dfac5e440fce629a를 독립 대조했다. 실제 EXE 원본·한글/공백/&이동본의 각N01 8/8·같은origin·WM_CLOSE·exit0·TEMP0 PASS. 중간09 전체FAIL은 보존하며 최종clean HEAD ZIP·전체native 게이트는 남아 있다. 소스커밋 후 최종 산출물을 만들고 검증한다. [최종 패키지 검증](desktop-packaging-verification.md), [구현 계약](desktop-packaging-implementation.md)을 따른다. 공개 바이너리 게시·서명·main 병합은 수행하지 않는다.

## 2026-10-19 최종 화면 검수와 Windows 패키징 착수

사용자가 남은 화면 검수를 완료하고 문제없으면 최종 패키징하도록 승인했다. 이전의 패키징 보류는 이번 단계에서 해제한다. `junbo-desktop-runtime-packaging`을 적용해 Windows x64 포터블 ZIP과 실제 포함 런타임 검증을 진행한다. main 병합·외부 배포·공개 릴리스 게시 권한은 추가하지 않는다.

기존 UI의 Chrome 추가 화면 검수는 [최종 화면 검수](final-screen-verification.md) 범위 PASS다. 사용자 4179 탭과 데이터를 보존했고 별도4188 검사 서버는 종료했다. 실제 200% 확대는 최종 Electron 앱의 page zoom으로 추가 확인한다. 앱 구현·vendor 무결성·최종ZIP·기동·독립 검토가 끝나기 전 패키징 완료로 표시하지 않는다. 아래는 이전 마일스톤의 보존 이력이다.

## 2026-10-19 M5 완료 — 원격 검사6개 통과

최종 검증 코드 기준은 `646c0e1595dbe562889815eeecaffee1f0ef25f0`이며 feat/runtime-and-curriculum에 푸시했다. [일반 CI39191939724](https://github.com/jbsim999/JS-edu/actions/runs/39191939724)의 Windows/Ubuntu×Node22/24 네 job과 [고정 Node CI39191939830](https://github.com/jbsim999/JS-edu/actions/runs/39191939830)의 Windows/Ubuntu×Node24.22.0 두 job이 모두 success다. 이후 문서 변경은 이 검증 결과의 인계 기록이다.

확정52강·55실습·용어82개, 실제 브라우저361+Node110=471행동 조건을 제공한다. 최신 로컬 전체 회귀281/281과 마지막 별칭TEMP의 서버5/5, 제품·테스트 경계 독립 검토 PASS다. 첫 원격 실패와 재현·수정·중간안 폐기 기록은 아래와 [CI 보완 검증](runtime-ci-verification.md)에 보존했다.

기존 http://127.0.0.1:4179/ 에서 최신 소스와 Node24.22.0 실행을 확인했다. 사용자 탭·저장 초안은 초기화하지 않았다. Astra는 일반 작업을 총괄이 직접 처리하고 복잡한 구현/독립 검토를 묶는 기준으로 운영한다. 패키징·main 병합·외부 배포는 미수행이며 패키징은 최종 한 번으로 남긴다. 실제 기기·실제200% 확대·OS IME·스크린리더는 미검증이다. 아래는 당시 상태를 보존한 이력이다.

## 2026-10-19 M5 원격 CI 보완 최종 로컬 검증

제품 보완 커밋 `16b4a45aaa312c16d746395b3653cd34827625d0`까지 푸시했다. [고정Node CI39191401477](https://github.com/jbsim999/JS-edu/actions/runs/39191401477)는 Windows/Ubuntu 모두 success다. 일반Ubuntu22/24도 success이며 Windows22/24는 테스트 후처리의 tmpdir 별칭/실제경로 비교만 실패했다. 같은 별칭TEMP에서 FAIL 재현 후 parent/target realpath 비교와 기존 삭제 경계 검사를 유지하도록 테스트만 보완했고 학습서버5/5·skip0 PASS를 확인했다. 제품 소스 변경은 없다. 최종 일반 CI는 후속 테스트 보완 커밋의 Actions를 확인한다.

M5를 `5c991e6a19b479d286193c79b012723ccce8c9e2`로 커밋·푸시했고 공개 저장소/원격 SHA 일치를 확인했다. 첫 원격 [일반 검사](https://github.com/jbsim999/JS-edu/actions/runs/39189509471)와 [고정 Node 검사](https://github.com/jbsim999/JS-edu/actions/runs/39189509624)에서 Worker private 완료 이전 자연 종료와 Windows 임시 폴더 별칭 경로 권한 불일치를 발견했다. Ubuntu 고정 Node110은 통과했으며 실패를 숨기거나 완료로 처리하지 않는다.

두 문제를 로컬에서 각각 FAIL로 재현했다. 실행 폴더는 canonical parent에서 생성하고 권한/컨텍스트/삭제 경계를 일치시켰다. Worker는 complete가 이미 확인된 전송 구간에서만 숨은 ref 타이머로 유지하고 supervisor가 종료한다. 처음부터 타이머를 두는 중간안은 N06 오답/N08 node:test idle을 변경해 전수검사에서 거부했으며 폐기했다. 현재 beforeExit·완료 후 수명·별칭·출력 제한·활성 핸들 위조5회귀 PASS다. 최종 index 분리본 전체 검사 구문296·회귀281/281·skip0와 실제Node11과제110조건·예제11·각11negative 거부·정리 PASS를 확인했다(02:39:24.514–02:40:32.367Z). 변경 소스3개 지문집계3548312fb82354089a17625ed0517cbeab9b51ec968c4dec70d25d8f7fab897d. 상세와 독립 판정은 [CI 보완 검증](runtime-ci-verification.md)을 따른다. 후속 커밋/원격검사를 확인하며 패키징은 계속 보류한다. 아래 M5 로컬 검증은 첫 커밋 당시 기록이다.

## 2026-10-19 M5 최종 로컬 검증 완료

공통32·브라우저8·Node8·통합4의 확정52강,55실습,용어82개를 연결했다. C02–C04는 기존 ID/개정을 유지하면서 브라우저·Node 교재/퀴즈/코드/제출을 분리한다. 승인한 피스타치오 효과와 다크 모드를 유지한다. 실행·채점·취소·호스트 전환·기록 복원·Node 실행 동의와 버전 불일치 안내를 실제 화면에서 확인했다.

커밋할 Git index를 분리한 최종본의 필수 검사 PASS: 구조52강·구문296·회귀278/278·skip0. 실제 Chrome155/Windows44과제361행동 조건·negative88·DOM예제11·실행기16조건, 실제 고정Node24.22.0/Windows x64의11과제110조건·예제11·starter/대표 오답 각11개 거부·정리 확인 PASS다. 합계55실습471조건이다. 일반 제작자 검사의 호스트 skip22개는 PARTIAL이며 실제 두 호스트 검사로 별도 확인했다. Node 교재/예제/검사 입력87개와 과제별 실행 기록을 대조했다.

M5 변경 소스119개의 index/분리본 SHA256 집계는 `804db39718e1e0f0abf0699512b4781154b076520f4444dcaec925873cdcbb89`다. 독립 검토에서 정리 실패의 거짓 통과·준비/취소 경고 유실·종료 정리 중단을 수정하고 실제 EACCES 주입 및 정상 재시도 회귀를 통과했다. 최종 독립 코드·증거 대조 PASS이며 미해결 P1/P2는 없다. 상세는 [M5 검증](curriculum-m5-verification.md)과 [검증 스냅샷](curriculum-m5-verification-evidence.json)을 따른다. 마일스톤은 feat/runtime-and-curriculum에 반영하며 실제 커밋은 Git 로그, 원격 검사는 GitHub Actions에서 확인한다.

320/360/390/768/1440·짧은1280×420/640×360·파일탭과목차 키보드를 실제 브라우저 에뮬레이션으로 확인했고 총괄이 합성 화면을 검토했다. 실제 기기·실제200% 확대·OS IME·스크린리더는 미검증이다. Astra는 일반 작업을 총괄이 직접 맡고 복잡한 구현·독립 검토를 묶는 기준을 적용했다. 전역 모델 설정이나 실측50% 감소를 주장하지 않는다. 패키징은 최종 한 번으로 보류하며 main 병합·외부 배포·설치본 제작은 미수행이다. 아래는 당시 상태를 보존한 이력이다.

## 2026-10-19 M4 원격 반영 / M5 화면 통합 중

M4는 `10fa0d7a6dae4535a2265714a7b688e5f4a43743`으로 feat/runtime-and-curriculum에 커밋·푸시했고 원격 SHA 일치를 확인했다. [원격 CI39184672700](https://github.com/jbsim999/JS-edu/actions/runs/39184672700)도 success다. M4 독립 코드·소스110개 지문 검토 PASS이며 최종 검증은 구문229·회귀206·실제 브라우저44강361개다. 제작자 검증의 예제 누락 거짓 PASS도 실제 HTTP500 주입으로 재현·수정했다.

M5 카탈로그52강·실습55개와 C02–C04 호스트 매핑을 연결했고 구조 검사 PASS다. 고정 Node24.22.0으로 N8+CNode3 정답110/110·예제11개·각11개 starter/오답 거부·정리를 다시 확인해 과제별 실행 기록11개와 executionVerified:true를 연결했다. Node 전용 제공자/검증 계약 회귀는 기본Node22.17.0과 고정24.22.0 각각59/59 PASS다. C02 기준답안의 실제 스트림 open 직후 취소·원래 이유 보존·닫힘·재실행을 같은 제공자에서 추가 확인했다. 일반 학습 제출의 모든 스트림 구현 경로를 전수 보증한다는 뜻은 아니다.

Node API 세 결함 수정과 Node 통합3과제는 독립 정적 검토 PASS다. 프런트 담당자가 Node 실행 동의/파일 탭/호스트 선택/성과 분리와 실제 화면 QA를 구현 중이다. 제품 연결 최종 검토와 분리 소스 필수 검사·M5 커밋/푸시는 아직 남았다. README는 M5 목표 구성을 반영한 작업본이다. 설치 패키징·병합·외부 배포는 계속 보류한다.

## 2026-10-19 M4 최종 검증과 다음 의존성

브라우저 경로44강·용어82개를 커밋할 Git index만 분리해 Windows Node22.17.0 필수 검사 PASS(구문229·회귀206/206·skip0)와 실제 Chrome155/Windows44강 정답361/361·negative88·DOM예제11·실행기16조건 PASS를 확인했다(01:12:37.819–01:13:02.527Z). 신규12과제 지문·검사ID97개를 현재 소스와 대조했다. 일반 제작자33과제 정답271·예제33은 PASS이며 DOM11 skip은 PARTIAL로 별도 표시한다.

같은 탭 강의 이동 뒤 프레임 준비 정지는 초점 프레임 제거 순서 문제로 최소 재현·수정했다. Chrome B03/B08 연속 제출·중지 후 복구와 IAB 추가검사,320–1440·짧은높이1280×420·목차52개 키보드순회를 확인했다. 총괄은 실제 합성 화면도 검토했다. 실제기기·200% 브라우저 확대·OS IME·스크린리더는 미검증이다. M4 독립 최종 코드 검토 뒤 같은 작업 브랜치에 커밋·푸시한다.

M5 Node8강+선택 통합3과제는 별도 소스에서 실제24.22.0 정답110/110·예제11·각11starter/대표오답 거부·정리 확인 PASS다. Node 독립 검토에서 발견한 일반 실행의 grader 의존·같은 요청의 준비 후 제출 충돌·graderRevision 불결속을 수정하고 관련 회귀59/59를 통과했다. 제품 UI/52강 카탈로그 연결·최종 검토는 후속으로 남았다. 현재 M4 index에 이 Node 작업은 섞지 않았다. 패키징은 최종으로 미룬다.

## 2026-10-19 작업 재개

사용자가 작업 재개와 Astra 호출 빈도를 이전의 약 절반 수준으로 줄이도록 요청했다. 일반 구현·자료 대조·검사는 총괄이 맡고 복잡한 프런트 통합과 최종 독립 검토를 묶어 위임한다. 독립 리뷰와 실제 검증 게이트는 유지한다. 전역 모델 설정 변경은 수행하지 않았다.

현재 원격 작업 브랜치는 feat/runtime-and-curriculum, HEAD는 c2b1a832fc47ae4e4f832a00faa0774663efbf2a다. 공통32강 M3와 Node24 CI 호환성 수정까지 푸시했고 원격 CI 성공 기록이 있다. 아래 과거의 M3 푸시 예정 문장은 당시 이력이다.

미커밋 M4는 공통·브라우저·통합44강과 용어82개다. 실제 브라우저 qualification 361검사·88negative·DOM예제11개는 통과했지만, 외부 Chrome의 같은 탭 강의 이동 후 프레임 준비 실패와 짧은 높이 목차의 마지막 재검증이 남았다. 이를 해결하기 전 M4 완료로 보고하지 않는다. Node8강은 작성과 고정24.22.0 제공자 검사82개·예제8개를 통과한 시점의 증거가 있으며 제품 UI/카탈로그 연결·최종 독립 검토는 남아 있다. Node 선택 통합3과제도 이어서 구현한다.

기존 미커밋 자료와 실패 증거를 보존한다. 마일스톤 검증 뒤 커밋·푸시하며 패키징은 최종으로 미룬다는 승인을 유지한다.


## 2026-10-15 M3 공통 01–32 실제 검증

공통 32강과 native ES 모듈 편집/실행을 연결했다. 실제 Chrome155/Windows에서 정답264개 행동 검사·64개 negative 제출·14개 실행기 조건을 모두 통과했다(10:01:53.409–10:02:09.060Z). 현재 정답 소스 지문32/32를 실제 결과와 대조하고 과제별 docs/execution 기록에 연결했다. Node22 제작자 검사도 정답264/264·오답/TODO 각각32개 거부·예제32개 로그 대조 PASS다. 자세한 범위·독립 리뷰·UI 검사·미검증은 [M3 검증](curriculum-m3-verification.md)을 따른다.

M2 원격 커밋 3dbdc4b2fd1cca4e50e08b961bb9b4ca6761ed23의 [CI](https://github.com/jbsim999/JS-edu/actions/runs/38712254834)는 성공했다. M3 커밋은 분리 검사와 독립 검수 마무리 후 푸시한다. 브라우저/Node 전용 교재는 후속 작업 중이며 패키징은 미수행이다.


M2 독립 화면 QA PASS: 별도 Chrome 검수 세션에서 11강×5단계55개를 전수 열어 자료·예제·퀴즈·실습 버튼을 확인했다. 08·11 실제 제출과 초안/메모 분리·수정 무효화·복원,12 준비중·트랙 URL/재로드,320px 긴 본문/예제/편집기에서 넘침·잘림 없음 확인. 총괄도 실제320 this본문/1280숫자예제 합성 화면을 직접 검토했다. 사용자4179탭은 수정하지 않았고 시험코드/메모 원복과viewport reset을 확인했다. 진짜200%·실제기기·OS IME·스크린리더는 미검증이다.

## 2026-10-15 M2 공통01–11 연결

공통01–11의 상세5단계·고정퀴즈·실습을확정순서로연결했다. 실제교재/실습연결11강과계획52강을구분하며12이후는준비중이다. 기존07 ID/contentRevision을보존하고선수06을연결했다. 10개신규과제의코드·메모·성취는각ID/개정별로분리한다.

Windows Node22.17.0의커밋대상분리검사PASS:구문70·테스트80/80·skip0·정답82/82·11개오답/11개TODO거부·11예제예상출력대조PASS. 실제IAB Chrome155 qualification 08:57:49.933–08:57:54.100Z에서11강정답82/82·각negative거부와runtime6조건PASS. 브라우저DOM결과의11개정답본문SHA256과검사ID를현재소스와대조했다. executionVerified:true는해당실제검증증거 docs/execution/에연결한다.

독립내용/검사코드리뷰PASS. 05기본값객체별칭은거부하고독립된동결결과는허용하며,08예외와문자열반환을구분하도록검사를보강했다. 신규10예제45줄의고정expected와원본교재/주석일치를독립확인했다. 보고서외109개Gitindex파일snapshot aggregate aa63e3104b9f242ef2e8312cb1808ddb49084487e9783174ab937f20029e2b99. 실제검사본work/m2-review와예정커밋소스를분리했고M3·M4작성중파일은제외했다.

M1원격커밋9b44b54ede21580d29715677fe5028275a4a54ed의 [CI](https://github.com/jbsim999/JS-edu/actions/runs/38709012887)는Windows/Ubuntu×Node22/24전부success. M2의원격결과는후속확인한다. 패키징/병합/외부배포는하지않았다.

M1 최종 검증: 커밋할 Git index만 work/m1-review로 분리해 Windows Node22.17.0 npm run check PASS(구문30·테스트80/80·skip0·제작자 정답7/7/오답·TODO거부/예제일치). 독립 코드·기능·12장 실제 합성 시각 검수 PASS. docs/runtime-verification-evidence.json의 Git index39파일 SHA256과 작업파일(LF정규화)·분리검사본 39/39를 독립 대조했다. aggregate a1b2d5d5cadf915462eb45b95d5a4aeee3a698b5e0a7c29e8ddf09f33e96a725. 후속 미연결 파일은 이 검증 대상에서 제외했다.

## 2026-10-15 M1 실제 실행·채점 검증

클로저 draft-1의 실제 브라우저 Worker 실행·7개 행동 검사·환경 확인·중지·시간/출력 제한을 연결했다. 52강 계획과 현재 제공 강의를 구분하는 목차, 고정 정답 퀴즈·개정/코드/환경/검사개정에 결속된 코딩 통과·메모 자가 확인을 제공한다. profile browser-worker available:true, 검증한 independent-counter만 executionVerified:true다. 문서 예상 출력을 실제 출력으로 사용하지 않는다.

실제 Chrome155/Windows 브라우저 qualification 최종 08:46:25.573Z PASS:정답7/7,starter/대표오답 거부,timeout·cancel·출력상한·종료후복구·Worker CSP의fetch/importScripts/dynamicimport/childWorker차단. 독립 코드 검토에서 Promise then 변조에 의한 거짓 통과와 grader개정누락을 발견·재현·수정했다. 후속 필수API 사전검사도 정적 재검토 PASS다. 코드·기능·합성 화면 검수 결과와 정확한 소스 범위는 verification.md를 따른다.

승인 기준선은 1bdb04dcf6d7fd89c5af2452577aaca6843674ef로 feat/runtime-and-curriculum에 push했고 원격SHA일치를 확인했다. M1은 독립 검수 뒤 같은 브랜치에 후속 커밋한다. main 병합/외부배포/패키징은 아직 하지 않았다. 현재 미연결 교재 파일은 후속 마일스톤 작업이며 M1 완료 범위에 포함하지 않는다. 다음은 공통01–11 연결과 전수 실행 검증이다.

## 2026-10-15 실행·전체 교재 구현 착수

새 승인: 실제 코드 실행·자동 채점을 연결하고 확정 로드맵 순서로 나머지 강의를 구현한다. 마일스톤마다 커밋·푸시하며 패키징은 마지막 한 번으로 미룬다. docs/implementation-milestones.md의 순서/수용 조건을 따른다. 아래 첫 제품 UI는 승인 기준선이며 실행/전체 교재의 완료가 아니다. 원격 main 기준 d9047786540dced4c3d1baf0a02ec033395596a1을 확인했고 feat/runtime-and-curriculum 작업 브랜치에서 진행한다. 브랜치별 원격 반영 결과는 각 마일스톤 완료 후 기록한다.

## 2026-10-15 제품 화면 개발

사용자 승인: 피스타치오 프리미엄의 효과·다크 모드에 만족하고 해당 스타일로 실제 개발 진행. 이번 구현은 web/ 학습 화면과 대표 클로저 초안 연결, 검색형 사전·상세 팝업, 함수 본문 편집·메모 저장, 테마/효과 환경설정이다. 기존 prototypes/와 스타일 후보는 보존한다. 커밋·푸시·호스팅·설치 패키지 권한은 이번 작업에 포함되지 않는다.

실행 방법: `npm run dev` → http://127.0.0.1:4179/ . 외부 npm 의존성 없이 로컬에서만 제공한다. 공개 파일 allowlist·GET/HEAD·Host 검사·CSP를 적용하고 저장소 전체·정답·검사기는 제공하지 않는다.

경계: 실제 카탈로그 수업은 bindings-and-closures / draft-1 한 개이며 나머지 여섯 개념은 미리보기다. 함수 본문 편집과 교재 개정별 브라우저 초안·메모 저장을 연결한다. 실제 코드 실행·자동 채점·완성 IDE·학습 성취·전체 교재·동기화는 미구현이다. available:false와 executionVerified:false를 유지하며 문서에 적힌 예상 출력을 실행 결과로 표시하지 않는다.

검증: 첫 제품 화면 구현 PASS. Windows 네이티브 Node22.17.0 npm run check 전체 PASS(구조 수업1/초안1·구문17·테스트15/15), 독립 아키텍처·코드·기능·실제 합성 시각 검수 PASS. 320/360/390/768/1280/1440 및 짧은 높이·가로 상태를 확인했다. 모바일 용어 상세창 이중 스크롤 P2를 수정하고 동일320×740에서 외부 scrollTop0·닫기 툴바 유지·내부 끝까지 스크롤·복귀를 재검사했다. 실제 기기·진짜200%/글자2배·OS IME·스크린리더·클립보드·브라우저 저장 실패 주입·blur 미지원 엔진·누른 상태 지속 효과는 미확인이다. 640×360은 공간 대체 검사다.

최종 소스: docs/product-ui-verification-evidence.json의 22개 파일/개별 SHA256과 aggregate 43027b4a0d5e410dc667d7f915b5e4f5bf6a5f0151d573e35376acfc0b34779e, 실제 소스와 22개 모두 일치. 보고서/인계 문서는 snapshot에서 제외했다. HEAD d9047786540dced4c3d1baf0a02ec033395596a1 위 로컬 미커밋 작업이며 이전 사용자 변경을 보존했다. 아래의 과거 해시와 검사는 이번 소스 전체를 증명하지 않는다.

인계: 사용자 확인용 새 개발 서버는 4179에 유지한다(종료 Ctrl+C). 검증 입력은 starter/빈메모로 복원했고 기본 dark/효과ON을 확인했다. 외부 게시 없음. 다음 의존성은 실제 실행 환경 선택·격리/취소·trusted grader 설계와 대표 정답/오답 검증, 이후 전체 교재 확장이다. 기본 실행 화면과 전체 교육 제품 완성을 구분한다.

## 이전 상태 이력 (2026-10-14)

단계: JavaScript-edu 상세 기획 및 작동하는 화면 시안 검토. 초기 승인: 로컬 구조/저장소 연결/초기 반영. 후속 승인: 공개 전환·상세 로드맵·이용자 요청 7장 보강·용어집/UI·UX 기획·정식 표시명 및 스타일 시안 보완. 사용자가 이번 범위를 '기획 + 작동하는 화면 시안'으로 선택했다. 제품 교재/실행기 구현은 아직 미연결이다.

완료: 교육 데이터 및 대표 클로저 초안, 웹 기능 경계, 저장/실행 불가 어댑터, 구조/구문 검사, 회귀 테스트, 협업 규칙·PR 양식·CI 정의, 추후 패키징 지침. GitHub 비공개 jbsim999/JS-edu 생성과 origin 연결 완료. 기준 브랜치 main.

실제 로컬 검사: Windows/Node.js 22.17.0, npm run check PASS(구조·구문 8개·테스트 9개). 독립 코드 리뷰에서 파일/목차 연결 검증 공백을 수정했고 수정 후 재검토 PASS. 실행은 총괄, 독립 리뷰는 별도 코드 리뷰 에이전트가 담당했다.

소스 snapshot SHA256: 84c94ff3bd827957f012a7c6c39bb3324273da504ed8fa71c2725734d6fd99e2. 범위·개별 hash와 실제 검사 근거는 docs/verification-evidence.json 및 docs/verification.md 참조. 이 인계 문서와 검증 보고서는 snapshot에서 제외한다. 커밋된 소스 파일 36개를 개별 SHA256과 대조해 모두 일치했다.

검증 소스 커밋: 2803adf62ccea040c58746d670754430d2bee6af. 원격 origin/main에 같은 SHA 반영 및 upstream 연결 확인. [GitHub CI](https://github.com/jbsim999/JS-edu/actions/runs/38500101310): Windows/Ubuntu × Node.js 22/24 네 조합 모두 success. 이것은 구조·구문·어댑터·검증기 테스트 결과이며 제품 런타임 전체 지원 승인이 아니다.

현재 HEAD는 d9047786540dced4c3d1baf0a02ec033395596a1이다. 초기 검증 이후 이 HEAD는 인계 문서만 갱신했다. 2026-10-14 후속 작업에서 GitHub 공개 변경 권한 ADMIN을 확인하고 공개 전환 후 visibility:PUBLIC, isPrivate:false, 기본 브랜치 main을 다시 조회했다. 저장소는 [jbsim999/JS-edu](https://github.com/jbsim999/JS-edu)다. 브랜치 보호·강제 필수 검사 설정은 적용하지 않았다.

후속 로컬 문서 변경: docs/roadmap.md의 공통32·브라우저8·Node8·통합4 상세 기획, docs/plan.md 연계, 이 상태와 docs/verification.md 기록. 커밋/푸시는 하지 않았다. 기존 코드·카탈로그·과제·실행 프로필은 그대로이며 실행 불가다. 현재 문서 변경은 초기 snapshot에 포함되지 않으므로 위 SHA256을 현재 문서 전체의 검증 증거로 사용하지 않는다. sourceSnapshot은 초기 검증 이력으로 보존한다.

공식 조사: 교육/호스트 연구자 2명이 정식 ES2026 PDF·ECMA-402·TC39·WHATWG·Node 공식 문서를 읽고 독립 조사했다. 상세 로드맵의 내용 검토 결과와 실제 검사 범위는 docs/verification.md에 기록한다. 한 트랙44강/양쪽52강은 계획 범위이며 구현된 수업 수가 아니다.

이전 상세 기획 검증: 수량·ID·공백 및 독립 재검토 PASS. 이전 roadmap SHA256 84738c0c2651347e97d402c65ee940a84ccbf00de7653f634e6fcccef37ae0ee는 아래 7장 증보 전 기준이며 현재 로드맵의 hash가 아니다.

현재 완료: 요청71항목(기존 명시28/부분36/미명시7) 전수 매핑·로드맵 핵심 절/실습 보강. docs/requested-topics-audit.md와 docs/ui-ux-plan.md 신규. prototypes/learning-workspace/의 6개 파일로 7개 개념 탐색·5단계 시안·28개 용어 검색/상세·URL/키보드/반응형을 구현했다. 제품 curriculum/web 어댑터/education.config.json은 그대로이며 available:false/executionVerified:false 유지.

현재 검증: Windows Node22.17.0 npm run check PASS(단원1/초안1·구문11·테스트9). 독립 코드 검토와 QA/시각 재검토 PASS. Chrome154 실제 합성15장, 320/360/390·태블릿·데스크톱·짧은높이·키보드·URL·합성 IME·글자2배/유효뷰포트 대체 검사. 발견한 Escape검색어삭제/Tab이탈과 줄바꿈/발표/폭변경focus 문제를 수정 후 재검사했다. 최종 app SHA256 1555b289a944108aad9d11ff0881dc35d447a0ea3418a56600e78e559d7dc997. 근거와 파일별hash는 docs/ui-preview-evidence.json 및 docs/verification.md, artifacts/ui-preview/qa/에 있다.

로컬 검토 주소: http://127.0.0.1:4178/ (serve.mjs). 사용자 검토용 미리보기 서버만 유지하고 임시 서버·검증 브라우저는 종료했다. 서버 종료는 해당 미리보기 세션에서 Ctrl+C. 커밋/푸시/외부 배포 없음. 실제 기기·OS IME·스크린리더·다른 브라우저·실제 브라우저200%는 미검증이며 대체 검사를 실측으로 표시하지 않는다.

미구현/미선정: 제품 UI 연결·IDE·실행기·grader·전체 용어/교재·설치형·배포·프로젝트 라이선스. 별도 화면 시안이 완성됐다는 것과 제품 기능을 구분한다. ES2026 기준은 실제 런타임과 별도이며 이번 검사 PASS는 학습 제출 통과가 아니다.

패키징 요청 시 junbo-desktop-runtime-packaging 스킬 적용. 해당 계약은 AGENTS.md와 docs/packaging.md에 기록됐다. 현재 패키징/배포 권한은 없다.

재개: 이 문서 → education.config.json → CONTRIBUTING.md → docs/plan.md/docs/roadmap.md/docs/ui-ux-plan.md. 사용자 시안 검토 반영 뒤 기술/실행 방식을 고정하고 대표 클로저 수업·용어집을 실제 교재/저장/실행/제출에 연결한다.

2026-10-14 정식 표시명을 JavaScript-edu로 변경했다. README·설정·package 설명·시안의 워드마크/문서 제목/접근성 이름·UI 기획·작업/협업 문서 제목에 반영했다. 내부 js-edu 식별자·저장 키·학습 ID/개정·로컬 폴더·실제 GitHub 주소는 보존했다. 표시명 변경 뒤 이전 ui-preview-evidence.json의 app/index/serve hash는 변경 전 이력이다. 현재 대상 9파일 hash와 실제 검사는 docs/branding-verification-evidence.json 참조.

스타일 검토: 기존 후보를 보존하고 대화 내 별도 pistachio-premium.html 시안을 만들었다. 사용자가 선택한 피스타치오 색/노란 핵심 버튼에 Fluent 2의 key/ambient 그림자 원리를 참고했고, 고형 버튼 밑면을 줄여 미세 반사선/반투명 면과 함께 적용했다. 05 클로저의 현재 위치 면에도 같은 재질과 독립 선택선을 넣었다. 실제 학습 시안의 CSS에는 이 후보 스타일을 아직 연결하지 않았다.

현재 검증: 네이티브 npm run check 전체 PASS(단원1/초안1·구문11·테스트9/9), 독립 정적 재검토 및 합성 화면 검수 PASS. 스타일 시안은 light/dark·효과 ON/OFF·320/390/768을 확인했고, 이름을 변경한 기존 4178 시안은 320/390 헤더·제목·넘침을 확인했다. 실제 기기·browser200%·host Tweak·누른 순간의 지속 그림자는 미확인이다. 커밋/푸시/배포 없음.


M3 커밋 대상만 분리한 `work/m3-review/`에서 Windows Node22.17.0 `npm run check` PASS: 구문170개·테스트167/167·skip0·정답264/264·예제32/32. 후속 DOM·Node 소스는 이 검사본에서 제외했다. `curriculum-m3-verification-evidence.json`의 Git index 소스181개와 분리 검사본 바이트가 모두 일치하며 aggregate SHA256은 `c43a4e45ff11d24762e80f033ebfa02c3d466e51c13de9dfd3eb0a3bf4fbc8cb`다.
