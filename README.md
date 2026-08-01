# 🌀 Spiral Buddy

질문하고, 연결하고, 다시 설명하며 이해를 쌓는 웹 기반 AI 학습 버디입니다.

이 저장소는 Electron 데스크톱 앱과 분리된 **Spiral Buddy 웹 서비스**입니다. 현재 버전은 로컬 실행을 위한 MVP이며, `iq-dev-lab`의 학습 레포를 새로운 공통 분류로 탐색하고 곧바로 Buddy와 공부할 수 있습니다.

## 현재 제공하는 경험

- `iq-dev-lab`의 학습 레포 86개를 검색·분야·카테고리로 탐색
- 공통 기반, Frontend, Backend, Android, iOS 등 8개 상위 분야와 29개 세부 카테고리
- 각 레포의 실제 `챕터 → 학습 항목` 목차를 GitHub 구조에서 자동 구성
- 선택한 Markdown 원문을 Buddy 문맥에 연결해 항목별 학습 시작
- 각 레포와 학습 자료의 GitHub 원문 링크
- GPT-5.6 Luna를 사용한 실시간 스트리밍 대화
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

## 학습 카탈로그

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

카탈로그의 단일 원본은 `data/catalog.json`입니다. 각 학습 레포는 정확히 한 카테고리에만 배치되어 총계와 탐색 기준이 흔들리지 않도록 했습니다.

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
├── api/chat/route.ts  # GPT-5.6 Luna 스트리밍 프록시
├── api/repository/    # GitHub 목차·선택 원문 로더
├── globals.css        # 브랜드·반응형 UI
├── layout.tsx         # 서비스 메타데이터
└── page.tsx           # 학습 세션 UI
data/
└── catalog.json       # 86개 레포의 독립적인 웹 분류 원본
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
