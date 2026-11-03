/**
 * e-Gov 法令API 関連の定数。
 *
 * e-Gov 法令API Version 2。2026-11-03 に実際の応答で次の 2 つを確認済み:
 *   GET /laws?law_title=<法令名>                → { total_count, count, laws[] }
 *   GET /law_data/<lawId>?response_format=json  → { law_info, revision_info, law_full_text, attached_files_info }
 * law_full_text は XML を { tag, attr, children } の木にした形。
 */
export const EGOV_API_BASE = "https://laws.e-gov.go.jp/api/2";

/** 閲覧者向けの e-Gov 法令検索ページ */
export const EGOV_LAW_SEARCH_URL = "https://laws.e-gov.go.jp/";

/** 出典表記（画面のフッター・条文表示で使う） */
export const EGOV_ATTRIBUTION = "出典：e-Gov法令検索（デジタル庁）";
