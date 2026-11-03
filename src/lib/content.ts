import fs from "node:fs";
import path from "node:path";
import type { CitedText, CrimeEntry, GlossaryTerm, LawRef, ProcedureStep, ReviewInfo } from "@/types/content";
import { getLaw, tocPath } from "@/lib/laws";

const CONTENT_DIR = path.join(process.cwd(), "data", "content");

/** ビルド時に CONTENT_PREVIEW=1 を付けると、未承認のエントリも表示する（確認用。公開ビルドでは付けない） */
export const isPreview = process.env.CONTENT_PREVIEW === "1";

function readDir<T>(sub: string): T[] {
  const dir = path.join(CONTENT_DIR, sub);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as T);
}

function lawIdsOf(value: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => lawIdsOf(v, ids));
  else if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.lawId === "string" && typeof v.article === "string") ids.add(v.lawId);
    Object.values(v).forEach((x) => lawIdsOf(x, ids));
  }
  return ids;
}

/** 承認済みで、承認後に参照先の法令が改正されていないか */
export function isApproved(entry: { review: ReviewInfo }): boolean {
  if (entry.review.status !== "verified") return false;
  const checked = entry.review.checkedRevisions ?? {};
  return [...lawIdsOf(entry)].every((id) => checked[id] && checked[id] === getLaw(id)?.meta.revisionId);
}

export function isVisible(entry: { review: ReviewInfo }): boolean {
  return isPreview || isApproved(entry);
}

let crimes: CrimeEntry[] | undefined;
/** 根拠条文が法令の中で何番目か（並べ替え用） */
function articleOrder(ref: LawRef | undefined): number {
  const law = ref && getLaw(ref.lawId);
  return law ? law.articles.findIndex((a) => a.num === ref.article) : Number.MAX_SAFE_INTEGER;
}

/** 条文の並び順（= 刑法の章の順）で返す */
export function listAllCrimes(): CrimeEntry[] {
  crimes ??= readDir<CrimeEntry>("crimes").sort(
    (a, b) => articleOrder(a.basis[0]) - articleOrder(b.basis[0]),
  );
  return crimes;
}

export function listVisibleCrimes(): CrimeEntry[] {
  return listAllCrimes().filter(isVisible);
}

export function getVisibleCrime(slug: string): CrimeEntry | undefined {
  const entry = listAllCrimes().find((c) => c.slug === slug);
  return entry && isVisible(entry) ? entry : undefined;
}

let glossary: GlossaryTerm[] | undefined;
export function listAllGlossary(): GlossaryTerm[] {
  glossary ??= readDir<GlossaryTerm>("glossary").sort((a, b) =>
    (a.reading ?? a.term).localeCompare(b.reading ?? b.term, "ja"),
  );
  return glossary;
}

export function listVisibleGlossary(): GlossaryTerm[] {
  return listAllGlossary().filter(isVisible);
}

export function getVisibleGlossary(slug: string): GlossaryTerm | undefined {
  const entry = listAllGlossary().find((g) => g.slug === slug);
  return entry && isVisible(entry) ? entry : undefined;
}

let procedure: ProcedureStep[] | undefined;
export function listAllProcedure(): ProcedureStep[] {
  procedure ??= readDir<ProcedureStep>("procedure").sort((a, b) => a.order - b.order);
  return procedure;
}

export function listVisibleProcedure(): ProcedureStep[] {
  return listAllProcedure().filter(isVisible);
}

export function getVisibleProcedure(slug: string): ProcedureStep | undefined {
  const entry = listAllProcedure().find((p) => p.slug === slug);
  return entry && isVisible(entry) ? entry : undefined;
}

/** 解説文の根拠になっている条を、重複なしで集める */
export function citedArticles(texts: CitedText[]): LawRef[] {
  const seen = new Set<string>();
  const refs: LawRef[] = [];
  for (const t of texts) {
    for (const r of t.lawRefs ?? []) {
      const key = `${r.lawId}/${r.article}`;
      if (!seen.has(key)) {
        seen.add(key);
        refs.push({ lawId: r.lawId, article: r.article });
      }
    }
  }
  return refs;
}

/** 罪名の分類 = 根拠条文が属する章（e-Gov の目次） */
export function crimeChapter(entry: CrimeEntry): string {
  const ref = entry.basis[0];
  const law = ref && getLaw(ref.lawId);
  if (!law) return "";
  const trail = tocPath(law, ref.article);
  return trail[trail.length - 1]?.title ?? "";
}

/** 「刑法 第百九十九条（第1項）」のような表示用ラベル */
export function lawRefLabel(ref: LawRef): string {
  const law = getLaw(ref.lawId);
  const article = law?.articles.find((a) => a.num === ref.article);
  if (!law || !article) return `${ref.lawId} ${ref.article}`;
  let label = `${law.meta.lawTitle} ${article.title}`;
  if (ref.paragraph && article.paragraphs.length > 1) label += ` 第${ref.paragraph}項`;
  if (ref.item) label += ` ${ref.item}号`;
  return label;
}

export function lawRefHref(ref: LawRef): string {
  return `/laws/${ref.lawId}/articles/${ref.article}`;
}

export const STATUS_LABEL: Record<ReviewInfo["status"], string> = {
  draft: "下書き",
  reviewed: "審査済み・承認待ち",
  verified: "承認済み",
};
