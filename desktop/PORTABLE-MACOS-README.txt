JavaScript-edu — macOS portable

시작하기
1. Mac의 CPU에 맞는 ZIP을 선택하세요. arm64는 Apple Silicon(M 시리즈), x64는 Intel용입니다.
2. ZIP 전체를 해제하고 JavaScript-edu.app을 실행하세요. 앱 번들 내부 파일을 개별 이동하지 마세요.
3. Node.js 실습은 화면의 로컬 실행 범위를 읽고 동의한 뒤 시작하세요.

macOS 13.5 Ventura 이상이 포함된 Node 24.22.0의 최소 조건이며, 앱 전체에도 이 조건을 적용합니다. CI는 macOS 15에서 실행하며 최소 버전 13.5 자체는 검사하지 않았습니다. 실제 검증 OS와 CPU는 manifest와 검증 기록을 확인하세요.
Electron과 Node.js 24.22.0 전체 배포본이 앱 안에 포함되어 Node.js/npm 별도 설치가 필요 없습니다.
교재와 고정 실습은 로컬에서 동작합니다. 외부 공식 자료 링크는 인터넷이 필요합니다.
Node.js 학습 코드는 네트워크를 사용할 수 있습니다. OS 보안 샌드박스가 아닙니다.

이 앱의 바깥 wrapper는 미서명입니다. 포함한 공급자 앱의 원래 서명/바이트는 그대로 보존합니다.
Electron x64 원본은 미서명이며, arm64 원본에는 실행 파일별 코드 서명만 있고 앱 전체를 봉인하는 리소스 서명은 없습니다. arm64 원본 앱 전체의 서명 검사는 실패하며, 개별 코드 서명 검사와 구분하여 BUILD-INFO에 기록합니다.
Developer ID 서명, 공증, 인터넷 다운로드 후 Gatekeeper 승인은 완료하지 않았습니다.
macOS가 실행을 차단할 수 있습니다. 시스템 전체 보안을 해제하거나 quarantine을 일괄 제거하지 마세요.
이 파일은 공개 Release 게시 또는 Apple의 승인을 뜻하지 않습니다.

학습 저장과 업데이트
기본 학습 데이터는 ~/Library/Application Support/JavaScript-edu 에 저장합니다.
browser 폴더는 초안·메모·진도·테마, desktop-state.json은 동일한 학습 origin을 보존합니다.
앱을 정상 종료한 뒤 새 버전을 별도 폴더에 해제하면 같은 사용자 데이터로 이어갑니다.
앱을 이동해도 기본 데이터 위치와 학습 주소는 유지됩니다. 다른 컴퓨터로 데이터를 자동 이관하지 않습니다.
설정한 학습 포트를 다른 앱이 사용하면 해당 앱을 닫고 다시 실행하세요.
제거할 때는 앱 종료 후 해제한 앱/폴더만 삭제합니다. 학습 데이터는 자동 삭제하지 않습니다.
JS_EDU_USER_DATA_DIR에 새 절대 경로를 지정하면 별도 프로필을 사용합니다.
보기 메뉴에서 확대/축소를, JavaScript-edu 메뉴 또는 Command+Q로 정상 종료를 사용할 수 있습니다.

BUILD-INFO.json은 소스 SHA·버전·CPU·실제 런타임·서명 상태를 기록합니다.
integrity/는 전체 vendor 파일 크기/SHA256/Unix 모드/상대 링크 원문과 앱 소스를 기록합니다.
ZIP 옆 .manifest.json과 .sha256은 최종 ZIP과 실제 해제본의 대조 결과입니다.
출처와 고지는 THIRD-PARTY-NOTICES.txt 및 앱 내부 Resources/vendor의 원본 고지에 있습니다.
