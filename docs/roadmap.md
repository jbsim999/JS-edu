# JavaScript 교육 로드맵

상태: 교육 설계 제안 / 구현 전. 대상은 다른 언어 경험자와 현직 개발자다. 공식 문서의 규칙과 이 문서의 교육 순서를 구분한다.

| 단계 | 역량 | 대표 실습 |
| --- | --- | --- |
| 1. 의미 모델 진단 | 값·타입·변환·동등성, 기존 언어의 가정 점검 | null/undefined/숫자 문자열/NaN 정규화 결함 수정 |
| 2. 스코프와 함수 | 렉시컬 스코프·TDZ·클로저·this·화살표 함수 | 독립 카운터와 잘못된 콜백 문맥 수정 |
| 3. 객체와 상태 | 참조·변경·프로토타입·클래스·합성 | 장바구니의 얕은 복사와 공유 상태 결함 수정 |
| 4. 데이터와 순회 | 배열·Map·Set·이터레이터·제너레이터·문자열 | 중복 이벤트 정규화·집계 순수 함수 |
| 5. 모듈과 실패 계약 | ESM·의존성·오류 전파·행동 테스트 | 다중 파일 도메인 모듈 정상/실패 경로 검사 |
| 6. 비동기 실행 | Promise·async/await·경쟁 상태·취소 | 동시 요청 제한 및 늦은 응답 덮어쓰기 방지 |
| 7. 호스트별 선택 | 브라우저 DOM/이벤트/Fetch 또는 Node.js 파일/HTTP/스트림 | 공유 도메인에 화면 또는 CLI 연결 |
| 8. 통합과 운영 | 입력 경계·자원 제한·성능·회귀·의존성 | 장애·취소·대량 입력을 처리하는 작은 조회 제품 |

기본 선수 관계는 1 → 2 → 3 → 4 → 5 → 6 → 7의 선택 분기 → 8이다. 진단을 통과한 경험자는 해당 단계를 건너뛸 수 있다. 프레임워크를 핵심 언어 과정의 필수 선수로 두지 않는다. 대표 클로저 수업 초안을 먼저 전체 흐름으로 구현하며 위 표 전체가 카탈로그에 구현됐다고 표시하지 않는다.

모든 수업은 **이론 → 예시 → 문제풀이 → 실무 심화 → 직접 코딩**이다. 코드 해석·결함 수정·설계 선택의 이유를 확인하고 구조형/본문형/다중 파일형을 학습 목표에 맞춘다. 실제 실행기 연결 전에는 학습 제출 PASS와 content reviewed를 기록하지 않는다.

## 표준과 호스트 기준

- 언어 기준: ES2026, ECMA-262 제17판(2026-06). 확인일: 2026-10-14.
- TC39 편집 중 명세와 제안은 정식판과 분리한다. Stage 4만으로 ES2026 포함을 추론하지 않는다.
- 개발 골격은 Node.js 22 이상을 요구한다. 제품 Node.js 호스트는 24 LTS를 후보로 검토하되 정확한 버전과 기능 호환성은 실행기 구현 시점에 다시 확인한다.
- 브라우저·엔진·정확한 버전·DOM/Fetch 기능은 별도 프로필로 관리한다. Node.js와 같은 호스트로 취급하지 않는다.
- 비동기 과정은 ECMAScript Promise 작업과 HTML 이벤트 루프, Node.js 이벤트 루프를 별도 근거로 설명한다.
- TypeScript·프레임워크는 추후 선택 과정이며 현재 JavaScript 필수 선수나 구현 기능이 아니다.

## 공식 근거

2026-10-14에 정식판 안내와 공식 호스트 문서를 확인했다. 세부 수업의 절별 내용 검수와 실행 호환성 검사는 다음 단계다.

- [ECMA-262 정식판 안내](https://ecma-international.org/publications-and-standards/standards/ecma-262/)
- [ECMAScript 2026 정식 명세](https://262.ecma-international.org/17.0/)
- [TC39 절차](https://tc39.es/process-document/)
- [Node.js와 브라우저의 차이](https://nodejs.org/learn/getting-started/differences-between-nodejs-and-the-browser)
- [Node.js 공식 릴리스 일정](https://github.com/nodejs/Release#release-schedule)
- [HTML 이벤트 루프](https://html.spec.whatwg.org/multipage/webappapis.html#event-loops)
- [Node.js 24 테스트 API](https://nodejs.org/docs/latest-v24.x/api/test.html)

이 로드맵은 채용 통계·기업 실제 과제·학습 성과 실측을 주장하지 않는다.
