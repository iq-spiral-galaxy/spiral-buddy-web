import { findRepo, learningTitle } from "@/app/catalog";

type GitHubTreeEntry = {
  path?: string;
  type?: string;
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

const markdownExtension = /\.md$/i;
const readmeName = /(^|\/)readme\.md$/i;
const naturalCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export const runtime = "edge";

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN?.trim();
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "spiral-buddy-web",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function normalizePath(value: string) {
  return value
    .replace(/^\.\//, "")
    .replace(/#.*$/, "")
    .split("/")
    .map((part) => decodeURIComponent(part))
    .join("/");
}

function cleanDisplayTitle(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/[*_`]/g, "")
    .replace(/^\s*(?:🔹|🔸|📘|📗|📙|📕|🟢|🔵|🟣|🟠|⚫|🧭|🗺️|📚)\s*/u, "")
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/\bdeep\s+dive\b/gi, "")
    .replace(/\bcompared\b/gi, "")
    .replace(/\bdistilled\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function readmeMetadata(readme: string) {
  const itemTitles = new Map<string, string>();
  const pathOrder = new Map<string, number>();
  const links: Array<{ path: string; index: number }> = [];
  const linkPattern = /\[([^\]]+)\]\((?:\.\/)?([^\s)#]+\.md)(?:#[^)]*)?\)/gi;
  let link: RegExpExecArray | null;
  let order = 0;

  while ((link = linkPattern.exec(readme)) !== null) {
    const path = normalizePath(link[2]!);
    if (readmeName.test(path)) continue;
    const title = cleanDisplayTitle(link[1]!);
    if (!pathOrder.has(path)) pathOrder.set(path, order++);
    if (title && !title.includes("![") && !itemTitles.has(path)) itemTitles.set(path, title);
    links.push({ path, index: link.index });
  }

  const chapterTitles = new Map<string, string>();
  const headings = [...readme.matchAll(/^###\s+(.+)$/gm)];
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index]!;
    const start = heading.index ?? 0;
    const end = headings[index + 1]?.index ?? readme.length;
    const headingText = cleanDisplayTitle(heading[1]!);
    const chapterMatch = headingText.match(/(?:chapter|챕터|ch)\s*\d+\s*[:—–-]?\s*(.+)$/i);
    if (!chapterMatch?.[1]) continue;

    const firstLink = links.find((candidate) => candidate.index > start && candidate.index < end);
    if (!firstLink) continue;
    const directory = firstLink.path.includes("/")
      ? firstLink.path.split("/")[0]!
      : "root";
    chapterTitles.set(directory, cleanDisplayTitle(chapterMatch[1]));
  }

  return { itemTitles, pathOrder, chapterTitles };
}

function buildCurriculum(paths: string[], readme: string): CurriculumChapter[] {
  const metadata = readmeMetadata(readme);
  const grouped = new Map<string, string[]>();

  for (const path of paths) {
    const directory = path.includes("/") ? path.split("/")[0]! : "root";
    const current = grouped.get(directory) ?? [];
    current.push(path);
    grouped.set(directory, current);
  }

  const chapters = [...grouped.entries()]
    .filter(([, items]) => items.length >= 2)
    .map(([directory, items]) => {
      const sortedItems = [...items].sort((left, right) => {
        const leftOrder = metadata.pathOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = metadata.pathOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return naturalCollator.compare(left, right);
      });
      const directoryOrder = Math.min(
        ...sortedItems.map((item) => metadata.pathOrder.get(item) ?? Number.MAX_SAFE_INTEGER),
      );
      return {
        id: directory,
        title: metadata.chapterTitles.get(directory) ?? (directory === "root" ? "전체 과정" : learningTitle(directory)),
        order: directoryOrder,
        items: sortedItems.map((path, itemIndex) => ({
          id: path,
          path,
          title: metadata.itemTitles.get(path) ?? learningTitle(path),
          order: itemIndex,
        })),
      };
    });

  return chapters
    .sort((left, right) => {
      if (left.order !== right.order) return left.order - right.order;
      return naturalCollator.compare(left.id, right.id);
    })
    .map((chapter, index) => ({ ...chapter, order: index }));
}

function cacheHeaders(maxAge = 3600) {
  return {
    "Cache-Control": `public, max-age=${maxAge}, s-maxage=86400, stale-while-revalidate=604800`,
  };
}

function repositoryError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const trackId = url.searchParams.get("track")?.trim() || "blue";
  const repo = url.searchParams.get("repo")?.trim() ?? "";
  const contentPath = url.searchParams.get("path")?.trim();
  const repoLocation = findRepo(repo, trackId);

  if (!repo || !repoLocation) {
    return repositoryError("학습 카탈로그에 없는 레포예요.", 404);
  }

  const { organization, defaultBranch } = repoLocation.track;

  if (contentPath) {
    if (
      !markdownExtension.test(contentPath) ||
      contentPath.includes("..") ||
      contentPath.startsWith("/") ||
      contentPath.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(contentPath) ||
      contentPath.length > 600 ||
      readmeName.test(contentPath)
    ) {
      return repositoryError("올바른 학습 문서 경로가 아니에요.", 400);
    }

    const encodedPath = contentPath.split("/").map(encodeURIComponent).join("/");
    const sourceResponse = await fetch(
      `https://raw.githubusercontent.com/${organization}/${encodeURIComponent(repo)}/${defaultBranch}/${encodedPath}`,
    );

    if (!sourceResponse.ok) {
      return repositoryError("선택한 학습 문서의 원문을 불러오지 못했어요.", sourceResponse.status === 404 ? 404 : 502);
    }

    const content = (await sourceResponse.text()).slice(0, 40_000);
    return Response.json(
      { track: trackId, organization, repo, path: contentPath, title: learningTitle(contentPath), content },
      { headers: cacheHeaders(3600) },
    );
  }

  const [treeResponse, readmeResponse] = await Promise.all([
    fetch(
      `https://api.github.com/repos/${organization}/${encodeURIComponent(repo)}/git/trees/${defaultBranch}?recursive=1`,
      { headers: githubHeaders() },
    ),
    fetch(
      `https://raw.githubusercontent.com/${organization}/${encodeURIComponent(repo)}/${defaultBranch}/README.md`,
    ),
  ]);

  if (!treeResponse.ok) {
    const rateLimited = treeResponse.status === 403 || treeResponse.status === 429;
    return repositoryError(
      rateLimited
        ? "GitHub 목차 요청 한도에 도달했어요. 잠시 후 다시 시도해 주세요."
        : "레포의 학습 목차를 불러오지 못했어요.",
      rateLimited ? 503 : 502,
    );
  }

  const treePayload = (await treeResponse.json()) as {
    tree?: GitHubTreeEntry[];
    truncated?: boolean;
  };
  const paths = (treePayload.tree ?? [])
    .filter((entry) => entry.type === "blob" && entry.path && markdownExtension.test(entry.path) && !readmeName.test(entry.path))
    .map((entry) => normalizePath(entry.path!));
  const readme = readmeResponse.ok ? await readmeResponse.text() : "";
  const chapters = buildCurriculum(paths, readme);
  const itemCount = chapters.reduce((total, chapter) => total + chapter.items.length, 0);

  return Response.json(
    {
      track: trackId,
      organization,
      repo,
      branch: defaultBranch,
      chapters,
      chapterCount: chapters.length,
      itemCount,
      truncated: Boolean(treePayload.truncated),
    },
    { headers: cacheHeaders(1800) },
  );
}
