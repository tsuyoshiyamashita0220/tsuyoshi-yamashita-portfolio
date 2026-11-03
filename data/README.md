# data/

| ディレクトリ | 中身 | 編集してよいか |
| --- | --- | --- |
| `egov/raw/` | e-Gov 法令API の応答原本と取得記録（`*.meta.json`） | **不可**（スクリプトだけが書く） |
| `egov/laws/` | 原本を画面用に変換した `EgovLawSnapshot`（`src/types/law.ts`） | **不可**（変換スクリプトだけが書く） |
| `content/crimes/` | 罪名解説 `CrimeEntry`（`src/types/content.ts`） | 可（根拠必須） |
| `content/glossary/` | 用語集 `GlossaryTerm` | 可（根拠必須） |
| `content/procedure/` | 刑事手続 `ProcedureStep` | 可（根拠必須） |

## ルール

1. 条文・法定刑の文言は `content/` に書かない。`LawRef` で `egov/laws/` を参照する。
2. 解説文の法的な主張には `lawRefs` か `sourceRefs` を付ける。
3. 根拠を確認できないエントリは `review.status: "draft"` のままにする（サイトに出さない）。
4. 法令を追加する手順: `npm run egov:search -- <法令名>` で法令ID を確かめる → `npm run egov:fetch -- <lawId>` → `npm run egov:build`。
5. 収録済み（2026-11-03 取得）: 刑法、刑事訴訟法（本則のみ。附則は未収録）。
