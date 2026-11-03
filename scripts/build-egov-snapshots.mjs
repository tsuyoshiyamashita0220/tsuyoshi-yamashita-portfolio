#!/usr/bin/env node
/**
 * data/egov/raw/ の e-Gov 原本を、画面用の EgovLawSnapshot（src/types/law.ts）に変換して
 * data/egov/laws/ に書き出す。
 *
 * - 原本の SHA-256 が取得記録（*.meta.json）と一致しない場合は中止する（原本の手編集を防ぐ）。
 * - 本則（MainProvision）のみ変換する。附則は含めない。
 * - 文字は原本からそのまま取り出す。言い換え・補完はしない（規則は src/types/law.ts 参照）。
 * - 想定外のタグに出会ったら中止する。条ごとに、変換後の文字が原本（ふりがなを除く）と
 *   過不足なく一致することを確かめる（取りこぼしを防ぐ）。
 *
 * 使い方: node scripts/build-egov-snapshots.mjs
 */
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const CONVERTER_VERSION = 1;
const RAW_DIR = path.join(process.cwd(), "data", "egov", "raw");
const OUT_DIR = path.join(process.cwd(), "data", "egov", "laws");

const isNode = (n) => n !== null && typeof n === "object";
const childrenOf = (n) => (isNode(n) ? n.children ?? [] : []);
const child = (n, tag) => childrenOf(n).find((c) => isNode(c) && c.tag === tag);
const childrenByTag = (n, tag) => childrenOf(n).filter((c) => isNode(c) && c.tag === tag);


/** ノード以下の文字を連結する。Rt（ふりがな）は省く */
function text(n) {
  if (typeof n === "string") return n;
  if (!isNode(n)) return "";
  if (n.tag === "Rt") return "";
  return childrenOf(n).map(text).join("");
}

/** Sentence / Column を含む文の要素（ParagraphSentence など）を 1 つの文字列にする */
function sentenceText(n) {
  if (!n) return "";
  const parts = [];
  for (const c of childrenOf(n)) {
    if (!isNode(c)) continue;
    if (c.tag === "Sentence") parts.push({ sep: "", value: text(c) });
    else if (c.tag === "Column") parts.push({ sep: "　", value: sentenceText(c) });
    else throw new Error(`文の中に想定外のタグ: ${c.tag}`);
  }
  return parts.map((p, i) => (i === 0 ? p.value : p.sep + p.value)).join("");
}

function tableOf(tableStruct) {
  const table = child(tableStruct, "Table");
  return childrenByTag(table, "TableRow").map((row) =>
    childrenByTag(row, "TableColumn").map((col) => text(col).trim()),
  );
}

/** Item / Subitem1 / Subitem2 … を再帰的に変換する */
function itemOf(n, depth) {
  const prefix = depth === 0 ? "Item" : `Subitem${depth}`;
  const nextTag = `Subitem${depth + 1}`;
  const item = {
    title: text(child(n, `${prefix}Title`)),
    sentence: sentenceText(child(n, `${prefix}Sentence`)),
  };
  for (const c of childrenOf(n)) {
    if (!isNode(c)) continue;
    if (![`${prefix}Title`, `${prefix}Sentence`, nextTag].includes(c.tag)) {
      throw new Error(`${prefix} の中に想定外のタグ: ${c.tag}`);
    }
  }
  const subs = childrenByTag(n, nextTag).map((s) => itemOf(s, depth + 1));
  if (subs.length) item.children = subs;
  return item;
}

function paragraphOf(n) {
  const p = {
    num: n.attr?.Num ?? "",
    numLabel: text(child(n, "ParagraphNum")),
    sentence: sentenceText(child(n, "ParagraphSentence")),
  };
  const caption = child(n, "ParagraphCaption");
  if (caption) p.caption = text(caption);
  const items = childrenByTag(n, "Item").map((i) => itemOf(i, 0));
  if (items.length) p.items = items;
  const tables = childrenByTag(n, "TableStruct").map(tableOf);
  if (tables.length) p.tables = tables;
  for (const c of childrenOf(n)) {
    if (!isNode(c)) continue;
    const known = ["ParagraphNum", "ParagraphSentence", "ParagraphCaption", "Item", "TableStruct"];
    if (!known.includes(c.tag)) throw new Error(`Paragraph の中に想定外のタグ: ${c.tag}`);
  }
  return p;
}

/** 空白を除いた文字の並び替え結果。原本と変換結果で文字の欠け・増えがないかを調べる */
const charSignature = (str) => [...str.replace(/[\s　]/g, "")].sort().join("");

function itemStrings(item) {
  return [item.title, item.sentence, ...(item.children ?? []).flatMap(itemStrings)];
}

function articleStrings(a) {
  return [
    a.title,
    a.caption ?? "",
    ...a.paragraphs.flatMap((p) => [
      p.caption ?? "",
      p.numLabel,
      p.sentence,
      ...(p.items ?? []).flatMap(itemStrings),
      ...(p.tables ?? []).flat(2),
    ]),
  ];
}

