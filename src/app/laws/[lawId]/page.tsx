import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SourceNote } from "@/components/SourceNote";
import { getLaw, listLaws } from "@/lib/laws";
import type { EgovLawSnapshot, LawTocNode } from "@/types/law";

export function generateStaticParams() {
  return listLaws().map((law) => ({ lawId: law.meta.lawId }));
}

export async function generateMetadata(props: PageProps<"/laws/[lawId]">): Promise<Metadata> {
  const { lawId } = await props.params;
  return { title: getLaw(lawId)?.meta.lawTitle ?? "法令" };
}

export default async function LawPage(props: PageProps<"/laws/[lawId]">) {
  const { lawId } = await props.params;
  const law = getLaw(lawId);
  if (!law) notFound();

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted">
        <Link href="/laws" className="underline">法令一覧</Link>
      </nav>
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{law.meta.lawTitle}</h1>
        <p className="text-sm text-muted">{law.meta.lawNum}</p>
      </header>
      <SourceNote law={law} />
      <section>
        <h2 className="mb-2 font-semibold">目次</h2>
        <Toc nodes={law.toc} law={law} />
      </section>
    </div>
  );
}

function Toc({ nodes, law }: { nodes: LawTocNode[]; law: EgovLawSnapshot }) {
  const byNum = new Map(law.articles.map((a) => [a.num, a]));
  return (
    <ul className="space-y-1">
      {nodes.map((node, i) => (
        <li key={`${node.title}-${i}`}>
          {node.title ? (
            <details open={node.kind === "part"}>
              <summary className="cursor-pointer font-medium">{node.title}</summary>
              <div className="border-l border-line pl-4">
                <ArticleLinks nums={node.articleNums} law={law} byNum={byNum} />
                {node.children && <Toc nodes={node.children} law={law} />}
              </div>
            </details>
          ) : (
            <ArticleLinks nums={node.articleNums} law={law} byNum={byNum} />
          )}
        </li>
      ))}
    </ul>
  );
}

function ArticleLinks({
  nums,
  law,
  byNum,
}: {
  nums: string[];
  law: EgovLawSnapshot;
  byNum: Map<string, EgovLawSnapshot["articles"][number]>;
}) {
  if (nums.length === 0) return null;
  return (
    <ul className="py-1">
      {nums.map((num) => {
        const a = byNum.get(num);
        if (!a) return null;
        return (
          <li key={num} className="text-sm">
            <Link href={`/laws/${law.meta.lawId}/articles/${num}`} className="hover:underline">
              {a.title}
              {a.caption && <span className="ml-1 text-muted">{a.caption}</span>}
              {a.deleted && <span className="ml-1 text-muted">削除</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
