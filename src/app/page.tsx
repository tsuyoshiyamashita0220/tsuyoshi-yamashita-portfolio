import Link from "next/link";
import { listLaws } from "@/lib/laws";

const sections = [
  { href: "/crimes", title: "罪名から調べる", body: "罪名ごとに、成立のポイントを条文つきで解説します。" },
  { href: "/procedure", title: "刑事手続の流れ", body: "捜査から判決までの流れを、根拠条文とあわせて説明します。" },
  { href: "/glossary", title: "用語集", body: "条文に定めのある言葉を、やさしく説明します。" },
];

export default function Home() {
  const laws = listLaws();
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <p className="text-sm font-semibold text-accent">開発中</p>
        <h1 className="text-3xl font-bold leading-tight">CRIME ATLAS JAPAN 2026</h1>
        <p className="text-muted">
          日本の犯罪と刑事法を、e-Gov の公式法令データにもとづいてわかりやすく学べる百科事典です。
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">条文を読む</h2>
        <p className="text-sm text-muted">e-Gov の公式データをそのまま表示します。</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {laws.map((law) => (
            <li key={law.meta.lawId}>
              <Link
                href={`/laws/${law.meta.lawId}`}
                className="block rounded-lg border border-line p-4 hover:border-foreground"
              >
                <p className="font-semibold">{law.meta.lawTitle}</p>
                <p className="text-xs text-muted">
                  {law.articles.length} 条
                  {law.meta.enforcementDate && <> ・ 施行日 {law.meta.enforcementDate} の版</>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.title} href={s.href} className="block rounded-lg border border-line p-4 hover:border-foreground">
            <h2 className="font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-muted">{s.body}</p>
          </Link>
        ))}
      </section>

      <p className="rounded-lg border border-line p-4 text-sm text-muted">
        解説は、条文との突き合わせと承認が済んだものから順に追加しています。
      </p>
    </div>
  );
}
