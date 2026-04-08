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
- Priority (P1〜P5、P1 が最優先)

---

## ▶ Ready（着手可能・優先度順）

### P1: Team Collaboration Phase 2

- Date: 2026-04-08
- Topic: Collab Phase 2 — conflict backup + エンティティ一覧 UI + 監査ログ
- Owner: -
- State: ready
- Link: `dev-docs/03_Spec/Team_Collaboration.md` (Phase 2)
- Note: Phase 1 完了（entity/lock/SSE/push 15 tests pass）。次は堅牢化。conflict backup の退避・復元、誰がどの scope にいるかの UI、操作ログ

---

### P1: Cloud Sync 競合 UI 改善

- Date: 2026-04-08
- Topic: T4 — Cloud Sync conflict 時の diff 表示 + 確認ダイアログ
- Owner: codex1
- State: ready
- Link: `dev-docs/tasks/handoff_cloud_sync_conflict_ui.md`
- Note: codex1 にハンドオフ済み。ヒアリングセッションで詳細を詰めてから着手

---

### P2: CI Stage A

- Date: 2026-04-07
- Topic: CI Stage A の最小ジョブ実装（branch-role ゲート統合）
- Owner: -
- State: ready
- Link: `dev-docs/06_Operations/Test_and_CICD_Guide.md`
- Note: PR 前ゲートとして運用。`npm run build` + `node --test` を CI で回す最小構成

---

### P2: scope/alias 仕様拡張

- Date: 2026-04-07
- Topic: scope/alias 仕様を Beta 実装粒度に拡張
- Owner: -
- State: ready
- Link: `dev-docs/03_Spec/Scope_and_Alias.md`
- Note: delete/権限/同一scope制約の訂正と Beta 実装仕様化。Collab の scope lock と整合が必要

---

### P3: Linear↔Tree L1

- Date: 2026-04-07
- Topic: Linear↔Tree L1 最小実装と round-trip テスト
- Owner: -
- State: ready
- Link: `dev-docs/03_Spec/Linear_Tree_Conversion.md`
- Note: L1 インデント形式の export/import を可逆にする

---

### P3: parser/reconcile テスト

- Date: 2026-04-07
- Topic: parser/reconcile 回帰テスト追加
- Owner: -
- State: ready
- Link: `dev-docs/03_Spec/Linear_Tree_Conversion.md`
- Note: Linear 変換 UI の誤変換防止

---

### P3: MCP 実運用テスト

- Date: 2026-04-07
- Topic: MCP サーバー経由の LLM 連携パイプラインの実運用テスト
- Owner: manager
- State: ready
- Link: `dev-docs/03_Spec/REST_API.md` (LLM 連携セクション)
- Note: m3e_mcp_server.py を Claude Desktop に登録し、実際のノード操作を検証

---

## ⏸ Blocked（判断待ち）

### セキュリティ検討（4件 — Owner: akaghef が判断）

- Date: 2026-04-08
- Topic: Collab API セキュリティ一括検討
- Owner: akaghef
- State: blocked
- Link: `dev-docs/03_Spec/Team_Collaboration.md` (セキュリティ検討事項)
- Note: 以下4点をまとめて判断する
  1. **CSRF**: カスタムヘッダー `X-M3E-Token` で十分か
  2. **LAN 露出**: 127.0.0.1 バインド維持 or LAN 公開時の認証・暗号化
  3. **エージェント偽装**: トークン有効期限、revocation API の要否
  4. **入力バリデーション**: scope push の部分 validate 方式

---

### MVP Phase 5

- Date: 2026-04-07
- Topic: MVP Phase 5 操作性調整
- Owner: -
- State: blocked
- Link: `dev-docs/02_Strategy/MVP_Definition.md` (Phase 5)
- Note: MVP は凍結方針（2026-04-08決定）。操作性改善は beta 側で進める

---

## 📦 Pooled（未整理）

- Date: 2026-04-07
- Topic: MCP ツールに alias / GraphLink / nodeType 変更を追加
- Owner: -
- State: pooled
- Link: -
- Note: 現在の MCP ツールは text の CRUD のみ。scope/alias の Beta 実装後に合わせて拡張

---

- Date: 2026-04-07
- Topic: Gateway policy Phase 2 実装（LiteLLM 統合）
- Owner: -
- State: pooled
- Link: `dev-docs/04_Architecture/AI_Infrastructure.md`
- Note: 設計済み・未実装。Phase 1（直接呼び出し）は動作中

---

## ✅ Done（直近のみ保持、古いものは daily に委譲）

- Date: 2026-04-08
- Topic: Team Collaboration Phase 1 実装
- State: done
- Note: entity/auth/lock/SSE/scope-push 完了。collab.ts + 15 tests pass

---

- Date: 2026-04-08
- Topic: main マージ + vYYMMDD タグ付与
- State: done
- Note: v260408 + v260408-2 完了

---

- Date: 2026-04-07
- Topic: REST API 仕様書の作成
- State: done
- Note: Document API / Cloud Sync API / LLM 連携の全エンドポイントを文書化

---

- Date: 2026-04-02
- Topic: 運用文書の責務分離
- State: done
- Note: Documentation_Rules.md 策定。260407 時点で運用定着確認
