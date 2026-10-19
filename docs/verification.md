# 검증 기록

## 2026-10-19 0.1.1 CI 보완 / Windows 후보 native PASS

보완 후 Windows/Node24.22.0 `npm run check` exit0 PASS: 구조52·구문317·회귀316중311PASS/Unix5skip/FAIL0, 제작자33실습271조건·예제33PASS/호스트22skip(PARTIAL). 전후504입력 SHA256 `4a764b271ca9292825f3b9d1b410110e0f398afdaeeaebe625a4a7e2ca1f104b` 동일. 첫043 소스와 원격 FAIL은 [후속 검증 기록](code-mac-ci-verification.md)에 분리한다. 이전503입력 기록의 원시는 `code-mac-check-043.log`, `code-mac-check-source-043.json`이며 최신 로그와 혼용하지 않는다.

보완 Windows 후보 최종 해제본의 실제 native 검사 06:46:37–06:49:17 UTC PASS:55실습471조건·토큰/원문·실제200%·저장/복원·정상/강제종료·한글/공백/&이동·전후불변. 총괄 light 예시와 dark200% 합성 검수 PASS. `artifacts/code-mac-native-candidate-01/`을 따르며 sourceDirty:true인 후보를 clean 최종 패키지로 승인하지 않는다. 새 커밋의 세 플랫폼 native·최종ZIP·Mac 코드 서명과 독립 최종 검토는 남아 있다.

## 2026-10-19 코드 문법 테마 / macOS 구현 검증 중

새0.1.1 코드 테마 개별5회귀 PASS, 별도 Chrome155 실제 화면11묶음 PASS(`artifacts/code-theme-qa/report.json`). 총괄이 light/dark·360px·사전 합성 화면을 직접 확인했다. 기존0.1.0의 성공을 새 패키지 검증 근거로 대체하지 않는다. Mac 공식 원본 네 개 SHA/실제 CPU 대조와 Windows에서 플랫폼 회귀19PASS/Unix3skip을 구분한다. CPU별 native CI와 최종 ZIP·전체 소스 검사는 완료 후 별도 기록한다.

최종 동결 소스의 Windows 필수 전체 검사는 PASS(exit0): 구조52·구문316·회귀313중308PASS/Unix5skip/FAIL0, 제작자33과제271조건·예제33PASS와 호스트22skip(PARTIAL). `artifacts/code-mac-check.log`와 전후503입력 지문 `db0479e7d7888a414938f9c07e548b9c6121c39bdb936984f11439aa876d53b2`를 연결한다. 독립 정적 검토가 원본 동결20파일·POSIX 그룹 경계·암호화/AAD·macOS13.5·코드 원문 보존을 대조해 PASS·미해결 P1/P2 없음으로 판정했다. Unix5개의 실제 실행과 최종 CPU별 native/ZIP 승인은 이 로컬 검사에 포함하지 않는다. 최소OS13.5 보정 이전에 중단한 실행은 `code-mac-check-before-minos.log`로 구분하며 성공 근거로 사용하지 않는다.

## 2026-10-19 최종 Windows ZIP/native/독립 검토 PASS

소스 `23154a3c3cc2f718469a3e03e158bc5db041c6b2`의 clean 최종ZIP 315,315,450바이트·SHA256 `9e9be81a981502ac6a3bcbfd2e56b5d1f8ed8a12c3cb085386e555b0e38d493e`, 원본vendor73+1994와 최종해제2410파일 전체 일치. 최종native 05:17:59.011–05:20:31.884 UTC PASS:55실습471조건·negative110·DOM예제11·runtime16·실제200%·동의/취소/복원·저장실패두선택·정상/강제종료정리·실제EXE와한글이동본각8/8·WM_CLOSE/exit0·마지막TEMP0·모든phase후원본/이동본과author117입력불변. 독립 검토도 검사ID·HEAD486파일·ZIP/manifest/native지문을 대조해PASS,미해결P1/P2없음. 자세한 범위/미검증은 [최종 기록](desktop-packaging-verification.md)과 [근거 요약](desktop-packaging-evidence.json)을 따른다. 미서명 로컬 산출물이며 원격CI/공개게시는 별도다. 아래는 당시 상태의 보존 이력이다.