function articleOf(n) {
  const rawNum = n.attr?.Num;
  if (!rawNum) throw new Error("Num 属性のない Article");
  const paragraphs = childrenByTag(n, "Paragraph").map(paragraphOf);
  const article = {
    num: rawNum.replaceAll(":", "-"),
    title: text(child(n, "ArticleTitle")),
    paragraphs,
  };
  const caption = child(n, "ArticleCaption");
  if (caption) article.caption = text(caption);
  if (paragraphs.length === 1 && paragraphs[0].sentence === "削除" && !paragraphs[0].items) {
    article.deleted = true;
  }
  for (const c of childrenOf(n)) {
    if (!isNode(c)) continue;
    if (!["ArticleTitle", "ArticleCaption", "Paragraph"].includes(c.tag)) {
      throw new Error(`Article ${rawNum} の中に想定外のタグ: ${c.tag}`);
    }
  }
  if (charSignature(text(n)) !== charSignature(articleStrings(article).join(""))) {
    throw new Error(`Article ${rawNum}: 変換後の文字が原本と一致しません`);
  }
  return article;
}

const STRUCTURE = {
  Part: { kind: "part", title: "PartTitle" },
  Chapter: { kind: "chapter", title: "ChapterTitle" },
  Section: { kind: "section", title: "SectionTitle" },
  Subsection: { kind: "subsection", title: "SubsectionTitle" },
  Division: { kind: "division", title: "DivisionTitle" },
};

/** MainProvision 以下をたどり、目次と条の一覧を作る */
function walkProvision(n, articles) {
  const nodes = [];
  const directNums = [];
  for (const c of childrenOf(n)) {
    if (!isNode(c)) continue;
    if (c.tag === "Article") {
      const a = articleOf(c);
      articles.push(a);
      directNums.push(a.num);
    } else if (STRUCTURE[c.tag]) {
      const { kind, title } = STRUCTURE[c.tag];
      const inner = walkProvision(c, articles);
      const node = { kind, title: text(child(c, title)), articleNums: inner.directNums };
      if (inner.nodes.length) node.children = inner.nodes;
      nodes.push(node);
    } else if (c.tag === "Paragraph") {
      throw new Error("条を持たない法令（本則が項だけの法令）は未対応");
    } else if (!Object.values(STRUCTURE).some((s) => s.title === c.tag)) {
      throw new Error(`本則の構造に想定外のタグ: ${c.tag}`);
    }
  }
  return { nodes, directNums };
}

async function convert(lawId) {
  const body = await readFile(path.join(RAW_DIR, `${lawId}.json`), "utf8");
  const meta = JSON.parse(await readFile(path.join(RAW_DIR, `${lawId}.meta.json`), "utf8"));
  const sha256 = createHash("sha256").update(body).digest("hex");
  if (sha256 !== meta.sha256) {
    throw new Error(`${lawId}: 原本の SHA-256 が取得記録と一致しません（原本が変更されています）`);
  }
  const raw = JSON.parse(body);
  const info = raw.law_info;
  const rev = raw.revision_info;
  if (info.law_id !== lawId) throw new Error(`${lawId}: 応答の law_id が一致しません`);

  const lawBody = child(raw.law_full_text, "LawBody");
  const main = child(lawBody, "MainProvision");
  if (!main) throw new Error(`${lawId}: MainProvision がありません`);

  const articles = [];
  const { nodes, directNums } = walkProvision(main, articles);
  const toc = directNums.length
    ? [{ kind: "chapter", title: "", articleNums: directNums }, ...nodes]
    : nodes;

  const nums = new Set();
  for (const a of articles) {
    if (nums.has(a.num)) throw new Error(`${lawId}: 条番号が重複しています: ${a.num}`);
    nums.add(a.num);
  }

  const snapshot = {
    meta: {
      lawId: info.law_id,
      lawNum: info.law_num,
      lawTitle: rev.law_title,
      ...(rev.category ? { category: rev.category } : {}),
      ...(rev.law_title_kana ? { lawTitleKana: rev.law_title_kana } : {}),
      revisionId: rev.law_revision_id,
      ...(rev.amendment_enforcement_date ? { enforcementDate: rev.amendment_enforcement_date } : {}),
    },
    snapshot: { sourceUrl: meta.sourceUrl, fetchedAt: meta.fetchedAt, sha256 },
    ...(rev.current_revision_status ? { currentRevisionStatus: rev.current_revision_status } : {}),
    converterVersion: CONVERTER_VERSION,
    toc,
    articles,
  };
  await writeFile(path.join(OUT_DIR, `${lawId}.json`), JSON.stringify(snapshot) + "\n");
  console.log(`${lawId} ${rev.law_title}: ${articles.length} 条（本則）`);
}

await mkdir(OUT_DIR, { recursive: true });
const files = (await readdir(RAW_DIR)).filter((f) => /^[0-9A-Za-z_]+\.json$/.test(f));
if (files.length === 0) {
  console.error("data/egov/raw/ に原本がありません。先に npm run egov:fetch を実行してください。");
  process.exit(1);
}
try {
  for (const f of files.sort()) await convert(f.replace(/\.json$/, ""));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
