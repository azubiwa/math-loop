import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const publicBase = new URL("https://azubiwa.github.io/math-loop/");
const title = "MathLoop — 学部数学の演習記録";
const description = "定義から証明まで、学部数学をAtCoderのように解いて記録する演習サイト。";

export const metadata: Metadata = {
  metadataBase: publicBase,
  title,
  description,
  openGraph: { title, description, type: "website", images: [{ url: new URL("og.png", publicBase).toString(), width: 1672, height: 941, alt: "MathLoop — 解く。" }] },
  twitter: { card: "summary_large_image", title, description, images: [new URL("og.png", publicBase).toString()] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