## 2026-10-19 Windows 소스·빌드 게이트 PASS

동결 소스의 전체 검사 PASS: 구조52강·구문306·회귀294/294·fail0·skip0, 제작자33과제271조건/예제33 PASS와 호스트22 skip PARTIAL을 구분했다. 검사 입력486파일 SHA256 집계 `b3cb3e353dbcea697524e8dd46940219ea6c17dc608a0b33dfac5e440fce629a`를 전후·독립 리뷰에서 일치 확인했다. 패키징13회귀와 세P2·startup·Windows 서비스 수명 수정 검토 PASS, 미해결 P1/P2 없음. 실제 EXE 원본/한글이동본의 N01·WM_CLOSE·exit0·TEMP0 probe도 확인했다. 중간09 전체 FAIL은 보존한다. clean HEAD 최종 ZIP/full native 게이트는 후속이며 [패키지 검증](desktop-packaging-verification.md)을 따른다. 아래는 과거 시점의 보존 기록이다.

## 2026-10-19 최종 원격 검사6/6 PASS

검증 코드 `646c0e1595dbe562889815eeecaffee1f0ef25f0`의 [일반 CI39191939724](https://github.com/jbsim999/JS-edu/actions/runs/39191939724) Windows/Ubuntu×Node22/24 네 job, [고정 Node CI39191939830](https://github.com/jbsim999/JS-edu/actions/runs/39191939830) Windows/Ubuntu×정확한24.22.0 두 job을 모두 success로 확인했다. 첫 실패를 재현·수정한 뒤의 결과이며 일반 CI의 조건부 host skip과 실제 고정 Node 전수 검사는 구분한다. 문서 후속 커밋은 이 결과를 기록하며 제품 코드를 바꾸지 않는다.

로컬 전체281회귀·별칭TEMP 서버5회귀 및 실제 브라우저44과제361조건·Node11과제110조건의 범위와 지문은 아래 및 [CI 보완 기록](runtime-ci-verification.md)을 따른다. 설치형/실제기기/실제200% 확대의 미검증 범위와 패키징 보류는 유지한다.

## 2026-10-19 M5 원격 CI 후속 보완

제품 보완16b4a45의 [고정Node Windows/Ubuntu CI](https://github.com/jbsim999/JS-edu/actions/runs/39191401477) success를 확인했다. 일반Ubuntu22/24도 success다. Windows 일반검사에서 남은 테스트 후처리의 별칭/실제경로 assertion을 동일 별칭TEMP의 FAIL로 재현하고 parent/target realpath 뒤 기존 삭제 경계 검사를 유지하도록 수정했다. 같은환경의 학습서버5/5·skip0 PASS. 제품 실행 소스 변경은 없으며 최종 일반검사는 후속 커밋의 Actions 결과를 따른다.

첫 M5 원격검사의 private 완료/Worker exit 경합과 Windows 임시 parent 별칭 권한 오류를 실제 로그 및 로컬 FAIL로 재현·수정했다. 완료 전 native idle을 유지하고 완료 응답 전송 구간에만 Worker 수명을 유지한다. canonical parent에서 권한/컨텍스트/삭제 경계를 파생하며 권한 범위는 넓히지 않는다.

최종 index 분리본의 구문296·회귀281/281·skip0, 경계5회귀와 실제Node11과제110조건·예제11·각11starter/오답 거부·정리 PASS(02:39:24.514–02:40:32.367Z). 원본87개와 실행기록11개 일치. 변경소스3개의 index/분리본/작업본 SHA집계3548312fb82354089a17625ed0517cbeab9b51ec968c4dec70d25d8f7fab897d. [상세·독립 판정](runtime-ci-verification.md), [스냅샷](runtime-ci-verification-evidence.json)을 따른다. 브라우저/UI 변경 없이 M5기준선의 실제361조건 증거와 한계 고지를 유지한다. 후속 원격검사는 정확한 커밋의 Actions에서 확인한다.

## 2026-10-19 M5 전체 로드맵·실제 Node·호스트 화면

최종 Git index 분리본에서52강 구조·구문296·회귀278/278·skip0 PASS. Windows 제작자Node22.17.0과 고정실행Node24.22.0을 구분해 실행했다. 일반 제작자33과제271검사·예제33·각33negative 거부는 PASS,DOM11+Node11의 skip22개는 PARTIAL로 유지한다. 실제 Chrome155/Windows44과제361/361·negative88·DOM예제11·실행기16조건(02:11:09.698–02:12:07.256Z), 실제Node24.22.0/Windows x64의11과제110/110·각11starter/대표 오답 거부·예제11·정리(02:12:33.218–02:13:47.014Z) PASS다. 최종55실습471행동 조건과 원본입력87개 지문을 대조했다.

정리 실패를 통과로 저장하던 경로와 준비/취소/종료의 경고 유실을 독립 검토에서 찾아 수정했다. 삭제 EACCES 오류 주입7회귀와 정상재시도, 기존 success+cleanupWarning/Pending 무효화, host필터 현재강의 유지까지 확인했다. M5변경소스119개 index/분리본 집계 `804db39718e1e0f0abf0699512b4781154b076520f4444dcaec925873cdcbb89`. 최종독립판정은 [M5 기록](curriculum-m5-verification.md)을 따른다.

실제 UI에서 동의·실행/제출 구분·호스트별 코드/퀴즈/성과·공유메모·이력/재로드·빠른전환·수정무효화·버전불일치 차단을 확인했다.320/360/390/768/1440·짧은1280×420/640×360·키보드/읽기전용/팝업초점과 실제 합성 화면을 확인했다. 실제기기·실제200%·OS IME·스크린리더는 미검증이다. 설치 패키징·병합·배포는 보류한다.

## 2026-10-19 M4 분리 소스와 실제 브라우저

M4 제품 소스와 교재를 Git index에 올려 별도 검사본으로 분리했다. Windows Node22.17.0 필수 검사 PASS(44강 구조·구문229·회귀206/206,skip0). 호스트 없는 제작자33과제 정답271·오답/TODO 각33거부·예제33개 일치,DOM11과제는 PARTIAL이다. 동일 분리본의 실제 Chrome155/Windows 검증 01:12:37.819–01:13:02.527Z에서44강 정답361·negative88·DOM예제11·실행기16조건 PASS. 신규12과제 소스 지문과 검사ID를 실행 기록에 대조했다.

독립 프런트 QA와 총괄의 실제 합성 화면 검토에서 승인한 피스타치오 효과·다크 모드 유지,320/360/390/768/1440·짧은1280×420·목차 키보드52항목·모바일팝업을 확인했다. Chrome 초점 프레임 제거 후 다음 탐색 정지를 최소 재현한 뒤 blur 선행으로 해결하고 실제 강의 이동/취소/복구를 재검사했다. 실제200%·실제기기·OS IME·스크린리더는 미검증이다. 자세한 범위와 한계는 [M4 기록](curriculum-m4-verification.md)을 따른다. 독립 코드 최종 검토 PASS. 마일스톤 커밋·푸시는 같은 작업 브랜치에 반영한다. 패키징은 보류했다.

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

## 2026-10-15 M1 실행·자동 채점

실제 Dedicated Worker/비공개 MessagePort/부모 기대값 비교를 연결했다. 실행 준비·대표 호출·코딩 제출·퀴즈·메모 자가 확인과 원문 저장은 각각 별도 상태다. 코드 수정·수업 전환·취소·늦은 해시/응답은 이전 통과를 현재 코드에 붙이지 못한다. requiredFeatures는 부모/Worker에서 확인하며 없는 기능은 오답 대신 환경 오류다. main CSP는self,Worker 전용 CSP만unsafe-eval/네트워크none을 적용한다. 기본서버의 정답 경로는404이고 --qualification 서버만 제작자 답안경로를 제공한다.

독립 코드 검토 PASS: 반환배열의 then 변조로 오답이 PASS되던 P1을 실제 재현하고 observe 즉시 스냅숏+undefined완료계약으로 수정했다. graderRevision검증 P2도 보완했다. validator는 표시 함수선언/runner일치와 generator문법을 확인한다. creator는 신뢰하는 저장소 작성물만 별도Node Worker로 검사하며 학습 제출의 서버 실행이 아니다.

실제 Chrome155/Windows IAB qualification 최종08:46:25.573Z PASS. 정답실행 stdout1 2 11 3,정답제출7/7,TODO와전역상태대표오답거부. 무한반복2.5초종료·명시취소·200줄출력제한·종료뒤복구·CSPheader/fetch/dynamicimport/importScripts/하위Worker차단 PASS. docs/execution/independent-counter.json은해당실제검사근거다.

독립 기능QA PASS:환경확인/실행성공이코딩통과를만들지않음,정답7/7·99반환오답1/7·수정즉시해제,timeout2513ms·취소후코드보존·이동중오염없음,퀴즈변경/메모수정무효화·저장/복원. 실제합성화면320/360/390/768/1280/1440 및640×360가로공간·용어팝업·키보드확인. 총괄도1440실제채점화면과320header합성을직접확인했다. 피스타치오/노랑·반사광·그림자·반투명효과유지. 실제기기·OS IME·스크린리더·진짜200%는미확인이다(Ctrl+plus전후IAB유효폭변화없음,640×360은대체공간검사). WorkerhardRAM/같은출처저장권한제거/OS보안격리는미제공.

## 2026-10-15 승인 스타일 제품 화면 통합

수행: 승인한 피스타치오 프리미엄 디자인을 web/에 적용했다. 다크/라이트·효과 설정, 7개 개념 탐색·5단계, 28개 용어 검색/상세, 실제 교재 초안·예제 연결, 읽기 전용 함수 선언+본문 편집, 개정/과제/파일별 코드·메모 저장, 초기화 확인과 실패 보호를 구현했다. 기존 prototype/스타일 후보와 교재·과제 ID/개정·실행 불가 계약은 보존했다. 서버는 로컬 공개 파일 allowlist, GET/HEAD, Host 검사, CSP를 적용했다.

변경 범위: web/index.html·app.mjs·styles.css·glossary-data.mjs·features/workspace-state.mjs·serve.mjs 신규, package.json의 dev/검사 명령·서버/저장 회귀 테스트·관련 안내 갱신. 교재/과제/프로필과 저장/실행 어댑터는 변경하지 않았다. sourceSnapshot은 docs/product-ui-verification-evidence.json의 22개 실제 파일을 대상으로 하며 보고서·인계 문서는 제외한다. 이전 sourceSnapshot과 시안 증거는 과거 이력이다.

실제 검사: Windows 네이티브 Node22.17.0 `npm run check` PASS(구조 수업1/초안1·구문17·테스트15/15, 실패0/skip0). sandbox 최초 서버 테스트는 loopback EACCES였고, 동일 테스트를 네이티브로 재실행한 뒤 전체 검사를 통과했다. 신규 테스트는 코드·메모·개정/namespace 분리, 저장 실패 후 재시도, 손상값 자동 보존과 명시 초기화, 읽기/삭제 실패·설정 보존, 실제 서버 공개/비공개 경로·nosniff 헤더·HEAD·405·Host·CSP를 확인한다. `git diff --check` PASS. 독립 아키텍처·코드 검토 PASS, 부팅 실패 guard와 CTA 조사 문구 수정도 재검토했다.

독립 기능 QA: 실제 IAB UI/DOM·합성 화면15장. 목차/단계/URL/뒤로/앞으로/재로드, 함수 본문만 편집·Tab 이탈, 즉시 이동 후 코드/메모 복원, 초기화 취소/Escape와 focus·열린 초기화창에서 뒤로가기·분리 초기화, 한영/빈결과 검색·모달 Tab순환/Escape/복귀·검색어 유지·브레이크포인트 focus, light/dark×효과ON/OFF 및 설정 복원 PASS. console warning/error 0개. 320×740(305/305),360×740(345/345),390×844(375/375),768×1024(753/753),1280×720(1265/1265),1440×900(1425/1425)에서 문서 client/scroll 폭 일치. 740×360·1280×480에서 초기화 버튼 접근,640×360 유효공간 대체에서 용어 상세 스크롤/닫기를 확인했다. QA 입력은 UI 초기화 후 starter/빈메모로 복원했다.

미검증: 실제 기기·진짜 브라우저200%/글자2배·OS IME·스크린리더·클립보드·브라우저 저장 실패 주입·blur 미지원 브라우저·누른 순간의 지속 효과. 640×360은 공간 대체 검사이며 실제200%/글자확대 검증으로 표시하지 않는다. 실제 코드 실행/제출·교육 정확성 전체·배포/설치형 검사는 아니다. available:false/executionVerified:false 유지. 실제 수업은 초안1개이고 나머지6개는 미리보기다.

시각 검수 중 320×740 light/효과ON에서 LexicalEnvironment 상세의 이중 세로 스크롤(P2)을 발견했다. 숨김 링크 설명의 위치 기준을 내부 스크롤 영역으로 제한하고 utility-dialog 외부 overflow만 차단했다. reset-dialog는 제외했다. 독립 정적 검토 PASS. 동일 조건 재검수에서 dialog client/scroll 740/740·top0, inner client675/scroll987·끝312, toolbarTop0·하단 빈 공간 없음, 검색 복귀·닫기 PASS를 확인했다. 수정 후 네이티브 전체 검사도 15/15 PASS다.

독립 시각 최종 검수 PASS: 실제 합성 pixels로 1440×900 dark/light×효과ON/OFF,320×740 light+목차/사전/긴용어상세,390×844 dark+본문편집/하단CTA,360×800 dark,768×1024 light+용어집,844×390 dark+스크롤/상세하단,최종1280×720 dark를 확인했다. 얇은 반사광/접지·주변 그림자·현재 목차의 더 약한 동일 재질·실제 반투명 사전과 가독성이 승인안의 방향을 유지한다. 수정 P2 재현 조건까지 재검수했고 console warning/error0. 총괄도 최종 소스를 새로 불러와 실제 light 및 dark 데스크톱 화면을 직접 확인했다.

최종 판정 PASS — 기록한 로컬 첫 제품 UI 범위. sourceSnapshot 22개 SHA256 전부 일치, aggregate 43027b4a0d5e410dc667d7f915b5e4f5bf6a5f0151d573e35376acfc0b34779e. 사용자 검토용4179 개발 서버만 의도적으로 유지한다. 임시 QA 탭 종료 재요청은 세션이 이미 사용 불가라 종료 여부 미확인으로 기록했으며 다른 사용자 탭은 건드리지 않았다. 커밋·푸시·호스팅 없음.

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

초기 검증 당시 소스의 경로·크기·SHA256은 [verification-evidence.json](verification-evidence.json)에 기록했다. 자기 참조를 피하려고 이 검증 기록·현재 상태·증거 JSON은 hash 범위에서 제외했다. Git 커밋/ref는 현재 상태 문서에서 확인한다. scaffold-manifest.json은 수정 전 생성기 출력만 기록하므로 현재 소스 검증 증거가 아니다.

미검증: 대표 예제 예상 출력, 교재 내용 승인, 실제 학습 실행/제출·grader, ES2026 기능별 호환성, UI/접근성/반응형, 실제 기기, 설치·서명·배포·릴리스. Windows 개발 골격 검사를 전체 교육 제품 PASS로 확대하지 않는다.

## 2026-10-14 상세 기획과 공개 전환

수행: 공식 언어/호스트 독립 조사 2개와 상세 로드맵 작성. 변경 파일은 docs/roadmap.md, docs/plan.md, docs/project-state.md, 이 기록이다. 코딩·카탈로그·프로필·어댑터에는 변경이 없다. 새 문서를 커밋/푸시하지 않았다.

공개 전환: GitHub CLI로 jbsim999/JS-edu의 PRIVATE·ADMIN 권한을 조회한 뒤 사용자의 명시적 요청에 따라 공개 전환했다. 후속 조회 결과 visibility:PUBLIC, isPrivate:false, 기본 브랜치 main이었다. 연결 앱은 접근 404, 기본 샌드박스 CLI는 연결 실패했으므로 허용된 네이티브 CLI로 수행·재확인했다. 인증 정보는 출력/문서에 기록하지 않았다.

기획 근거: ES2026 정식판 HTML은 도구 용량 제한이 있어 공식 PDF 조항을 확인했다. ECMA-402·TC39·WHATWG·Node 원문을 읽은 조사 결과와 교육 설계를 구분했다. 상세 출처·과제·평가·실행 경계는 docs/roadmap.md에 있다.

기존 검사 증거는 초기 코드 검증 이력으로 유지한다. 문서만 바뀐 이번 작업에서 npm run check를 성공 근거로 재사용하거나 재실행하지 않았다. 초기 snapshot을 새 문서의 현재 검증 증거로 사용하지 않는다.

문서 검사: 표에서 공통32·브라우저8·Node8·통합4=52와 ID 중복0·기존 수업 ID 보존을 확인했다. git diff --check PASS, 변경 파일은 위 4개 문서뿐이다. 독립 리뷰어가 수량·선수 참조/순환·정식판 API7개 조항·기존 계약·평가/실행 경계를 검토했다. Map.prototype 표기(P3)와 평가 주체·공통 Node 추적·초기 snapshot 표현을 보완한 뒤 재검토 PASS, 신규 결함 없음. 이 판정은 상세 기획의 정적 검토이며 수업 실행이나 UI 통과가 아니다.

재검토한 docs/roadmap.md SHA256: 84738c0c2651347e97d402c65ee940a84ccbf00de7653f634e6fcccef37ae0ee. 연구자는 읽기 전용 공식 조사, 총괄은 문서 작성·공개 전환·정적 검사, 리뷰어는 읽기 전용 독립 검토를 맡았다.

미검증: 새로운 수업/진단/평가의 실제 실행·호환성·학습 효과, UI·실기기, 최종 실행 제공자·정확한 브라우저 버전·자원 상한, 설치/배포. 판정: 저장소 공개 전환 PASS, 제품 기능 미구현.

## 2026-10-14 이용자 목차 보강과 용어집 화면 시안

승인 범위: 사용자가 기획과 작동하는 화면 시안을 선택했다. 제품 curriculum·과제·프로필·runner·진도는 연결/변경하지 않았다. docs/roadmap.md·plan.md·frontend-structure.md 증보, requested-topics-audit.md·ui-ux-plan.md 신규, prototypes/learning-workspace/ 6파일 신규, 현재 기록 갱신. 커밋/푸시/배포 없음.

전수 대조: 요청번호71개·중복0, 기존 명시28/부분36/미명시7. 최종 로드맵에 모두 핵심 절/실습으로 연결했고 32/8/8/4 계획 강의 수를 유지했다. 연구자는 공식 정식판·호스트 문서를 읽고 메모리 내 의미11검사 PASS를 보고했으나 그 검사와 제품 grader 검증을 구분한다.

| 실제 검사 | 최종 결과와 범위 |
| --- | --- |
| npm run check | PASS: 연결 단원1/초안1·mjs구문11·기존회귀9·실패/skip0. Node22.17.0 Windows native |
| 용어 데이터 | 28개·ID/별명/검색/개정/범위 검사 PASS, 초성/본문검색 미지원 명시 |
| 독립 코드 검토 | 71항목/명세·기존 계약·용어 정의·XSS출력·URL·단일dialog·loopback allowlist 검토와 최종 재검토 PASS |
| Chrome 기능 QA | Chrome154.0.8037.99 headless: 검색·상세·URL/history·invalidID·모달·키보드·query/scroll/focus·단계·비활성실행 PASS |
| 반응형 | 320/360/390/768/1024/1280/1440, 844×390, 1024×500에서 전체가로넘침·버튼가림 없음 |
| 확대 대체 | 글자2배(1440/390)·720×450 유효뷰포트, 총괄720×500/DPR2 캡처 PASS. 실제browserzoom 아님 |
| 수정 회귀 | 모바일 Escape검색어삭제와 상세Tab이탈 P2 수정, 관련10조건 및 마지막8조건 PASS |
| 작은 품질 보완 | 접히는사이드 focus·320/360 단어/도식·250ms안정발표/IME취소 수정 후 PASS |
| 실제 합성 시각 | 총괄15장 캡처·pageErrors0. 별도 visual 담당이 전체/태블릿/확대대체/긴용어/미연결/최신좁은4장 직접 검수 후 PASS |

처음 sandbox Chrome의 로컬접속 거부와 native Chrome→sandbox서버 timeout은 환경 경계였다. 소유한 sandbox 서버를 닫고 포함 serve.mjs와 검증 Chrome을 native 환경에서 실행해 해결했다. 제품 결함과 구분한다. 승인 자동 심사의 거절은 없었다.

QA의 root CSS zoom:2 대체는 dialog의 dvh까지2배 키워 화면밖 결과를 냈다. 실제 브라우저 확대와 다른 방식의 한계로 보존하며 전체 확대 PASS의 증거로 사용하지 않는다. 정상 뷰포트·글자 확대·유효뷰포트 대체를 별도로 기록했다. 실제 browser200%는 미검증이다.

QA 근거: artifacts/ui-preview/qa/report-core.json(수정 전 실패 보존), report-state.json, report-layout.json, report-regression.json, report-accessibility.json, report-final.json(최종8조건). 마지막 검사 전후5개시안 파일hash 동일. favicon.ico404만 관찰, JavaScript pageerror0. 총괄 캡처는 artifacts/ui-preview/*.png. 초기 실패 PNG를 최종 결함으로 표시하지 않는다.

최종 소스 hash와 범위는 [ui-preview-evidence.json](ui-preview-evidence.json)에 기록한다. 초기 verification-evidence.json과 scaffold-manifest.json은 현재 증보/시안의 검증 증거가 아니다. 최종 app hash1555b289a944108aad9d11ff0881dc35d447a0ea3418a56600e78e559d7dc997는 QA·코드 리뷰·총괄 조회가 일치한다.

역할: 연구자(읽기 전용 조사), UX(기획 문서), 프런트(시안6파일), 총괄(로드맵/대조/통합/필수검사/캡처), 독립 리뷰어(정적 검토), QA(실행 검사/증거), visual(합성 화면)이 단독 파일/브라우저 소유권을 지켰다. 검증용 브라우저·임시 서버는 종료했다. 사용자 검토용 localhost4178 시안 서버만 유지한다.

미검증: 실제 모바일·OS 한국어IME·스크린리더·다른 브라우저·실제browser200%, 사용자 시각 선호/학습 효과, 제품 저장·실행·채점·전체 용어DB·배포. 최종 판정: 기획 통합/작동 시안 PASS, 교육 제품·학습 제출은 미구현.

## 2026-10-14 정식 표시명 및 스타일 시안 보완

제품 표시명 JavaScript-edu를 설정/소개/워드마크/제목/접근성 이름/관련 문서에 반영했다. npm 내부 name, namespace, 학습 ID/contentRevision, 실행 불가 상태와 실제 원격 URL은 유지했다. 이전 시안 hash 기록은 변경 전 이력이며 이번 9파일의 현재 hash는 [branding-verification-evidence.json](branding-verification-evidence.json)에 별도로 기록했다.

최초 sandbox npm run check는 구조·구문11·테스트8이 통과하고 junction 생성만 EPERM이었다. 해당 테스트를 native에서 따로 재실행해 1/1 통과했고, 총괄이 이어 native npm run check 전체를 실행해 구조 PASS(단원1/초안1), 구문11 PASS, 테스트9/9 PASS(exit0)를 확인했다. git diff --check와 별도 스타일 시안 인라인 스크립트 구문 검사도 통과했다.

독립 코드 검수: 표시명 변경을 되돌린 app/serve SHA가 이전 검증본과 같아 로직 보존을 확인했다. 새 스타일에서 다크 기본 그림자 선택자가 hover/active보다 우선하는 P3를 발견해 명시 선택자로 수정했다. 재검토 PASS, 총괄은 브라우저에서 다크 CTA 일반/hover의 실제 computed boxShadow 차이를 확인했다. 누른 순간의 지속 상태는 캡처하지 않았다.

시각 참고 근거: [Fluent 2 Elevation](https://fluent2.microsoft.design/elevation)의 방향/key 및 ambient 그림자와 [Material](https://fluent2.microsoft.design/material)의 재질 구분을 확인했다. 개별 색·반사선·수치는 본 프로젝트의 설계 선택이며 공식 라이브러리 도입이나 고정 내비게이션 전체의 Acrylic 채택 권장으로 해석하지 않는다.

독립 시각 검수는 별도 소유 IAB에서 최신 pistachio-premium 시안의 데스크톱 light/dark × 효과 ON/OFF, 320×760 dark·390×844 light·768×1024 light, CTA 펼침과 용어집을 직접 보고 PASS 판정했다. 4px 고형 밑면 제거·목차 선택 면의 반사선/반투명/표시·긴 브랜드의 좁은 폭 배치를 확인했다. 재사용 검수 세션의 IAB 소멸/Chrome 연결 실패는 환경 제한으로 기록하고 이전 시안 PASS를 전용하지 않았다. 새 독립 세션에서 실제 화면을 다시 확인했다.

총괄은 기존 4178 시안의 320/390 정식 명칭·제목·헤더를 별도 탭에서 확인했다. 320px 문서 client/scrollWidth는305/305, 390px은375/375이며 브랜드 오른쪽170.83px과 액션 왼쪽225px은 겹치지 않았다. 브라우저 에뮬레이션이며 실제 기기가 아니다. 효과/테마 비교는 대화 내 별도 스타일 시안에서만 제공하고 기존 제품 CSS에는 적용하지 않았다.

미확인: host Tweak의 실제 슬라이더·호스트 상태 저장, pressed 지속 상태, browser200%·실제 기기·스크린리더·학습 효과. 사용자 시각 승인과 교육 제품 구현/실행기 검증은 별도다. 변경 범위 판정 PASS, 커밋/푸시/배포 없음. 검수용 탭/viewport/4189 서버는 종료하며 사용자 검토용 4178 서버는 유지한다.


M3 커밋 대상만 분리한 `work/m3-review/`에서 Windows Node22.17.0 `npm run check` PASS: 구문170개·테스트167/167·skip0·정답264/264·예제32/32. 후속 DOM·Node 소스는 이 검사본에서 제외했다. `curriculum-m3-verification-evidence.json`의 Git index 소스181개와 분리 검사본 바이트가 모두 일치하며 aggregate SHA256은 `c43a4e45ff11d24762e80f033ebfa02c3d466e51c13de9dfd3eb0a3bf4fbc8cb`다.
