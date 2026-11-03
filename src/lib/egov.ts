/**
 * e-Gov 法令API 関連の定数。
 *
 * エンドポイントは e-Gov 法令API（Version 2）の公式仕様書で確認してから使う。
 * この開発環境からは laws.e-gov.go.jp に接続できなかったため、
 * 2026-11-03 時点では実際の応答による確認をしていない。
 */
export const EGOV_API_BASE = "https://laws.e-gov.go.jp/api/2";

/** 閲覧者向けの e-Gov 法令検索ページ */
export const EGOV_LAW_SEARCH_URL = "https://laws.e-gov.go.jp/";

/** 出典表記（画面のフッター・条文表示で使う） */
export const EGOV_ATTRIBUTION = "出典：e-Gov法令検索（デジタル庁）";
