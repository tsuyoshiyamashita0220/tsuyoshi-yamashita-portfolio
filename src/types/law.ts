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
  /** 法令の分類（e-Gov の category。例: 刑事） */
  category?: string;
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

/**
 * 本文テキストの扱い（変換スクリプトの規則）:
 * - 複数の Sentence（本文・ただし書）はそのまま連結する。
 * - Column（段）は全角スペースで連結する（e-Gov の表示と同じ）。
 * - ふりがな（Ruby の Rt）は省き、本文の文字だけを残す。
 */

/** 表（TableStruct）。行 → セルの文字列 */
export type LawTable = string[][];

/** 項 */
export interface LawParagraph {
  /** 項番号（e-Gov の Num 属性。第1項は "1"） */
  num: string;
  /** 項番号の表記（第1項は空文字。第2項以降は "２" など e-Gov 原文のまま） */
  numLabel: string;
  /** 項の見出し（ある場合のみ） */
  caption?: string;
  /** 本文（e-Gov 原文のまま） */
  sentence: string;
  /** 号 */
  items?: LawItem[];
  /** 表 */
  tables?: LawTable[];
}

/** 号・号の細分（イ、ロ… / (1)、(2)…） */
export interface LawItem {
  /** 番号表記（e-Gov 原文のまま。例: 一、イ） */
  title: string;
  sentence: string;
  /** 細分 */
  children?: LawItem[];
}

/** 条 */
export interface LawArticle {
  /**
   * 条番号のキー。e-Gov の Num 属性をもとにする（第百九十九条 → "199"、
   * 枝番号は "_" 区切り）。削除条の範囲（e-Gov では "73:76"）は URL で使えるよう
   * "73-76" に置き換える。
   */
  num: string;
  /** 条名表記（e-Gov 原文のまま。例: 第○条） */
  title: string;
  /** 見出し（括弧書きの条文見出し。ない条もある） */
  caption?: string;
  paragraphs: LawParagraph[];
  /** 本文が「削除」だけの条 */
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

/** data/egov/laws/<lawId>.json の形。本則（MainProvision）のみを収録し、附則は含めない */
export interface EgovLawSnapshot {
  meta: EgovLawMeta;
  snapshot: EgovSnapshotInfo;
  /** e-Gov の現行状態（例: CurrentEnforced） */
  currentRevisionStatus?: string;
  /** 変換スクリプトのバージョン（変換規則を変えたら上げる） */
  converterVersion: number;
  toc: LawTocNode[];
  articles: LawArticle[];
}
