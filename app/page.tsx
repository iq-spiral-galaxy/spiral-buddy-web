"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
};

type Topic = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  prompt: string;
  tone: string;
};

const topics: Topic[] = [
  {
    id: "event-loop",
    eyebrow: "JavaScript · Foundations",
    title: "이벤트 루프를 내 언어로",
    description: "콜 스택과 태스크 큐가 실제 실행 순서를 어떻게 만드는지 따라가요.",
    prompt: "JavaScript 이벤트 루프를 배우고 싶어. 내가 이미 아는 수준부터 확인해줘.",
    tone: "#315ee7",
  },
  {
    id: "database-index",
    eyebrow: "Database · Backend",
    title: "인덱스는 왜 빠를까",
    description: "B-Tree의 모양보다 먼저, 탐색 비용이 줄어드는 직관을 만들어요.",
    prompt: "데이터베이스 인덱스가 왜 조회를 빠르게 하는지 직관부터 배우고 싶어.",
    tone: "#9b5de5",
  },
  {
    id: "distributed-system",
    eyebrow: "Architecture · Systems",
    title: "분산 시스템의 첫 균열",
    description: "두 서버가 같은 사실을 다르게 볼 때 생기는 선택을 탐색해요.",
    prompt: "분산 시스템에서 일관성과 가용성 사이의 선택을 사례로 이해하고 싶어.",
    tone: "#e85d75",
  },
];

