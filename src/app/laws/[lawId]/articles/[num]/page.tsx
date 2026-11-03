import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/ArticleView";
import { SourceNote } from "@/components/SourceNote";
import { getArticle, listLaws, tocPath } from "@/lib/laws";

export function generateStaticParams() {
  return listLaws().flatMap((law) =>
    law.articles.map((a) => ({ lawId: law.meta.lawId, num: a.num })),
  );
}

export async function generateMetadata(
  props: PageProps<"/laws/[lawId]/articles/[num]">,
): Promise<Metadata> {
  const { lawId, num } = await props.params;
  const found = getArticle(lawId, num);
  if (!found) return { title: "条文" };
  const { law, article } = found;
  return { title: `${law.meta.lawTitle} ${article.title}${article.caption ?? ""}` };
}

export default async function ArticlePage(props: PageProps<"/laws/[lawId]/articles/[num]">) {
  const { lawId, num } = await props.params;
  const found = getArticle(lawId, num);
  if (!found) notFound();
  const { law, article, prev, next } = found;
  const trail = tocPath(law, article.num);
  const base = `/laws/${law.meta.lawId}/articles`;

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-x-2 text-sm text-muted">
        <Link href="/laws" className="underline">法令一覧</Link>
        <span>›</span>
        <Link href={`/laws/${law.meta.lawId}`} className="underline">{law.meta.lawTitle}</Link>
        {trail.map((node, i) => (
          <span key={i}>› {node.title}</span>
        ))}
      </nav>
      <ArticleView article={article} />
      <nav className="flex justify-between gap-4 text-sm">
        {prev ? <Link href={`${base}/${prev.num}`} className="underline">← {prev.title}</Link> : <span />}
        {next ? <Link href={`${base}/${next.num}`} className="underline">{next.title} →</Link> : <span />}
      </nav>
      <SourceNote law={law} />
    </div>
  );
}
