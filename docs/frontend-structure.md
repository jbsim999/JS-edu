# 앞단 구조

상태: 설계 골격, 화면 미구현.

web/features/navigation: 목차·검색·트랙/버전 필터·수업/단계 URL 상태.
web/features/lesson: theory/example/quiz/practice/lab 렌더링과 출처·공식 버전.
web/features/editor: 문법 강조 편집기·구조/본문/다중 파일 모드.
web/features/progress: 퀴즈·코딩·메모 분리, 현재 제출 snapshot과 개정 식별자.
web/adapters/storage.mjs: 기기 저장소 주입·수업/개정/파일별 초안.
web/adapters/runner.mjs: 명시적 실행 불가 기본값, 실제 어댑터로 교체.

웹과 설치형은 같은 화면·교재를 사용하고 저장/실행 어댑터를 바꾼다. 다크·라이트·고대비, 좁은 화면 목차 접기, 코드 내부 스크롤, 키보드·한글 입력을 실제 구현 후 검사한다.
