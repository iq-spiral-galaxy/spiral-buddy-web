import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { learningTitle, repoTitle } from "../app/title-utils.ts";

const projectRoot = new URL("../", import.meta.url);

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost/"), { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Spiral Buddy learning experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Spiral Buddy/);
  assert.match(html, /코드에서 시스템까지/);
  assert.doesNotMatch(html, /BLUE · TECHNE · SOFTWARE &amp; SYSTEMS/);
  assert.match(html, /Blue · Software &amp; Systems/);
  assert.match(html, /Red · AI &amp; Mathematics/);
  assert.match(html, /Green · Practical Wisdom/);
  assert.match(html, /Black · Physics &amp; Reality/);
  assert.match(html, /White · Mind &amp; Consciousness/);
  assert.match(html, /86.*232.*REPOSITORIES/);
  assert.match(html, /공통 기반/);
  assert.match(html, /Frontend/);
  assert.match(html, /Backend/);
  assert.match(html, /Android/);
  assert.match(html, /iOS/);
  assert.match(html, /Computer Architecture/);
  assert.match(html, />Git</);
  assert.doesNotMatch(html, /Git In Depth/);
  assert.doesNotMatch(html, />[^<]*(?:Deep Dive|Compared|Distilled)[^<]*</);
  assert.match(html, /레포, 기술, 카테고리 검색/);
  assert.match(html, /목차 보기/);
  assert.doesNotMatch(html, /GPT-5\.6 Luna|LIVE MODEL/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|OPENAI_API_KEY/);
});

test("repository curriculum endpoint only accepts curated safe paths", async () => {
  const unknownRepo = await render("/api/repository?repo=.github");
  assert.equal(unknownRepo.status, 404);
  assert.deepEqual(await unknownRepo.json(), { error: "학습 카탈로그에 없는 레포예요." });

  const unsafePath = await render(
    "/api/repository?repo=browser-rendering-deep-dive&path=..%2FREADME.md",
  );
  assert.equal(unsafePath.status, 400);
  assert.deepEqual(await unsafePath.json(), { error: "올바른 학습 문서 경로가 아니에요." });

  const crossTrackRepo = await render(
    "/api/repository?track=white&repo=linear-algebra-deep-dive",
  );
  assert.equal(crossTrackRepo.status, 404);

  const redUnsafePath = await render(
    "/api/repository?track=red&repo=optimization-theory-deep-dive&path=README.md",
  );
  assert.equal(redUnsafePath.status, 400);
});

test("repository titles remove format suffixes without removing the subject", () => {
  assert.equal(repoTitle("deep-rl-deep-dive"), "Deep RL");
  assert.equal(repoTitle("3d-neural-rendering-deep-dive"), "3D & Neural Rendering");
  assert.equal(repoTitle("probabilistic-thinking-distilled"), "Probabilistic Thinking");
  assert.equal(repoTitle("concurrency-models-compared"), "Concurrency Models");
  assert.equal(repoTitle("feedback-loops-everywhere"), "Feedback Loops Everywhere");
  assert.equal(learningTitle("ch7-synthesis/01-predictions-compared.md"), "Predictions");
});

test("catalog contains every curated learning repository in the right track", async () => {
  const blueCatalog = JSON.parse(await readFile(new URL("../data/catalog.json", import.meta.url), "utf8"));
  const trackFiles = ["red", "green", "black", "white"];
  const additionalTracks = await Promise.all(trackFiles.map(async (track) =>
    JSON.parse(await readFile(new URL(`../data/tracks/${track}.json`, import.meta.url), "utf8")),
  ));
  const tracks = [
    { id: "blue", organization: blueCatalog.organization, domains: blueCatalog.domains },
    ...additionalTracks,
  ];
  const expected = {
    blue: ["iq-dev-lab", 8, 86],
    red: ["iq-ai-lab", 9, 48],
    green: ["iq-phronesis-lab", 6, 31],
    black: ["iq-physis-lab", 7, 36],
    white: ["iq-psyche-lab", 7, 31],
  };

  for (const track of tracks) {
    const categories = track.domains.flatMap((domain) => domain.categories);
    const repos = categories.flatMap((category) => category.repos);
    const [organization, domainCount, repoCount] = expected[track.id];
    assert.equal(track.organization, organization);
    assert.equal(track.domains.length, domainCount);
    assert.equal(repos.length, repoCount);
    assert.equal(new Set(repos).size, repoCount);
    assert.ok(track.domains.every((domain) => domain.categories.length > 0));
    assert.ok(categories.every((category) => category.repos.length > 0));
  }

  const domains = blueCatalog.domains;
  const categories = domains.flatMap((domain) => domain.categories);
  const repos = categories.flatMap((category) => category.repos);

  for (const expected of [
    "network-deep-dive",
    "react-internals-deep-dive",
    "spring-core-deep-dive",
    "jetpack-compose-internals-deep-dive",
    "swiftui-internals-deep-dive",
    "local-first-sync-deep-dive",
  ]) {
    assert.ok(repos.includes(expected), `${expected} should be present`);
  }

  for (const excluded of [".github", "iq-dev-lab.github.io", "object"]) {
    assert.ok(!repos.includes(excluded), `${excluded} should stay out of the learning catalog`);
  }

  const allRepoEntries = tracks.flatMap((track) =>
    track.domains.flatMap((domain) =>
      domain.categories.flatMap((category) => category.repos.map((repo) => `${track.id}:${repo}`)),
    ),
  );
  assert.equal(allRepoEntries.length, 232);
  assert.equal(new Set(allRepoEntries).size, 232);

  const redRepos = additionalTracks[0].domains.flatMap((domain) =>
    domain.categories.flatMap((category) => category.repos),
  );
  assert.ok(redRepos.includes("optimization-theory-deep-dive"));
  assert.ok(redRepos.includes("regularization-theory-deep-dive"));
  assert.ok(!redRepos.includes("optimization-theory-deep-dive.md"));
  assert.ok(!redRepos.includes("regularization-theory-deep-dive.md"));
});

test("removes the disposable starter preview", async () => {
  await assert.rejects(access(new URL("app/_sites-preview", projectRoot)));

  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/layout.tsx", projectRoot), "utf8"),
    readFile(new URL("package.json", projectRoot), "utf8"),
  ]);

  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.match(page, /aria-live="polite"/);
  assert.match(layout, /lang="ko"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton|drizzle/);
});
