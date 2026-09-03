# Memoforest 関連サービス考察

## Status

- 種別: idea / investigation bundle
- 対象: 2026-08-06 時点の公開版 Memoforest
- M3E 関連: S3（保存・同期・復元）、S16（canonical source / write authority）
- 採用状態: 未採用。実装・同期開始を意味しない

## Why

Memoforestを、M3Eの代替保存基盤ではなく、Rapidを人間が階層化・注釈・数式編集する外部ワークベンチ候補として評価する。二重正本を避け、JSON交換、source adapter、proposal writeのどこまでを接続可能か整理する。

## Bundle

- [`memoforest-export-v3.json`](./memoforest-export-v3.json) — Memoforest v3形式の構造調査＋考察9まとめ、158データノード
- [`01_public_software_structure.md`](./01_public_software_structure.md) — 公開UI・配信コードから確認したソフトウェア構造
- [`02_m3e_fit_assessment.md`](./02_m3e_fit_assessment.md) — M3Eとの役割比較と結論
- [`03_canonical_ownership.md`](./03_canonical_ownership.md) — canonical source / owner / write authority境界
- [`04_data_mapping.md`](./04_data_mapping.md) — Memoforest v3 → M3E概念対応と損失
- [`05_integration_options.md`](./05_integration_options.md) — 手動交換からproposal writeまでの選択肢
- [`06_security_privacy.md`](./06_security_privacy.md) — 保存先・クラウド・AI往復の露出面
- [`07_operations_recovery.md`](./07_operations_recovery.md) — revision、競合、journal、Recovery Gate
- [`08_roadmap.md`](./08_roadmap.md) — 小さな検証から始める導入計画
- [`validation.json`](./validation.json) — JSON構造検証結果と既知の制約

## Current conclusion

Memoforestは**人間が1文書を深く読むRapid編集面**として有望。一方、M3Eはworkspace / map / scope / node、canonical owner、provenance、write authorityを横断管理する側に留める。最初の検証は手動JSON round-tripまたはread-only SourceReadPortとし、自動writeはSemantic Command、base revision、read-after-write、Recovery Gateが成立してから評価する。

## Open Questions

1. Memoforest projectをM3Eのmapとして扱うか、artifact portalとして扱うか。
2. annotationのquote anchorをM3Eでどのfacetへ保持するか。
3. project-level LaTeX macroを表示metadataとしてどこへ置くか。
4. Freeプランのまとめ数上限を検証運用上どう扱うか。
5. 外部workspace APIが公開契約として安定しているか。

