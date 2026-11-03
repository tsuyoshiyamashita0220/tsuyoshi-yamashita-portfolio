import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CitedArticles } from "@/components/CitedArticles";
import { CitedTextView } from "@/components/CitedTextView";
import { PreviewBanner } from "@/components/PreviewBanner";
import { citedArticles, getVisibleGlossary, listAllGlossary, listVisibleCrimes } from "@/lib/content";

/** 全用語の slug を返す（Cache Components では 1 件以上が必要）。非公開のものはページ側で 404 */
export function generateStaticParams() {
  return listAllGlossary().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata(props: PageProps<"/glossary/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const t = getVisibleGlossary(slug);
  return t ? { title: t.term, description: t.definition.text } : { title: "用語" };
}

export default async function GlossaryTermPage(props: PageProps<"/glossary/[slug]">) {
  const { slug } = await props.params;
  const term = getVisibleGlossary(slug);
  if (!term) notFound();
  const related = (term.relatedTerms ?? []).map(getVisibleGlossary).filter((t) => t !== undefined);
  const crimes = listVisibleCrimes().filter((c) => c.glossaryTerms?.includes(term.slug));

  return (
    <article className="space-y-8">
      <nav className="text-sm text-muted">
        <Link href="/glossary" className="underline">用語集</Link>
      </nav>
      <PreviewBanner entry={term} />
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">
          {term.term}
          {term.reading && <span className="ml-2 text-base font-normal text-muted">{term.reading}</span>}
        </h1>
        <p className="text-lg"><CitedTextView value={term.definition} /></p>
      </header>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">根拠の条文</h2>
        <CitedArticles refs={citedArticles([term.definition])} />
      </section>
      {(related.length > 0 || crimes.length > 0) && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">関連</h2>
          <ul className="flex flex-wrap gap-2">
            {related.map((t) => (
              <li key={t.slug}>
                <Link href={`/glossary/${t.slug}`} className="rounded-full border border-line px-3 py-1 text-sm">{t.term}</Link>
              </li>
            ))}
            {crimes.map((c) => (
              <li key={c.slug}>
                <Link href={`/crimes/${c.slug}`} className="rounded-full border border-line px-3 py-1 text-sm">罪名：{c.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-muted">最終更新 {term.updatedAt}</p>
    </article>
  );
}
