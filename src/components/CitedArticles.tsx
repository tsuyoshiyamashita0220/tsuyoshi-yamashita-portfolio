import { ArticleView } from "@/components/ArticleView";
import { getArticle, getLaw } from "@/lib/laws";
import type { LawRef } from "@/types/content";

/** 根拠条文を原文で並べる。法令が複数あるときは法令名も出す */
export function CitedArticles({ refs }: { refs: LawRef[] }) {
  return (
    <div className="space-y-3">
      {refs.map((ref) => {
        const found = getArticle(ref.lawId, ref.article);
        if (!found) return null;
        return (
          <div key={`${ref.lawId}/${ref.article}`} className="rounded-lg border border-line p-4">
            <p className="mb-1 text-xs text-muted">{getLaw(ref.lawId)?.meta.lawTitle}</p>
            <ArticleView article={found.article} />
          </div>
        );
      })}
    </div>
  );
}
