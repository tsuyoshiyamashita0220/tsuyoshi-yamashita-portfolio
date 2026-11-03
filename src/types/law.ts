/**
 * e-Gov 法令API から取得した法令データの型。
 *
 * ここに入る値はすべて e-Gov の公式データから機械的に取り込んだもので、
 * 手作業で書き換えない。取り込みは scripts/fetch-egov-law.mjs で行う。
 */

/** e-Gov 上の法令の識別情報 */
export interface EgovLawMeta {
  /** e-Gov の法令ID（例の値はここに書かない。取得結果をそのまま使う） */
  lawId: string;
  /** 法令番号（e-Gov の表記のまま） */
  lawNum: string;
  /** 法令名（e-Gov の表記のまま） */
  lawTitle: string;
  /** 法令名読み（e-Gov が提供する場合のみ） */
  lawTitleKana?: string;
  /** 取り込んだ改正版の識別子（e-Gov の revision ID） */
  revisionId: string;
  /** その改正版の施行日（YYYY-MM-DD、e-Gov の値） */
  enforcementDate?: string;
}

/** 取り込み時の記録。どの時点の公式データかを必ず残す */
export interface EgovSnapshotInfo {
  /** 取得に使った API の URL */
  sourceUrl: string;
  /** 取得日時（ISO 8601） */
  fetchedAt: string;
  /** 取得したレスポンス本体の SHA-256（改ざん・手編集の検知用） */
  sha256: string;
}

/** 項 */
export interface LawParagraph {
  /** 項番号（第1項は "1"） */
  num: string;
  /** 本文（e-Gov 原文のまま） */
  sentence: string;
  /** 号 */
  items?: LawItem[];
}

/** 号 */
export interface LawItem {
  /** 号の番号表記（e-Gov 原文のまま。例: 一、二…） */
  title: string;
  sentence: string;
}

/** 条 */
export interface LawArticle {
  /**
   * 条番号のキー。e-Gov の Num 属性に合わせる（第百九十九条 → "199"、
   * 枝番号は "_" 区切り）。URL でも使う。
   */
  num: string;
  /** 条名表記（e-Gov 原文のまま。例: 第○条） */
  title: string;
  /** 見出し（括弧書きの条文見出し。ない条もある） */
  caption?: string;
  paragraphs: LawParagraph[];
  /** 削除された条など */
  deleted?: boolean;
}

/** 編・章・節などの目次ノード */
export interface LawTocNode {
  kind: "part" | "chapter" | "section" | "subsection" | "division";
  title: string;
  /** この見出しの下にある条番号（num）の範囲 */
  articleNums: string[];
  children?: LawTocNode[];
}

/** data/egov/laws/<lawId>.json の形 */
export interface EgovLawSnapshot {
  meta: EgovLawMeta;
  snapshot: EgovSnapshotInfo;
  toc: LawTocNode[];
  articles: LawArticle[];
}
