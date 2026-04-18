# Codex 作業依頼: Obsidian Vault 強結合 (tight coupling)

## 依頼概要

M3E マップと Obsidian Vault の **双方向ライブ同期** を実装する。
一度きりの import/export ではなく、fs.watch ベースで Vault と M3E マップの変更を相互反映する「強結合」を目指す。

**最終目標**: ユーザーが Obsidian で書いた .md が M3E に即反映され、M3E で編集した構造が .md に即書き戻される。Obsidian での日常メモが M3E の構造化思考にそのまま昇格する流れを作る。

## 仕様書

- [docs/03_Spec/Obsidian_Vault_Integration.md](../docs/03_Spec/Obsidian_Vault_Integration.md) — Import/Export の5フェーズ仕様（既存）
- [docs/design/local_file_integration.md](../docs/design/local_file_integration.md) — ローカルファイル統合の全体設計

## マップ上の位置

`strategy/260413 Evolution Plan/S6: 競合吸収 1×1/Obsidian 強結合 (tight coupling)` 配下に全タスクを展開済み。実装時はマップのノードを見ながら進めること。

## 段階導入（必ずこの順で）

### P1: Import one-shot (AI無し)
- Phase A (Discovery): Vault配下 .md を再帰列挙 → folderノード骨格生成
- Phase B (Parse): frontmatter / wikilink / linearText 抽出
- Phase E (Persist): AppState保存 + SSE完了通知
- **AC**: 10-20 .md の小Vault を取り込めること

### P2: Import + AI Transform
- Phase C: 既存 `linear-to-tree` subagent を再利用して linearText → tree 構造
- Phase D: `[[wikilink]]` → folder alias 解決
- **AC**: wikilink が folder alias として動作、frontmatter tags/aliases が attributes 反映

### P3: Export one-shot (逆変換)
- folder ノード → ディレクトリ復元
- subtree → Markdown 見出し階層
- alias → `[[wikilink]]`
- attributes → frontmatter YAML
- **AC**: round-trip (import→export) で元 .md との diff 最小

### P4: Watch層 (強結合の核)
- `fs.watch` で Vault 変更検知 → 差分 import
- M3E マップ変更 → 対応 .md 書き戻し（debounce）
- ファイル削除 → ノード削除（orphan 保護付き）
- **AC**: .md 変更 → マップに <5s 反映

### P5: Conflict UI + 大規模対応
- 同時編集時の conflict UI（非破壊）
- 1000+ .md 規模のパフォーマンス確認
- **AC**: 競合発生時にユーザー確認なしにデータを壊さない

## 受け入れ基準（全体）

- AC1: 小Vault (10-20 .md) → マップ構造復元
- AC2: `[[wikilink]]` → folder alias 動作
- AC3: frontmatter tags/aliases → attributes 反映
- AC4: round-trip で diff 最小
- AC5: Watch層で .md 変更 → <5s でマップ反映
- AC6: 競合発生時に非破壊で conflict UI 提示

## 技術課題（設計時に決めること）

- 画像/添付ファイル `![[image.png]]` の扱い
- Dataview / Templater 等プラグイン記法の保持 or 無視
- 大規模Vault (1000+ .md) のパフォーマンス
- Windows/Mac のパス差異・改行コード
- linearText 6000字上限超過時の切り詰め方針

## API / UI

- `POST /api/vault/import { vaultPath }` — Import トリガー（SSE進捗）
- `POST /api/vault/export { nodeId, vaultPath }` — Export トリガー
- `GET /api/vault/watch` — SSE で変更通知
- 設定UI: Vault パス登録・解除
- 進捗UI: Phase A-E の可視化 + レビューモード

## 依存関係

- 既存 `linear-to-tree` subagent (AI infra)
- folder ノード型 + alias 機構（既存）
- SSE 通知基盤（既存）
- **S4 Red Team**: Vaultパス指定の path traversal 検証（クラウド公開前に必須）

## 作業進め方

- ブランチ: `dev-beta-obsidian` を新設（data ロールが主担当を想定）
- P1 から順に PR を分割して [pr-beta](../.claude/skills/pr-beta/SKILL.md) 経由で dev-beta にマージ
- 各フェーズの AC をテストコードで担保すること
- 不明点は `backlog/` に追加で書き出し、akaghef のレビューを待つ

## 注意事項

- **Cloud Sync は別タスク**。Obsidian 連携は完全ローカル完結で設計する
- **Red Team 未完了の段階で公開URL・共有機能との結合は禁止**（path traversal リスク）
- **P4 の Watch 層は fs.watch の OS 差異に注意**（Windows では chokidar など検討）

---

*2026-04-13*
