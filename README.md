# 🌀 Spiral Buddy

질문하고, 연결하고, 다시 설명하며 이해를 쌓는 웹 기반 AI 학습 버디입니다.

이 저장소는 Electron 데스크톱 앱과 분리된 **Spiral Buddy 웹 서비스**입니다. 현재 버전은 로컬 실행을 위한 MVP이며, 첫 학습 트랙으로 **Blue — Software & Systems**를 제공합니다.

## 현재 제공하는 경험

- 세 가지 Blue 추천 주제와 자유 주제 학습
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
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

API 키는 서버 라우트에서만 읽으며 브라우저 번들에 포함하지 않습니다. OpenAI Responses API 요청은 `store: false`로 전송합니다.

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
├── api/chat/route.ts  # GPT-5.6 Luna 스트리밍 프록시
├── globals.css        # 브랜드·반응형 UI
├── layout.tsx         # 서비스 메타데이터
└── page.tsx           # 학습 세션 UI
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
