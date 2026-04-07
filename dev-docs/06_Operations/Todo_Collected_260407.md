# やるべきこと一覧（2026-04-07 更新）

## 情報源

- `dev-docs/00_Home/Current_Status.md`
- `dev-docs/06_Operations/Todo_Pool.md`
- `dev-docs/06_Operations/Decision_Pool.md`
- `dev-docs/02_Strategy/MVP_Definition.md`
- `dev-docs/03_Spec/REST_API.md`
- コードベース内 TODO コメント
- AGENTS.md の優先度定義
- `dev-docs/daily/260403.md`

---

## A. 直近の運用タスク

| # | タスク | 状態 | ソース |
|---|--------|------|--------|
| A1 | ~~`dev-docs/daily/260402.md` の内容整合を最終確認~~ | 解消見込み（260403 以降の作業で上書き） | Current_Status |
| A2 | CI Stage A 導入（branch-role ゲート統合） | ready | Current_Status + Decision Pool B6 |
| A3 | ~~Todo Pool 運用の定着~~ | done（260407 に全項目を移行・運用開始） | Current_Status |
| A4 | REST API 仕様書の作成 | done | 260407 新規 |
| A5 | MCP 経由 LLM 連携パイプラインの実運用テスト | ready | 260407 新規 |

## B. Decision Pool の未完了 Next アクション

| # | Decision | Next アクション | Status | 進捗 |
|---|----------|----------------|--------|------|
| B1 | Linear 変換 UI（2026-04-02-002） | parser/reconcile の回帰テスト追加 | working-agreement | 未着手 |
| B2 | Linear↔Tree 変換（2026-04-02-001） | L1 export/import の最小実装と round-trip テスト | working-agreement | 未着手 |
| B3 | graph-level Link（2026-04-01-003） | Data_Model.md / Import_Export.md に Link 型と保存制約を追加 | working-agreement | promoted 済み |
| B4 | scope/alias 訂正（2026-04-01-002） | Scope_and_Alias.md の delete/権限/同一 scope 制約を訂正 | working-agreement | promoted 済み |
| B5 | scope/alias Beta 実装（2026-04-01-001） | Scope_and_Alias.md を Beta 実装粒度へ拡張 | working-agreement | 未着手 |
| B6 | テスト/CI 段階導入（2026-03-30-004） | Stage A の最小 CI ジョブを実装、PR 前ゲートを運用 | working-agreement | 未着手 |
| B7 | SVG 先行方針（2026-03-30-002） | 04_Architecture に描画インターフェースの境界整理 | working-agreement | 未着手 |

## C. コード内 TODO

| # | ファイル | 内容 |
|---|---------|------|
| C1 | `scripts/final/migrate-from-beta.bat` L80 | `TODO: call node final/dist/node/migrate.js when schema changes occur` |

## D. Beta 優先度別タスク（AGENTS.md より）

| 優先度 | カテゴリ | 具体例 |
|--------|---------|--------|
| P5（最優先） | Infrastructure & CI | テスト環境整備、CI パイプライン、デプロイスクリプト |
| P4 | Demo quality | ビジュアルポリッシュ、fit-to-content、focus-selected |
| P3 | MVP completeness | メタデータ描画、スタートアップパッケージング |
| P2 | Dev infrastructure | Stage A CI、hit-test カバレッジ |
| P1（後回し） | Deferred | reparent feedback UI、delete confirmation |

## E. MVP 残タスク（MVP_Definition.md Phase 別）

Phase 1〜4 は完了。残り:

| # | Phase | 残タスク | 状態 |
|---|-------|---------|------|
| E1 | Phase 5 | 主要操作の導線を短くする | doing |
| E2 | Phase 5 | 操作ラベルと状態表示の整理 | doing |
| E3 | Phase 5 | 初見ユーザーでの簡易操作確認 | 未着手 |
| E4 | MVP後 | AI 提案生成と承認フロー | pooled |
| E5 | MVP後 | scope / alias の完全実装 | B4+B5 で準備中 |
| E6 | MVP後 | Deep 差分履歴 | pooled |

## F. AI / LLM インフラ関連

| # | タスク | 状態 | 備考 |
|---|--------|------|------|
| F1 | Gateway policy Phase 2 実装（LiteLLM 統合） | pooled | 設計済み・未実装 |
| F2 | Bitwarden 自動注入の安定化 | 運用中 | 改善余地あり |
| F3 | MCP サーバー実運用テスト | ready | 260407 新規。m3e_mcp_server.py の Claude Desktop 登録と検証 |
| F4 | MCP ツール拡張（alias / link / nodeType 変更） | pooled | scope/alias Beta 実装後 |

## G. ドキュメント整備

| # | タスク | 状態 | 備考 |
|---|--------|------|------|
| G1 | REST API 仕様書 | done | 03_Spec/REST_API.md 作成済み |
| G2 | Command_Reference.md を beta Actions に合わせて更新 | pooled | 現在は MVP 版のまま。Actions_Beta.md と乖離あり |
| G3 | 04_Architecture に描画 IF 境界を整理 | ready | B7 と連動 |

---

## 推奨アクション順序

1. **A2 + B6**: CI Stage A 導入（branch-role ゲート + 最小テストジョブ）→ 開発安全網
2. **A5 + F3**: MCP サーバー実運用テスト → LLM 連携の実用化
3. **B2**: Linear↔Tree L1 最小実装 → 機能面の前進
4. **B1**: parser/reconcile 回帰テスト → L1 安定性
5. **E1〜E3**: MVP Phase 5 操作性調整 → MVP 完了判定へ
6. **B5**: scope/alias Beta 実装粒度の仕様拡張 → 次期機能の基礎
7. **D: P4**: Demo quality 向上
8. **F4**: MCP ツール拡張（alias/link 対応）
