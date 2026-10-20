# 검증 기록

## 2026-10-20 0.1.3 최종ZIP·네이티브 앱·공개 파일 검증

정확한 소스9cfdc226be2c44815d8307d99299c09f01a07c96, [desktop CI39396286738](https://github.com/jbsim999/JS-edu/actions/runs/39396286738)의 Windows x64·macOS Intel x64·Apple Silicon arm64 세 작업 모두 success. 공급자 원본 전체 inventory·빌드복사·최종ZIP 해제/전수대조 후, 각 타깃의 실제 앱 실행으로 브라우저44실습361조건/오답88개·DOM예제11·런타임16검사와 Node11실습110조건/미완성·대표오답 거부를 확인했다. 실행 동의·현재코드 통과·취소/서비스 정리·정상 종료·재시작 초안/진도 복원·한글/공백 경로 이동·Mac LaunchServices 실행과 패키지 불변도 통과했다.

신규 SVG 검사는 각 CPU의 dark100/200%·light200% ×열림/닫힘6개씩 총18개 PASS다. 실제 최종ZIP의 앱 모듈과 바이트가 같은 vendor Electron을 사용하며 각 선의 박스 중심 오차는 모두0px다. 실제 Electron page zoom200%이며 웹 CSS 확대 대체와 구분한다. Windows와 두 Mac의 실제 PNG를 직접 열어 +/−의 중앙 배치·경계·대비를 확인했다. 이 helper의 직접 open 설정을 실제 키보드 조작 검사로 표시하지 않는다. Enter/Space 동작은 별도의 웹 검사에서 확인했다.

[일반 CI39396286683](https://github.com/jbsim999/JS-edu/actions/runs/39396286683)는 Windows Node22 테스트의 after-hook에서 임시폴더 rmdir EBUSY가1회 발생했다. 제품/테스트 소스를 변경하지 않고 실패 작업만 같은 소스로 재실행했으며 attempt2의 최종 결론 success다. 다른3 matrix 작업은 첫 실행에서 success였다. [고정Node CI39396286676](https://github.com/jbsim999/JS-edu/actions/runs/39396286676)도 Windows/Ubuntu 모두 success다. 로컬 소스 검사 결과는 아래 준비 절과 artifacts/source-toggle-013-full-check.log를 따른다.

CI첨부3개의 GitHub artifact digest를 수신 컨테이너와 대조하고 RSA/AES 인증 복호화 후 기대한 소스SHA·플랫폼/CPU·PASS·바이트수·ZIP SHA를 결속했다. 원본 manifest와 native smoke의 소스SHA/ZIP SHA·authorInputs.verifiedUnchanged·packageUnchanged 및18정렬 결과를 기계 대조했다. 수신 패키지를 이 Windows PC에서 새로 기동한 검사는 아니며 네이티브 실행 근거는 타깃CI다. 원시는 artifacts/package-013-*.json, received-013-*.json, work/package-013-received/{target}/artifacts/desktop-ci-smoke/에 보존한다.

[v0.1.3](https://github.com/jbsim999/JS-edu/releases/tag/v0.1.3)는 소스9cfdc22를 직접 가리키는 prerelease다. 세앱·source-context·소스출처·검증JSON·체크섬 총7첨부의 uploaded 상태·크기·서버SHA256을 로컬 파일과 대조했다. 변경 없는 Electron44.9.0/Node24.22.0 대응 소스는 기존v0.1.1 첨부를 제공한다. README는 새 직접 다운로드와 Windows 실제 앱 캡처를 안내한다. 인증 없는 세앱 다운로드 GET range는 재시도 후 HTTP206/1byte 모두 PASS다. 첫 연결 시간 초과와 초안 태그 조회의404는 파일/앱 실패가 아니며 초안 목록 조회·네트워크 재시도로 정상 확인했다. 공개 접근 결과와 파일별 값은 [기계판독 증거](desktop-0.1.3-evidence.json)를 따른다. 다운로드 범위 요청은 링크 접근 확인이며 다운로드 후 Gatekeeper 검사를 뜻하지 않는다.

판정: **소스·세CPU 최종ZIP/명시한 네이티브 검사·전송/공개 파일 PASS**. wrapper는 미서명이며 Developer ID·공증·다운로드 후 Gatekeeper·OS IME/스크린리더는 미검증이다. 이전0.1.2 검수 생략 기록은 이 버전의 검증 근거가 아니다.

## 2026-10-20 0.1.3 SVG 아이콘 중앙 정렬 / 네이티브 검사 준비

문자 +/−와 가상 요소를 제거하고26px 정사각형 안에14px SVG를 grid 중앙 배치했다. 대칭 좌표의 두 선 중 열린 상태에서는 세로선만 숨긴다. SVG는 aria-hidden이며 native details의 펼침/접힘 의미와 Enter/Space 동작을 유지한다. 다른 코드/채점/저장 계약은 변경하지 않았다.

실제 Chrome155에서 light/dark ×320/360/390/768/1440/1920/1280×420 ×닫힘/열림 총28상태의 각 선 중심을 실제 DOM 좌표로 측정했다. 박스 중심과 최대 오차0px, 문서 가로 넘침 없음. 키보드·forced-colors·CSS200% 대체와 PNG 직접 검토 PASS. 원시 근거는 artifacts/qa-source-toggle-013.mjs, source-toggle-013/report.json·PNG다. 기존 디자인 동작10그룹 회귀 PASS. 독립 검토자는 실제diff와 light/dark·320px·1920px·CSS200%·forced-colors PNG를 읽고 코드/웹 범위 PASS로 판정했다.

Windows 고정 Node24.22 `npm run check` exit0: 구문318, 테스트327 중322PASS/5skip/0fail, 기본33실습271조건·예제33PASS/호스트22skip. artifacts/source-toggle-013-full-check.log를 따른다. scripts/desktop-smoke-main.mjs에는 실제 최종ZIP의 앱 모듈/동일 vendor Electron에서 dark100/200%, light200%의 +/− 중심을 검사·캡처하는 항목을 추가했다. 이번 준비 시점에는 네이티브 검사 실행 전이며, 세CPU의 실제 결과는 후속 기록으로 구분한다. 웹 CSS200%를 실제 앱200% 검사로 대신하지 않는다.

## 2026-10-20 오답 강조·자료 카드·넓은 화면 목차 개선

세 디자인 피드백은 모두 반영하되 창 크기에 비례한 무제한 확대는 적용하지 않았다. 전체 폭은 최대1880px, 목차는224~300px, 본문 문단은100ch로 제한한다. 태블릿/모바일의 기존 목차 팝업·스크롤 구조는 유지한다. 학습 목표와 공식 자료는 native details 카드 내부의 두 영역으로 구분하고 좁은 화면에서는 세로 배치한다. 설계 메모 위의 연속 구분선은 제거했다. 오답·미응답은 구분되는 배경/테두리와 판정 문구를 제공하며 실패한 코드 검사에도 같은 시각 언어를 적용했다. 강의·문항/정답·실행/채점·저장 키는 바꾸지 않았다.

- Windows 고정 Node24.22.0 `npm run check` exit0: 구조 검사 PASS, 구문318 PASS, 테스트327 중322 PASS/5skip/0fail. 기본 교재33실습271조건·예제33 PASS, 호스트22skip. 이 skip을 호스트 실행 통과로 세지 않는다. 원시 기록: artifacts/design-feedback-full-check.log.
- Chrome155 독립 브라우저 컨텍스트10그룹 PASS: 오답/정답/미응답 표시, light/dark, 저장된 판정 재로드, 답 변경 시 전체 판정/정답 해설 해제, 다른 단계에서 재진입 시 미채점 선택 보존, 재제출 통과, native details Enter/Tab, 모바일 목차 Escape/초점 복귀, 키보드 목차 선택 가시성, 가로 넘침, 강제 색상에서도 판정 문구 보존.
- 실제 Worker 실습에서 `return null;` 제출로7조건 실패를 발생시켜 실패 박스/테두리와 기대값·실제값 펼치기를 확인했다. 사용자 컨텍스트/초안은 사용하지 않았다.
- 뷰포트320/360/390/768/1024/1280/1440/1920/2560, 1280×420 및844×390 가로 화면과720px에서 CSS200% 대체를 검사했다. 실제 합성 PNG에서 light/dark·모바일 오답·자료 카드·목차·넓은 화면·짧은 높이·확대의 경계/간격/대비를 직접 확인했다. artifacts/qa-design-feedback.mjs 및 design-feedback-qa/report.json·PNG가 원시 근거다.
- 전체 교재55경로(52강+Node변형3개)의 본문·229문항 표시와 정답 제출 통과 회귀 PASS: artifacts/content-revision-qa/report.json. 독립 리뷰어가 실제 diff·판정 해제/재진입 경로·검사 스크립트/보고서·실제 합성 PNG를 읽고 필수 수정사항 없음/PASS로 판정했다. 에이전트 리뷰이며 GitHub 사람 승인이 아니다.

현재 소스 해시는 [증거 요약](ui-feedback-evidence.json)에 기록했다. 실제 기기·OS IME·스크린리더·네이티브 앱과 실제 브라우저200% 확대는 미검증이다. CSS200%를 네이티브 확대 검사로 표시하지 않는다. 새 패키징/릴리스는 수행하지 않았으며 v0.1.2 배포 파일은 이번 웹 변경 전 소스다. 판정: **이번 웹 변경과 명시한 검사 범위 PASS**.

## 2026-10-19 0.1.2 build-only 생성·전송·공개 완료

정확한 생성 소스4478e391d76c94a44a84e58db148eba826956e44, [수동 실행39228451971](https://github.com/jbsim999/JS-edu/actions/runs/39228451971), Windows x64·Mac x64/arm64 세 생성 작업 success. 각 native 앱검수 단계와 Mac 플랫폼검사 단계는 명시 입력에 따라 skipped다. 빌더의 최종 ZIP 재해제 대조도 건너뛰었고 manifest는 BUILT_UNVERIFIED/SKIPPED_BY_REQUEST/extractedPath:null이다. 원본 배포본·소스·CPU 확인은 빌드 필수로 수행했다. 이번 패키지를 실행하거나 내용을 해제해 검사하지 않았다.

대용량 수신 지연으로 기존 세션을 중단하고4MiB분할 전송을 사용했다. GitHub artifact digest3개를 전송 컨테이너 바이트와 대조한 후 컨테이너만 해제했다. 앱ZIP은 암호화 인증과 명시 allow-unverified로 수령했고 기대한4478소스·CPU·BUILT_UNVERIFIED 상태를 결속했다. 수신3개 receipt의 status:PASS는 authenticated-artifact-transfer-only이며 패키지 검수 PASS가 아니다.

[v0.1.2](https://github.com/jbsim999/JS-edu/releases/tag/v0.1.2)는 prerelease로 공개했다. 태그는4478 커밋을 직접 가리킨다. 3앱·source-context·소스출처·생성상태·체크섬 총7개 uploaded이며 공개 서버 digest/크기를 수신 파일과 대조했다. 인증 없는3앱 실제GET range는 HTTP206/1byte로 링크 접근만 확인했다. README의 링크·현재웹화면·코드/용어기준·소스검사와 패키지검수생략 안내를 갱신했다. 기존0.1.1 파일/태그는 교체하지 않았다. [기계판독 요약](desktop-0.1.2-evidence.json)과 원시 artifacts/package-012-build-jobs.json, package-012-remote-artifacts.json, received-012-*.json, release-012-published.json, release-0.1.2-anonymous-downloads.json을 따른다.

판정: **생성·전달 완료 / 최종 패키지 검수는 요청으로 생략**. UI/소스 검사 결과는 아래 절이며 이 생략을 대체하지 않는다. 서명·공증·다운로드 후OS승인·실제기기·OS IME 등 새 검증을 수행했다고 표시하지 않는다.

## 2026-10-19 0.1.2 코드/명칭 기준 통일과 명시적 build-only

부분 키워드 자동 인식으로 Web Worker의 Worker만 강조되고 명세 타입 Undefined/Null만 누락되는 표시 불일치를 수정했다. 실행 코드와 자연어 전문 명칭을 구분한다. 명시 code 범위의 구문 색상은 그대로 유지하고, Node.js·Web Worker·ECMAScript 및 Undefined·Null·Boolean·String·Symbol·Number·BigInt·Object 등의 전체 명칭은 별도 technical-term으로 같은 배경/고정색을 적용한다. 타입 이름과 변환 함수·실제 값은 대소문자 변경으로 섞지 않고 문맥/명시 code 범위로 나눈다. [기준](code-theme.md)을 본문과 README에 명시했다.

대상52강/Node변형3개·학습문장1987필드·용어82개246설명을 점검해10파일34필드를 보완했다. 타입 목록의 의미를 풀고 타입/함수 참조·Promise 반응/작업 명칭을 정리했다. ID·개정·출처·정답·실행 계약·예상 출력과 용어 예시/별칭은 대조해 보존했다. 코드와 명칭은 표시용이며 학습자 저장/채점 값은 변경하지 않았다.

실제 소스 검사: 고정 Node24.22 npm run check 종료0, 구조·구문318개 PASS, 테스트327중322PASS/5skip/0fail, 기본교재33실습271조건·예제33PASS/호스트22skip. 코드 테마15/15(전체8타입/전체환경이름·명시코드우선·member/call비분절·원문·명칭색대비 포함). Chrome155 실제 웹55경로·229문항 PASS, 추가표시7묶음 PASS(light/dark의8타입 동일 배경/색, Node.js/Web Worker 전체이름, 함수전체유지,320/390/768,forced-colors,pageerror0). 총괄은 실제타입목록과환경명칭 합성 화면을 직접 검토했다. 실제 모바일/OS IME/스크린리더/이번소스의네이티브앱 검사는 하지 않았다.

사용자는 수정 후 패키징을 승인하면서 **패키징 검수 생략**을 명시했다. 이에 --skip-final-verification과 workflow_dispatch의 skip_final_verification=true를 추가했다. 기본 경로의 최종해제/네이티브검수는 유지한다. 이번 생성 결과는 BUILT_UNVERIFIED, finalArchiveVerification/nativeApplicationTest는 SKIPPED_BY_REQUEST, extractedPath는 null이다. 원본 배포본 checksum·필수 구조·CPU·복사 보존·clean source SHA·동시 변경 차단은 생성 필수로 유지한다. 전송에는 --allow-unverified를 양끝에 명시하며 상태를 AES-GCM 인증 정보에 포함한다. 거짓 PASS 승격·dirty소스·미승인 전송 거부 회귀를 포함한 전송4/4, JS구문/YAML파싱 PASS. 패키지 최종 ZIP 해제·내용 전수대조·실제 앱 실행·제출 smoke·native 200%는 요청대로 수행하지 않는다. 생성 성공을 검수 PASS로 표시하지 않는다.

원시 근거: artifacts/consistent-content-labels.json, artifacts/label-consistency-qa/report.json 및 PNG, artifacts/content-revision-qa/report.json, artifacts/labels-012-full-check.log. 최종 생성물/전송/게시 식별자는 생성 완료 후 별도로 연결한다. 기존0.1.1의 검수 PASS는 그 소스/버전 이력으로만 유지한다.

## 2026-10-19 전체 교재 실제 수정 / 코드 분절 회귀 보완

사용자가 전체 검수 결과를 실제 본문에 반영하도록 승인했다. 이전 절의 읽기 전용 검수에서 구현 단계로 진행했다. 대상은52강의 목표·다섯 단계 본문·퀴즈와 Node변형3개, 용어82개의 요약·정의·오해 설명이다. 자연스러운 문장은 유지했고 문장/절의 분할·설명 순서 보완이 필요해 humanize-korean의 일반 파일 편집 경로를 사용했다. 문장별 원문→수정→규칙·표시만 수정·기술 정정을 구분한 로그를 남겼다. 정규식 단어 일괄 치환으로 윤문하지 않았다.

### 실제 반영

- 52강 학습 필드1076개 수정. 공통02–32는 학습 문자열1186개를 읽고688필드를 수정했으며, 호스트/통합20강+Node변형은772문장·92문항을 읽고369필드를 수정했다. 총괄이01강과 후속 정정을 반영했다. 용어 설명246필드 중164수정/82유지다. 동일한 원문이 들어 있던25과제의 안내31필드를 검수본으로 동기화하고 개별 과제 정의와도 맞췄다. 첫 과제와 counter·cancel의 설명 정정은 별도 변경이다.
- `f(){'use strict'; return this;}`처럼 독립 선언으로는 잘못된 예를 정상적인 `function f() { 'use strict'; return this; }`로 고쳤다. f는 이름, f()는 일반 호출, obj.f()는 메서드 호출이라는 설명을 먼저 제공한다. 교재에서 실제 함수 선언을 추출해 실행한 결과 일반 호출은 undefined, 메서드 호출은 해당 객체임을 검사했다.
- 키워드를 각각 감싸던 방식에 완전한 코드 범위 표기를 추가했다. 중첩 호출·객체·함수 전체를 한 code로 렌더하며 템플릿 자체의 백틱은 더 긴 구분자로 감싼다. 인라인 영역에 빈 줄이 있어도 코드 내부를 문단으로 나누지 않는다. raw HTML은 해석하지 않으며 표시만 처리한다. .`click`()처럼 괄호가 바깥에 남은 사례도 수정하고 전체 문장 회귀로 검사한다.
- 언어/호스트 정의, descriptor·Promise/await 선행 설명, 모듈 실행 순서4개, Number 정밀도, cancel의 동기 재진입, Node 응답 상태와 수신 바이트 상한, 제공 중인 Node변형/패키지 안내, C03의 반복 함수/Worker 구분을 보완했다. Promise.then이라는 부정확한 정적 메서드 축약도 정리했다. C02의 json 오류는 response.json() 단계 전체의 실패라는 현재 구현 정책으로 명시했다. GC·문자열 length·Promise 콜백 반환값·브라우저 상대URL 용어 설명도 보완했다.

### 검증과 보존

기준 HEAD `3a0f88646b2eb8ab1cb4bfc45ab9c75d28b5edfd`와52강/55과제를 구조 비교했다. 교재 ID·contentRevision·선수·지원버전·평가 연결·문항ID·정답ID·선택지 집합과 모든 과제 실행 계약·예상 출력이 동일하다. 참조 구현·starter·검사기는 변경하지 않았다. 용어집의 예시·ID·검색어·연결·출처 등 보호 필드82개 해시도 동일하다. 이는 문체/표시/기존 동작의 설명 정정이며 제출 조건을 새로 만들지 않았다. 사용자 저장 키와 입력은 바꾸지 않았다.

고정 Node24.22.0의 `npm run check` 종료0: 구조·구문318 PASS, 테스트325개 중320PASS/5skip/0fail, 기본교재33실습271조건·예제33PASS/호스트22skip. 별도 코드 표시14/14 PASS. 최대 입력 두 렌더 경로의 로컬 실측은 일반20만자1.98ms, 표시영역25000개의12.5만자328.65ms, 서로다른백틱 run18.21만자4.90ms이며 성능 보장치가 아니다.

별도 Chrome155에서52강+Node변형3개의55경로를 열고 이론 본문·중첩 code 부재·문제/선택지 표시·229문항의 정답 선택과 통과 처리를 실제 확인했다. 첫 함수 전체가 단일 code이고 텍스트 선택 결과가 선언 원문과 일치했다. light/dark·320/360/390/768/1280×420·키보드Tab·720px와CSS200%의 대체 확대·실습 입력 유지·pageerror0을 확인했다. 총괄은 실제 light/dark/320 합성 화면과 함수 문단의 별도 캡처를 직접 검토했다. 전체페이지 캡처에 skip-link가 보인 사례는 실제 뷰포트 측정 top=-120/bottom=-70.4·focus:false로 화면 밖임을 따로 확인했다.

독립 코드 리뷰는 renderer·app 연결·첫 강의·회귀 테스트 범위다. 리뷰에서 코드 내부 빈 줄의 조기 문단 분할을 발견하고 공유 구간 파서로 수정했으며 재검토에서 미해결 P1/P2 없음. 다른 강의/용어는 담당 작성자의 보고와 총괄의 변경·보호 구조 대조 및 표본 내용 검토로 통합했다. 모든 설명이 완전히 정확하다는 보증은 아니다.

스킬의 일반 보호 요소 감사는 요청된 백틱 추가와 확인된 기술 보완도 변경으로 잡는다. 용어집 원시 감사는 변경률14.11%/새 무근거 통용성 주장0이지만 REJECT였으며 이를 자동PASS로 바꾸지 않았다. 표시 추가와 기술 정정은 사용자 승인 범위로 분류하고, 별도의 보호 데이터 해시·구조 비교·문장별 의미 검토로 확인했다. 호스트 작업자는 Python 감사기를 실행하지 못했으므로 그 범위의 자동 감사 통과를 주장하지 않는다.

로컬 원시 근거: artifacts/core-prose-edits.json, host-prose-edits.json, glossary-prose-edits.json, instruction-sync-edits.json, root-followup-prose-edits.json, content-revision-diff.json, content-revision-invariants.json, content-revision-full-check.log, content-revision-qa/report.json 및 이미지. [커밋용 검증 요약](content-revision-evidence.json)은 원시 로그와 구분한다.

판정: **요청한 본문·코드 표시 수정 및 위 범위 검사 PASS**. N05–N08 정답 위치 편중, featureSince 필드 의미, 일부 이동형 출처 링크는 이번 본문 수정과 구분한 후속 편집 사항이다. 실제 모바일기기·OS IME·스크린리더·네이티브 새 소스/실제브라우저200%·클립보드 붙여넣기는 검사하지 않았다. CSS200%는 대체 검사다. 기존 v0.1.1 패키지를 다시 생성하거나 교체하지 않았다.

## 2026-10-19 한국어·기술 내용 재검수 / 본문 코드 표시

사용자 요청: 교재 전체의 문맥·기술 내용 검토, `humanize-korean` 설치·재검수, 본문 속 코드의 시각적 구분. 교재 검토와 표시 기능 구현을 분리했다. 교재 JSON·과제 계약·정답·contentRevision은 변경하지 않았다. 아래의 수정안은 검토 결과이며 적용 완료가 아니다.

### 스킬 설치와 검토 범위

[커뮤니티 humanize-korean](https://github.com/nathankim0/humanize-korean)의 커밋 `b51aa5985be0a94a645788f1395b29a118bc9c33`을 공식 skill-installer의 Git 방식으로 사용자 스킬 폴더에 설치했다. 설치된 14개 파일을 원격 Git blob SHA-1과 전수 대조했다(LF 정규화). MIT LICENSE·THIRD_PARTY_NOTICES도 보존했다. 외부 스킬의 Python 코드는 실행하지 않았다. 현재 작업에서는 설치된 SKILL.md와 관련 룰북을 직접 읽어 적용했다. 다음 세션의 자동 발견과 현재 수동 적용을 구분한다.

두 독립 검토자가 공통 01–32강과 브라우저·Node·통합 33–52강 및 C02–C04 Node 변형을 나누어 재독했다. 총괄은 문제 제기 문단과 82개 용어를 검토했다. 목표·이론·예시·실습 설명·퀴즈의 자연스러움과 기술 계약을 확인했다. 문체의 반복만으로 AI 작성 여부를 판정하지 않았다. 실행 환경·입력 조건·부정·오류 경계·코드·식별자는 보존 대상으로 삼았다.

### 우선 수정할 내용

| 우선 | 위치 | 확인 내용과 권고 |
| --- | --- | --- |
| P2 | `language-host-boundaries.json`, 이론 | `Promise·Map·JSON은 ECMAScript`는 객체와 표준의 관계를 생략한다. ECMAScript를 먼저 정의하고 언어 내장 객체와 실행 환경 API를 설명한다. 브라우저 페이지(Window)와 브라우저 Web Worker를 구분한다. `일정`은 타이머라는 기능을 드러내지 못한다. |
| P2 | `esm-and-live-bindings.json`, 예시 | 설명에는 이벤트 3개지만 실제 예제·정답·검사는 `reader:initial-resolved`를 포함한 4개다. 독립 검토자가 예제를 실행해 확인했다. 설명을 현재 코드에 맞춘다. |
| P2 | `bindings-and-closures.json`, 실습 계약 | 모든 유한 Number가 호출마다 정확히 1씩 증가한다는 보장은 성립하지 않는다. MAX_VALUE·MAX_SAFE_INTEGER 경계에서 정밀도 문제가 있다. Number 연산 의미를 명시하거나 별도의 범위 정책을 먼저 정한다. 정상 소수 입력을 임의로 거부하지 않는다. |
| P2 | `cancellation-and-stale-results.json`, 취소 계약 | cancel의 동기 abort 리스너가 새 start를 호출하면 새 작업의 pending은 true다. 무조건 pending=false라고 읽히는 설명을 보완한다. 이 재진입은 실제 재현했으며 현재 참조 구현을 결함으로 판정하지 않았다. |
| P2 | C02·C04, 제공 범위 | Node 변형을 후속 단계/미제공으로 적었으나 현재 Node 변형·실행 프로필·설치 패키지가 제공된다. 오래된 설명을 갱신한다. C01의 browser 한정 제공 문구는 해당 강의의 범위와 맞으므로 같은 오류로 묶지 않는다. |
| P2 | 12·23강, 학습 순서 | 복사 심화에서 다음 13강의 descriptor 개념을, 23강에서 27–28강의 Promise·await 개념을 먼저 요구한다. 짧은 선행 설명 또는 심화 부분의 재배치가 필요하다. 단순 선수 ID 추가는 순환 관계를 만들 수 있다. |
| P2 | Node N05–N08, 퀴즈 | 16문항 연속 정답 위치가 첫 선택지다. 화면도 선택지를 섞지 않는다. 정답의 사실 오류는 아니지만 추측을 쉽게 하므로 선택지 배치를 다양화한다. |
| P3 | `node-outbound-requests-and-cancellation.json` | `헤더에 503`은 상태 코드와 헤더를 혼동한다. `응답 상태 코드가 503`으로 바로잡는다. maxBytes는 수신 본문 바이트 합의 상한이며 전체 요청 메모리 예산을 보장하지 않는다. |
| P3 | `scope-tdz-and-declarations.json` | var의 초기화와 대입식 실행을 한 구절에 섞었다. 일반적인 지역 var의 undefined 초기화와 이후 대입을 구분하되 모든 이름 충돌 상황에 확대하지 않는다. |
| P3 | 32강·B01·B04, 학습/제작 설명 | 고정 검사 게이트·실행 기록 관리·문항 제작 설명이 학습 본문에 섞인다. 실제 실행과 예상 결과의 구분은 보존하고 제작 절차는 검증 주석으로 이동한다. |
| P3 | `higher-order-functions.json` | 앞 인자를 고정하는 것은 이 과제의 부분 적용 정책이다. 일반적인 부분 적용 정의와 과제 정책을 구분한다. |
| P3 | C03·N05·Node 출처 | fixture·worker 루프 등은 첫 등장에 뜻을 설명한다. C03 worker 함수가 실제 Worker 스레드라는 오해를 막는다. 고정 Node 버전을 설명하는 링크는 이동하는 latest 문서와 구분한다. |
| P3 | 용어집 GC·Fetch | GC는 도달 가능성을 바탕으로 메모리를 회수하며 파일·소켓 등 모든 자원 정리를 보장하지 않는다. `fetch('/products')`는 브라우저 페이지 예제임을 표시한다. Node 24.22에서 상대 URL 단독 호출은 ERR_INVALID_URL을 원인으로 실패하는 것을 실제 확인했다. |

정책 확인을 남긴 항목: Promise 강의의 featureSince가 주제의 도입 연도인지 예제 전체의 최소 구문 버전인지, C02의 json 실패 분류가 파싱 실패만 뜻하는지 본문 읽기 단계를 뜻하는지다. 정의가 불명확한 상태에서 구현 버그로 확정하지 않았다.

### 문장만 다듬을 대표 사례

`humanize-korean` 기준을 보수적으로 적용했다. 아래 예시는 기술 사실을 새로 추가하는 교정과 구분한 문체 수정 제안이다.

| 원문 | 제안 | 규칙 |
| --- | --- | --- |
| FileHandle을 얻은 함수가 close 책임을 갖고, 실패도 finally에서 정리한다. | FileHandle을 얻은 함수가 close를 맡으며, 실패했을 때도 finally에서 자원을 정리한다. | S-17 |
| then에 붙인 반응은 지금 실행 중인 자바스크립트를 끼어들어 실행하지 않는다. | then에 등록한 반응은 현재 실행 중인 자바스크립트에 끼어들지 않는다. | S-14·문법/비문 |
| assertion은 기대한 조건이 틀리면 실패를 드러내는 주장이다. | assertion은 기대한 조건이 맞는지 확인하고, 틀리면 실패를 드러낸다. | S-17·M-2 |
| 동시에 여러 컨트롤러를 같은 root에 소유시키는 사용은 이 과제의 범위 밖이다. | 같은 root를 여러 컨트롤러가 동시에 관리하는 경우는 이 과제에서 다루지 않는다. | S-17·S-25 |
| 교육용 상품 조회 경계는 자동 재시도를 하지 않는다. | 이 과제의 상품 조회 함수는 자동으로 재시도하지 않는다. | S-27·M-2 |

문제 제기 문단의 수정 방향은 다음과 같다. 이는 ECMAScript·Window·Worker의 공식 정의를 확인한 **기술 설명 보완안**이며 순수 윤문만으로 추가한 사실이 아니다.

> 브라우저 페이지에서 document를 사용하던 코드를 Node.js나 브라우저의 Web Worker로 옮기면 document가 정의되지 않았다는 오류가 날 수 있다. document는 웹페이지를 다루도록 제공되는 객체이며, Node.js와 Web Worker는 이 객체를 제공하지 않기 때문이다.
>
> ECMAScript는 JavaScript의 문법과 기본 동작을 정한 표준이다. Promise·Map·JSON은 이 표준에 정의된 내장 객체다. 반면 document와 node:fs는 코드가 실행되는 환경에서 제공하는 기능이다. document는 브라우저 페이지에서 문서를 다룰 때, node:fs는 Node.js에서 파일을 다룰 때 사용한다.
>
> setTimeout도 ECMAScript 내장 함수가 아니라 실행 환경이 제공하는 타이머다. fetch는 Fetch 표준에 정의되어 있으며, 브라우저와 Node.js 등 여러 환경에서 제공하더라도 ECMAScript 내장 기능이 되는 것은 아니다.

주요 공식 근거: [ECMA-262 17판 §4.2](https://ecma-international.org/wp-content/uploads/ECMA-262_17th_edition_june_2026.pdf), [Window.document](https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-document-2), [WorkerGlobalScope](https://html.spec.whatwg.org/multipage/workers.html#the-workerglobalscope-common-interface), [Node 24.22 globals](https://github.com/nodejs/node/blob/v24.22.0/doc/api/globals.md), [Fetch Response](https://fetch.spec.whatwg.org/#response-class), [V8 메모리·리스너 정리](https://v8.dev/features/weak-references).

판정: **검토 완료 / 교재 수정 필요**. 전체 내용이 기술적으로 무결하다는 PASS가 아니다. 코드 검사 통과를 교재 설명의 정확성 근거로 대체하지 않았다. 교재 원문과 학습 기록은 보존했다.

공통 강의 문체 분류: 우선 보완 01·06·12·21·23·26·27·29·30·31·32, 국소 점검 04·07·08·13·15·18·22·24, 대체로 유지 02·03·05·09·10·11·14·16·17·19·20·25·28. 이 분류는 문체 재작성 범위이며 기술 결함의 유무·학습 제출 PASS와 다르다. 29–32강의 일부 이론과 07강 퀴즈에서는 다체·습니다체 혼용도 확인했다(ST-1).

### 본문 코드 표시 구현

Windows 고정 Node24.22.0의 `npm run check` 종료 코드 0: 구조 검증·구문318개 PASS, 테스트321개 중316 PASS/5skip/0fail, 기본 교재검사33실습271조건·예제33 PASS/호스트22skip. 이 기본 검사는 호스트 실행을 생략하도록 설정된 명령이므로 이번 검사에서55실습 전체를 실행했다고 표시하지 않는다. 전체 로그는 artifacts/inline-code-full-check.log에 보존한다.

`web/features/inline-code.mjs`에서 기존 교재의 알려진 키워드·API·호출·멤버식·typeof 표현을 표시용 code 요소로 감쌌다. 원문 문자를 이스케이프하고 기존 구문 강조기를 사용한다. `web/app.mjs`의 학습 본문·목표·문제·선택지·해설·실습 설명·사전 설명에 연결했다. 저장 값·문항 ID·채점 데이터·에디터 입력은 바꾸지 않는다. 밝은/어두운 페이지 모두 별도의 어두운 코드 배경과 4.5:1 이상 대비를 사용하며, 짧은 표현은 줄 경계에서 쪼개지지 않는다. 표기 없는 원문에 대한 보수적 패턴 인식이므로 임의의 모든 변수나 코드를 의미적으로 식별하지는 않는다.

실제 검사: 코드 테마 단위 10/10 PASS(전체 52강·82개 용어의 표시 문자 보존 포함), 별도 Chrome155 실제 합성 화면·동작 14그룹 PASS. 밝은/어두운 테마, 퀴즈 정답 선택·해설, 실습 입력 유지, 사전 팝업, 320/360/390/768/1280 및 짧은 높이, forced-colors, 키보드 Tab을 확인했다. 720px 뷰포트와 CSS 200% 확대 조합의 대체 검사도 합성 화면으로 확인했다. 이 대체 검사는 실제 브라우저 확대나 네이티브 앱 200% 검사와 다르며, 데스크톱 미디어 쿼리를 유지하는 단독 CSS zoom은 실제 확대 대체로 채택하지 않았다. 총괄이 실제 light/dark/360 합성 이미지를 보고 줄바꿈을 보완한 뒤 다시 검사했다. 독립 코드 검토에서 주요 결함 없음. artifacts/inline-code-qa/report.json과 이미지가 로컬 증거다. 이 검사는 브라우저 에뮬레이션이며 실제 모바일 기기·OS IME·스크린리더·네이티브 앱의 이번 소스에 대한 실제 200% 검사는 수행하지 않았다. 기존 v0.1.1 패키지와 이전 네이티브 검증 이력은 이번 UI 변경 전 소스다.

## 2026-10-19 0.1.1 최종3CPU·공개 다운로드 PASS

소스 ec4a38e의 [데스크톱39213893601](https://github.com/jbsim999/JS-edu/actions/runs/39213893601) 3job, [일반39213893641](https://github.com/jbsim999/JS-edu/actions/runs/39213893641) 4job, [고정Node39213893519](https://github.com/jbsim999/JS-edu/actions/runs/39213893519) 2job 모두 success다. 각 앱의55실습471조건·코드 원문/토큰·최종해제/vendor 전체 대조·정상/강제종료·저장/이동·실제200% PASS, Mac 두 CPU는 LaunchServices/Unix5회귀도 실제 PASS다. 총괄은 Mac 두 CPU의 실제 합성 화면을 확인했고 독립 검토가 최종3ZIP 및 manifest/native 식별자를 직접 대조했다. 전체 bundle 서명·공증·다운로드 후 Gatekeeper 승인으로 확대하지 않는다.

전송 artifact3개의 GitHub digest/크기를 실제 수신 파일과 대조하고 인증 복호화한 ZIP SHA를 원본 manifest/native report 및 Release 서버 digest에 연결했다. 앱3개+소스4개 전수7개 서버 digest 일치, 공개 asset10개와 태그/source ec4a38e를 확인한다. 인증 없는 앱3개 실제 GET range는 HTTP206/1byte PASS(`artifacts/release-0.1.1-anonymous-downloads.json`). [최종 기계 판독 근거](desktop-0.1.1-evidence.json)와 [대응 소스 확인 범위](desktop-source-provenance.md)를 따른다. 원시 CI·최종 native/PNG·receipt는 `artifacts/ci-ec4-*`, `work/final-transfer-ec4/`, `artifacts/desktop-0.1.1-received.json`에 보존한다.

## 2026-10-19 main 반영 전 원격 결과와 README

정확한 소스 c591eed의 일반 CI4개·고정Node2개와 desktop Windows/Mac arm64가 success다. Mac Intel의 실패는 고정 unsigned 진단의 `In architecture: x86_64` 추가 줄이며, CPU가 일치하는 해당 suffix만 `--all-architectures`에서 인정하는 보완 회귀1/1 PASS다. 서명 변조·다른CPU·추가오류·timeout거부는 유지한다. [원격 실행과 원시 기록](code-mac-ci-verification.md)을 따른다. 이 후속 두 파일은 이전504지문/전체검사와 구분하며 최종 통합 CI로 추가 검사한다.

README는 사용자 지정 java-edu의 구조를 참고해 재작성하고 자체 SVG 배너·검증용 Windows 앱의 실제 PNG를 추가한다. 다운로드 링크·공개배포·Mac Intel 통과를 꾸며 넣지 않는다. 사용자가 비치명 문제로 main 반영을 보류하지 말라고 승인했으며 강제 푸시·보호 우회는 허용하지 않는다.

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
