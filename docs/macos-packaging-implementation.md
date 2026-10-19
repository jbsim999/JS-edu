# macOS 패키징 구현과 검증 계약

2026-10-19 사용자 요청에 따라 Windows의 후속 코드 테마 버전과 macOS Intel x64·Apple Silicon arm64 portable ZIP을 같은 소스에서 만든다. 기존 0.1.0 Windows ZIP은 덮어쓰지 않는다. 패키징 소스 구현과 실제 Mac 최종 실행 PASS는 구분한다. 이 문서 자체는 아직 실행하지 않은 CPU의 완료 증거가 아니다.

## 공식 원본과 플랫폼

- [Electron 44.9.0](https://releases.electronjs.org/release/v44.9.0): Chromium 152.0.7977.167, 내장 Node 24.22.0. [Electron 44 최소 조건](https://www.electronjs.org/blog/electron-44-0)은 macOS 13 Ventura 이상이며 실제 CI OS는 별도 기록한다.
- [별도 Node 24.22.0 공식 배포본](https://nodejs.org/dist/v24.22.0/): macOS CPU별 전체 tar.gz. [고정 버전 공식 지원 표와 바이너리 빌드 조건](https://github.com/nodejs/node/blob/v24.22.0/BUILDING.md#platform-list)은 두 CPU 모두 macOS 13.5 이상이며 공식 바이너리의 deployment target도 13.5다. 따라서 앱 전체의 최소 버전과 Info.plist에는 13.5를 적용한다. Electron 내장 Node와 학습 코드 실행 프로세스를 구분한다. 실제 CI는 macOS 15이며 최소 버전 13.5 자체의 실행 검증은 수행하지 않았다.
- [GitHub 공식 runner 표](https://docs.github.com/en/actions/reference/runners/github-hosted-runners): `macos-15-intel`은 Intel x64, `macos-15`는 arm64다. `process.arch`, `uname -m`, Rosetta 변환 여부, vendor `lipo -archs`를 각각 검사한다.
- 원본 URL/checksum은 `desktop/vendors-macos.json`에 고정한다. Native 최소 OS 13.5 기기·인터넷 다운로드 Gatekeeper·물리 Mac 키보드/IME는 CI만으로 검증했다고 표시하지 않는다.

## 번들 구조와 무결성

ZIP은 버전·CPU가 붙은 상위 폴더와 `JavaScript-edu.app`, `BUILD-INFO.json`, `integrity/`, 고지·안내를 포함한다. 앱 내부는 다음 구조다.

```text
JavaScript-edu.app/Contents/
  Info.plist
  MacOS/JavaScript-edu         # 제품 소유의 미서명 shell launcher
  Resources/app/              # 별도 교육 app, 교재, 실행기
  Resources/vendor/electron/  # 공식 ZIP 전체, 원래 Electron.app 그대로
  Resources/vendor/node/      # 공식 Node tar.gz 전체
```

원래 Electron.app 안의 Info.plist, Resources, framework, 원래 서명 자료를 수정하거나 재서명하지 않는다. 별도 wrapper가 원본 Electron 실행 파일에 교육 app 경로를 인자로 전달한다. 모든 vendor 파일·실행 비트·상대 symlink 원문을 기록하며 따라가며 열거하지 않는다. 링크는 같은 원본 배포본 안에서 끝나는지 실제 구조로 해석하고 탈출·끊김·순환·파일 아래 경로·대소문자/Unicode 정규화 충돌·hardlink·특수 파일을 거부한다.

빌드 입력은 clean HEAD 파일 집합과 blob 바이트를 직접 비교한다. 최종 ZIP은 Unix 링크를 보존해 생성하고 다시 실제 해제한 뒤 전체 파일·모드·링크를 빌드 전 목록 및 공식 원본 목록에 대조한다. 동일한 고정 SHA의 Electron ZIP을 macOS `ditto -x -k`로 별도 해제하고 자체 파서 해제본과 전수 대조한다. 제품 wrapper를 Developer ID/ad-hoc 서명하거나 공증했다고 표시하지 않는다.

Electron 44.9.0 원본은 두 CPU 모두 `_CodeSignature/CodeResources`가 없다. x64의 14개 Mach-O는 unsigned이고, arm64의 14개는 `0x20002` linker/ad-hoc flags·resource special slot 0인 코드 전용 서명이다. [Apple TN2206](https://developer.apple.com/library/archive/technotes/tn2206/_index.html)은 단일 실행 파일 서명과 bundle의 resource envelope를 구분한다. arm64 원본 `Electron.app`의 `codesign --verify --deep --strict`는 resource envelope 부재 오류로 실패한다. 이 결과를 `FAIL_UNSEALED_ORIGINAL_BUNDLE`, `bundleSignatureVerified:false`와 원시 명령 출력으로 보존하며 전체 번들 서명 PASS로 바꾸지 않는다.

검사 범위는 고정 44.9.0 원본의 정확한 형상에만 한정한다. 모든 ARM 코드 페이지의 내장 SHA256을 검사하고, bundle 밖의 별도 임시 폴더에 바이트 그대로 복사한 14개 파일 각각을 native `codesign --verify --strict --all-architectures`로 검증한다. 원본·복사본 SHA를 검사 전후 대조하며 복사본은 제품에 넣지 않는다. 예상한 flags·slot·CPU·14개 수량·정확한 원본 bundle 오류 이외에는 중단한다. 다른 서명 오류, timeout, signal을 unsigned 예외로 인정하지 않는다. 자체 파서 원본·ditto 원본·최종 ZIP 해제본·실행 검증 후 해제본에 같은 검사를 적용한다. Node 실행 파일은 별도로 strict 서명을 검사한다. 이는 원본 바이트와 실제 포함 코드 서명에 대한 검사이며 Gatekeeper 승인이나 봉인된 전체 Electron bundle 검증을 뜻하지 않는다.

## 실제 실행 게이트와 산출물

Windows와 두 Mac CPU 모두 해당 네이티브 호스트에서 같은 최종 ZIP을 검사한다. 55개 실습·471개 조건, 오답/TODO 거부, UI 동의·취소·초안/메모/성과 복원, 실제 200% 확대, 저장 실패 후 돌아가기/종료, 정상 종료와 부모 강제 종료 후 소유 Node 서비스/포트/학습 임시 폴더 정리를 검사한다. OS dialog의 선택값 stub과 실제 OS dialog 입력 검증은 구분한다.

Mac은 추가로 원본 실행 파일의 CPU·서명을 확인한다. 실제 wrapper를 직접 실행하고 한글/공백/`&` 경로로 전체 패키지를 옮겨 다시 제출한다. `.app`을 `open -W -n`으로 LaunchServices를 통해 실행하고 AppKit에서 소유 PID만 정상 종료 요청한다. 최종 원본/이동본 파일이 검사 전후 그대로인지 확인한다. JavaScript 편집기 mirror의 토큰·원문 동일성과 예제 토큰을 실제 패키지 안에서 검사한다.

`.github/workflows/desktop-package-check.yml`은 통합 대상 `main`과 작업 브랜치에서 Windows x64 및 Mac CPU 두 개를 실행한다. 성공한 작업의 ZIP은 지정 수신자의 공개키로 암호화한 뒤 `.sealed`와 envelope만 Actions artifact로 올린다. 평문 ZIP을 artifact에 넣지 않는다. 외부 manifest·sha256·최종 native JSON/PNG는 함께 보관하며 실패 작업은 원시 실패 증거만 남긴다. 로컬 비공개키로 복호화한 원본의 sourceCommit·GitHub SHA·ZIP SHA·native 결과를 대조한다. 암호화는 승인된 수신자에게 산출물을 전달하는 경계이며 라이선스 면책이나 공개 Release 조건 완료를 뜻하지 않는다.

Node 학습 코드는 OS 보안 샌드박스가 아니며 모든 renderer/GPU 자손 PID 회수, POSIX의 임의 자손 탈출 방지, Windows Job Object 격리를 보증하지 않는다. 포함한 FFmpeg 등 LGPL/MPL 고지와 공개 바이너리 재배포 대응 소스 조건은 별도이며 공개 릴리스 완료로 표현하지 않는다.

## 구현 시점의 로컬 근거와 남은 게이트

2026-10-19 Windows x64/Node 22.17.0의 최초 desktop/mac 회귀는 22개 중 19 PASS, Unix 파일시스템 2개와 POSIX signal 1개 skip, FAIL 0이다. 후속 supervisor 경계 변경 후 고정 Node 24.22.0에서 Node 실행기·desktop/mac 회귀 56개 중 51 PASS, Unix/POSIX 5개 skip, FAIL 0을 확인했다. beforeExit·private 완료·정상 취소·권한·Node 제출 회귀를 포함한다. POSIX 회귀는 SIGTERM을 실제로 무시하는 service 생존을 먼저 확인하고, graceful timeout 뒤 소유 PID SIGKILL·exit 확인·실패 상태 유지를 검사한다. Mac native 부모 강제 종료도 실제 SIGKILL signal을 확인한다.

POSIX supervisor는 `detached:true`로 생성된 자기 PID와 같은 그룹이 존재하는지 시작 전에 검사하고, 미확인 상태에서는 학습 Worker를 시작하지 않는다. 부모 IPC가 끊기면 검증한 자기 PGID만 SIGKILL한다. 회귀 fixture는 실제 supervisor 소스와 Worker가 만든 같은 PGID의 자식/열린 포트를 사용한다. 서비스의 강제 종료 뒤 supervisor·자식·포트가 사라지고, 다른 PGID의 통제용 형제 프로세스와 포트는 살아 있는지 확인한다. 부모 그룹에 직접 띄운 supervisor는 작업을 거부하고 자기 프로세스만 실패 종료해야 한다. 이 POSIX 사례는 Windows에서 미실행이며 네이티브 CI에서 확인한다. service가 강제 종료된 경우 workspace 삭제 완료까지 보증하지 않으며 정상 cleanup 성공으로 표시하지 않는다. 새 session/group으로 명시적으로 이탈한 자손의 회수는 보장하지 않는다.

네 공식 Mac 원본 아카이브를 직접 내려받아 고정 SHA256과 비교했다. 각 Electron ZIP은 584항목/260파일/14링크, 각 Node tar.gz는 5888항목/4797파일/3링크다. 실제 archive의 Mach-O CPU는 x64와 arm64 각각 일치했다. x64 Electron main에는 LC_CODE_SIGNATURE가 없고 arm64 main에는 있으며, 두 Node 실행 파일에도 signature load command가 있다. 이 정적 확인은 네이티브 `codesign` 검증 결과가 아니다. 원시 로컬 결과는 `artifacts/macos-vendor-preflight.json`에 남긴다.

최종 Mac ZIP 생성, Unix 모드/링크 실제 해제, 정상 .app/LaunchServices 기동과 전체 native 검증, 원본 signature 검사 및 CPU별 합성 화면 검수는 실제 해당 CI 결과로 확정한다. 로컬 Windows 파싱 성공을 Mac 패키징 PASS로 올리지 않는다.

## 043d8f6 실제 CI 실패와 후속 보완

[첫 네이티브 CI 39209629600](https://github.com/jbsim999/JS-edu/actions/runs/39209629600)의 Mac 두 CPU에서 Unix/POSIX 5회귀가 실제 통과했다. 서비스 SIGKILL 뒤 같은 그룹의 supervisor·자식·포트 회수 및 독립 형제 그룹 생존도 포함한다. Windows와 Mac x64는 패키지 빌드 후 author 하네스의 ready 순서 오류로 실패했고, Mac arm64는 위 원본 bundle 서명 실패에서 중단했다. 최종 native PASS로 취급하지 않는다.

하네스의 unawaited async IIFE 안에서 BUILD-INFO 읽기와 동적 import를 기다리는 동안 Electron ready가 먼저 발생했다. [Electron ESM 공식 지침](https://www.electronjs.org/docs/latest/tutorial/esm)에 맞춰 동기 BUILD-INFO 읽기와 모듈 최상위 await import를 사용하고, `startDesktop`의 동기 보안·프로필 초기화 직전에 ready=false를 실제 검사한다. `startDesktop` 전체는 ready를 기다리므로 최상위 await하지 않는다. 제품의 sandbox·프로필·single-instance 초기화와 실제 production entry 검사는 유지한다.

고정 Node 24.22.0/Windows에서 서명 형상·변조·예상 밖 codesign 오류 3회귀를 추가한 desktop/mac 합동 27개 중 22 PASS, Unix/POSIX 5 skip, FAIL 0이다. 샌드박스 내 최초 실행은 기존 링크·Git fixture·프로세스 종료 권한에서 실패했으며 네이티브 재검사 결과를 최종 로컬 근거로 사용한다. 실제 Electron 44.9.0 preflight의 ready 선행 주입은 enableSandbox 오류를 재현했고, 최상위 await bootstrap 대조는 ready=false와 의도한 절대경로 검증·exit0을 확인했다. 이는 전체 패키지 실행 검증을 대신하지 않는다. 고정 원본 28개 Mach-O 분류와 ARM 14개 내장 코드 페이지 SHA256은 로컬 정적 검사 PASS다. 후속 native ditto·파일별 codesign·최종 실행은 새 CI로 확인해야 한다.
