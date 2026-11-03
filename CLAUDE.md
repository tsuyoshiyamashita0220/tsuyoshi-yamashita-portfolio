@AGENTS.md

# CRIME ATLAS JAPAN 2026

日本の犯罪・刑事法をわかりやすく学べる Web 百科事典。設計は `docs/DESIGN.md`。

## 絶対のルール

- 法令の根拠は e-Gov 法令API の公式データだけ。条文・罪名・法定刑・法令番号・法令ID を記憶や推測で書かない。
- 条文の文言は `data/egov/laws/` のスナップショットから表示する。`data/egov/` は手で編集しない。
- 根拠を確認できない解説は `review.status: "draft"` のまま。公開ページに出さない。
- 外部公開（デプロイ）、課金が発生する操作、既存ファイルの削除は、ユーザーの明示的な指示があるまでしない。

## コマンド

- `npm run dev` / `npm run build` / `npm run lint`
- `npm run egov:search -- <法令名>` / `npm run egov:fetch -- <lawId>`（laws.e-gov.go.jp への接続が必要）

## 分業（`.claude/agents/`）

| エージェント | モデル | 役割 |
| --- | --- | --- |
| メインセッション | Opus | 設計、タスク分解、最終確認 |
| `implementer` | Sonnet | 画面・コンポーネント・スクリプトの実装 |
| `data-checker` | Haiku | JSON 形式・参照切れなど機械的な確認（読み取り専用） |
| `legal-reviewer` | Opus | 解説文と e-Gov 条文の突き合わせ（読み取り専用） |
