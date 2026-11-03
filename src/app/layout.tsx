import type { Metadata } from "next";
import Link from "next/link";
import { EGOV_ATTRIBUTION } from "@/lib/egov";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CRIME ATLAS JAPAN 2026",
    template: "%s | CRIME ATLAS JAPAN 2026",
  },
  description:
    "日本の犯罪と刑事法を、e-Gov の公式法令データにもとづいてわかりやすく解説する Web 百科事典。",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="font-bold tracking-wide whitespace-nowrap">
              CRIME ATLAS JAPAN
            </Link>
            <nav className="flex shrink-0 gap-4 text-sm whitespace-nowrap">
              <Link href="/laws">法令</Link>
              <Link href="/about">サイトについて</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-line text-xs text-muted">
          <div className="mx-auto max-w-4xl space-y-1 px-4 py-4">
            <p>{EGOV_ATTRIBUTION}</p>
            <p>本サイトは学習用の解説であり、法律相談ではありません。</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
