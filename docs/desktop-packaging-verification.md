# Windows 최종 패키지 검증

2026-10-19. 현재 소스 커밋·빌드 게이트는 **PASS**, clean HEAD 최종 ZIP의 전체 native 게이트는 후속 검증 대상으로 남긴다. 미서명 로컬 Windows x64 포터블 패키지이며 공개 릴리스를 게시하지 않는다.

## 소스 게이트

Windows 네이티브 개발 Node 22.17.0에서 `JS_EDU_NODE_EXECUTABLE`에 포함 예정인 공식 Node 24.22.0의 절대 경로를 지정해 `npm run check`를 실행했다. 구조52강, 구문306파일, 회귀 **294/294·fail0·skip0** PASS다. 패키징/수명 경계13개 회귀를 포함한다. 제작자33과제271조건·예제33은 PASS이며 DOM/Node 호스트22 skip은 **PARTIAL**로 별도 유지한다. 이번 기본 검사만으로 호스트 전수 제출을 통과했다고 표시하지 않는다.

검사 전후 소스 입력486파일의 경로/원본 SHA256 집계는 `b3cb3e353dbcea697524e8dd46940219ea6c17dc608a0b33dfac5e440fce629a`로 동일하다. 독립 리뷰어가 동일486파일과 작성자 동결17파일을 다시 계산해 불일치0을 확인했다. 미해결 P1/P2는 없다. 실제 로그는 `artifacts/desktop-final-check.log`, 입력목록은 `artifacts/desktop-check-source.json`, 작성자 인계는 `artifacts/desktop-source-freeze.json`에 보존한다.

## 중간 native 근거와 실패 보존

후보09에서 실제 Electron Chromium152 브라우저44과제361조건·negative88·DOM예제11·runtime16, 포함 Node11과제110조건과 starter/오답 거부, 실제 200% 배율, 동의·취소 후 정상 제출·메모/테마/코딩 복원, 저장 실패 양쪽 선택, 단일 인스턴스·정상 종료·강제 부모 종료의 서비스PID/두포트/임시 폴더 정리가 통과했다. 마지막 실제 EXE 검사에서 테스트 런처가 GUI를 숨겨 창 핸들을 찾지 못해 **09 전체는 FAIL**로 보존했다. 부분 통과를 전체 성공으로 바꾸지 않았다.

동결된 최종 productionEntry 함수로 별도 실제 EXE 검사를 수행했다. 원본과 한글·공백·`&` 경로의 전체 복사본 각각 N01 **8/8**, 같은 origin의 재사용, 실제 WM_CLOSE·exit0, 임시 폴더0과 패키지 전체 바이트 불변 PASS다. `artifacts/desktop-production-probe/production-entry-probe.json`과 함수 SHA를 독립 대조했다. 전체 최종 native 재실행을 대신하지 않는다.

## 경계 수정

독립 검토와 실제 실패 재현으로 ignored 파일 혼입, HEAD 숨김 변경/삭제, 외부 ZIP·manifest와 실행 폴더 결속, 정상 X 종료와 서비스 exit 경합을 수정했다. Electron ESM ready 상호대기와 잘못된 프로필의 백그라운드 잔류, Windows의 비분리 자식 프로세스 수명에 따른 강제 종료 cleanup 실패도 실제 재현 후 수정했다. Windows에서 서비스 IPC 참조는 유지하며 정상·강제 부모 종료·timeout 회수를 별도로 검사한다. Windows Job Object 보안 격리 또는 모든 Electron 하위 PID의 고아 부재를 주장하지 않는다.

저장 실패 검사는 실제 Storage 예외와 Electron beforeunload 이벤트를 사용하되 OS 대화상자의 선택 반환값만 스텁했다. 실제 대화상자 키보드 조작·OS IME·스크린리더·물리 모바일 기기는 미검증이다. 실제 확대와 합성 검수는 [화면 기록](final-screen-verification.md)을 따른다.

## 최종 산출물 게이트

검토한 소스를 먼저 로컬 커밋하고 `sourceDirty:false`인 최종 ZIP을 한 번 생성한다. 공식 배포본 전체와 최종 해제본을 비교한 뒤 외부 manifest/ZIP 해시·최종 앱 소스·작성자 입력을 결속해 전체 native 검사를 수행한다. 검사 후 원본/이동본 전체 바이트, 모든 phase 뒤 임시 폴더와 작성자 입력 불변을 확인한다. 실제 소스 commit·ZIP SHA256·native 결과는 완료 후 이 문서에 추가한다.

전체 vendor 라이선스는 보존한다. 공개 바이너리 배포의 대응 소스·배포 조건 확인, 프로젝트 라이선스 지정, 앱 코드 서명과 공개 게시는 이번 로컬 산출물과 구분해 미완료로 남긴다.
