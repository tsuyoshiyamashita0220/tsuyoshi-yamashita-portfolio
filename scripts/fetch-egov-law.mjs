#!/usr/bin/env node
/**
 * e-Gov 法令API から法令データを取得し、原本のまま保存する。
 *
 * 使い方:
 *   node scripts/fetch-egov-law.mjs search <法令名>   … 法令名で検索し、候補を表示
 *   node scripts/fetch-egov-law.mjs fetch <lawId>     … 本文を取得して data/egov/raw/ に保存
 *
 * 方針:
 * - 取得した応答は加工せずに保存し、SHA-256 と取得日時を記録する。
 * - 画面用の形（src/types/law.ts の EgovLawSnapshot）への変換は別スクリプトで行う。
 *   応答の形を公式仕様書と実際の応答で確認してから実装する（未実装）。
 * - 法令ID などをこのファイルに直書きしない。必ず search の結果から選ぶ。
 *
 * 注意: エンドポイントのパスは e-Gov 法令API Version 2 の公式仕様書で要確認。
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API_BASE = "https://laws.e-gov.go.jp/api/2";
const RAW_DIR = path.join(process.cwd(), "data", "egov", "raw");

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`e-Gov API が ${res.status} を返しました: ${url}`);
  }
  const body = await res.text();
  return { body, json: JSON.parse(body) };
}

async function search(title) {
  const url = `${API_BASE}/laws?law_title=${encodeURIComponent(title)}`;
  const { json } = await getJson(url);
  // 応答の形は未確認のため、そのまま表示して人が確認する
  console.log(JSON.stringify(json, null, 2));
}

async function fetchLaw(lawId) {
  if (!/^[0-9A-Za-z_]+$/.test(lawId)) {
    throw new Error(`lawId の形式が不正です: ${lawId}`);
  }
  const url = `${API_BASE}/law_data/${lawId}?response_format=json`;
  const { body } = await getJson(url);
  const sha256 = createHash("sha256").update(body).digest("hex");
  const fetchedAt = new Date().toISOString();

  await mkdir(RAW_DIR, { recursive: true });
  await writeFile(path.join(RAW_DIR, `${lawId}.json`), body);
  await writeFile(
    path.join(RAW_DIR, `${lawId}.meta.json`),
    JSON.stringify({ lawId, sourceUrl: url, fetchedAt, sha256 }, null, 2) + "\n",
  );
  console.log(`保存しました: data/egov/raw/${lawId}.json (sha256=${sha256})`);
}

const [command, arg] = process.argv.slice(2);
try {
  if (command === "search" && arg) await search(arg);
  else if (command === "fetch" && arg) await fetchLaw(arg);
  else {
    console.error("使い方: fetch-egov-law.mjs search <法令名> | fetch <lawId>");
    process.exit(1);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
