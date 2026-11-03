import type { ReviewInfo } from "@/types/content";
import { STATUS_LABEL, isApproved, isPreview } from "@/lib/content";

/** 確認用ビルドで、未承認のエントリに表示する注意書き */
export function PreviewBanner({ entry }: { entry: { review: ReviewInfo } }) {
  if (!isPreview || isApproved(entry)) return null;
  return (
    <p className="rounded-lg border border-accent p-3 text-sm text-accent">
      確認用表示：このページは「{STATUS_LABEL[entry.review.status]}」です。公開ビルドには表示されません。
    </p>
  );
}
