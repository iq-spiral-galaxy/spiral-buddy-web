const titleTokens: Record<string, string> = {
  "3d": "3D",
  ai: "AI",
  and: "&",
  android: "Android",
  api: "API",
  apis: "APIs",
  async: "Async",
  aqe: "AQE",
  cbo: "CBO",
  caching: "Caching",
  cicd: "CI/CD",
  cnn: "CNN",
  cqrs: "CQRS",
  css: "CSS",
  cssom: "CSSOM",
  db: "DB",
  ddd: "DDD",
  dom: "DOM",
  elasticsearch: "Elasticsearch",
  flutter: "Flutter",
  git: "Git",
  gnn: "GNN",
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
  lcp: "LCP",
  cls: "CLS",
  inp: "INP",
  llm: "LLM",
  lm: "LM",
  lstm: "LSTM",
  ml: "ML",
  mlops: "MLOps",
  msa: "MSA",
  mysql: "MySQL",
  ncc: "NCC",
  nlp: "NLP",
  nn: "NN",
  objc: "Objective-C",
  os: "OS",
  orm: "ORM",
  postgresql: "PostgreSQL",
  pytorch: "PyTorch",
  rabbitmq: "RabbitMQ",
  rag: "RAG",
  react: "React",
  rdd: "RDD",
  redis: "Redis",
  rl: "RL",
  rnn: "RNN",
  sde: "SDE",
  spark: "Spark",
  spring: "Spring",
  swift: "Swift",
  swiftui: "SwiftUI",
  typescript: "TypeScript",
  uikit: "UIKit",
  ui: "UI",
  v8: "V8",
  vs: "vs.",
  wasm: "WebAssembly",
  webflux: "WebFlux",
};

const repositoryTitleOverrides: Record<string, string> = {
  "3d-neural-rendering-deep-dive": "3D & Neural Rendering",
  "altered-states-distilled": "Altered & Edge States",
  "attention-working-memory-distilled": "Attention & Working Memory",
  "brains-vs-networks-distilled": "Brains vs. Networks",
  "computation-representation-distilled": "Computation & Representation",
  "deep-rl-deep-dive": "Deep RL",
  "emotion-motivation-distilled": "Emotion & Motivation",
  "experimental-statistics-mlops-deep-dive": "Experimental Statistics & MLOps",
  "free-will-agency-distilled": "Free Will & Agency",
  "git-in-depth": "Git",
  "hard-problem-distilled": "The Hard Problem",
  "learning-decision-distilled": "Learning & Decision",
  "mind-body-map-distilled": "The Mind–Body Map",
  "other-minds-distilled": "Other Minds",
  "rnn-lstm-deep-dive": "RNN & LSTM",
};

export function repoTitle(slug: string) {
  if (repositoryTitleOverrides[slug]) return repositoryTitleOverrides[slug];
  return learningTitle(slug);
}

export function learningTitle(identifier: string) {
  const basename = identifier.split("/").pop() ?? identifier;
  return basename
    .replace(/\.md$/i, "")
    .replace(/^(?:(?:chapter|챕터|ch)[-_ ]*)?\d+[-_. )]+/i, "")
    .replace(/-(?:deep-dive|compared|distilled)$/i, "")
    .split("-")
    .map((token) => titleTokens[token.toLowerCase()] ?? `${token.charAt(0).toUpperCase()}${token.slice(1)}`)
    .join(" ");
}
