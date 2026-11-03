# CRIME ATLAS JAPAN 2026 設計書

最終更新: 2026-11-03 / 状態: フェーズ 2 まで完了（刑法・刑事訴訟法の条文ビューア）、未公開

## 1. 目的

日本の犯罪と刑事法を、法律を学んだことがない人でも読める言葉で説明する Web 百科事典。
すべての法律情報は e-Gov 法令API の公式データを根拠にし、根拠のない記述は載せない。

## 2. 開発環境（2026-11-03 確認）

| 項目 | 値 |
| --- | --- |
| Node.js | v22.23.4 |
| npm | 10.9.9 |
| Next.js | 16.4.4（App Router、`cacheComponents: true`、Turbopack） |
| React | 19.3.0 |
| TypeScript | 5 系 |
| スタイル | Tailwind CSS 4 |
| Lint | ESLint 9 + eslint-config-next |
| リポジトリ | `tsuyoshiyamashita0220/tsuyoshi-yamashita-portfolio`（初期状態は空、コミットなし） |
| 作業ブランチ | `claude/crime-atlas-japan-setup-wxbyu2` |

**e-Gov 接続**: 環境のネットワーク設定で `laws.e-gov.go.jp` を許可済み（2026-11-03）。
Node の fetch はプロキシを自動で使わないため、`NODE_USE_ENV_PROXY=1` を付けて実行する（npm スクリプトは付与済み）。

### e-Gov 法令API v2（2026-11-03 に実応答で確認）

| 用途 | リクエスト | 応答の主なキー |
| --- | --- | --- |
| 法令検索 | `GET /api/2/laws?law_title=<法令名>` | `total_count`, `count`, `laws[]`（各要素に `law_info`, `revision_info`, `current_revision_info`） |
| 本文取得 | `GET /api/2/law_data/<lawId>?response_format=json` | `law_info`, `revision_info`, `law_full_text`, `attached_files_info` |

- `law_full_text` は XML を `{ tag, attr, children }` の木にしたもの（`Law` → `LawNum` / `LawBody` → …）。変換スクリプトはこの木をたどって `EgovLawSnapshot` を作る。
- `revision_info.law_revision_id` を `EgovLawMeta.revisionId`、`amendment_enforcement_date` を `enforcementDate` に対応させる。
- `current_revision_status`（例: `CurrentEnforced`, `Repeal`）で現行法かどうかを判別できる。検索結果には廃止法令も混ざるので、取り込む法令は人が選ぶ。
- 確認例: 法令名「刑法」の検索結果のうち現行の「刑法」は法令ID `140AC0000000045`（明治四十年法律第四十五号）、取得時点の改正版の施行日は 2026-05-21。

## 3. 開発計画

| フェーズ | 内容 | 完了条件 |
| --- | --- | --- |
| 0. 初期設定（済） | Next.js 雛形、型定義、取得スクリプト、エージェント定義、設計書 | `npm run build` が通る |
| 1. データ基盤（済） | 原本取得 → `EgovLawSnapshot` への変換スクリプト | 刑法・刑事訴訟法のスナップショットが `data/egov/laws/` にあり、sha256 が原本と一致 |
| 2. 条文ビューア（済） | `/laws`、`/laws/[lawId]`、`/laws/[lawId]/articles/[num]` | 全条が e-Gov 原文どおり表示され、出典・施行日が出る |
| 3. 罪名解説（5 件承認待ち） | `CrimeEntry` を作成し、legal-reviewer の審査を通ったものだけ公開 | `verified` のエントリのみ表示 |
| 4. 刑事手続・用語集 | `/procedure`、`/glossary` | 同上 |
| 5. 検索・仕上げ | 静的検索インデックス、アクセシビリティ、OGP | Lighthouse でアクセシビリティ 90 以上 |
| 6. 公開 | ホスティング先の決定 | **ユーザーの承認後のみ**（今回は対象外） |

対象法令の候補（法令名のみ。法令ID は取得時に e-Gov の検索結果から確定する）:
刑法、刑事訴訟法、少年法、軽犯罪法、その他の特別刑法は段階的に追加。

## 4. 画面構成

| パス | 画面 | 主な内容 |
| --- | --- | --- |
| `/` | トップ | 検索窓、罪名カテゴリ、刑事手続の入口、データ更新日 |
| `/crimes` | 罪名一覧 | カテゴリ別一覧（`verified` のみ） |
| `/crimes/[slug]` | 罪名詳細 | ひとことで言うと → 成立の要件 → 条文（e-Gov 原文） → 法定刑（原文） → 関連罪名・用語 → 出典 |
| `/laws` | 法令一覧 | 取り込み済み法令、施行日、取得日 |
| `/laws/[lawId]` | 法令目次 | 編・章・節のツリー |
| `/laws/[lawId]/articles/[num]` | 条文 | 原文、前後の条へのリンク、この条を参照する解説 |
| `/procedure` | 刑事手続の流れ | 捜査 → 起訴 → 公判 → 判決などの図解 |
| `/procedure/[slug]` | 手続の詳細 | 根拠条文つきの説明 |
| `/glossary`、`/glossary/[slug]` | 用語集 | 五十音順 |
| `/search` | 検索 | ビルド時に作る静的インデックスで検索 |
| `/about` | このサイトについて | 出典、データ取得日、免責（法律相談ではない旨） |

