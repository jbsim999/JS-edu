# 검증용 패키지의 단일 수신자 전송

공개 저장소의 Actions artifact는 로그인한 다른 읽기 사용자도 다운로드할 수 있다. [GitHub 공식 설명](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)을 기준으로, 공개 Release를 만들지 않았다는 이유만으로 평문 앱 ZIP을 비공개로 간주하지 않는다.

이번 패키지는 사용자에게 로컬로 전달하는 미서명 산출물이다. CI는 native 검증이 성공한 ZIP을 `.github/desktop-artifact-recipient.json`의 공개키로 봉인한 뒤 암호문만 artifact에 올린다. 개인키는 로컬 `work/`에만 두고 Git·CI·환경 변수·로그에 넣지 않는다. 평문 manifest/checksum과 검증 JSON/PNG는 함께 보관한다. 사용자에게 제공하는 로컬 ZIP은 해당 CI 실행의 sourceCommit/CPU·검증 성공·manifest/원본 크기/SHA를 대조하고 복호화 인증을 완료한 결과다.

전송은 파일별 새 AES-256 키·12바이트 nonce·16바이트 GCM tag를 사용하고 RSA-OAEP SHA256/3072비트 공개키로 AES 키를 감싼다. sourceCommit·플랫폼/CPU·파일명·원본 SHA256/크기·수신 공개키 지문을 AAD에 결속한다. 복호화는 정확한 CI 실행에서 별도로 얻은 manifest와 일치해야 진행하며, 인증·원본 SHA 검사 전에는 최종 ZIP을 만들거나 압축 해제·실행하지 않는다. 기존 결과를 덮어쓰지 않는다. 공개키로는 누구나 암호문을 만들 수 있으므로 이것은 제작자 전자서명이 아니며 GitHub 실행/커밋 확인을 대체하지 않는다.

향후 다른 담당자가 자신의 패키지를 받으려면 새 RSA3072 이상 키 쌍을 만들고 공개키 JSON의 PEM/DER SHA256 지문을 함께 갱신한다. 개인키는 보관 담당자만 접근하는 Git 제외 경로에 둔다. 기존 수신자의 개인키가 없으면 이전 암호문을 복호화할 수 없다. 사용자 학습 데이터와 앱 동작에는 이 전송용 키를 사용하지 않는다.

단일 수신자 전송을 공개 바이너리 배포의 라이선스 검토 완료로 표현하지 않는다. 원본 공급자 전체 고지는 계속 보존하며, 공개 평문 ZIP/Release 게이트는 닫아 둔다. 후속 공개 배포에는 실제 포함 구성 요소와 정확한 대응 소스·변경·빌드 정보의 연결이 필요하다. FFmpeg의 경우 [공식 체크리스트](https://ffmpeg.org/legal.html), [Chromium152 고정 DEPS](https://raw.githubusercontent.com/chromium/chromium/152.0.7977.167/DEPS)의 revision과 [Electron44.9.0 FFmpeg 패치 순서](https://raw.githubusercontent.com/electron/electron/v44.9.0/patches/ffmpeg/.patches)까지 대조해야 한다. 일반 최신 소스나 Electron 태그 링크만으로 완료 판정하지 않는다. 이것은 현재 개발·전송 범위의 기록이며 법률 적합성 인증이 아니다.
