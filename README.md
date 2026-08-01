# 🌀 Spiral Buddy

질문하고, 연결하고, 다시 설명하며 이해를 쌓는 웹 기반 AI 학습 버디입니다.

이 저장소는 Electron 데스크톱 앱과 분리된 **Spiral Buddy 웹 서비스**입니다. 현재 버전은 로컬 실행을 위한 MVP이며, Galaxy의 다섯 학습 트랙을 탐색하고 곧바로 Buddy와 공부할 수 있습니다.

## 현재 제공하는 경험

- Blue·Red·Green·Black·White의 학습 레포 232개를 트랙·분야·레이어로 탐색
- Blue의 공통 기반, Frontend, Backend, Android, iOS 등 8개 상위 분야와 29개 세부 카테고리
- Red의 AI·수학 9개 경로, Green의 실천지 6개 레이어, Black의 물리 7개 레이어, White의 마음·의식 7개 레이어
- 각 레포의 실제 `챕터 → 학습 항목` 목차를 GitHub 구조에서 자동 구성
- 선택한 Markdown 원문을 Buddy 문맥에 연결해 항목별 학습 시작
- 각 레포와 학습 자료의 GitHub 원문 링크
- `OPENAI_MODEL`로 선택하는 실시간 스트리밍 대화(현재 기본값 GPT-5.6 Luna)
- 첫 이해 → 다시 보기 → 더 깊이의 나선형 학습 단계
- 소크라테스식 질문 중심의 Buddy 프롬프트
- 이해 확인 문제와 8섹션 학습 노트 생성
- 현재 세션을 브라우저 `localStorage`에 임시 보존
- 모바일과 데스크톱 반응형 UI

## 로컬에서 시작하기

필요한 것:

- Node.js `>=22.13.0`
- OpenAI API 키

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`에 실제 API 키를 설정합니다.

```dotenv
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.6-luna
# 선택: 공개 GitHub API 목차 조회 한도를 높일 때만 설정
# GITHUB_TOKEN=github_pat_...
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

API 키는 서버 라우트에서만 읽으며 브라우저 번들에 포함하지 않습니다. OpenAI Responses API 요청은 `store: false`로 전송합니다.

## 다섯 학습 트랙

각 색은 화면 테마가 아니라 서로 다른 지식 축과 GitHub 기관을 뜻합니다.

| 트랙 | 지식 축 | GitHub 기관 | 학습 레포 | 구조 |
|---|---|---|---:|---|
| Blue | Techne · 개발과 시스템 | `iq-dev-lab` | 86 | 공통 기반과 역할별 개발 분야 |
| Red | Episteme · AI와 수학 | `iq-ai-lab` | 48 | 수학에서 최전선 AI까지 9개 경로 |
| Green | Phronesis · 실천적 지혜 | `iq-phronesis-lab` | 31 | 판단 도구에서 종합까지 6개 레이어 |
| Black | Sophia · 물리와 우주 | `iq-physis-lab` | 36 | 물리의 언어에서 양자중력까지 7개 레이어 |
| White | Psyche · 마음과 의식 | `iq-psyche-lab` | 31 | 마음의 언어에서 자아와 종합까지 7개 레이어 |

트랙과 레포의 조합을 고유 식별자로 사용하므로, 다른 기관에 같은 이름의 레포가 생겨도 목차와 GitHub 링크가 섞이지 않습니다. 서버는 사용자가 임의로 기관을 지정하게 하지 않고 카탈로그에 등록된 기관·브랜치만 조회합니다.

### Blue 분류

기존 Backend 중심 분류를 그대로 가져오지 않고, 직군을 넘어 반복되는 내용과 역할별 내용을 분리했습니다.

| 상위 분야 | 레포 수 | 범위 |
|---|---:|---|
| 공통 기반 | 14 | 컴퓨터 시스템, 개발 기본기, 설계·품질, 언어·런타임 |
| Frontend | 13 | 웹 플랫폼, 언어·타입, UI·상태, 도구·성능 |
| Backend | 17 | Java·JVM, Spring, 분산 아키텍처, API |
| Android | 7 | 플랫폼·런타임, Kotlin·Compose, 구조, 성능·빌드 |
| iOS | 7 | 언어·런타임, 수명주기·동시성, UI, 성능 |
| Cross Platform | 4 | 멀티플랫폼 프레임워크, 로컬 우선 동기화 |
| Data & Infrastructure | 18 | DevOps, 데이터베이스, 메시징, 데이터 엔지니어링 |
| Synthesis | 6 | 플랫폼을 가로지르는 공통 실행·UI·캐시 모델 |

Blue 분류의 원본은 `data/catalog.json`, 다섯 트랙의 메타데이터와 추가 네 트랙의 공식 학습 순서는 `data/tracks/*.json`입니다. 각 학습 레포는 트랙 안에서 정확히 한 경로에만 배치했습니다.

레포를 열면 서버가 GitHub의 README와 Markdown 트리를 읽어 `레포 → 챕터 → 학습 항목` 목차를 만듭니다. README의 챕터·항목 표시명을 우선 사용하고, 오래된 형식은 폴더와 파일 이름을 자연스럽게 변환합니다. 실제 레포 slug와 경로는 링크 식별자로만 유지하며 화면에서는 `Deep Dive`, `Compared` 같은 접미사를 표시하지 않습니다.

## 명령어

```bash
npm run dev      # 로컬 개발 서버
npm run build    # 프로덕션 빌드 검증
npm test         # 빌드 + 렌더링 테스트
npm run lint     # 정적 검사
```

## 구조

```text
app/
├── catalog.ts         # 카탈로그 타입·검색용 도우미
├── title-utils.ts     # 레포·챕터 표시명 정규화
├── api/chat/route.ts  # GPT-5.6 Luna 스트리밍 프록시
├── api/repository/    # GitHub 목차·선택 원문 로더
├── globals.css        # 브랜드·반응형 UI
├── layout.tsx         # 서비스 메타데이터
└── page.tsx           # 학습 세션 UI
data/
├── catalog.json       # Blue 86개 레포의 웹 분류 원본
└── tracks/            # 다섯 트랙 메타데이터와 Red·Green·Black·White 학습 경로
```

## 아직 하지 않는 것

- 회원가입과 로그인
- 여러 기기 간 학습 기록 동기화
- 결제와 사용량 제한
- 운영 데이터베이스
- 도메인 연결과 배포

이 항목들은 서비스 운영 단계에서 별도로 설계합니다.

## 기술 기반

- React 19 / Next.js 호환 App Router
- [vinext](https://github.com/cloudflare/vinext) / Vite
- [OpenAI Responses API](https://developers.openai.com/api/docs/guides/responses-vs-chat-completions)
- [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
