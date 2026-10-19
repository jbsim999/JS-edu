# Windows portable 구현과 검증 계약

기준일: 2026-10-19. 대상은 Windows x64의 미서명 로컬 portable ZIP이다. 공개 바이너리 릴리스, 설치 프로그램, 코드 서명, macOS/Linux/ARM64 빌드는 이번 범위가 아니다. 사용자 데이터는 앱 폴더 밖에 보존한다.

## 포함 공급자와 출처

| 구분 | 정확한 배포본 | 공식 ZIP SHA256 |
| --- | --- | --- |
| 데스크톱 셸 | Electron 44.9.0 Windows x64, Chromium 152.0.7977.167 | `88e08039d0ef359bab9f674e8051fa103bd8628ea7c5a5e1daaa610a8a0c6931` |
| 학습 실행기 | Node.js 24.22.0 Windows x64, npm/Corepack 및 원본 고지 포함 | `f9683a19877e12a9b167305c8db71040d812876359de21f0d2e97c3f321f80c3` |

Electron의 내장 Node도 24.22.0이지만 학습자 코드는 별도로 포함한 공식 Node 프로세스에서 실행한다. 개발 도구 Node 버전, ECMAScript 언어 기준, 브라우저 엔진, 학습 실행기 버전을 같은 개념으로 취급하지 않는다.

