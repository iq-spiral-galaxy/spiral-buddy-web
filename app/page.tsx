"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  findRepo,
  getDomainRepoCount,
  getRepoUrl,
  learningDomains,
  repoTitle,
  totalCategoryCount,
  totalRepoCount,
  type LearningCategory,
  type LearningDomain,
} from "@/app/catalog";

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
  tone: string;
  domain?: string;
  category?: string;
  repoSlug?: string;
  repoUrl?: string;
};

type VisibleCategory = {
  category: LearningCategory;
  repos: string[];
};

type VisibleDomain = {
  domain: LearningDomain;
  categories: VisibleCategory[];
};

type CurriculumItem = {
  id: string;
  path: string;
  title: string;
  order: number;
};

type CurriculumChapter = {
  id: string;
  title: string;
  order: number;
  items: CurriculumItem[];
};

type RepositoryCurriculum = {
  repo: string;
  branch: string;
  chapters: CurriculumChapter[];
  chapterCount: number;
  itemCount: number;
  truncated: boolean;
};

type LessonSelection = {
  chapterId: string;
  chapterTitle: string;
  chapterOrder: number;
  itemId: string;
  itemTitle: string;
  itemOrder: number;
  path: string;
};

type LessonSource =
  | { status: "idle" | "loading" }
  | { status: "ready"; content: string }
  | { status: "error"; message: string };

const depthLabels = ["첫 이해", "다시 보기", "더 깊이"];
const sessionStorageKey = "spiral-buddy-session-v3";

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isStoredTopic(value: unknown): value is Topic {
  if (!value || typeof value !== "object") return false;
  const topic = value as Partial<Topic>;
  return typeof topic.id === "string" && typeof topic.title === "string" && typeof topic.eyebrow === "string";
}

function isStoredLesson(value: unknown): value is LessonSelection {
  if (!value || typeof value !== "object") return false;
  const lesson = value as Partial<LessonSelection>;
  return typeof lesson.path === "string" && typeof lesson.itemTitle === "string" && typeof lesson.chapterId === "string";
}

function lessonWelcomeMessage(repoName: string, lesson: LessonSelection): Message {
  return {
    id: createId("buddy"),
    role: "assistant",
    content: `좋아, “${repoName}”의 ${lesson.chapterTitle} 챕터에서 “${lesson.itemTitle}”을 함께 공부해보자.\n\n설명부터 시작하기 전에, 이 항목에서 이미 아는 것 또는 가장 궁금한 지점을 하나만 말해줄래?`,
  };
}

