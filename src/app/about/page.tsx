import type { Metadata } from "next";
import { EGOV_LAW_SEARCH_URL } from "@/lib/egov";

export const metadata: Metadata = { title: "このサイトについて" };

export default function AboutPage() {
  return (
    <article className="space-y-6">
      <h1 className="text-2xl font-bold">このサイトについて</h1>
      <section className="space-y-2">
        <h2 className="font-semibold">出典</h2>
        <p>
          条文は{" "}
          <a href={EGOV_LAW_SEARCH_URL} className="underline" rel="noopener noreferrer">
            e-Gov法令検索
          </a>{" "}
          の公式データを使います。各ページに、取り込んだ時点の施行日と取得日を表示します。
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">解説の方針</h2>
        <p>解説には必ず根拠の条文を付けます。公式データで確認できない内容は掲載しません。</p>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">免責</h2>
        <p>
          本サイトは学習のための解説であり、法律相談ではありません。具体的な事件については弁護士などの専門家に相談してください。
        </p>
      </section>
    </article>
  );
}