共通レイアウト: ヘッダー（サイト名・検索・主要ナビ）、パンくず、フッター（e-Gov 出典表記・最終取得日・免責）。
スマートフォン優先で設計する。

**Cache Components の制約**: 動的ルートの `generateStaticParams` は 1 件以上を返す必要がある
（空配列はビルドエラー）。`/crimes/[slug]` などは公開できるエントリが 1 件以上できてから作る。

**実装済み（フェーズ 2）**: `/laws`、`/laws/[lawId]`、`/laws/[lawId]/articles/[num]`。スナップショットは
`fs.readFileSync` で読むため全ページがビルド時に静的生成される（2 法令で約 1,000 ページ）。
存在しない URL は Next.js の 404 画面を表示する（部分プリレンダリングのため HTTP ステータスは 200 になる点に注意）。

### 変換の規則（`scripts/build-egov-snapshots.mjs`）

- 本則（MainProvision）のみ。附則は未収録。
- 複数の文（本文・ただし書）は連結、段（Column）は全角スペースで連結、ふりがな（Rt）は省く。
- 表（TableStruct）は行×セルの文字列として保持。号の細分（Subitem1, 2…）は入れ子で保持。
- 削除条の範囲番号 `73:76` は URL 用に `73-76` へ置換。
- 想定外のタグがあれば中止。条ごとに、変換後の文字が原本と過不足なく一致するかを検証する。
- 原本の SHA-256 が取得記録と違えば中止（原本の手編集を検出）。

## 5. データ構造

```
data/
  egov/raw/<lawId>.json         e-Gov 応答の原本（加工しない）
  egov/raw/<lawId>.meta.json    取得 URL・日時・sha256
  egov/laws/<lawId>.json        画面用に変換した EgovLawSnapshot
  content/crimes/<slug>.json    CrimeEntry
  content/glossary/<slug>.json  GlossaryTerm
  content/procedure/<slug>.json ProcedureStep
```

型は `src/types/law.ts`（e-Gov 由来）と `src/types/content.ts`（編集コンテンツ）。

```
EgovLawSnapshot ─ meta (lawId, lawNum, lawTitle, revisionId, enforcementDate)
                ├ snapshot (sourceUrl, fetchedAt, sha256)
                ├ toc[]  (編・章・節 → articleNums)
                └ articles[] (num, title, caption, paragraphs[] → items[])

CrimeEntry ─ basis: LawRef[]        ← 本条
           ├ summary / elements: CitedText (text + lawRefs / sourceRefs)
           ├ penaltyRef: LawRef[]   ← 法定刑は文言を持たず参照のみ
           └ review: draft | reviewed | verified (+ checkedRevisions)

LawRef = { lawId, article, paragraph?, item? }  → EgovLawSnapshot を指す
```

### 公開までの流れ（実装済み）

1. 下書き（`draft`）を作る。`npm run content:check` で参照切れ・根拠なしを検出（`npm run build` でも自動実行）。
2. `legal-reviewer`（Opus）が条文と突き合わせる。指摘を直したら `reviewed` にし、`checkedRevisions` に確認した版を入れる。
3. **人（サイトの責任者）が承認**したら `verified` にする。公開ビルドに出るのは `verified` かつ `checkedRevisions` が現行版と一致するものだけ。
4. 確認用には `CONTENT_PREVIEW=1 npm run build` で未承認のものも表示できる（注意書きつき。公開ビルドでは使わない）。

2026-11-03 時点: 刑法の殺人・傷害・窃盗・強盗・詐欺の 5 件が `reviewed`（承認待ち）。

### 根拠の担保

1. 条文・法定刑の文言は編集コンテンツに書かず、表示時にスナップショットから引く。
2. 法令が改正されて `revisionId` が変わったら、`checkedRevisions` が古いエントリを自動で `reviewed` 扱いに戻し、再審査する。
3. ビルド時チェック（フェーズ 1 で実装）: 参照切れの `LawRef`、根拠のない `CitedText` があればビルド失敗。

## 6. Claude Code のモデル分業

Claude Code ではサブエージェントを `.claude/agents/*.md` に定義し、frontmatter の `model`
（`sonnet` / `haiku` / `opus` / `inherit`）で使うモデルを指定できる。Agent ツールの呼び出し時に
`model` を指定して上書きすることもできる。メインセッションのモデルは `/model` で切り替える。

| 担当 | モデル | 使う場面 | 理由 |
| --- | --- | --- | --- |
| メインセッション | Opus | 設計、タスク分解、レビュー結果の統合 | 判断と全体把握が必要 |
| `implementer` | Sonnet | ページ・コンポーネント・変換スクリプトの実装 | 実装の質と速度のバランス |
| `data-checker` | Haiku | JSON 形式、参照切れ、件数集計（読み取り専用） | 機械的で量が多い作業を安く速く |
| `legal-reviewer` | Opus | 解説文と条文の突き合わせ（読み取り専用） | 正確さが最優先 |

流れ: Opus が設計 → Sonnet が実装 → Haiku が機械チェック → Opus が法的内容を審査 → 人が最終承認。
サブエージェントは毎回ゼロから文脈を読み直すので、小さな作業はメインセッションで直接行う。

## 7. やらないこと（今回）

- 外部公開・デプロイ
- 課金が発生するサービスの契約・設定
- 既存ファイルの削除
- 未確認の法律情報の作成（法令ID・条文・罪名・法定刑を含む）