정확한 다운로드와 checksum URL은 [desktop/vendors.json](../desktop/vendors.json)에 고정했다. [Electron 공식 릴리스](https://releases.electronjs.org/release/v44.9.0), [배포 문서](https://www.electronjs.org/docs/latest/tutorial/application-distribution), [보안 권고](https://www.electronjs.org/docs/latest/tutorial/security), [Node 24.22.0 플랫폼 요구사항](https://github.com/nodejs/node/blob/v24.22.0/BUILDING.md)을 확인했다. Windows 10 이상의 공급자 지원 서비스 채널을 대상으로 하며 Windows 11을 권장한다. EOL 운영체제를 일반적으로 지원한다고 확대하지 않는다.

## 앱 경계와 수명 주기

`JavaScript-edu.exe`는 공급자 `electron.exe`의 추가 바이트 동일 복사본이다. 기존 `electron.exe`와 모든 공식 파일도 유지하므로 리소스 편집이나 재서명으로 원본을 바꾸지 않는다. 제품 이름은 Electron의 앱 이름, 창 제목과 메뉴에서 설정한다. 포함 배포본 크기를 줄이기 위해 실행기·라이브러리·언어 파일을 삭제하지 않는다.

네이티브 main은 포함 Node를 절대 경로로 실행한다. 명시적인 환경 객체에서 PATH, NODE_OPTIONS, NODE_PATH와 임의 자격 증명을 제외한다. Windows libuv는 PATH 등 필수 환경을 부모에서 보완할 수 있으므로 child PATH가 비어 있다고 주장하지 않는다. 실행 파일은 절대 경로로 선택하며 QA는 부모 PATH를 System32로 제한한다. 서비스는 실제 학습 서버를 `qualification: false`로 시작하고 UI와 DOM 과제의 두 loopback origin을 분리한다. renderer는 sandbox/contextIsolation을 사용하고 Node 통합, preload, webview와 renderer IPC를 제공하지 않는다. 같은 학습 origin의 루트 경로만 탐색하며 자료 링크는 허용한 HTTPS 호스트를 기본 브라우저로 연다.

첫 포트는 `%APPDATA%\JavaScript-edu\desktop-state.json`에 저장한다. 같은 프로필은 앱 이동·재실행 후 같은 origin을 사용하며 동시에 하나의 인스턴스만 연다. 포트 충돌이나 손상된 상태 파일은 저장 데이터를 보존한 채 시작 실패로 알린다. 브라우저 개발 화면의 저장 데이터를 이 프로필로 자동 이관하지 않는다. `JS_EDU_USER_DATA_DIR`의 명시적인 절대 경로로 QA 프로필을 분리한다.

종료는 renderer의 저장/beforeunload를 먼저 거친다. 저장 실패에서 돌아가기를 고르면 서버와 편집기를 유지한다. 종료를 고르면 저장되지 않은 변경이 사라진다는 안내를 표시한다. 창 종료, 메뉴 종료와 부모 IPC 끊김은 서비스의 `server.close()` 및 진행 중 작업 정리를 호출한다. 정상 종료 중 서비스 exit를 비정상 장애로 오인하지 않도록 종료 시작 상태를 분리한다. 정리 제한 시간 이후 소유 프로세스 트리 회수를 시도하고 실패를 표시한다. Windows Job Object 기반 자원 격리는 제공하지 않는다.

Windows 서비스만 `detached: true`로 시작하되 IPC와 프로세스 참조를 유지하고 `unref()`하지 않는다. [Node 24.22.0의 libuv Windows 구현](https://github.com/nodejs/node/blob/v24.22.0/deps/uv/src/win/process.c)은 일반 child를 부모 종료 때 즉시 종료하는 내부 Job Object에 넣는다. 그 상태에서는 앱 강제 종료 시 서비스가 IPC 정리를 끝내기 전에 종료되어 과제 임시 폴더가 남는 것을 실제로 확인했다. 서비스가 IPC disconnect를 받고 자신의 정리를 끝낼 기회를 주되, 학습 supervisor의 별도 제한과 종료 처리는 그대로 유지한다. 이것은 앱 전체에 대한 별도 Job Object 자원 제한을 구현했다는 뜻이 아니다.

메인 모듈은 `app.whenReady()`를 top-level await 하지 않는다. Electron ESM 평가 완료와 ready 이벤트의 상호 대기로 생기는 기동 정지를 피한다. 서비스 생성 후 시작 오류는 cleanup 완료 후 전파하고, 서비스 생성 전 잘못된 프로필 경로 같은 오류는 실제 앱 프로세스를 exit code 1로 끝낸다.

## 패키지 무결성

`npm run package:desktop`은 Windows x64와 PowerShell 7을 요구한다. 먼저 공식 ZIP의 고정 SHA256을 확인하고 새 폴더에 전체 해제한다. 링크/junction, 경로 탈출, NTFS ADS, Windows 예약 이름, 대소문자 충돌과 ZIP local/central 경로 불일치를 거부한다. 공식 Electron 73개 파일과 Node 1,994개 파일의 크기·SHA256을 기록한다.

제품 소스는 명시한 폴더와 desktop 파일만 채택한다. reference, author qualification, 테스트, 저장소 메타데이터와 개발 산출물은 제외한다. 제외 규칙을 동일하게 적용한 HEAD 파일 집합을 디스크 입력과 비교하므로 숨김 삭제도 누락되지 않는다. 포함 소스와 변환 입력의 실제 raw blob 바이트를 HEAD와 비교하므로 `assume-unchanged`/`skip-worktree`가 숨긴 변조도 clean 소스로 통과하지 않는다. 승인되지 않은 ignored `.env`, key, 추가 파일은 포함하지 않고 빌드를 거부한다. `--allow-dirty` 후보도 임의 추가 파일을 허용하지 않으며 명시한 새 desktop 파일만 예외로 허용한다.

최종 ZIP은 다시 실제 해제한다. 빌드 전에 기록한 전체 inventory와 해제본의 모든 파일을 대조하고 공급자 원본도 별도로 대조한다. 최소 앱 package.json, 상대 Node 경로 설정과 브랜드 EXE 추가는 변환 내역에 기록한다. 빌드 전후 채택 소스와 빌드 입력 hash 및 HEAD를 재확인한다. 최종 ZIP 옆 `.manifest.json`과 `.sha256`이 ZIP 해시, 소스 commit/dirty 상태, 전체 파일 inventory를 연결한다. ZIP 내부 manifest를 자기 자신의 해시 검증 근거로 사용하지 않는다.

## 실제 앱 검사

작성자 전용 `check:desktop:smoke`에는 실제 해제 경로, 외부 manifest, 새 QA 출력 폴더가 필요하다. 실행 전에 실제 ZIP SHA256, 전체 해제 파일, 내부 source manifest와 원본 소스를 비교한다. 검사 main, qualification 파일, 모든 reference의 개별 SHA256과 묶음 digest를 사전 기록하고 사후 다시 비교한다. 실행 중 소스 commit 변경도 거부한다.

패키지된 Electron은 `resources/app`을 우선하므로 외부 테스트 main 인수를 그대로 사용할 수 없다. 하네스는 최종 패키지의 원본 Electron 73개 파일을 바이트 대조하여 전용 테스트 호스트로 복사하고, 최종 해제본의 실제 application 모듈을 불러온다. qualification 답안은 작성자 메모리 입력으로만 전달한다. 제품 서버에 테스트 경로나 reference를 여는 방식은 쓰지 않는다. 뒤이어 최종 `JavaScript-edu.exe` 자체를 테스트 인수 없이 실행해 실제 production main도 별도로 검사한다.

검사 범위:

- 정확한 Electron 엔진에서 브라우저 44과제/361조건, starter·오답 88개 거부, DOM 예제 11개와 runtime 검사 16개.
- 포함 native Node의 11과제/110조건, starter·오답 거부. 이 단계는 Node 예제 11개 실행 검사와 구분한다.
- 실제 학습 UI의 동의, 환경 확인, 실패 제출, 실행 중지와 실제 DELETE 정리 응답, 정상 실행/제출 복구, 메모·테마·현재 코드 성취 저장/복원과 편집 후 성취 무효화.
- `webContents.setZoomFactor(2)`와 실제 `getZoomFactor`, DPR, innerWidth 측정. 두 animation frame 이후 capturePage로 dark/light/사전/Node 제출 화면을 캡처한다.
- 저장 실패를 실제 Storage write 예외로 주입해 실제 will-prevent-unload 이벤트를 검사한다. 네이티브 대화상자의 반환값만 0/1로 대체하며 OS 대화상자를 사람이 클릭한 검사로 기록하지 않는다. 돌아가기 후 서비스 유지·재저장·정상 종료, 종료 후 이전 저장본 보존을 각각 확인한다.
- 단일 인스턴스, 정상 종료 후 서비스 PID와 두 포트 정리, Electron 부모만 강제 종료한 뒤 소유 서비스 PID·두 포트·학습자 임시 폴더 정리. renderer/GPU 등 모든 하위 PID가 사라졌다고 확대하지 않는다.
- 실제 production EXE의 잘못된 상대 프로필 경로 종료, N01 행동 채점과 Windows CloseMainWindow 정상 종료. 전체 파일을 한글·공백·`&` 경로로 복사한 뒤 같은 프로필/origin으로 재실행하고 채점/종료를 반복한다.
- 모든 native phase 이후 원본 패키지, 이동한 패키지와 외부 manifest, 작성자 입력을 사전 기대값과 다시 대조한다.

실제 Windows GUI/소프트웨어 입력 검사이며 물리 모바일, OS 한글 IME, screen reader 또는 Windows Job Object 검사는 아니다. 실행되지 않은 플랫폼을 검증했다고 표시하지 않는다. 최종 판정은 동일 소스의 기본 검사와 독립 리뷰, 최종 ZIP의 native 보고서가 함께 통과해야 한다.

## 라이선스와 공개 배포 경계

Electron의 원본 LICENSE와 LICENSES.chromium.html, Node의 원본 LICENSE 및 모든 포함 고지를 보존한다. 실제 Electron 고지에는 FFmpeg LGPL 2.1+ 등 여러 조건이 있으므로 번들 전체를 MIT로 축약하지 않는다. [THIRD-PARTY-NOTICES.txt](../desktop/THIRD-PARTY-NOTICES.txt)에 정확한 공급자 버전과 source/build 맥락 링크, 고지 위치를 기록했다.

이번 로컬 패키지에는 공개 릴리스용 별도 대응 소스 archive를 첨부하지 않았다. 공개 바이너리 배포 전 실제 링크된 LGPL/MPL 등 구성요소의 대응 소스, 빌드/패치 지침과 배포 조건을 확인하고 충족해야 한다. 링크와 고지를 복사한 것만으로 그 조건을 완료했다고 주장하지 않는다. 프로젝트 자체의 코드/교재 재배포 라이선스도 현재 지정되지 않았으며 GitHub 공개 상태가 사용 허락을 대신하지 않는다.

## 재현과 근거

정확한 명령은 [desktop/README.md](../desktop/README.md)에 있다. `tests/desktop-packaging.test.mjs`는 Windows 경로/ZIP/junction, 전체 inventory 변조, 저장 origin, renderer 정책, 서비스 환경, ignored 파일 유출, 외부 manifest 결속, 격리 Git fixture의 숨김 변경·삭제를 검사한다. 실제 프로젝트의 index flag를 변경하지 않는다.

별도의 프로세스 fixture는 부모만 실제로 강제 종료한 뒤 서비스의 IPC cleanup 완료를 검사한다. 또 shutdown을 의도적으로 무시하는 서비스와 그 소유 child를 만들어 짧은 종료 제한 시간 후 실제 Windows `taskkill /T`가 두 PID를 회수하고 결과를 `ok: false`로 보고하는지 검사한다. 이 검사는 실제 교재/채점 실행 검사와 구분한다.

초기 후보에서 PowerShell 5의 깊은 npm 경로 실패를 재현해 PowerShell 7로 고쳤다. Electron ESM 기동 대기와 잘못된 프로필의 백그라운드 잔류도 실제 EXE로 발견해 수정했다. author 하네스의 boot-note 제거 조건, 취소 결과 표현 및 함수 반환의 IPC 복제 오류는 제품 오류와 구분하여 수정했다. 실패한 후보와 부분 통과를 최종 PASS로 쓰지 않는다. 최종 소스 commit과 ZIP 해시, native 통과 여부는 패키지 옆 manifest 및 `artifacts/`의 해당 실행 보고서를 기준으로 기록한다.
