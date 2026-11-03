import type { Metadata } from "next";
import Link from "next/link";
import { listLaws } from "@/lib/laws";

export const metadata: Metadata = { title: "法令一覧" };

export default function LawsPage() {
  const laws = listLaws();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">法令一覧</h1>
      <p className="text-sm text-muted">e-Gov 法令検索から取り込んだ法令です。</p>
      <ul className="space-y-3">
        {laws.map((law) => (
          <li key={law.meta.lawId}>
            <Link
              href={`/laws/${law.meta.lawId}`}
              className="block rounded-lg border border-line p-4 hover:border-foreground"
            >
              <p className="font-semibold">{law.meta.lawTitle}</p>
              <p className="text-sm text-muted">
                {law.meta.lawNum} ・ {law.articles.length} 条
                {law.meta.enforcementDate && <> ・ 施行日 {law.meta.enforcementDate} の版</>}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
