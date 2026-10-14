# 실행기 설계 경계

상태: 설계 초안, 실제 실행기 미구현.

ECMAScript는 언어 기준이다. DOM·fetch·브라우저 이벤트 루프는 웹 호스트 계약, fs·process·Node.js 이벤트 루프는 Node.js 계약으로 분리한다. compilerTarget:null은 현재 직접 실행 설계에서 해당 없음이다. 번들러/트랜스파일러 도입 시 변환 대상과 실행 엔진을 따로 기록한다.

어댑터 인터페이스는 getEnvironment / prepare / run / submit / cancel이다. 현재 getEnvironment는 available:false, actualRuntime:null이며 prepare/run/submit은 RUNNER_UNAVAILABLE로 거부한다. cancel의 idle은 프로세스 취소 구현을 뜻하지 않는다.

후속 단계에서 브라우저 전용 실습은 격리된 Worker/iframe의 API·시간·출력·취소 경계를 설계하고 실제 지원을 확인한다. Node.js 실습은 사용자 권한과 파일·네트워크 접근을 밝히며 개인 IDE를 OS 보안 샌드박스라고 표현하지 않는다. 제품은 과제 ID와 고정 프로필/allowlist/harness를 선택하며 학습자 입력으로 명령·채점 기준·환경을 결정하지 않는다.

결과 계약: requestId, exerciseId, contentRevision, sourceFingerprint, environmentFingerprint, targetVersion, actualRuntime, status, stdout, stderr, compilerOutput, checks, durationMs. 실제 실행과 제출 행동 검사·인프라 오류를 분리하고 검사 0개는 통과가 아니다. 코드 수정·전환·늦은 응답은 이전 성취를 현재 코드에 적용하지 못하게 한다.

제품 런타임 고정, trusted grader, 기준 답안/대표 오답, 자원 제한, 취소/종료, 동의와 초안 복원 검사가 다음 의존성이다.
