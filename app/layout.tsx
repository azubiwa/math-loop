import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const publicBase = new URL("https://azubiwa.github.io/math-loop/");
const title = "MathLoop — 学部数学の演習記録";
const description = "定義から証明まで、学部数学をAtCoderのように解いて記録する演習サイト。";
const faviconUrl = new URL("favicon.svg?v=2", publicBase).toString();

export const metadata: Metadata = {
  metadataBase: publicBase,
  title,
  description,
  icons: {
    icon: faviconUrl,
    shortcut: faviconUrl,
    apple: faviconUrl,
  },
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
        className={`${inter.variable} ${notoSansJP.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
