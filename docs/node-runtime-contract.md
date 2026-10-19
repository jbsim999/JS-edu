# Node.js 실습 실행 계약

교재의 언어 기준은 ES2026이며 Node.js는 별도 호스트다. 실습 대상은 정확히 Node.js 24.22.0이다. 개발 서버를 다른 버전으로 시작하더라도 이 실행 파일을 별도로 지정할 수 있다. 실제 버전과 Permission Model 시작을 확인하지 못하면 Node 실습을 실행하거나 통과로 표시하지 않는다. 공식 배포본의 출처·체크섬·라이선스는 `runtime/node-vendor.json`에 기록하며 설치 패키지 제작은 최종 단계로 보류한다.

## 사용자 흐름

환경 확인은 학습 코드를 import하지 않으며 검사기를 읽지 않는다. 코드 실행과 제출은 자기 PC에서 실행한다는 안내에 동의한 뒤 가능하다. 실행은 고정 runProbe의 관찰과 출력을 제공하며 제출만 행동 검사기를 사용한다. 실행 성공과 코딩 제출 통과는 별개다. 실행 파일이 없거나 버전이 다를 때도 교재·퀴즈·초안 편집은 이용할 수 있다.

통합 C02–C04는 하나의 강의 ID를 유지하며 브라우저와 Node 실습을 선택한다. 기본 exerciseId는 기존 브라우저 과제다. exerciseByHost와 hostVariants.node가 Node 과제·다섯 학습 단계·선수 강의·퀴즈를 연결한다. 실습 초안과 코딩 성취는 과제/교재 개정으로, 퀴즈는 별도 개정으로 구분한다. 호스트 변경이 이전 호스트의 제출이나 퀴즈를 대신 통과시키지 않는다.

## 소스와 관찰

네이티브 .mjs/.cjs/.json 파일을 변경 없이 Node 로더로 읽는다. package.json·도우미 파일 중 읽기 전용 자료는 서버가 고정 소스와 대조한다. 파일 목록·entry를 정규화한 전체 snapshot의 SHA256을 사용한다. 제출 식별에는 requestId·lessonId·exerciseId·contentRevision·targetVersion·sourceFingerprint가 포함되며 결과는 환경과 graderRevision에도 결속된다. 환경 지문에는 실제 실행 파일이 보고한 버전·플랫폼·아키텍처와 제공자 정책·Worker capability·검사 개정을 포함한다.

검사마다 새 Worker와 데이터 폴더를 사용한다. 학습 코드의 관찰값은 private MessagePort를 거쳐 서버로 전달하며 기대값은 서버에서 비교한다. observe는 한 번만 호출해야 하며 호출 시점에 값을 복사한다. supervisor 응답에는 서버가 생성한 비밀키의 HMAC과 순서를 확인한다. 이 응답 검사는 아래의 프로세스 격리 한계를 제거하지 않는다.

## 자원과 한계

동시 실행은 한 개이며 대기열은 없다. 시작 전 요청 하나만 예약한다. 요청 본문 800KB, 파일 16개·각 100KiB·합계 512KiB, 검사 2.5초·전체 15초, 출력 64KiB/200줄을 기본으로 한다. 취소와 연속 실행은 이전 작업의 프로세스 종료·임시 폴더 정리를 기다린다. 정리를 확인하지 못하면 경고를 표시하며 정상 통과 증거로 사용하지 않는다.

Node Permission Model의 파일 읽기/쓰기 경로·하위 프로세스·애드온 제한을 적용한다. 네트워크는 차단하지 않는다. 기존 파일 디스크립터·심볼릭 링크 등 모든 접근 경계를 격리하지 않으며 OS 보안 샌드박스가 아니다. 64MB는 JavaScript 힙 설정으로 전체 RAM 상한이 아니다. N07처럼 하위 Worker를 허용한 과제는 Worker 실행 옵션으로 권한 제한을 벗어날 수 있다. 신뢰할 수 있는 학습 코드만 실행한다.

고정 링크 경계 검사는 부모 제공자가 소유한 임시 데이터 폴더 안에만 자료를 만든다. 클라이언트는 fixture 종류·경로를 지정할 수 없으며 학습 코드에 링크 생성 권한을 추가하지 않는다. 이 검사는 링크 접근 전체의 보안 보증을 뜻하지 않는다.

## 제작자 검증

일반 `npm run check`의 호스트 건너뛰기는 PARTIAL이다. Node 실제 제공자 검증은 별도 명령과 CI에서 고정 버전으로 수행하며 정답·starter·대표 오답·예제 출력·정리 결과를 확인한다. N05의 의도된 오답 중 취소를 무시하는 코드는 정확한 release-unused-body 검사 timeout에 한해서만 정상 정답 전수 통과와 후속 회복을 함께 확인한 뒤 거부 증거로 사용한다. 다른 timeout이나 환경 오류는 검증 실패다.

공식 근거: [Node.js Permission Model](https://nodejs.org/docs/v24.22.0/api/permissions.html), [ES modules](https://nodejs.org/docs/v24.22.0/api/esm.html), [Packages](https://nodejs.org/docs/v24.22.0/api/packages.html), [Worker threads](https://nodejs.org/docs/v24.22.0/api/worker_threads.html). 구현의 실제 검증 결과와 미확인은 마일스톤 보고서에 별도로 기록한다.
