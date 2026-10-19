# 학습 화면

피스타치오 스타일과 밝은·어두운 테마의 학습 화면이다. `npm run dev`로 http://127.0.0.1:4179/ 를 연다. 52강의 다섯 학습 단계, 55개 실습, 검색형 용어집과 실제 실행·제출 검사를 제공한다. 이전 시안은 `prototypes/learning-workspace`에 보존한다.

`app.mjs`가 화면을, `features/`가 초안·진도·다중 파일·실행 상태를 관리한다. 편집기는 native textarea의 원본 값을 저장·실행하며 읽기 전용 색상 레이어를 겹친다. `code-theme.css`와 `features/code-theme.mjs`는 예제·용어집·편집기·고정 선언·구조화한 결과의 문법 색상을 제공한다. 고정 버전 Prism은 `vendor/prism/`에 MIT 고지와 출처 지문을 포함해 보관한다. 자세한 범위는 [코드 테마 계약](../docs/code-theme.md)을 따른다.

`serve.mjs`는 공개 학습 파일만 제공한다. 기본 모드에서는 저장소 전체나 기준 답안을 노출하지 않는다. 실제 DOM·브라우저 Worker·ES 모듈 Worker·별도 Node.js 24.22.0 제공자를 구분한다. 제작자 검증용 `--qualification`은 개인용 별도 주소에서만 사용한다.

서버 옵션은 `npm run dev -- --port 4180`, 종료는 Ctrl+C다. 저장 실패는 화면에 표시하며 계정·기기 간 동기화는 제공하지 않는다. 설치 앱과 검증 기록은 프로젝트 README와 `docs/project-state.md`를 확인한다.
