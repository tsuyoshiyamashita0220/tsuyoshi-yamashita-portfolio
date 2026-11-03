#!/usr/bin/env node
/**
 * data/content/ の編集コンテンツを機械的に検証する。1 件でも問題があれば失敗する。
 * npm run build の前に自動で実行される。
 *
 * 確認すること:
 * - ファイル名と slug が一致する
 * - すべての LawRef（法令・条・項・号）が data/egov/laws/ のスナップショットに存在する
 * - すべての CitedText に根拠（lawRefs か sourceRefs）がある
 * - review.status が draft / reviewed / verified のいずれか
 * - verified のエントリは checkedRevisions を持つ（現行版と違う場合は警告し、サイトには出さない）
 * - relatedCrimes / glossaryTerms などの参照先が存在する
 *
 * 内容の法的な正しさは判断しない（legal-reviewer と人が確認する）。
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LAWS_DIR = path.join(ROOT, "data", "egov", "laws");
const CONTENT_DIR = path.join(ROOT, "data", "content");

const errors = [];
const warnings = [];

function readJsonDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ file: path.relative(ROOT, path.join(dir, f)), name: f.replace(/\.json$/, ""), data: JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) }));
}

const laws = new Map(readJsonDir(LAWS_DIR).map(({ data }) => [data.meta.lawId, data]));

function findItem(items, title) {
  for (const item of items ?? []) {
    if (item.title === title) return item;
  }
  return undefined;
}

function checkLawRef(ref, where) {
  const law = laws.get(ref?.lawId);
  if (!law) return errors.push(`${where}: 法令 ${ref?.lawId} のスナップショットがありません`);
  const article = law.articles.find((a) => a.num === ref.article);
  if (!article) return errors.push(`${where}: ${law.meta.lawTitle} に条 ${ref.article} がありません`);
  if (article.deleted) errors.push(`${where}: ${law.meta.lawTitle} ${article.title} は削除された条です`);
  if (ref.paragraph === undefined) {
    if (ref.item !== undefined) errors.push(`${where}: 項を指定せずに号を指定しています`);
    return;
  }
  const paragraph = article.paragraphs.find((p) => p.num === ref.paragraph);
  if (!paragraph) return errors.push(`${where}: ${article.title} に第${ref.paragraph}項がありません`);
  if (ref.item !== undefined && !findItem(paragraph.items, ref.item)) {
    errors.push(`${where}: ${article.title}第${ref.paragraph}項に号「${ref.item}」がありません`);
  }
}

function checkCitedText(ct, where) {
  if (!ct || typeof ct.text !== "string" || ct.text.trim() === "") {
    return errors.push(`${where}: text が空です`);
  }
  const lawRefs = ct.lawRefs ?? [];
  const sourceRefs = ct.sourceRefs ?? [];
  if (lawRefs.length + sourceRefs.length === 0) errors.push(`${where}: 根拠（lawRefs / sourceRefs）がありません`);
  lawRefs.forEach((r, i) => checkLawRef(r, `${where}.lawRefs[${i}]`));
  sourceRefs.forEach((s, i) => {
    for (const key of ["publisher", "title", "url", "accessedAt"]) {
      if (!s?.[key]) errors.push(`${where}.sourceRefs[${i}]: ${key} がありません`);
    }
  });
}

function checkReview(review, refsLawIds, where) {
  if (!["draft", "reviewed", "verified"].includes(review?.status)) {
    return errors.push(`${where}.review.status が不正です: ${review?.status}`);
  }
  if (review.status !== "verified") return;
  const checked = review.checkedRevisions ?? {};
  for (const lawId of refsLawIds) {
    const current = laws.get(lawId)?.meta.revisionId;
    if (!checked[lawId]) errors.push(`${where}: verified なのに ${lawId} の checkedRevisions がありません`);
    else if (checked[lawId] !== current) {
      warnings.push(`${where}: ${lawId} が改正されています（確認時 ${checked[lawId]} / 現行 ${current}）。再審査まで非公開`);
    }
  }
}

function lawIdsOf(entry) {
  const ids = new Set();
  const visit = (v) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") {
      if (typeof v.lawId === "string" && typeof v.article === "string") ids.add(v.lawId);
      Object.values(v).forEach(visit);
    }
  };
  visit(entry);
  return [...ids];
}

function checkCommon(file, name, entry) {
  if (entry.slug !== name) errors.push(`${file}: slug（${entry.slug}）がファイル名と一致しません`);
  if (!/^[a-z0-9-]+$/.test(entry.slug ?? "")) errors.push(`${file}: slug は英小文字・数字・ハイフンのみ`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.updatedAt ?? "")) errors.push(`${file}: updatedAt は YYYY-MM-DD`);
  checkReview(entry.review, lawIdsOf(entry), file);
}

const crimes = readJsonDir(path.join(CONTENT_DIR, "crimes"));
const glossary = readJsonDir(path.join(CONTENT_DIR, "glossary"));
const procedure = readJsonDir(path.join(CONTENT_DIR, "procedure"));
const crimeSlugs = new Set(crimes.map((c) => c.name));
const glossarySlugs = new Set(glossary.map((g) => g.name));
const procedureSlugs = new Set(procedure.map((p) => p.name));

for (const { file, name, data } of crimes) {
  checkCommon(file, name, data);
  if (!data.name) errors.push(`${file}: name がありません`);
  if (!data.basis?.length) errors.push(`${file}: basis（根拠条文）がありません`);
  (data.basis ?? []).forEach((r, i) => checkLawRef(r, `${file}.basis[${i}]`));
  if (!data.penaltyRef?.length) errors.push(`${file}: penaltyRef がありません`);
  (data.penaltyRef ?? []).forEach((r, i) => checkLawRef(r, `${file}.penaltyRef[${i}]`));
  (data.relatedProvisions ?? []).forEach((r, i) => checkLawRef(r, `${file}.relatedProvisions[${i}]`));
  checkCitedText(data.summary, `${file}.summary`);
  if (!data.elements?.length) errors.push(`${file}: elements がありません`);
  (data.elements ?? []).forEach((e, i) => checkCitedText(e, `${file}.elements[${i}]`));
  for (const s of data.relatedCrimes ?? []) if (!crimeSlugs.has(s)) errors.push(`${file}: relatedCrimes の ${s} がありません`);
  for (const s of data.glossaryTerms ?? []) if (!glossarySlugs.has(s)) errors.push(`${file}: glossaryTerms の ${s} がありません`);
}

for (const { file, name, data } of glossary) {
  checkCommon(file, name, data);
  checkCitedText(data.definition, `${file}.definition`);
  for (const s of data.relatedTerms ?? []) if (!glossarySlugs.has(s)) errors.push(`${file}: relatedTerms の ${s} がありません`);
}

for (const { file, name, data } of procedure) {
  checkCommon(file, name, data);
  checkCitedText(data.summary, `${file}.summary`);
  (data.details ?? []).forEach((d, i) => checkCitedText(d, `${file}.details[${i}]`));
  for (const s of data.nextSteps ?? []) if (!procedureSlugs.has(s)) errors.push(`${file}: nextSteps の ${s} がありません`);
}

const count = crimes.length + glossary.length + procedure.length;
const byStatus = {};
for (const { data } of [...crimes, ...glossary, ...procedure]) {
  byStatus[data.review?.status] = (byStatus[data.review?.status] ?? 0) + 1;
}
for (const w of warnings) console.warn(`警告: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`エラー: ${e}`);
  console.error(`\nコンテンツ検証に失敗しました（${errors.length} 件）`);
  process.exit(1);
}
console.log(`コンテンツ検証 OK: ${count} 件 ${JSON.stringify(byStatus)}`);
