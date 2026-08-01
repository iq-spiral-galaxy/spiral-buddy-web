import catalogData from "@/data/catalog.json";

export type LearningCategory = {
  id: string;
  name: string;
  description: string;
  repos: string[];
};

export type LearningDomain = {
  id: string;
  name: string;
  englishName: string;
  description: string;
  color: string;
  categories: LearningCategory[];
};

export type RepoLocation = {
  slug: string;
  title: string;
  domain: LearningDomain;
  category: LearningCategory;
};

export const catalogOrganization = catalogData.organization;
export const learningDomains = catalogData.domains as LearningDomain[];

const titleTokens: Record<string, string> = {
  android: "Android",
  api: "API",
  apis: "APIs",
  async: "Async",
  aqe: "AQE",
  cbo: "CBO",
  caching: "Caching",
  cicd: "CI/CD",
  cqrs: "CQRS",
  css: "CSS",
  cssom: "CSSOM",
  dom: "DOM",
  db: "DB",
  ddd: "DDD",
  elasticsearch: "Elasticsearch",
  flutter: "Flutter",
  git: "Git",
  go: "Go",
  gpu: "GPU",
  grpc: "gRPC",
  iac: "IaC",
  ios: "iOS",
  ipc: "IPC",
  java: "Java",
  javascript: "JavaScript",
  jetpack: "Jetpack",
  jvm: "JVM",
  kafka: "Kafka",
  kotlin: "Kotlin",
  kubernetes: "Kubernetes",
  linux: "Linux",
  lcp: "LCP",
  cls: "CLS",
  inp: "INP",
  msa: "MSA",
  mysql: "MySQL",
  objc: "Objective-C",
  os: "OS",
  orm: "ORM",
  postgresql: "PostgreSQL",
  rabbitmq: "RabbitMQ",
  react: "React",
  rdd: "RDD",
  redis: "Redis",
  spark: "Spark",
  spring: "Spring",
  swift: "Swift",
  swiftui: "SwiftUI",
  typescript: "TypeScript",
  uikit: "UIKit",
  ui: "UI",
  v8: "V8",
  wasm: "WebAssembly",
  webflux: "WebFlux",
};

const repositorySuffixTokens = new Set(["deep", "dive", "compared"]);
const repositoryTitleOverrides: Record<string, string> = {
  "git-in-depth": "Git",
};

export function repoTitle(slug: string) {
  if (repositoryTitleOverrides[slug]) return repositoryTitleOverrides[slug];
  return learningTitle(slug);
}

export function learningTitle(identifier: string) {
  const basename = identifier.split("/").pop() ?? identifier;
  return basename
    .replace(/\.md$/i, "")
    .replace(/^(?:(?:chapter|챕터|ch)[-_ ]*)?\d+[-_. )]*/i, "")
    .split("-")
    .filter((token) => !repositorySuffixTokens.has(token))
    .map((token) => titleTokens[token] ?? `${token.charAt(0).toUpperCase()}${token.slice(1)}`)
    .join(" ");
}

export const repoLocations: RepoLocation[] = learningDomains.flatMap((domain) =>
  domain.categories.flatMap((category) =>
    category.repos.map((slug) => ({
      slug,
      title: repoTitle(slug),
      domain,
      category,
    })),
  ),
);

export const totalRepoCount = repoLocations.length;
export const totalCategoryCount = learningDomains.reduce(
  (total, domain) => total + domain.categories.length,
  0,
);

export function getRepoUrl(slug: string) {
  return `https://github.com/${catalogOrganization}/${slug}`;
}

export function getDomainRepoCount(domain: LearningDomain) {
  return domain.categories.reduce((total, category) => total + category.repos.length, 0);
}

export function findRepo(slug: string) {
  return repoLocations.find((repo) => repo.slug === slug);
}
