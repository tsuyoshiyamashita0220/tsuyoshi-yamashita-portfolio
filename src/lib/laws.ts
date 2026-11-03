import fs from "node:fs";
import path from "node:path";
import type { EgovLawSnapshot, LawArticle, LawTocNode } from "@/types/law";

/**
 * data/egov/laws/ のスナップショットを読む。
 * 同期読み込みなので、ビルド時に静的に描画される（Cache Components の「予測可能な値」）。
 */
const LAWS_DIR = path.join(process.cwd(), "data", "egov", "laws");

let cache: Map<string, EgovLawSnapshot> | undefined;

function loadAll(): Map<string, EgovLawSnapshot> {
  if (cache) return cache;
  const map = new Map<string, EgovLawSnapshot>();
  const files = fs.existsSync(LAWS_DIR) ? fs.readdirSync(LAWS_DIR) : [];
  for (const file of files.filter((f) => f.endsWith(".json")).sort()) {
    const law = JSON.parse(fs.readFileSync(path.join(LAWS_DIR, file), "utf8")) as EgovLawSnapshot;
    map.set(law.meta.lawId, law);
  }
  cache = map;
  return map;
}

export function listLaws(): EgovLawSnapshot[] {
  return [...loadAll().values()];
}

export function getLaw(lawId: string): EgovLawSnapshot | undefined {
  return loadAll().get(lawId);
}

export function getArticle(
  lawId: string,
  num: string,
): { law: EgovLawSnapshot; article: LawArticle; prev?: LawArticle; next?: LawArticle } | undefined {
  const law = getLaw(lawId);
  if (!law) return undefined;
  const index = law.articles.findIndex((a) => a.num === num);
  if (index < 0) return undefined;
  return {
    law,
    article: law.articles[index],
    prev: law.articles[index - 1],
    next: law.articles[index + 1],
  };
}

/** 条が属する編・章・節の見出しを、上位から順に返す（パンくず用） */
export function tocPath(law: EgovLawSnapshot, num: string): LawTocNode[] {
  const search = (nodes: LawTocNode[], trail: LawTocNode[]): LawTocNode[] | undefined => {
    for (const node of nodes) {
      const next = [...trail, node];
      if (node.articleNums.includes(num)) return next;
      const found = node.children && search(node.children, next);
      if (found) return found;
    }
    return undefined;
  };
  return (search(law.toc, []) ?? []).filter((n) => n.title);
}

/** e-Gov 法令検索の該当法令ページ */
export function egovLawUrl(lawId: string): string {
  return `https://laws.e-gov.go.jp/law/${lawId}`;
}
