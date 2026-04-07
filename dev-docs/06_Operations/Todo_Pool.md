# Todo Pool

## 目的

確定前の粗い TODO を一時プールし、正式タスク化前の取りこぼしを防ぐ。

## 運用ルール

1. 粗いメモでも登録してよい（未分解可）。
2. 実施完了の詳細は daily note に残す。
3. `Current_Status.md` には現在の重要項目のみ反映する。
4. 同じ項目が正式化されたら `Link` に反映先を記録する。

## 記法

- Date
- Topic
- Owner
- State (`pooled` | `ready` | `doing` | `blocked` | `done`)
- Link
- Note

---

## Entries

- Date: 2026-04-07
- Topic: MCP サーバー経由の LLM 連携パイプラインの実運用テスト
- Owner: manager
- State: ready
- Link: `dev-docs/03_Spec/REST_API.md` (LLM 連携セクション)
- Note: m3e_mcp_server.py を Claude Desktop に登録し、実際のノード操作を検証する。alias / link / nodeType 変更は未対応のため、需要に応じて拡張

---

- Date: 2026-04-07
- Topic: REST API 仕様書の作成
- Owner: manager
- State: done
- Link: `dev-docs/03_Spec/REST_API.md`
- Note: Document API / Cloud Sync API / LLM 連携の全エンドポイントを文書化。Data_Model.md, AI_Common_API.md から相互リンク済み

---

- Date: 2026-04-07
- Topic: MCP ツールに alias / GraphLink / nodeType 変更を追加
- Owner: -
- State: pooled
- Link: -
- Note: 現在の MCP ツールは text ノードの CRUD のみ。scope/alias の Beta 実装後に合わせて拡張

---

- Date: 2026-04-07
- Topic: CI Stage A の最小ジョブ実装（branch-role ゲート統合）
- Owner: -
- State: ready
- Link: `dev-docs/06_Operations/Test_and_CICD_Guide.md`
- Note: B6（Decision Pool）と A2（Current_Status Next 3）を統合。PR 前ゲートとして運用

---

- Date: 2026-04-07
- Topic: Linear↔Tree L1 最小実装と round-trip テスト
- Owner: -
- State: ready
- Link: `dev-docs/03_Spec/Linear_Tree_Conversion.md`
- Note: B2（Decision Pool）。L1 インデント形式の export/import を可逆にする

---

- Date: 2026-04-07
- Topic: parser/reconcile 回帰テスト追加
- Owner: -
- State: ready
- Link: `dev-docs/03_Spec/Linear_Tree_Conversion.md`
- Note: B1（Decision Pool）。Linear 変換 UI の誤変換防止

---

- Date: 2026-04-07
- Topic: scope/alias 仕様を Beta 実装粒度に拡張
- Owner: -
- State: ready
- Link: `dev-docs/03_Spec/Scope_and_Alias.md`
- Note: B4 + B5（Decision Pool）。delete/権限/同一scope制約の訂正と Beta 実装仕様化

---

- Date: 2026-04-07
- Topic: MVP Phase 5 操作性調整（導線短縮・ラベル整理・初見テスト）
- Owner: -
- State: doing
- Link: `dev-docs/02_Strategy/MVP_Definition.md` (Phase 5)
- Note: E1〜E3。主要操作の導線短縮、操作ラベル整理、初見ユーザーテスト

---

- Date: 2026-04-07
- Topic: Gateway policy Phase 2 実装（LiteLLM 統合）
- Owner: -
- State: pooled
- Link: `dev-docs/04_Architecture/AI_Infrastructure.md`
- Note: F1。設計済み・未実装。Phase 1（直接呼び出し）は動作中

---

- Date: 2026-04-02
- Topic: 運用文書の責務分離（daily/status/todo pool）
- Owner: manager
- State: done
- Link: `dev-docs/06_Operations/Documentation_Rules.md`
- Note: 1サイクル運用後に不足項目を追記する。260407 時点で運用定着を確認
