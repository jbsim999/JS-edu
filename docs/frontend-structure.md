# 앞단 구조

상태: 2026-10-15 승인한 피스타치오 스타일의 첫 학습 화면 구현 완료. 실제 검사와 완료 범위는 project-state.md 및 verification.md를 따른다.

UI/UX 기획과 이전 작동 시안은 [ui-ux-plan.md](ui-ux-plan.md)와 [prototypes/learning-workspace](../prototypes/learning-workspace/README.md)에 보존한다. 제품 화면은 web/index.html에서 시작하며 다크·라이트, 효과 전환, 실제 대표 교재 데이터, 용어 검색·상세 팝업과 로컬 초안·메모를 연결한다. 기능 모듈의 기존 README는 설계 경계이며 구현 여부는 아래 실제 파일과 검증 기록으로 구분한다.

web/features/navigation: 목차·검색·트랙/버전 필터·수업/단계 URL 상태.
web/features/lesson: theory/example/quiz/practice/lab 렌더링과 출처·공식 버전.
web/features/editor: 문법 강조 편집기·구조/본문/다중 파일 모드.
web/features/progress: 퀴즈·코딩·메모 분리, 현재 제출 snapshot과 개정 식별자.
web/features/glossary(계획): 용어 데이터·한영/별명 검색·간단 설명·상세 모달/시트·관련 수업. 안정 ID/개정/출처와 교재 연결 검증, 포커스/본문 위치 복원. 아직 제품 파일/기능이 구현됐다는 뜻이 아니다.
web/adapters/storage.mjs: 기기 저장소 주입·수업/개정/파일별 초안.
web/adapters/runner.mjs: 명시적 실행 불가 기본값, 실제 어댑터로 교체.

웹과 설치형은 같은 화면·교재를 사용하고 저장/실행 어댑터를 바꾼다. 다크·라이트·고대비, 좁은 화면 목차 접기, 코드 내부 스크롤, 키보드·한글 입력을 실제 구현 후 검사한다.
