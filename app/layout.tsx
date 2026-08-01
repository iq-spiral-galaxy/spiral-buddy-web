import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "Spiral Buddy — 질문으로 깊어지는 학습";
const description = "질문하고, 연결하고, 다시 설명하며 이해를 쌓는 AI 학습 버디.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const socialImage = `${origin}/og.png`;

  return {
    title,
    description,
    metadataBase: new URL(origin),
    openGraph: {
      type: "website",
      locale: "ko_KR",
      title,
      description,
      images: [{ url: socialImage, width: 1200, height: 630, alt: "Spiral Buddy" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
