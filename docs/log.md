# M3E Documents Log

このファイルは `docs/` の LLM Wiki 型運用ログである。ingest / organize / lint / query を時系列で追記する。

## [2026-06-27] ingest | LLM Wiki pattern

- Source: `docs/ideas/260627_llm_wiki_pattern.md`
- Action: 添付 Markdown を verbatim で stow した。
- Promoted: `docs/06_Operations/LLM_Wiki_Schema.md`

## [2026-06-27] organize | docs index bootstrap

- Action: `docs/` 全体を content-oriented index で横断できるようにした。
- Index: `docs/index.md`
- Check: `node scripts/ops/check-docs-index.mjs --check`
- Coverage: `docs/.obsidian/` と `.DS_Store` を除く `docs/` 配下のファイル。
