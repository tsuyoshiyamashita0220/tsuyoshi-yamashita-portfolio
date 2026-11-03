import type { Metadata } from "next";
import Link from "next/link";
import { STATUS_LABEL, isApproved, isPreview, listVisibleProcedure } from "@/lib/content";

export const metadata: Metadata = { title: "刑事手続の流れ" };

export default function ProcedurePage() {
  const steps = listVisibleProcedure();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">刑事手続の流れ</h1>
      <p className="text-sm text-muted">刑事訴訟法の条文にもとづいて、捜査から判決までの主な流れを説明します。</p>
      {isPreview && (
        <p className="rounded-lg border border-accent p-3 text-sm text-accent">確認用表示：未承認の項目も表示しています。</p>
      )}
      {steps.length === 0 && (
        <p className="rounded-lg border border-line p-4 text-sm text-muted">公開できる項目はまだありません。</p>
      )}
      <ol className="space-y-0">
        {steps.map((s, i) => (
          <li key={s.slug} className="relative pb-4 pl-10">
            <span className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border border-foreground text-sm font-bold">
              {i + 1}
            </span>
            {i < steps.length - 1 && <span className="absolute left-[13px] top-7 h-full w-px bg-line" aria-hidden />}
            <Link href={`/procedure/${s.slug}`} className="block rounded-lg border border-line p-4 hover:border-foreground">
              <p className="font-semibold">
                {s.title}
                {!isApproved(s) && <span className="ml-2 text-xs font-normal text-accent">{STATUS_LABEL[s.review.status]}</span>}
              </p>
              <p className="text-sm text-muted">{s.summary.text}</p>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
