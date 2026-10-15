# 실행기 설계 경계

상태: M1 함수 본문 실행·자동 행동 검사 연결. 후속 DOM/Node 및 다중 파일 제공자는 단계별로 검증한다.

ECMAScript는 언어 기준이다. DOM·fetch·브라우저 이벤트 루프는 웹 호스트 계약, fs·process·Node.js 이벤트 루프는 Node.js 계약으로 분리한다. compilerTarget:null은 현재 직접 실행 설계에서 해당 없음이다. 번들러/트랜스파일러 도입 시 변환 대상과 실행 엔진을 따로 기록한다.

어댑터 인터페이스는 getEnvironment / prepare / run / submit / cancel이다. web/execution/browser-runner.mjs는 실제 Dedicated Worker를 만들고 private MessageChannel로 통신한다. prepare는 지원/CSP/실행 준비만 확인하고, run은 고정 대표 호출의 출력만 반환한다. submit은 기대값을 전달하지 않은 Worker의 관찰값을 부모에서 비교한다. 이전 web/adapters/runner.mjs는 미구현 제공자의 명시적 거부 계약으로 보존한다.

고정 probe는 observe(actual)를 정확히 한 번 호출하고 undefined로 완료한다. 값은 Promise의 then 해석 전에 동기적으로 제한 복사한다. 동기 함수의 관찰에 불필요한 await를 넣지 않는다. 검사 개정·교재 개정·검사 수/ID/자료형을 검증하며 결과를 학습 코드가 자체 판정하지 않는다. 공개 검사의 완전성·비밀 유지·인증 성적을 보증하지 않는다.

각 실행은 새 Worker를 사용한다. 기본 2.5초, 출력64KiB/200줄, 소스100KiB, 관찰값 깊이/개수 제한을 적용한다. 종료·취소·교체 시 Worker와 포트·타이머·진행 중 자료 요청을 정리한다. Worker 응답은 script-src 'unsafe-eval'만 허용하고 connect-src/worker-src를 'none'으로 제한한다. 메인 화면의 script-src는 'self'를 유지한다. hard heap quota 및 같은 출처 IndexedDB/OPFS 권한 제거는 제공하지 않는다.

requiredFeatures는 실행 표현식이 아닌 callable API 경로다. 선택 과제의 지원을 부모와 실제 Worker에서 확인하며 미지원은 학습 오답 대신 환경 오류로 표시한다. ES2026 교재 기준, 실제 UA 엔진, 개발 Node 버전은 구분한다.

후속 단계에서 브라우저 전용 실습은 격리된 Worker/iframe의 API·시간·출력·취소 경계를 설계하고 실제 지원을 확인한다. Node.js 실습은 사용자 권한과 파일·네트워크 접근을 밝히며 개인 IDE를 OS 보안 샌드박스라고 표현하지 않는다. 제품은 과제 ID와 고정 프로필/allowlist/harness를 선택하며 학습자 입력으로 명령·채점 기준·환경을 결정하지 않는다.

결과 계약: requestId, exerciseId, contentRevision, sourceFingerprint, environmentFingerprint, targetVersion, actualRuntime, status, stdout, stderr, compilerOutput, checks, durationMs. 실제 실행과 제출 행동 검사·인프라 오류를 분리하고 검사 0개는 통과가 아니다. 코드 수정·전환·늦은 응답은 이전 성취를 현재 코드에 적용하지 못하게 한다.

제품 런타임 고정, trusted grader, 기준 답안/대표 오답, 자원 제한, 취소/종료, 동의와 초안 복원 검사가 다음 의존성이다.
