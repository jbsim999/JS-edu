# Windows 최종 패키지 검증

2026-10-19. 소스·최종 ZIP 무결성·전체 native·독립 최종 검토 모두 **PASS**다. 미서명 로컬 Windows x64 포터블 패키지이며 공개 릴리스를 게시하지 않는다. 바이너리 빌드 소스는 `23154a3c3cc2f718469a3e03e158bc5db041c6b2`다. 이후 검증 기록 문서 커밋과 이 빌드 SHA를 구분한다.

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

검토한 소스를 먼저 로컬 커밋하고 `sourceDirty:false`인 최종 ZIP을 한 번 생성했다. 원본 Electron73·Node1,994파일을 보존하고 최종 해제본 **2,410파일/2,908항목**을 외부 manifest와 대조했다. 독립 리뷰어도 직접 크기/SHA256/누락·추가·링크를 확인해 불일치0을 판정했다.

| 항목 | 최종 식별자 |
| --- | --- |
| 빌드 소스 | `23154a3c3cc2f718469a3e03e158bc5db041c6b2`, sourceDirty:false |
| 산출물 | `dist/JavaScript-edu-0.1.0-win-x64.zip`, 315,315,450바이트 |
| ZIP SHA256 | `9e9be81a981502ac6a3bcbfd2e56b5d1f8ed8a12c3cb085386e555b0e38d493e` |
| 외부 manifest SHA256 | `a6ace165e1532027ed3ee7bd5f4a67a0fa3ae5672cd8f1511dee1d76b1558191` |
| 포함 앱 소스 집계 | `7c95f9eeb2f5a8ae803c6959f5d27c186a7c90b5830d6510e4bfcb8300129f19` |
| 작성자 입력117파일 집계 | `a2abe1d855d3150efd384a63be80f2010ba3c6356ab999ef32bbe2b437e30768` |

실제 최종 native 실행은 **05:17:59.011–05:20:31.884 UTC**, Windows win32/x64·25H2·build26200.9711에서 수행했다. 개발/빌드 Node22.17.0, 셸 Electron44.9.0/Chromium152.0.7977.167, 별도 학습 프로세스의 공식 Node24.22.0을 구분했다. 전체 **55실습471조건**(browser361+Node110), browser negative88·DOM예제11·runtime16, Node starter/오답 각11개 거부 PASS다. Node 예제11개 실행은 이번 패키지 smoke의 검사 범위가 아니며 앞선 교재 검증 기록과 구분한다.

실제 UI 동의·준비·실패 제출·취소의 DELETE 응답/정리·재실행/제출 복구, 진도/메모/테마 복원·코드 수정 후 성취 무효화, 실제200% dark/light/사전·초점, 저장 실패 양쪽 선택, 단일 인스턴스, 정상 종료와 강제 부모 종료 후 서비스PID/두포트/임시 폴더 정리가 모두 PASS다. 실제 production EXE 원본과 한글·공백·`&` 이동본도 각각 N01 8/8, WM_CLOSE·exit0, 동일origin 재사용을 통과했다. 마지막 production 단계 뒤 임시 폴더0·원본/이동본 전체 바이트·외부 manifest·작성자117입력 불변을 확인했다.

독립 리뷰어는 55실습의 검사 ID와 원본, 개별 입력 지문, 실제 native 원시 보고서 및 캡처를 대조해 **최종 로컬 패키지 PASS·미해결 P1/P2 없음**으로 판정했다. 총괄도 최종 압축 해제본의 100/200% 합성 화면을 직접 검토했다. 정확한 보고서와 캡처의 경로/SHA256은 [최종 근거 요약](desktop-packaging-evidence.json), 원시는 `artifacts/desktop-final-native/`, 전체 ZIP 파일 목록은 `dist/JavaScript-edu-0.1.0-win-x64.manifest.json`에 보존했다. checksum 파일도 dist에 있다.

원격 반영과 CI는 현재 `feat/runtime-and-curriculum`의 실제 Git ref와 Actions 결과를 확인한다. 이 문서의 로컬 산출물 PASS를 원격 CI 성공이나 공개 게시로 확대하지 않는다.

전체 vendor 라이선스는 보존한다. 공개 바이너리 배포의 대응 소스·배포 조건 확인, 프로젝트 라이선스 지정, 앱 코드 서명과 공개 게시는 이번 로컬 산출물과 구분해 미완료로 남긴다.
