const sections = [
  { title: "罪名から調べる", body: "罪名ごとに、成立の要件と法定刑を条文つきで解説します。" },
  { title: "条文を読む", body: "e-Gov の公式データをそのまま表示します。" },
  { title: "刑事手続の流れ", body: "捜査から判決までの流れを、根拠条文とあわせて説明します。" },
  { title: "用語集", body: "法律用語をやさしい言葉で言い換えます。" },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <p className="text-sm font-semibold text-accent">準備中</p>
        <h1 className="text-3xl font-bold leading-tight">CRIME ATLAS JAPAN 2026</h1>
        <p className="text-muted">
          日本の犯罪と刑事法を、e-Gov の公式法令データにもとづいてわかりやすく学べる百科事典です。
        </p>
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
        法令データはまだ取り込んでいません。取り込み後、公式データで確認できた内容から順に公開します。
      </p>
    </div>
  );
}
