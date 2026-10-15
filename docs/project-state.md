# 현재 상태

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
