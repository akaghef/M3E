# M3E Data Structure Conversation Corpus

ChatGPT export内の M3E 関連会話から、データ構造・通信形式・正本境界・属性表現に関係する材料を M3E repo 側へコピーした作業パッケージ。

- generated: 2026-05-14 12:25:07
- source: `C:\Users\Akaghef\data\作業\chatGPTdata\MarkdownFiles\Projects\Akaghef\M3E`
- raw copy: `raw_conversations/`
- source manifest: `source_manifest.csv`, `source_manifest.md`
- curated evidence: `extracts/curated_core_evidence.md`
- extracted evidence: `extracts/high_purity_evidence.md`, `extracts/high_value_evidence.md`
- distilled notes: `01_pure_brief.md`, `02_transport_schema_seed.md`, `03_core_i64_seed.md`, `04_open_questions.md`

## 扱い

`raw_conversations/` は証跡であり、仕様ではない。会話ログには重複・古い案・途中案が混ざる。

仕様化に使う入口は次の順に読む。

1. `01_pure_brief.md`
2. `02_transport_schema_seed.md`
3. `03_core_i64_seed.md`
4. `extracts/curated_core_evidence.md`
5. `extracts/high_purity_evidence.md`
6. `source_manifest.md`

## 抽出方針

全 Markdown 会話ファイルを raw としてコピーした。さらに `TOON`, `MIOS`, `Command Patch`, `Model.apply`, `JSON正本`, `SQLite`, `nodeAttrs`, `scope/alias`, `DTO`, `極性`, `dependability` などの語でスコアリングし、設計判断に近い行だけを抽出した。

「純度」は、raw を捨てることではなく、raw を証跡層へ隔離し、設計判断だけを別ノートへ集約することで担保する。