function topicFromRepo(domain: LearningDomain, category: LearningCategory, slug: string): Topic {
  return {
    id: slug,
    eyebrow: `${domain.name} · ${category.name}`,
    title: repoTitle(slug),
    description: category.description,
    tone: domain.color,
    domain: domain.name,
    category: category.name,
    repoSlug: slug,
    repoUrl: getRepoUrl(slug),
  };
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
  const [selectedDomain, setSelectedDomain] = useState("common");
  const [query, setQuery] = useState("");
  const [curriculum, setCurriculum] = useState<RepositoryCurriculum | null>(null);
  const [curriculumStatus, setCurriculumStatus] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  const [curriculumError, setCurriculumError] = useState("");
  const [curriculumReload, setCurriculumReload] = useState(0);
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
  const [activeLesson, setActiveLesson] = useState<LessonSelection | null>(null);
  const [lessonSource, setLessonSource] = useState<LessonSource>({ status: "idle" });
  const conversationEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const restoreSession = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(sessionStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as {
            topic?: unknown;
            topicId?: string;
            lesson?: unknown;
            messages?: Message[];
            depth?: number;
          };
          let restoredTopic = isStoredTopic(parsed.topic) ? parsed.topic : null;

          if (!restoredTopic && parsed.topicId) {
            const repo = findRepo(parsed.topicId);
            if (repo) restoredTopic = topicFromRepo(repo.domain, repo.category, repo.slug);
          }

          if (restoredTopic && Array.isArray(parsed.messages)) {
            setActiveTopic(restoredTopic);
            if (isStoredLesson(parsed.lesson)) setActiveLesson(parsed.lesson);
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
    const persistSession = window.setTimeout(() => {
      window.localStorage.setItem(
        sessionStorageKey,
        JSON.stringify({ topic: activeTopic, topicId: activeTopic.id, lesson: activeLesson, messages, depth }),
      );
    }, 350);
    return () => window.clearTimeout(persistSession);
  }, [activeLesson, activeTopic, depth, hydrated, messages]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOpen]);

  useEffect(() => {
    const repoSlug = activeTopic?.repoSlug;
    if (!repoSlug) return;

    const controller = new AbortController();
    const markLoading = window.setTimeout(() => {
      setCurriculum(null);
      setCurriculumStatus("loading");
      setCurriculumError("");
    }, 0);

    void fetch(`/api/repository?repo=${encodeURIComponent(repoSlug)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as (RepositoryCurriculum & { error?: string }) | null;
        if (!response.ok || !payload) throw new Error(payload?.error || "학습 목차를 불러오지 못했어요.");
        setCurriculum(payload);
        setCurriculumStatus(payload.chapters.length > 0 ? "ready" : "empty");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCurriculumStatus("error");
        setCurriculumError(error instanceof Error ? error.message : "학습 목차를 불러오지 못했어요.");
      });

    return () => {
      window.clearTimeout(markLoading);
      controller.abort();
    };
  }, [activeTopic?.repoSlug, curriculumReload]);

  useEffect(() => {
    if (!activeTopic?.repoSlug || !curriculum?.chapters.length) return;
    const selectInitialLesson = window.setTimeout(() => {
      const selectedStillExists = activeLesson && curriculum.chapters.some(
        (chapter) => chapter.id === activeLesson.chapterId && chapter.items.some((item) => item.path === activeLesson.path),
      );
      if (selectedStillExists) {
        setExpandedChapters((current) => current.includes(activeLesson.chapterId) ? current : [...current, activeLesson.chapterId]);
        return;
      }

      const firstChapter = curriculum.chapters[0];
      const firstItem = firstChapter?.items[0];
      if (!firstChapter || !firstItem) return;
      const firstLesson: LessonSelection = {
        chapterId: firstChapter.id,
        chapterTitle: firstChapter.title,
        chapterOrder: firstChapter.order,
        itemId: firstItem.id,
        itemTitle: firstItem.title,
        itemOrder: firstItem.order,
        path: firstItem.path,
      };
      setActiveLesson(firstLesson);
      setExpandedChapters([firstChapter.id]);
      setMessages([lessonWelcomeMessage(activeTopic.title, firstLesson)]);
    }, 0);
    return () => window.clearTimeout(selectInitialLesson);
  }, [activeLesson, activeTopic?.repoSlug, activeTopic?.title, curriculum]);

  useEffect(() => {
    const repoSlug = activeTopic?.repoSlug;
    const lessonPath = activeLesson?.path;
    if (!repoSlug || !lessonPath) return;

    const controller = new AbortController();
    const markLoading = window.setTimeout(() => setLessonSource({ status: "loading" }), 0);
    void fetch(
      `/api/repository?repo=${encodeURIComponent(repoSlug)}&path=${encodeURIComponent(lessonPath)}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { content?: string; error?: string } | null;
        if (!response.ok || typeof payload?.content !== "string") {
          throw new Error(payload?.error || "학습 원문을 불러오지 못했어요.");
        }
        setLessonSource({ status: "ready", content: payload.content });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLessonSource({
          status: "error",
          message: error instanceof Error ? error.message : "학습 원문을 불러오지 못했어요.",
        });
      });

    return () => {
      window.clearTimeout(markLoading);
      controller.abort();
    };
  }, [activeLesson?.path, activeTopic?.repoSlug]);

  const normalizedQuery = query.trim().toLocaleLowerCase("ko");

  const visibleDomains = useMemo<VisibleDomain[]>(() => {
    const sourceDomains = normalizedQuery
      ? learningDomains
      : selectedDomain === "all"
        ? learningDomains
        : learningDomains.filter((domain) => domain.id === selectedDomain);

    return sourceDomains
      .map((domain) => ({
        domain,
        categories: domain.categories
          .map((category) => ({
            category,
            repos: category.repos.filter((slug) => {
              if (!normalizedQuery) return true;
              const searchableText = [
                slug,
                repoTitle(slug),
                domain.name,
                domain.englishName,
                domain.description,
                category.name,
                category.description,
              ]
                .join(" ")
                .toLocaleLowerCase("ko");
              return searchableText.includes(normalizedQuery);
            }),
          }))
          .filter((category) => category.repos.length > 0),
      }))
      .filter((domain) => domain.categories.length > 0);
  }, [normalizedQuery, selectedDomain]);

  const visibleRepoCount = useMemo(
    () => visibleDomains.reduce(
      (domainTotal, domain) => domainTotal + domain.categories.reduce(
        (categoryTotal, category) => categoryTotal + category.repos.length,
        0,
      ),
      0,
    ),
    [visibleDomains],
  );

  const selectedDomainName = selectedDomain === "all"
    ? "전체 분야"
    : learningDomains.find((domain) => domain.id === selectedDomain)?.name ?? "학습 라이브러리";

  const conversationProgress = useMemo(() => {
    const userTurns = messages.filter((message) => message.role === "user").length;
    return Math.min(100, Math.max(8, userTurns * 18));
  }, [messages]);

  const activeCurriculumChapter = curriculum?.chapters.find((chapter) => chapter.id === activeLesson?.chapterId);
  const progress = activeLesson && activeCurriculumChapter
    ? Math.round(((activeLesson.itemOrder + 1) / activeCurriculumChapter.items.length) * 100)
    : conversationProgress;
  const progressText = activeLesson && activeCurriculumChapter
    ? `${depthLabels[depth]} · ${activeLesson.itemOrder + 1}/${activeCurriculumChapter.items.length}`
    : `${depthLabels[depth]} · 흐름 ${progress}%`;

  function startTopic(topic: Topic) {
    setActiveTopic(topic);
    setCurriculum(null);
    setCurriculumStatus(topic.repoSlug ? "loading" : "idle");
    setExpandedChapters([]);
    setActiveLesson(null);
    setLessonSource({ status: "idle" });
    setDepth(0);
    setNotice(null);
    setSidebarOpen(false);
    setMessages(topic.repoSlug ? [] : [{
      id: createId("buddy"),
      role: "assistant",
      content: `좋아, 네가 고른 주제에서 출발해보자.\n\n지금 공부하고 싶은 것과 이미 알고 있는 부분을 짧게 적어줄래?`,
    }]);
  }

  function selectLesson(chapter: CurriculumChapter, item: CurriculumItem) {
    const lesson: LessonSelection = {
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      chapterOrder: chapter.order,
      itemId: item.id,
      itemTitle: item.title,
      itemOrder: item.order,
      path: item.path,
    };
    setActiveLesson(lesson);
    setExpandedChapters((current) => current.includes(chapter.id) ? current : [...current, chapter.id]);
    setMessages([lessonWelcomeMessage(activeTopic?.title ?? "이 레포", lesson)]);
    setDraft("");
    setDepth(0);
    setNotice(null);
  }

  function toggleChapter(chapterId: string) {
    setExpandedChapters((current) =>
      current.includes(chapterId)
        ? current.filter((id) => id !== chapterId)
        : [...current, chapterId],
    );
  }

  function returnToCatalog() {
    setActiveTopic(null);
    setMessages([]);
    setCurriculum(null);
    setCurriculumStatus("idle");
    setCurriculumError("");
    setExpandedChapters([]);
    setActiveLesson(null);
    setLessonSource({ status: "idle" });
    setDraft("");
    setDepth(0);
    setNotice(null);
    setSidebarOpen(false);
  }

  function showDomain(domainId: string) {
    returnToCatalog();
    setSelectedDomain(domainId);
    setQuery("");
  }

  async function sendMessage(override?: string) {
    const content = (override ?? draft).trim();
    if (!content || isStreaming || !activeTopic || (activeTopic.repoSlug && !activeLesson)) return;

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
          topic: activeLesson
            ? `${activeLesson.itemTitle} · ${activeLesson.chapterTitle} · ${activeTopic.title}`
            : activeTopic.title,
          sourceTitle: activeLesson?.itemTitle,
          source: lessonSource.status === "ready" ? lessonSource.content : undefined,
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
        aria-label={sidebarOpen ? "학습 메뉴 닫기" : "학습 메뉴 열기"}
        aria-expanded={sidebarOpen}
        aria-controls="learning-sidebar"
        onClick={() => setSidebarOpen((open) => !open)}
      >
        <span />
        <span />
      </button>

      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          type="button"
          aria-label="학습 메뉴 닫기"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside id="learning-sidebar" className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <button className="brand-lockup" type="button" onClick={returnToCatalog}>
          <span className="brand-mark" aria-hidden="true">
            <i />
          </span>
          <span>
            <strong>Spiral Buddy</strong>
          </span>
        </button>

        <nav className="domain-nav" aria-label="학습 분야">
          <p className="nav-label">LEARNING DOMAINS</p>
          <button
            className={`domain-nav-item ${selectedDomain === "all" ? "domain-nav-active" : ""}`}
            type="button"
            onClick={() => showDomain("all")}
            aria-pressed={selectedDomain === "all"}
          >
            <span className="domain-nav-symbol" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="1.5" width="5" height="5" rx="1.2" />
                <rect x="9.5" y="1.5" width="5" height="5" rx="1.2" />
                <rect x="1.5" y="9.5" width="5" height="5" rx="1.2" />
                <rect x="9.5" y="9.5" width="5" height="5" rx="1.2" />
              </svg>
            </span>
            <span><strong>전체 분야</strong><small>Complete library</small></span>
            <em>{totalRepoCount}</em>
          </button>
          {learningDomains.map((domain) => (
            <button
              className={`domain-nav-item ${selectedDomain === domain.id ? "domain-nav-active" : ""}`}
              type="button"
              key={domain.id}
              onClick={() => showDomain(domain.id)}
              aria-pressed={selectedDomain === domain.id}
              style={{ "--domain-color": domain.color } as React.CSSProperties}
            >
              <span className="domain-nav-symbol"><i /></span>
              <span><strong>{domain.name}</strong><small>{domain.englishName}</small></span>
              <em>{getDomainRepoCount(domain)}</em>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="local-note">
          <span aria-hidden="true">⌂</span>
          <p><strong>Local preview</strong>대화는 이 브라우저에만 임시 저장돼요.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button type="button" onClick={returnToCatalog}>학습 라이브러리</button>
            <span>/</span>
            <strong>{activeTopic?.title ?? selectedDomainName}</strong>
          </div>
          <div className="topbar-actions">
            {activeTopic ? (
              <>
                <button className="quiet-button" type="button" onClick={returnToCatalog}>
                  레포 목록
                </button>
                <div className="depth-control" aria-label="학습 깊이">
                  {depthLabels.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      className={depth === index ? "depth-active" : ""}
                      onClick={() => setDepth(index)}
                      aria-label={label}
                      aria-pressed={depth === index}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <span className="catalog-count">{totalRepoCount} REPOSITORIES</span>
            )}
          </div>
        </header>

        {!activeTopic ? (
          <section className="catalog-view">
            <div className="ambient-orbit orbit-one" />
            <div className="ambient-orbit orbit-two" />

            <div className="catalog-intro">
              <div className="welcome-copy">
                <p className="eyebrow">ONE LIBRARY · EVERY SOFTWARE PATH</p>
                <h1>흩어진 공부를,<br />하나의 <span>지도</span>로.</h1>
                <p className="welcome-description">
                  공통 기반은 함께 묶고, Frontend·Backend·Android·iOS는 분명하게 나눴어요.
                  레포를 고르면 그 자리에서 Buddy와 학습을 시작할 수 있습니다.
                </p>
              </div>

              <dl className="catalog-stats" aria-label="학습 라이브러리 규모">
                <div><dt>{totalRepoCount}</dt><dd>학습 레포</dd></div>
                <div><dt>{learningDomains.length}</dt><dd>상위 분야</dd></div>
                <div><dt>{totalCategoryCount}</dt><dd>세부 카테고리</dd></div>
              </dl>
            </div>

            <section className="catalog-browser" aria-labelledby="catalog-title">
              <div className="catalog-heading">
                <div>
                  <p>학습 라이브러리</p>
                  <h2 id="catalog-title">직접 살펴보고 시작하세요</h2>
                </div>
                <span>CURATED FROM IQ-DEV-LAB</span>
              </div>

              <div className="catalog-controls">
                <div className="search-field">
                  <label className="sr-only" htmlFor="repo-search">레포 검색</label>
                  <span aria-hidden="true">⌕</span>
                  <input
                    id="repo-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="레포, 기술, 카테고리 검색"
                    autoComplete="off"
                  />
                  {query && <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>}
                </div>

                <div className="domain-filter" aria-label="분야 필터">
                  <button
                    type="button"
                    className={selectedDomain === "all" ? "filter-active" : ""}
                    onClick={() => showDomain("all")}
                    aria-pressed={selectedDomain === "all"}
                  >
                    전체 <span>{totalRepoCount}</span>
                  </button>
                  {learningDomains.map((domain) => (
                    <button
                      type="button"
                      key={domain.id}
                      className={selectedDomain === domain.id ? "filter-active" : ""}
                      onClick={() => showDomain(domain.id)}
                      aria-pressed={selectedDomain === domain.id}
                    >
                      {domain.name} <span>{getDomainRepoCount(domain)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="catalog-result-status" role="status" aria-live="polite">
                {normalizedQuery
                  ? `전체 분야에서 “${query.trim()}” 검색 · ${visibleRepoCount}개 레포`
                  : `${selectedDomainName} · ${visibleRepoCount}개 레포`}
              </p>

              <div className="catalog-results">
                {visibleDomains.map(({ domain, categories }, domainIndex) => (
                  <section
                    className="domain-section"
                    key={domain.id}
                    style={{ "--domain-color": domain.color } as React.CSSProperties}
                  >
                    <header className="domain-section-header">
                      <span className="domain-number">{String(domainIndex + 1).padStart(2, "0")}</span>
                      <div>
                        <p>{domain.englishName}</p>
                        <h3>{domain.name}</h3>
                        <span>{domain.description}</span>
                      </div>
                      <strong>{categories.reduce((total, category) => total + category.repos.length, 0)}</strong>
                    </header>

                    <div className="category-list">
                      {categories.map(({ category, repos }) => (
                        <section className="category-section" key={category.id} aria-labelledby={`${domain.id}-${category.id}`}>
                          <header className="category-header">
                            <div>
                              <h4 id={`${domain.id}-${category.id}`}>{category.name}</h4>
                              <p>{category.description}</p>
                            </div>
                            <span>{repos.length}</span>
                          </header>

                          <div className="repo-grid">
                            {repos.map((slug) => (
                              <article className="repo-card" key={slug}>
                                <div className="repo-card-meta">
                                  <span>{category.name}</span>
                                  <a
                                    href={getRepoUrl(slug)}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label={`${repoTitle(slug)} GitHub 레포 열기`}
                                  >
                                    GitHub ↗
                                  </a>
                                </div>
                                <h5>{repoTitle(slug)}</h5>
                                <button type="button" onClick={() => startTopic(topicFromRepo(domain, category, slug))}>
                                  목차 보기 <span>→</span>
                                </button>
                              </article>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </section>
                ))}

                {visibleDomains.length === 0 && (
                  <div className="empty-catalog">
                    <span aria-hidden="true">⌕</span>
                    <h3>일치하는 레포가 없어요</h3>
                    <p>기술 이름이나 GitHub 레포 이름의 일부로 다시 검색해보세요.</p>
                    <button type="button" onClick={() => setQuery("")}>전체 목록으로 돌아가기</button>
                  </div>
                )}
              </div>

              <button className="custom-start" type="button" onClick={() => startTopic({
                id: "custom",
                eyebrow: "Your own question",
                title: "내가 고른 주제",
                description: "",
                tone: "#315ee7",
              })}>
                <span>＋</span>
                <div><strong>레포 밖의 주제로 시작하기</strong><small>지금 궁금한 것을 자유롭게 물어보세요</small></div>
                <b>→</b>
              </button>
            </section>
          </section>
        ) : (
          <section
            className={`session-view ${activeTopic.repoSlug ? "repository-session" : ""}`}
            style={{ "--topic-tone": activeTopic.tone } as React.CSSProperties}
          >
            <div className="session-header">
              <div>
                <p className="eyebrow">{activeTopic.eyebrow}</p>
                <h1>{activeTopic.title}</h1>
                {activeTopic.repoSlug && (
                  <div className="session-repo">
                    <a href={activeTopic.repoUrl} target="_blank" rel="noreferrer">GitHub에서 보기 ↗</a>
                    {curriculum && <span>{curriculum.chapterCount}개 챕터 · {curriculum.itemCount}개 학습 항목</span>}
                  </div>
                )}
              </div>
              <div className="session-progress" aria-label={`학습 흐름 ${progress}%`}>
                <div><span style={{ width: `${progress}%` }} /></div>
                <small>{progressText}</small>
              </div>
            </div>

            <div className={activeTopic.repoSlug ? "study-layout" : "study-layout study-layout-free"}>
              {activeTopic.repoSlug && (
                <aside
                  className="curriculum-panel"
                  aria-label={`${activeTopic.title} 학습 목차`}
                  aria-busy={curriculumStatus === "loading"}
                >
                  <header className="curriculum-header">
                    <p>CURRICULUM</p>
                    <h2>학습 목차</h2>
                    <span>
                      {curriculum
                        ? `${curriculum.chapterCount} 챕터 · ${curriculum.itemCount} 항목`
                        : "레포 구조를 불러오는 중"}
                    </span>
                  </header>

                  {curriculumStatus === "loading" && (
                    <div className="curriculum-loading" role="status">
                      <span /><span /><span /><span />
                    </div>
                  )}

                  {curriculumStatus === "error" && (
                    <div className="curriculum-state" role="alert">
                      <strong>목차를 불러오지 못했어요</strong>
                      <p>{curriculumError}</p>
                      <button type="button" onClick={() => setCurriculumReload((value) => value + 1)}>다시 불러오기</button>
                      <a href={activeTopic.repoUrl} target="_blank" rel="noreferrer">GitHub에서 직접 보기 ↗</a>
                    </div>
                  )}

                  {curriculumStatus === "empty" && (
                    <div className="curriculum-state" role="status">
                      <strong>표시할 학습 항목이 없어요</strong>
                      <p>README를 제외한 Markdown 문서를 찾지 못했습니다.</p>
                      <a href={activeTopic.repoUrl} target="_blank" rel="noreferrer">GitHub에서 직접 보기 ↗</a>
                    </div>
                  )}

                  {curriculumStatus === "ready" && curriculum && (
                    <div className="curriculum-chapters">
                      {curriculum.chapters.map((chapter) => {
                        const expanded = expandedChapters.includes(chapter.id);
                        const activeChapter = activeLesson?.chapterId === chapter.id;
                        const panelId = `curriculum-${chapter.id.replace(/[^a-z0-9_-]/gi, "-")}`;
                        return (
                          <section className={`curriculum-chapter ${activeChapter ? "curriculum-chapter-active" : ""}`} key={chapter.id}>
                            <button
                              className="curriculum-chapter-button"
                              type="button"
                              aria-expanded={expanded}
                              aria-controls={panelId}
                              onClick={() => toggleChapter(chapter.id)}
                            >
                              <span>{String(chapter.order + 1).padStart(2, "0")}</span>
                              <strong>{chapter.title}</strong>
                              <em>{chapter.items.length}</em>
                              <i aria-hidden="true">⌄</i>
                            </button>
                            <div id={panelId} hidden={!expanded}>
                              <ol className="curriculum-items">
                                {chapter.items.map((item) => {
                                  const selected = activeLesson?.path === item.path;
                                  return (
                                    <li key={item.id}>
                                      <button
                                        type="button"
                                        className={selected ? "curriculum-item-active" : ""}
                                        aria-current={selected ? "step" : undefined}
                                        onClick={() => selectLesson(chapter, item)}
                                      >
                                        <span>{String(item.order + 1).padStart(2, "0")}</span>
                                        <strong>{item.title}</strong>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ol>
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  )}
                </aside>
              )}

              <div className="session-main">
                {activeTopic.repoSlug && activeLesson && (
                  <header className="lesson-context">
                    <span className="lesson-index">{activeLesson.chapterOrder + 1}.{activeLesson.itemOrder + 1}</span>
                    <div>
                      <p>{activeLesson.chapterTitle}</p>
                      <h2>{activeLesson.itemTitle}</h2>
                      <span className={`source-status source-${lessonSource.status}`}>
                        <i />
                        {lessonSource.status === "ready" && "GitHub 원문 연결됨"}
                        {lessonSource.status === "loading" && "GitHub 원문 연결 중"}
                        {lessonSource.status === "idle" && "학습 원문 준비 중"}
                        {lessonSource.status === "error" && "원문 연결 실패 · 일반 지식으로 진행"}
                      </span>
                    </div>
                  </header>
                )}

                {activeTopic.repoSlug && !activeLesson ? (
                  <div className="session-await" role="status">
                    <span aria-hidden="true">↻</span>
                    <h2>{curriculumStatus === "error" ? "목차 연결을 확인해 주세요" : "학습 목차를 준비하고 있어요"}</h2>
                    <p>챕터와 학습 항목을 찾으면 첫 항목부터 시작할 수 있게 열어둘게요.</p>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
