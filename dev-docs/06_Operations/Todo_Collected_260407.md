# やるべきこと一覧（2026-04-07 収集）

## 情報源

- `dev-docs/00_Home/Current_Status.md`
- `dev-docs/06_Operations/Todo_Pool.md`
- `dev-docs/06_Operations/Decision_Pool.md`
- `dev-docs/02_Strategy/MVP_Definition.md`
- コードベース内 TODO コメント
- AGENTS.md の優先度定義
- `dev-docs/daily/260403.md`

---

## A. 直近の運用タスク（Next 3 from Current_Status）

| # | タスク | 状態 | ソース |
|---|--------|------|--------|
| A1 | `dev-docs/daily/260402.md` の内容整合を最終確認 | blocked/risk | Current_Status |
| A2 | branch-role と変更ファイル範囲の CI 検証を追加 | 未着手 | Current_Status |
| A3 | `Todo_Pool.md` を実運用し、正式タスク化の流れを固定 | ready | Current_Status / Todo_Pool |

## B. Decision Pool の未完了 Next アクション

| # | Decision | Next アクション | Status |
|---|----------|----------------|--------|
| B1 | Linear 変換 UI（2026-04-02-002） | parser/reconcile の回帰テスト追加 | working-agreement |
| B2 | Linear↔Tree 変換（2026-04-02-001） | L1 export/import の最小実装と round-trip テスト | working-agreement |
| B3 | graph-level Link（2026-04-01-003） | Data_Model.md / Import_Export.md に Link 型と保存制約を追加 | working-agreement |
| B4 | scope/alias 訂正（2026-04-01-002） | Scope_and_Alias.md の delete/権限/同一 scope 制約を訂正 | working-agreement |
| B5 | scope/alias Beta 実装（2026-04-01-001） | Scope_and_Alias.md を Beta 実装粒度へ拡張 | working-agreement |
| B6 | テスト/CI 段階導入（2026-03-30-004） | Stage A の最小 CI ジョブを実装、PR 前ゲートを運用 | working-agreement |
| B7 | SVG 先行方針（2026-03-30-002） | 04_Architecture に描画インターフェースの境界整理 | working-agreement |

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

現在 Phase 1-4 はほぼ完了（基本的な読み取り・編集・描画・保存が動作中）。残り:

| # | Phase | 残タスク |
|---|-------|---------|
| E1 | Phase 5 | 主要操作の導線を短くする |
| E2 | Phase 5 | 操作ラベルと状態表示の整理 |
| E3 | Phase 5 | 初見ユーザーでの簡易操作確認 |
| E4 | MVP後 | AI 提案生成と承認フロー |
| E5 | MVP後 | scope / alias の完全実装 |
| E6 | MVP後 | Deep 差分履歴 |

## F. AI インフラ関連（260403 daily より）

| # | タスク | 状態 |
|---|--------|------|
| F1 | Gateway policy Phase 2 実装（LiteLLM 統合） | 設計済み・未実装 |
| F2 | Bitwarden 自動注入の安定化 | 運用中・改善余地あり |

---

## 推奨アクション順序

1. **A1**: 260402.md の競合解消確認（ブロッカー除去）
2. **A2 + B6**: CI 検証の導入（branch-role + Stage A の統合）
3. **A3**: Todo Pool 運用の定着
4. **B2**: Linear↔Tree L1 最小実装（機能面の前進）
5. **B1**: parser/reconcile 回帰テスト
6. **E1-E3**: MVP Phase 5 の操作性調整
7. **B3-B5**: spec 文書の更新（Link, scope/alias）
8. **D: P4**: Demo quality の向上
