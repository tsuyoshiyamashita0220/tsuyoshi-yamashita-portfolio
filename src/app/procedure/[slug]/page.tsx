import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CitedArticles } from "@/components/CitedArticles";
import { CitedTextView } from "@/components/CitedTextView";
import { PreviewBanner } from "@/components/PreviewBanner";
import { citedArticles, getVisibleProcedure, listAllProcedure } from "@/lib/content";

/** 全項目の slug を返す（Cache Components では 1 件以上が必要）。非公開のものはページ側で 404 */
export function generateStaticParams() {
  return listAllProcedure().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/procedure/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const s = getVisibleProcedure(slug);
  return s ? { title: s.title, description: s.summary.text } : { title: "刑事手続" };
}

export default async function ProcedureStepPage(props: PageProps<"/procedure/[slug]">) {
  const { slug } = await props.params;
  const step = getVisibleProcedure(slug);
  if (!step) notFound();
  const next = (step.nextSteps ?? []).map(getVisibleProcedure).filter((s) => s !== undefined);

  return (
    <article className="space-y-8">
      <nav className="text-sm text-muted">
        <Link href="/procedure" className="underline">刑事手続の流れ</Link>
      </nav>
      <PreviewBanner entry={step} />
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">{step.title}</h1>
        <p className="text-lg"><CitedTextView value={step.summary} /></p>
      </header>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">くわしく</h2>
        <ul className="list-disc space-y-2 pl-5">
          {step.details.map((d, i) => (
            <li key={i}><CitedTextView value={d} /></li>
          ))}
        </ul>
      </section>
      {step.actors && step.actors.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">かかわる人・機関</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {step.actors.map((a) => (
              <li key={a} className="rounded-full border border-line px-3 py-1">{a}</li>
            ))}
          </ul>
        </section>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">根拠の条文</h2>
        <CitedArticles refs={citedArticles([step.summary, ...step.details])} />
      </section>
      {next.length > 0 && (
        <nav className="text-right">
          {next.map((s) => (
            <Link key={s.slug} href={`/procedure/${s.slug}`} className="underline">次へ：{s.title} →</Link>
          ))}
        </nav>
      )}
      <p className="text-xs text-muted">条文は e-Gov 法令検索（デジタル庁）のデータです。最終更新 {step.updatedAt}</p>
    </article>
  );
}
