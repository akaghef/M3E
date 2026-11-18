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

## [2026-11-18] promote | Engine（思考の熱機関）

- Source: `docs/research/m3e_data_structure_conversations/raw_conversations/` の 2026-03-25「温度とグラフ構造」、`docs/ideas/70_concept/thought_physics/`、2026-11-18 の akaghef との議論
- Promoted: `docs/01_Vision/Engine.md`
- Glossary: Engine、温度、体積、活動を追加
- 保存の形（極性・温度の式・キャッシュの持ち方）は record schema の未決として残した

## [2026-11-18] promote | LLM のワークベンチとしての M3E

- Source: `docs/research/m3e_data_structure_conversations/raw_conversations/` の 2026-04-17「重要Resource管理のアプローチ」（極性）、2026-11-18 の akaghef との議論（種別の変更、task）
- Promoted: `docs/01_Vision/LLM_Workbench.md`
- 保存の形（task の欄、種別の変更の組み合わせ、alias の極性）は record schema の未決として残した
