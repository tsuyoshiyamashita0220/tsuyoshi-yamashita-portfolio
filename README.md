# CRIME ATLAS JAPAN 2026

日本の犯罪・刑事法をわかりやすく学べる Web 百科事典（開発中・未公開）。

- 設計書: [docs/DESIGN.md](docs/DESIGN.md)
- 開発ルール: [CLAUDE.md](CLAUDE.md)
- データの置き場所: [data/README.md](data/README.md)

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

法令データは e-Gov 法令API から取得します（`scripts/fetch-egov-law.mjs`）。
