import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/ArticleView";
import { CitedTextView } from "@/components/CitedTextView";
import { PreviewBanner } from "@/components/PreviewBanner";
import { SourceNote } from "@/components/SourceNote";
import {
  crimeChapter,
  getVisibleCrime,
  getVisibleGlossary,
  lawRefHref,
  lawRefLabel,
  listAllCrimes,
} from "@/lib/content";
import { getArticle, getLaw } from "@/lib/laws";
import type { LawRef } from "@/types/content";

/**
 * 全エントリの slug を返す（Cache Components では 1 件以上が必要なため）。
 * 公開できないエントリはページ側で 404 にするので、内容は出力されない。
 */
export function generateStaticParams() {
  return listAllCrimes().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(props: PageProps<"/crimes/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const entry = getVisibleCrime(slug);
  return entry ? { title: entry.name, description: entry.summary.text } : { title: "罪名" };
}

/** 同じ条を二度表示しないよう、条単位でまとめる */
function uniqueArticles(refs: LawRef[]) {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const key = `${r.lawId}/${r.article}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default async function CrimePage(props: PageProps<"/crimes/[slug]">) {
  const { slug } = await props.params;
  const entry = getVisibleCrime(slug);
  if (!entry) notFound();

  const basis = uniqueArticles(entry.basis);
  const basisKeys = new Set(basis.map((r) => `${r.lawId}/${r.article}`));
  const penaltyInBasis = entry.penaltyRef.every((r) => basisKeys.has(`${r.lawId}/${r.article}`));
  const related = uniqueArticles(entry.relatedProvisions ?? []).filter(
    (r) => !basisKeys.has(`${r.lawId}/${r.article}`),
  );
  const relatedCrimes = (entry.relatedCrimes ?? [])
    .map((s) => getVisibleCrime(s))
    .filter((c) => c !== undefined);
  const terms = (entry.glossaryTerms ?? []).map(getVisibleGlossary).filter((t) => t !== undefined);
  const law = getLaw(entry.basis[0].lawId);

  return (
    <article className="space-y-8">
      <nav className="text-sm text-muted">
        <Link href="/crimes" className="underline">罪名一覧</Link>
        <span className="mx-1">›</span>
        <span>{crimeChapter(entry)}</span>
      </nav>
      <PreviewBanner entry={entry} />
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">
          {entry.name}
          {entry.reading && <span className="ml-2 text-base font-normal text-muted">{entry.reading}</span>}
        </h1>
        <p className="text-lg">
          <CitedTextView value={entry.summary} />
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">成立のポイント</h2>
        <ul className="list-disc space-y-2 pl-5">
          {entry.elements.map((e, i) => (
            <li key={i}>
              <CitedTextView value={e} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">条文</h2>
        {basis.map((ref) => {
          const found = getArticle(ref.lawId, ref.article);
          return found ? (
            <div key={`${ref.lawId}/${ref.article}`} className="rounded-lg border border-line p-4">
              <ArticleView article={found.article} />
            </div>
          ) : null;
        })}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">法定刑</h2>
        {penaltyInBasis ? (
          <p className="text-sm text-muted">法定刑は上の条文に定められています。</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {entry.penaltyRef.map((r, i) => (
              <li key={i}>
                <Link href={lawRefHref(r)} className="underline">{lawRefLabel(r)}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {related.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">関連する条文</h2>
          {related.map((ref) => {
            const found = getArticle(ref.lawId, ref.article);
            return found ? (
              <div key={`${ref.lawId}/${ref.article}`} className="rounded-lg border border-line p-4">
                <ArticleView article={found.article} />
              </div>
            ) : null;
          })}
        </section>
      )}

      {relatedCrimes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">関連する罪名</h2>
          <ul className="flex flex-wrap gap-2">
            {relatedCrimes.map((c) => (
              <li key={c.slug}>
                <Link href={`/crimes/${c.slug}`} className="rounded-full border border-line px-3 py-1 text-sm">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {terms.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">関連する用語</h2>
          <ul className="flex flex-wrap gap-2">
            {terms.map((t) => (
              <li key={t.slug}>
                <Link href={`/glossary/${t.slug}`} className="rounded-full border border-line px-3 py-1 text-sm">
                  {t.term}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted">
        解説は条文の文言にもとづく言い換えです。判例・学説による解釈は、出典を確認できたものから追加します。最終更新 {entry.updatedAt}
      </p>
      {law && <SourceNote law={law} />}
    </article>
  );
}
