import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.match(html, /흩어진 공부를/);
  assert.match(html, /공통 기반/);
  assert.match(html, /Frontend/);
  assert.match(html, /Backend/);
  assert.match(html, /Android/);
  assert.match(html, /iOS/);
  assert.match(html, /Computer Architecture/);
  assert.match(html, />Git</);
  assert.doesNotMatch(html, /Git In Depth/);
  assert.doesNotMatch(html, />[^<]*(?:Deep Dive|Compared)[^<]*</);
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
});

test("catalog contains every curated learning repository exactly once", async () => {
  const catalog = JSON.parse(await readFile(new URL("../data/catalog.json", import.meta.url), "utf8"));
  const domains = catalog.domains;
  const categories = domains.flatMap((domain) => domain.categories);
  const repos = categories.flatMap((category) => category.repos);

  assert.equal(catalog.organization, "iq-dev-lab");
  assert.equal(domains.length, 8);
  assert.equal(categories.length, 29);
  assert.equal(repos.length, 86);
  assert.equal(new Set(repos).size, 86);
  assert.ok(domains.every((domain) => domain.categories.length > 0));
  assert.ok(categories.every((category) => category.repos.length > 0));

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
