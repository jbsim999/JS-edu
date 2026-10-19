# Windows·macOS portable 앱

Electron 44.9.0의 전체 배포본과 별도 Node.js 24.22.0 전체 배포본을 포함한다. Windows x64는 `JavaScript-edu.exe`, macOS Intel x64·Apple Silicon arm64는 `JavaScript-edu.app`으로 시작한다. 웹 교재와 실행 어댑터를 공유하며 설치된 Node.js나 npm, PATH에 의존하지 않는다. 바이너리는 Git에 넣지 않고 해당 CPU의 네이티브 빌드/CI에서 생성한다.

명시적으로 만드는 서비스 환경 객체에는 preload 옵션, 자격 증명, PATH를 넣지 않는다. Windows libuv가 PATH 등 필수 환경을 부모에서 보완할 수 있으므로 실제 child의 PATH가 비어 있다고 보장하지 않는다. 실행 파일은 고정 절대 경로로 선택하며 QA는 PATH를 System32로 제한한 상태에서도 수행한다.

`main.mjs`는 별도 Node 프로세스의 `service.mjs`를 시작한다. UI와 DOM 과제 서버는 서로 다른 loopback origin을 사용한다. 일반 교재 서버에 qualification, reference, 테스트 코드나 종료 API를 노출하지 않는다. Electron renderer는 sandbox/contextIsolation을 사용하고 Node, preload, renderer IPC를 제공하지 않는다. 자료 링크만 허용된 HTTPS 출처에서 기본 브라우저로 연다.

사용자 데이터는 기본 Windows `%APPDATA%\JavaScript-edu`, Mac `~/Library/Application Support/JavaScript-edu`에 유지한다. 첫 실행의 학습 포트를 저장해 앱 이동·업데이트 후에도 같은 origin을 유지한다. 포트 충돌이나 손상된 설정을 발견하면 원본 데이터를 보존하고 시작 오류를 표시한다. `JS_EDU_USER_DATA_DIR`에 절대 경로를 지정하면 별도 프로필을 사용한다. QA는 항상 이 방식 또는 동일한 내부 설정으로 전용 폴더를 사용한다.

종료 전 renderer의 저장과 beforeunload를 먼저 처리한다. 사용자가 돌아가기를 선택하면 서버를 유지한다. 정상 종료와 부모 IPC 끊김은 실행 중인 Node 과제와 두 서버를 정리한다. 시간 제한 후에는 소유한 서비스 프로세스 트리만 회수하고 미확인 정리 실패를 표시한다. Windows Job Object 또는 악의적인 코드에 대한 OS 보안 샌드박스를 제공한다는 뜻은 아니다.

Windows 빌드에는 Windows x64, Node.js 22 이상, Git, PowerShell 7(`pwsh.exe`)이 필요하다. Mac은 각각의 네이티브 CPU, macOS 13.5 이상, Node.js 22 이상과 Git 및 기본 `zip`, `codesign`, `lipo`, `plutil`이 필요하다. 포함된 Node 24.22.0의 최소 OS 13.5를 앱 전체에 적용하며, 실제 CI는 macOS 15이므로 13.5 자체의 실행을 검증한 것은 아니다. 최종 빌드는 검토·커밋된 clean HEAD에서 실행하며, Git 상태뿐 아니라 포함 파일 집합과 원본 blob 바이트를 직접 비교한다. `--allow-dirty`는 명시적으로 `sourceDirty: true`인 로컬 후보만 만든다.

```powershell
npm run package:desktop -- --output-dir dist
$version = (Get-Content -LiteralPath package.json -Raw | ConvertFrom-Json).version
$manifest = Resolve-Path "dist/JavaScript-edu-$version-win-x64.manifest.json"
$package = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
npm run check:desktop:smoke -- $package.extractedPath --manifest $manifest --output-dir artifacts/desktop-final-smoke
```

출력 디렉터리와 smoke 디렉터리는 새 경로여야 한다. 패키지 생성은 최종 ZIP을 다시 해제하여 전체 파일의 크기·SHA256과 공급자 원본을 비교한다. 별도 smoke는 그 외부 manifest 및 실제 ZIP 해시와 실행 대상을 먼저 결속하고, 모든 네이티브 검사 후 전체 파일을 다시 비교한다. `scripts/desktop-smoke-main.mjs`와 reference 답안은 작성자 환경에만 있으며 최종 ZIP에 포함되지 않는다.

Mac은 `npm run package:desktop`이 현재 CPU를 직접 검사하고 `mac-x64` 또는 `mac-arm64` ZIP을 만든다. `desktop/vendors-macos.json`의 원본 `.app`과 Node tar.gz 전체를 보존하고 별도 미서명 wrapper에서 실행한다. 공급자 파일의 모드·링크 원문·SHA256을 최종 ZIP까지 비교하며 원래 서명이 있는 경우 `codesign --verify --deep --strict`로 확인한다. 서명되지 않은 공급자 바이너리는 그대로 unsigned로 기록한다. 실행기 경로를 CPU별로 고정하며 Rosetta 교차 실행은 네이티브 검증으로 허용하지 않는다. 상세 계약은 `docs/macos-packaging-implementation.md`를 따른다.

정확한 vendor 버전·출처·checksum은 `vendors.json`/`vendors-macos.json`, 사용자 설명은 `PORTABLE-README.txt`/`PORTABLE-MACOS-README.txt`, 고지는 각각의 `THIRD-PARTY-*-NOTICES.txt`를 따른다. 범위는 미서명 portable ZIP과 승인된 CI artifact다. Developer ID 서명·공증·다운로드 후 Gatekeeper 승인·공개 Release 게시·Linux/Windows ARM64는 포함하지 않는다. 네이티브 CPU별 PASS는 실제 해당 CI 결과가 나온 뒤 기록한다.
