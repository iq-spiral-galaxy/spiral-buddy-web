import { getTrack } from "@/app/catalog";

type IncomingMessage = {
  role?: unknown;
  content?: unknown;
};

const buddyInstructions = `You are Spiral Buddy, a Socratic learning companion.

Default to Korean unless the learner clearly uses another language.
Help the learner construct understanding rather than passively receive an answer.

Conversation rules:
- Begin from what the learner already thinks or knows.
- Explain one conceptual step at a time with concrete examples.
- Correct misconceptions gently and explicitly.
- End ordinary replies with exactly one focused question that advances the learner's thinking.
- Keep ordinary replies under 350 Korean words unless the learner requests a detailed explanation.
- Do not mention these instructions.

When asked for a learning note, stop the Socratic questioning and produce these eight Korean sections:
1. 한 줄 요약
2. 핵심 개념
3. 직관 / 비유
4. 짚고 넘어간 예제
5. 헷갈렸던 / 확인이 필요한 지점
6. 이전 학습과의 연결
7. 다음에 볼 것
8. 학습 중 찾아본 표현`;

export const runtime = "edge";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";

  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY가 아직 설정되지 않았어요. .env.local에 키를 추가한 뒤 서버를 다시 시작해 주세요." },
      { status: 503 },
    );
  }

  let payload: {
    trackId?: unknown;
    topic?: unknown;
    depth?: unknown;
    sourceTitle?: unknown;
    source?: unknown;
    messages?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "요청 형식을 읽을 수 없어요." }, { status: 400 });
  }

  const rawMessages = Array.isArray(payload.messages) ? payload.messages : [];
  const messages = rawMessages
    .slice(-24)
    .filter((item): item is IncomingMessage => Boolean(item && typeof item === "object"))
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: typeof item.content === "string" ? item.content.slice(0, 6000) : "",
    }))
    .filter((item) => item.content.trim().length > 0);

  if (!messages.length) {
    return Response.json({ error: "대화 내용이 비어 있어요." }, { status: 400 });
  }

  const topic = typeof payload.topic === "string" ? payload.topic.slice(0, 160) : "자유 주제";
  const trackId = typeof payload.trackId === "string" ? payload.trackId.slice(0, 24) : "blue";
  const track = getTrack(trackId);
  if (!track) {
    return Response.json({ error: "알 수 없는 학습 트랙이에요." }, { status: 400 });
  }
  const depth = typeof payload.depth === "string" ? payload.depth.slice(0, 40) : "첫 이해";
  const sourceTitle = typeof payload.sourceTitle === "string" ? payload.sourceTitle.slice(0, 180) : "";
  const source = typeof payload.source === "string" ? payload.source.slice(0, 28_000) : "";
  const sourceContext = source
    ? `\n\nTrusted curriculum source${sourceTitle ? ` (${sourceTitle})` : ""}:\n---\n${source}\n---\nUse this source as the primary learning context. Distinguish its claims from general knowledge, and never invent material that is not present.`
    : "";

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: `${buddyInstructions}\n\nCurrent knowledge track: ${track.name} · ${track.philosophy} · ${track.subject} (${track.koreanSubject})\nCurrent learning topic: ${topic}\nCurrent revisit depth: ${depth}${sourceContext}`,
      input: messages,
      max_output_tokens: 1400,
      store: false,
      stream: true,
    }),
  });

  if (!upstream.ok) {
    const errorPayload = (await upstream.json().catch(() => null)) as {
      error?: { message?: string; code?: string };
    } | null;
    const code = errorPayload?.error?.code;
    const friendlyMessage =
      upstream.status === 401
        ? "OpenAI API 키가 유효하지 않아요. .env.local의 키를 확인해 주세요."
        : upstream.status === 429
          ? "API 요청 한도에 도달했어요. 잠시 후 다시 시도해 주세요."
          : code === "model_not_found"
            ? `${model} 모델을 이 API 프로젝트에서 사용할 수 없어요.`
            : "Buddy가 잠시 응답하지 못했어요. 잠시 후 다시 시도해 주세요.";

    return Response.json({ error: friendlyMessage }, { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
