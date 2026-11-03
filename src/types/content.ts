/**
 * 百科事典の編集コンテンツ（罪名解説・用語集・刑事手続）の型。
 *
 * 原則:
 * - 条文の文言は書かない。必ず LawRef で e-Gov スナップショットを参照し、
 *   表示時にスナップショットから引く。
 * - 解説文（やさしい言い換え）は編集コンテンツだが、法的な主張には
 *   必ず根拠（LawRef か SourceRef）を付ける。
 * - 根拠が確認できないものは status を "draft" のままにし、公開しない。
 */

/** e-Gov スナップショット内の条・項・号への参照 */
export interface LawRef {
  /** EgovLawMeta.lawId */
  lawId: string;
  /** LawArticle.num */
  article: string;
  /** LawParagraph.num（省略時は条全体） */
  paragraph?: string;
  /** LawItem.title（省略時は項全体） */
  item?: string;
}

/** 法令以外の公式資料（統計・白書など）への参照 */
export interface SourceRef {
  /** 発行元（例: 省庁名。実在の名称を正確に） */
  publisher: string;
  title: string;
  url: string;
  /** 閲覧日（YYYY-MM-DD） */
  accessedAt: string;
}

/** 根拠つきの文。解説文の最小単位 */
export interface CitedText {
  text: string;
  lawRefs?: LawRef[];
  sourceRefs?: SourceRef[];
}

/**
 * 公開状態。
 * draft: 下書き（公開しない）
 * reviewed: 編集レビュー済み（根拠の突き合わせ待ち）
 * verified: すべての LawRef が現行スナップショットに存在し、内容の一致を確認済み
 */
export type ReviewStatus = "draft" | "reviewed" | "verified";

export interface ReviewInfo {
  status: ReviewStatus;
  /** 確認に使ったスナップショットの revisionId（lawId → revisionId） */
  checkedRevisions?: Record<string, string>;
  checkedAt?: string;
  notes?: string;
}

/** 罪名カテゴリ（表示用の分類。法令の編・章名とは別に編集側で定義） */
export interface CrimeCategory {
  slug: string;
  name: string;
  description: string;
  order: number;
}

/** 罪名エントリ: data/content/crimes/<slug>.json */
export interface CrimeEntry {
  /** URL 用の英数字スラッグ */
  slug: string;
  /** 罪名（条文見出し・法令上の表記を根拠にする） */
  name: string;
  reading?: string;
  categorySlug: string;
  /** 根拠条文（本条） */
  basis: LawRef[];
  /** ひとことで言うと（中学生にも分かる言葉で） */
  summary: CitedText;
  /** 成立の要件（構成要件）をやさしく分解したもの */
  elements: CitedText[];
  /**
   * 法定刑。文言はスナップショットから引くので、ここには参照だけを持つ。
   */
  penaltyRef: LawRef[];
  /** 未遂・予備などの関連規定 */
  relatedProvisions?: LawRef[];
  /** 関連する罪名（slug） */
  relatedCrimes?: string[];
  /** 関連用語（glossary の slug） */
  glossaryTerms?: string[];
  review: ReviewInfo;
  updatedAt: string;
}

/** 用語集: data/content/glossary/<slug>.json */
export interface GlossaryTerm {
  slug: string;
  term: string;
  reading?: string;
  definition: CitedText;
  relatedTerms?: string[];
  review: ReviewInfo;
  updatedAt: string;
}

/** 刑事手続のステップ: data/content/procedure/<slug>.json */
export interface ProcedureStep {
  slug: string;
  /** 並び順（捜査 → 起訴 → 公判 → 判決 → 執行 など） */
  order: number;
  title: string;
  summary: CitedText;
  details: CitedText[];
  /** このステップにかかわる人・機関 */
  actors?: string[];
  nextSteps?: string[];
  review: ReviewInfo;
  updatedAt: string;
}
