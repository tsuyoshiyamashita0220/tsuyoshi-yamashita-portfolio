import type { EgovLawSnapshot } from "@/types/law";
import { EGOV_ATTRIBUTION } from "@/lib/egov";
import { egovLawUrl } from "@/lib/laws";

/** 出典・版・取得日の表示。条文を出すページには必ず置く */
export function SourceNote({ law }: { law: EgovLawSnapshot }) {
  const fetched = law.snapshot.fetchedAt.slice(0, 10);
  return (
    <aside className="rounded-lg border border-line p-3 text-xs text-muted">
      <p>
        {EGOV_ATTRIBUTION}{" "}
        <a href={egovLawUrl(law.meta.lawId)} className="underline" rel="noopener noreferrer">
          {law.meta.lawTitle}（e-Gov で見る）
        </a>
      </p>
      <p>
        {law.meta.enforcementDate && <>施行日 {law.meta.enforcementDate} の版 ・ </>}
        取得日 {fetched} ・ 本則のみ収録（附則は未収録）
      </p>
    </aside>
  );
}
