# 데스크톱 패키징

## 0.1.2 생성과 요청된 검수 생략

사용자가 이번0.1.2의 패키징 후 검수를 생략하도록 명시했다. 기본 패키징 경로는 그대로 두고 이번 생성에는 `node scripts/package-desktop.mjs --skip-final-verification`을 사용한다. 세CPU의 정확한 소스를 선택하는 수동 workflow에서는 `source_commit=<40자리SHA>`, `skip_final_verification=true`를 지정한다.

이 결과는 `BUILT_UNVERIFIED`이며 최종ZIP 재해제/내용 전수대조와 네이티브 앱 실행은 `SKIPPED_BY_REQUEST`다. 공급자 원본 checksum·필수 구조·CPU·빌드 복사 보존·소스 동일성은 패키지를 생성하는 필수 단계로 유지한다. 암호화 전송도 `--allow-unverified`를 양쪽에 명시하고 상태를 인증 데이터에 포함한다. 전송 성공은 패키지 검수 통과를 뜻하지 않는다. 이번 생성 후 다운로드/소스 식별자는 [현재 상태](project-state.md)와 [검증 기록](verification.md)에 별도로 기록한다.

## 현재 공개 프리뷰 · 2026-10-19

사용자가 README에서 앱을 바로 다운로드하도록 후속 승인해 [v0.1.1](https://github.com/jbsim999/JS-edu/releases/tag/v0.1.1)을 게시했다. Windows x64·Mac Intel·Apple Silicon의 최종 ZIP/native CI가 모두 PASS이며, [파일·소스·CPU 검증](desktop-0.1.1-evidence.json)과 [포함 도구의 고정 소스·패치·빌드 안내](desktop-source-provenance.md)를 함께 제공한다. 단독 EXE/설치 프로그램이 아닌 전체 런타임 포함 ZIP이다. 아래 미게시·로컬 범위 문장은 이 후속 승인 이전의 빌드 계약 이력이다.

2026-10-19 사용자 승인으로 `junbo-desktop-runtime-packaging`의 전체 공급자 배포본 보존·최종 ZIP 해제 대조·네이티브 실행 계약을 적용한다. 기존0.1.0은 **Windows x64 포터블 ZIP**이고, 추가 승인된0.1.1은 **Windows x64·macOS Intel x64·Apple Silicon arm64**를 대상으로 한다. Mac 실제 검증 전에는 완료로 표시하지 않는다. 설치 프로그램·공개 릴리스는 포함하지 않는다.

Mac은 전체 `JavaScript-edu.app`을 보존하는 CPU별 ZIP이며 macOS13.5 이상이 공급자 최소 조건이다([고정 Node24.22.0 지원 표](https://raw.githubusercontent.com/nodejs/node/v24.22.0/BUILDING.md)). 원본 Electron.app과 전체 Node 배포본을 수정 없이 미서명 wrapper 안에 보관하며 각 원본의 서명 유무·검증을 별도로 기록한다. 정확한 구조와 실제 네이티브 게이트는 [Mac 패키징 계약](macos-packaging-implementation.md)을 따른다. 공개 CI에 평문 ZIP을 게시하지 않으며, 지정 수신자 전송은 [전송 계약](desktop-private-transfer.md)을 따른다.

## 사용자 실행과 데이터

ZIP을 폴더 전체로 해제한 뒤 `JavaScript-edu.exe`를 연다. Node.js나 npm의 별도 설치·PATH 변경·관리자 권한 등록은 필요하지 않다. 원본 `electron.exe`도 무결성 보존을 위해 남기며, 제품 이름 EXE는 그 파일의 바이트가 동일한 추가 복사본이다. 단일 EXE 앱으로 표현하지 않는다.

사용자별 앱 데이터에 브라우저 저장소와 첫 실행의 로컬 포트를 보관한다. 다음 실행은 같은 origin을 사용한다. 포트가 다른 프로그램에 점유되면 임의로 다른 주소로 바꿔 기록이 사라진 것처럼 보이게 하지 않고, 원인을 알리고 종료한다. 앱 폴더의 이동·교체와 사용자 데이터 보존은 분리한다. 기존 웹 브라우저판 기록의 자동 이전·클라우드 동기화는 제공하지 않는다.

## 포함 도구와 경계

| 도구 | 고정 버전 / 대상 | 원본과 고지 |
| --- | --- | --- |
| Electron 앱 셸 | 44.9.0 / win32-x64, Chromium 152.0.7977.167 | 공식 전체 ZIP, LICENSE·LICENSES.chromium.html 보존 |
| 학습 서버와 Node 실습 | Node.js 24.22.0 / win32-x64 | 공식 전체 ZIP, npm·고지 등 배포본 전체 보존 |

정확한 URL·SHA256·버전은 [공급자 설정](../desktop/vendors.json)과 [Node 공급자 기록](../runtime/node-vendor.json)을 따른다. Electron 내부 Node 버전과 별도 실행하는 학습용 Node 실행 파일을 구분한다. 원본 배포본은 재서명·리소스 편집·파일 삭제 없이 복사한다. 프로젝트 앱 자체는 **미서명**이다. 공급자 파일의 보존은 프로젝트 코드 서명을 뜻하지 않는다.

렌더러에는 Node/preload/임의 파일·명령 IPC를 제공하지 않는다. 브라우저 실습은 별도 loopback origin, Node 실습은 포함 실행 파일의 기존 권한·시간·출력 제한을 사용한다. 실행 동의·제출 판정·초안/진도 계약은 웹판과 같다. 외부 자료는 허용된 HTTPS 문서만 기본 브라우저로 연다. 교재 열람과 기본 실습은 로컬 리소스를 사용하며 외부 공식 문서 열기는 인터넷이 필요하다. OS 네트워크 격리나 Windows Job Object 기반 보안 샌드박스로 표현하지 않는다.

공급자 기준 대상은 Windows 10 이상 x64의 지원되는 서비스 채널이다. Windows 11을 권장하며 실제 검사 OS/build는 최종 근거에 별도 기록한다. 최소 OS의 모든 버전을 실제 검사한 것으로 표현하지 않는다.

## 빌드와 검증 동일성

빌드 명령은 검토한 소스를 먼저 커밋하도록 요구한다. `--allow-dirty`는 소스가 미커밋인 검증 후보만 만들며 최종 패키지는 이 옵션을 사용하지 않는다. 빌드 PC에는 긴 경로를 지원하는 PowerShell 7이 필요하다. 학습자의 앱 실행에는 PowerShell 설치가 필요하지 않다. `dist/`의 ZIP·전체 manifest·SHA256 파일은 Git에서 제외한다. 기존 검증 ZIP은 덮어쓰지 않는다.

공식 아카이브 hash → 추출한 vendor 전체 inventory → 빌드 복사본 → 최종 ZIP 실제 해제본을 경로·크기·SHA256로 비교한다. 경로 탈출·링크·대소문자 충돌·누락·추가는 거부한다. 앱의 package.json 최소 엔트리·고정 상대 경로 설정 생성·제품명 EXE 추가는 BUILD-INFO에 한정해 기록한다. 제작자 qualification·기준 답안·Git·테스트·개인 개발 산출물은 학습 앱에 넣지 않는다.

정적 무결성 검사는 네이티브 기동·실제 제출 검사를 대신하지 않는다. 최종 검증은 실제 해제본에서 실행·오답/정답·취소·종료 정리·재시작 복원·한글/공백 경로·실제 Electron page zoom 200%를 구분해 기록한다. 구현 및 실제 실행 기록은 [구현 기록](desktop-packaging-implementation.md)과 [최종 검증](desktop-packaging-verification.md)에 연결한다. 공개 다운로드 링크·태그·릴리스는 게시하지 않았다.

Electron의 고지는 FFmpeg의 LGPL 등 여러 조건을 포함하며 MIT 하나로 축약하지 않는다. 전체 원문을 보존한다. 공개 바이너리 배포에 필요한 대응 소스와 조건 확인은 별도이며 아직 완료하지 않았다. 현재 산출물은 로컬 패키지다.
