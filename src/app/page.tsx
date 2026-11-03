import Link from "next/link";
import { listLaws } from "@/lib/laws";

const sections = [
  { title: "罪名から調べる", body: "罪名ごとに、成立の要件と法定刑を条文つきで解説します。" },
  { title: "刑事手続の流れ", body: "捜査から判決までの流れを、根拠条文とあわせて説明します。" },
  { title: "用語集", body: "法律用語をやさしい言葉で言い換えます。" },
];

export default function Home() {
  const laws = listLaws();
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <p className="text-sm font-semibold text-accent">準備中</p>
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
          <div key={s.title} className="rounded-lg border border-line p-4">
            <h2 className="font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-muted">{s.body}</p>
            <p className="mt-2 text-xs text-muted">公開準備中</p>
          </div>
        ))}
      </section>

      <p className="rounded-lg border border-line p-4 text-sm text-muted">
        罪名解説・刑事手続・用語集は、条文との突き合わせが済んだものから順に公開します。
      </p>
    </div>
  );
}
