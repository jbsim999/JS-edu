# 학습 화면

승인한 피스타치오 스타일을 적용하는 첫 제품 화면이다. 프로젝트 루트에서 `npm run dev` 후 http://127.0.0.1:4179/ 를 연다. 기존 작동 시안은 prototypes/learning-workspace에 보존한다.

`index.html`, `app.mjs`, `styles.css`는 화면과 상호작용, `glossary-data.mjs`는 검색형 용어집, `features/workspace-state.mjs`는 로컬 초안·메모·환경설정, `adapters/`는 저장과 명시적 실행 불가 경계다. `serve.mjs`는 명시한 공개 학습 파일만 로컬에 제공하며 저장소 전체·정답·검사기를 노출하지 않는다.

클로저만 실제 카탈로그·교재·과제·실행 프로필과 연결한다. 나머지 여섯 개념은 미리보기다. `draft-1`은 교재 초안이며, 편집·저장을 실행/학습 통과로 표시하지 않는다. native textarea는 함수 본문 편집만 지원하며 문법 강조 IDE로 표시하지 않는다. `available:false`, `executionVerified:false`를 유지한다.

서버 옵션: `npm run dev -- --port 4180`. 종료: Ctrl+C. 호스팅·계정·동기화·설치 패키지는 미구현이다.
