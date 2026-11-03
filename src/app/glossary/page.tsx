import type { Metadata } from "next";
import Link from "next/link";
import { STATUS_LABEL, isApproved, isPreview, listVisibleGlossary } from "@/lib/content";

export const metadata: Metadata = { title: "用語集" };

export default function GlossaryPage() {
  const terms = listVisibleGlossary();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">用語集</h1>
      <p className="text-sm text-muted">条文に定めのある言葉を、条文にもとづいて説明します。</p>
      {isPreview && (
        <p className="rounded-lg border border-accent p-3 text-sm text-accent">確認用表示：未承認の用語も表示しています。</p>
      )}
      {terms.length === 0 && (
        <p className="rounded-lg border border-line p-4 text-sm text-muted">公開できる用語はまだありません。</p>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {terms.map((t) => (
          <li key={t.slug}>
            <Link href={`/glossary/${t.slug}`} className="block rounded-lg border border-line p-3 hover:border-foreground">
              <span className="font-semibold">{t.term}</span>
              {t.reading && <span className="ml-2 text-xs text-muted">{t.reading}</span>}
              {!isApproved(t) && <span className="ml-2 text-xs text-accent">{STATUS_LABEL[t.review.status]}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
