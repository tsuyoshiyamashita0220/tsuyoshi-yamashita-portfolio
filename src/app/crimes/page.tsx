import type { Metadata } from "next";
import Link from "next/link";
import { STATUS_LABEL, crimeChapter, isApproved, isPreview, listVisibleCrimes } from "@/lib/content";
import type { CrimeEntry } from "@/types/content";

export const metadata: Metadata = { title: "罪名一覧" };

export default function CrimesPage() {
  const groups = new Map<string, CrimeEntry[]>();
  for (const c of listVisibleCrimes()) {
    const chapter = crimeChapter(c);
    groups.set(chapter, [...(groups.get(chapter) ?? []), c]);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">罪名一覧</h1>
      <p className="text-sm text-muted">分類は刑法の章（e-Gov の目次）にもとづいています。</p>
      {isPreview && (
        <p className="rounded-lg border border-accent p-3 text-sm text-accent">
          確認用表示：未承認のエントリも表示しています。
        </p>
      )}
      {groups.size === 0 && (
        <p className="rounded-lg border border-line p-4 text-sm text-muted">
          公開できる解説はまだありません。条文との突き合わせと承認が済んだものから順に公開します。
        </p>
      )}
      {[...groups].map(([chapter, entries]) => (
        <section key={chapter} className="space-y-2">
          <h2 className="font-semibold">{chapter}</h2>
          <ul className="space-y-2">
            {entries.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/crimes/${c.slug}`}
                  className="block rounded-lg border border-line p-4 hover:border-foreground"
                >
                  <p className="font-semibold">
                    {c.name}
                    {!isApproved(c) && (
                      <span className="ml-2 text-xs font-normal text-accent">
                        {STATUS_LABEL[c.review.status]}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted">{c.summary.text}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