const depthLabels = ["첫 이해", "다시 보기", "더 깊이"];
const sessionStorageKey = "spiral-buddy-session-v1";

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Home() {
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [depth, setDepth] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const restoreSession = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(sessionStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as {
            topicId?: string;
            messages?: Message[];
            depth?: number;
          };
          const restoredTopic = topics.find((topic) => topic.id === parsed.topicId);
          if (restoredTopic && Array.isArray(parsed.messages)) {
            setActiveTopic(restoredTopic);
            setMessages(parsed.messages.slice(-30));
            setDepth(Math.min(Math.max(parsed.depth ?? 0, 0), 2));
          }
        }
      } catch {
        window.localStorage.removeItem(sessionStorageKey);
      } finally {
        setHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(restoreSession);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!activeTopic) {
      window.localStorage.removeItem(sessionStorageKey);
      return;
    }
    window.localStorage.setItem(
      sessionStorageKey,
      JSON.stringify({ topicId: activeTopic.id, messages, depth }),
    );
  }, [activeTopic, depth, hydrated, messages]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  const progress = useMemo(() => {
    const userTurns = messages.filter((message) => message.role === "user").length;
    return Math.min(100, Math.max(8, userTurns * 18));
  }, [messages]);

  function startTopic(topic: Topic) {
    setActiveTopic(topic);
    setDepth(0);
    setNotice(null);
    setSidebarOpen(false);
    setMessages([
      {
        id: createId("buddy"),
        role: "assistant",
        content: `좋아, 오늘은 “${topic.title}”을 함께 풀어보자.\n\n설명부터 시작하지 않을게. 지금 이 주제에 대해 떠오르는 이미지나 이미 알고 있는 사실이 하나라도 있어?`,
      },
    ]);
  }

  function resetSession() {
    setActiveTopic(null);
    setMessages([]);
    setDraft("");
    setDepth(0);
    setNotice(null);
    setSidebarOpen(false);
  }

  async function sendMessage(override?: string) {
    const content = (override ?? draft).trim();
    if (!content || isStreaming || !activeTopic) return;

    const userMessage: Message = { id: createId("user"), role: "user", content };
    const assistantId = createId("buddy");
    const nextMessages = [...messages, userMessage];

    setDraft("");
    setNotice(null);
    setIsStreaming(true);
    setMessages([...nextMessages, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: activeTopic.title,
          depth: depthLabels[depth],
          messages: nextMessages.map(({ role, content: messageContent }) => ({
            role,
            content: messageContent,
          })),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Buddy와 연결하지 못했어요.");
      }

      if (!response.body) throw new Error("응답 스트림을 열지 못했어요.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedText = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const data = block
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("");
          if (!data || data === "[DONE]") continue;

          try {
            const event = JSON.parse(data) as {
              type?: string;
              delta?: string;
              error?: { message?: string };
            };
            if (event.type === "response.output_text.delta" && event.delta) {
              receivedText = true;
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: message.content + event.delta }
                    : message,
                ),
              );
            }
            if (event.type === "error") {
              throw new Error(event.error?.message || "응답 중 오류가 발생했어요.");
            }
          } catch (error) {
            if (error instanceof SyntaxError) continue;
            throw error;
          }
        }
      }

      if (!receivedText) throw new Error("Buddy가 빈 응답을 보냈어요. 다시 시도해 주세요.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.";
      setMessages((current) => current.filter((item) => item.id !== assistantId));
      setNotice(message);
    } finally {
      setIsStreaming(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <main className="app-shell">
      <button
        className="mobile-menu"
        type="button"
        aria-label="학습 메뉴 열기"
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen((open) => !open)}
      >
        <span />
        <span />
      </button>

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand-lockup" onClick={resetSession} role="button" tabIndex={0}>
          <div className="brand-mark" aria-hidden="true">
            <i />
          </div>
          <div>
            <strong>Spiral Buddy</strong>
            <span>배움은 다시 돌아올 때 깊어진다</span>
          </div>
        </div>

        <nav className="track-nav" aria-label="학습 트랙">
          <p className="nav-label">LEARNING TRACKS</p>
          <button className="track-item track-active" type="button">
            <span className="track-orb orb-blue" />
            <span>
              <strong>Blue</strong>
              <small>Software & Systems</small>
            </span>
            <em>01</em>
          </button>
          <button className="track-item" type="button" disabled>
            <span className="track-orb orb-red" />
            <span>
              <strong>Red</strong>
              <small>AI & Mathematics</small>
            </span>
            <em>곧</em>
          </button>
          <button className="track-item" type="button" disabled>
            <span className="track-orb orb-green" />
            <span>
              <strong>Green</strong>
              <small>Practical Wisdom</small>
            </span>
            <em>곧</em>
          </button>
        </nav>

        <div className="sidebar-spacer" />

        <section className="model-card" aria-label="현재 AI 모델">
          <div className="model-status"><span /> LIVE MODEL</div>
          <strong>GPT-5.6 Luna</strong>
          <p>빠르고 가벼운 대화를 위해 연결된 학습 버디</p>
        </section>

        <div className="local-note">
          <span aria-hidden="true">⌂</span>
          <p><strong>Local preview</strong>대화는 이 브라우저에만 임시 저장돼요.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button type="button" onClick={resetSession}>Blue</button>
            <span>/</span>
            <strong>{activeTopic?.title ?? "오늘의 학습"}</strong>
          </div>
          <div className="topbar-actions">
            {activeTopic && (
              <button className="quiet-button" type="button" onClick={resetSession}>
                새 세션
              </button>
            )}
            <div className="depth-control" aria-label="학습 깊이">
              {depthLabels.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className={depth === index ? "depth-active" : ""}
                  onClick={() => setDepth(index)}
                  aria-label={label}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
        </header>

        {!activeTopic ? (
          <section className="welcome-view">
            <div className="ambient-orbit orbit-one" />
            <div className="ambient-orbit orbit-two" />
            <div className="welcome-copy">
              <p className="eyebrow">A SOCRATIC LEARNING COMPANION</p>
              <h1>아는 것에서 출발해,<br /><span>이해한 것</span>으로 돌아오세요.</h1>
              <p className="welcome-description">
                Spiral Buddy는 답을 먼저 건네지 않아요. 질문하고, 연결하고,
                다시 설명하면서 당신만의 이해를 함께 만듭니다.
              </p>
            </div>

            <div className="topic-heading">
              <div>
                <p>오늘의 시작점</p>
                <h2>하나를 골라 천천히 파고들어요</h2>
              </div>
              <span>BLUE · 3 TOPICS</span>
            </div>

            <div className="topic-grid">
              {topics.map((topic, index) => (
                <button
                  className="topic-card"
                  key={topic.id}
                  type="button"
                  onClick={() => startTopic(topic)}
                  style={{ "--topic-tone": topic.tone } as React.CSSProperties}
                >
                  <span className="topic-index">0{index + 1}</span>
                  <div className="topic-line" />
                  <p>{topic.eyebrow}</p>
                  <h3>{topic.title}</h3>
                  <span className="topic-description">{topic.description}</span>
                  <span className="topic-cta">학습 시작 <b>↗</b></span>
                </button>
              ))}
            </div>

            <button className="custom-start" type="button" onClick={() => startTopic({
              id: "custom",
              eyebrow: "Your own question",
              title: "내가 고른 주제",
              description: "",
              prompt: "내가 고른 주제로 학습하고 싶어.",
              tone: "#315ee7",
            })}>
              <span>＋</span>
              <div><strong>다른 주제로 시작하기</strong><small>지금 궁금한 것을 자유롭게 물어보세요</small></div>
              <b>→</b>
            </button>
          </section>
        ) : (
          <section className="session-view">
            <div className="session-header">
              <div>
                <p className="eyebrow">BLUE · {activeTopic.eyebrow}</p>
                <h1>{activeTopic.title}</h1>
              </div>
              <div className="session-progress" aria-label={`학습 흐름 ${progress}%`}>
                <div><span style={{ width: `${progress}%` }} /></div>
                <small>{depthLabels[depth]} · 흐름 {progress}%</small>
              </div>
            </div>

            <div className="conversation" aria-live="polite">
              {messages.map((message) => (
                <article className={`message message-${message.role}`} key={message.id}>
                  <div className="message-avatar" aria-hidden="true">
                    {message.role === "assistant" ? <i /> : "나"}
                  </div>
                  <div className="message-body">
                    <p className="message-author">{message.role === "assistant" ? "BUDDY" : "YOU"}</p>
                    <div className="message-content">
                      {message.content || <span className="typing"><i /><i /><i /></span>}
                    </div>
                  </div>
                </article>
              ))}
              <div ref={conversationEndRef} />
            </div>

            {notice && (
              <div className="notice" role="alert">
                <span>!</span>
                <p>{notice}</p>
                <button type="button" onClick={() => setNotice(null)}>닫기</button>
              </div>
            )}

            <div className="session-tools">
              <button
                type="button"
                disabled={isStreaming || messages.length < 2}
                onClick={() => void sendMessage("지금까지 나눈 학습 대화를 Spiral Buddy의 8섹션 학습 노트로 정리해줘.")}
              >
                <span>✦</span> 지금까지 노트로 정리
              </button>
              <button
                type="button"
                disabled={isStreaming}
                onClick={() => void sendMessage("방금까지의 이해를 확인할 수 있는 짧은 적용 문제를 하나만 내줘.")}
              >
                <span>?</span> 이해 확인
              </button>
            </div>

            <form className="composer" onSubmit={submit}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="지금 떠오른 생각이나 막힌 지점을 적어보세요…"
                rows={2}
                maxLength={6000}
                aria-label="Buddy에게 보낼 메시지"
              />
              <div className="composer-footer">
                <span><kbd>Enter</kbd> 보내기 · <kbd>Shift Enter</kbd> 줄바꿈</span>
                <button type="submit" disabled={!draft.trim() || isStreaming} aria-label="메시지 보내기">
                  <span>↑</span>
                </button>
              </div>
            </form>
          </section>
        )}
      </section>
    </main>
  );
}
