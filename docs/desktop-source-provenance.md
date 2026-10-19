# JavaScript-edu 0.1.2 런타임 소스

0.1.2는 0.1.1과 같은 공식 Electron 44.9.0과 Node.js 24.22.0 배포본을 수정 없이 포함한다. 포함 런타임의 버전을 바꾸지 않았으므로 아래 대응 소스는 기존 [v0.1.1 Release의 소스 첨부](https://github.com/jbsim999/JS-edu/releases/tag/v0.1.1)를 그대로 제공한다. 앱 ZIP의 `LICENSE`, `LICENSES.chromium.html`, Node `LICENSE`와 제3자 고지를 보존한다. 0.1.2의 제품 코드는 해당 빌드 소스 커밋의 source-context로 별도 제공한다. 이번 최종 패키지 검수는 사용자 요청으로 생략했으며, 이 문서는 검수 통과나 바이너리 재현 빌드를 인증하지 않는다.

## 첨부 원본과 무결성

| 첨부 파일 | 고정 출처 | 크기(bytes) | SHA-256 |
| --- | --- | ---: | --- |
| `electron-fd148b9908b83c8dc09924e45e6df44b83b6bfe7.tar.gz` | [Electron commit](https://github.com/electron/electron/tree/fd148b9908b83c8dc09924e45e6df44b83b6bfe7) | 20,558,341 | `bce11fc9180b4b9e92338a231171651cffdc240a360199d07dcb05f5a045a027` |
| `ffmpeg-2b68d2babae73714846961fb0ee47e3b3d2e39a9.tar.gz` | [Chromium FFmpeg commit](https://chromium.googlesource.com/chromium/third_party/ffmpeg/+/2b68d2babae73714846961fb0ee47e3b3d2e39a9/) | 18,819,959 | `d248e0ecd449159bf465071550b3eada3645925798b780eaaa214e139995d81a` |
| `node-v24.22.0.tar.xz` | [Node 공식 소스](https://nodejs.org/dist/v24.22.0/node-v24.22.0.tar.xz) | 57,606,320 | `41f97cff2c666f1f8293dc5f85c65e8dd605c16b43fd9febd49ede32ee1e0329` |

Node 소스의 해시는 공식 [SHASUMS256.txt](https://nodejs.org/dist/v24.22.0/SHASUMS256.txt)와 대조했다. Electron·FFmpeg의 값은 고정 commit에서 내려받은 파일의 SHA-256을 직접 측정한 값이다. 공급자가 서명한 소스 체크섬이라고 표현하지 않는다. Electron v44.9.0 태그 객체가 가리키는 commit은 위 값이며 해당 태그의 GitHub 검증 필드는 unsigned였다.

## FFmpeg 소스·패치·빌드 조건

Electron의 [고정 DEPS](https://github.com/electron/electron/blob/fd148b9908b83c8dc09924e45e6df44b83b6bfe7/DEPS)는 Chromium `152.0.7977.167`과 Node `v24.22.0`을 지정한다. Chromium 태그 commit은 `dd78960ccd8a03a2fe1f629543d27783885b78e9`이고 그 [DEPS](https://chromium.googlesource.com/chromium/src/+/dd78960ccd8a03a2fe1f629543d27783885b78e9/DEPS)의 `ffmpeg_revision`이 위 FFmpeg commit이다.

FFmpeg 첨부는 해당 Chromium fork의 전체 소스다. `BUILD.gn`, `ffmpeg_generated.gni`, `chromium/config`, `chromium/scripts`, `chromium/patches`, `CREDITS.chromium`, `COPYING.LGPLv2.1` 등을 포함한다. Electron 첨부의 `patches/ffmpeg/.patches`에는 `link_with_loader_path.patch` 하나가 있으며, macOS 동적 FFmpeg 라이브러리의 install name을 `@rpath/libffmpeg.dylib`에서 `@loader_path/libffmpeg.dylib`로 바꾼다. 원본 FFmpeg를 수정해서 배포하지 않고 이 패치를 Electron 소스와 함께 별도로 제공한다.

Electron `build/args/release.gn`은 `is_component_ffmpeg = true`를 지정하고 `all.gn`은 `ffmpeg_branding = "Chrome"`, `proprietary_codecs = true`를 지정한다. FFmpeg의 해당 플랫폼 `chromium/config/Chrome/{win/x64,mac/x64,mac/arm64}/config.h`에는 GPL·nonfree·version3 설정이 비활성화되어 있다. 이는 소스의 빌드 설정을 확인한 것이며 바이너리로부터 실제 컴파일 명령 전체를 추출한 결과는 아니다.

이 제품은 FFmpeg를 사용하며 FFmpeg의 LGPL 고지와 라이선스는 원본 런타임에 포함한다. FFmpeg 및 기타 제3자 구성요소의 해당 라이선스가 허용하는 수정·디버깅·교체 권리를 프로젝트 자체 조건으로 제한하지 않는다. [FFmpeg 배포 안내](https://ffmpeg.org/legal.html)의 소스 제공·빌드/변경 사항 고지 항목에 맞춰 위 원본과 패치를 함께 안내한다.

## 전체 빌드 문맥을 얻는 방법

아래는 새로운 빈 디렉터리에서 실행하는 소스 획득 예시다. 사용 중인 앱 또는 사용자 프로젝트에서 실행하지 않는다. 사전에 Electron 첨부에 들어 있는 `docs/development/build-instructions-gn.md`와 해당 OS의 `build-instructions-windows.md` 또는 `build-instructions-macos.md`에 따라 depot_tools·SDK·컴파일러를 준비한다.

```sh
mkdir electron-44.9.0-source
cd electron-44.9.0-source
gclient config --name "src/electron" --unmanaged https://github.com/electron/electron
gclient sync --with_branch_heads --with_tags --revision src/electron@fd148b9908b83c8dc09924e45e6df44b83b6bfe7
```

Electron `DEPS`, `patches/config.json`, `script/apply_all_patches.py`와 `docs/development/patches.md`가 의존성 및 패치 적용 순서를 정의한다. 개별 FFmpeg 소스만 최신 FFmpeg로 대체하면 이 릴리스의 소스가 되지 않는다. 획득 후 `src/electron`의 HEAD와 각 DEPS pin을 대조한다. Electron 고정 빌드 문서의 Release GN 설정과 `ninja -C out/Release electron`을 사용하고 목표 CPU를 `x64` 또는 `arm64`로 명시한다. 이 프로젝트에서 런타임 소스 재컴파일이나 공식 배포본과의 비트 단위 재현 검증은 수행하지 않았다.

## Chromium의 LGPL/MPL 관련 소스 위치

최상위 Electron 소스만으로 Chromium 전체 소스가 포함되지는 않는다. `JavaScript-edu-0.1.1-source-context.zip`에는 확보한 Chromium 하위 소스 원본, 원본 고지, DEPS·패치 근거와 파일별 해시를 추가로 제공한다. 이 보조 ZIP도 Chromium 전체 오프라인 checkout으로 표현하지 않는다. 아래는 모두 Chromium 고정 commit에서 접근하는 소스이며 위 `gclient` 방식은 DEPS의 외부 저장소까지 획득한다.

| 원본 고지의 구성요소 | 정확한 소스 |
| --- | --- |
| WebKit/Blink | [third_party/blink 전체](https://chromium.googlesource.com/chromium/src/+/dd78960ccd8a03a2fe1f629543d27783885b78e9/third_party/blink/) 및 그 `LICENSE_FOR_ABOUT_CREDITS` |
| AXE-CORE | [third_party/axe-core](https://chromium.googlesource.com/chromium/src/+/dd78960ccd8a03a2fe1f629543d27783885b78e9/third_party/axe-core/) |
| Hunspell | [third_party/hunspell](https://chromium.googlesource.com/chromium/src/+/dd78960ccd8a03a2fe1f629543d27783885b78e9/third_party/hunspell/) |
| ISimpleDOM | [third_party/isimpledom](https://chromium.googlesource.com/chromium/src/+/dd78960ccd8a03a2fe1f629543d27783885b78e9/third_party/isimpledom/) |
| NSPR | [base/third_party/nspr](https://chromium.googlesource.com/chromium/src/+/dd78960ccd8a03a2fe1f629543d27783885b78e9/base/third_party/nspr/) |
| Mozilla security manager / Windows cert | [net/third_party/mozilla_security_manager](https://chromium.googlesource.com/chromium/src/+/dd78960ccd8a03a2fe1f629543d27783885b78e9/net/third_party/mozilla_security_manager/) · [mozilla_win](https://chromium.googlesource.com/chromium/src/+/dd78960ccd8a03a2fe1f629543d27783885b78e9/net/third_party/mozilla_win/) |
| url_parse | [url/third_party/mozilla](https://chromium.googlesource.com/chromium/src/+/dd78960ccd8a03a2fe1f629543d27783885b78e9/url/third_party/mozilla/) |
| Symphonia 및 관련 Rust crates | [third_party/rust/chromium_crates_io](https://chromium.googlesource.com/chromium/src/+/dd78960ccd8a03a2fe1f629543d27783885b78e9/third_party/rust/chromium_crates_io/)의 `Cargo.lock`·`vendor`·빌드 파일 |
| Eigen | Chromium DEPS pin [d53ac33805ba0a23fa139adaf24227fb6707e6fa](https://chromium.googlesource.com/external/gitlab.com/libeigen/eigen/+/d53ac33805ba0a23fa139adaf24227fb6707e6fa/) |

[MPL 2.0](https://www.mozilla.org/en-US/MPL/2.0/) §3.2의 소스 획득 안내로 위 고정 경로를 제공한다. 이 링크 표는 모든 소스가 Release 첨부에 포함되었다는 뜻이 아니다. 원본 `LICENSES.chromium.html`은 Android·Linux 전용 항목도 포함하는 넓은 고지다. 문자열에 GPL/MPL이 등장한다는 이유만으로 모든 항목이 Windows/macOS 바이너리에 연결되었다고 판정하지 않는다. 각 파일의 실제 라이선스와 대안 라이선스 선택권을 원문 그대로 보존한다.

## 확인한 범위와 남은 한계

확인: 공식 vendor ZIP SHA, 원본 고지 추출, 태그→commit→DEPS pin, 세 핵심 소스 파일의 크기·SHA와 아카이브 목록, FFmpeg 패치와 플랫폼 config, Electron release GN 설정. 보조 소스 ZIP은 파일 목록·해시를 함께 제공한다.

미실행: 전체 Chromium 의존성 checkout 및 런타임 재빌드, 각 바이너리의 모든 연결 대상 역추적, 소스 재현성 검증. 일부 소스 서버 아카이브 요청은 HTTP 503을 반환했으며 실패한 응답은 소스로 첨부하지 않았다. 필요한 소스는 해당 고정 commit의 파일별 열람과 공식 Git checkout 경로로도 접근할 수 있다.
