---
pj_id: PJ03
project: SelfDrive
date: 2026-04-20
status: active
owner: akaghef
related: plan.md
---

# PJ03 — SelfDrive

M3E に state machine / Agent workflow を持ち込むための設計・実装方針を確定し、最小の 1 workflow を成立させる PJ。最終的に PJ03 自身の 1 task を自前 workflow engine で回す dogfood で成立を示す。

## Vision

### 問題

現在の sub-pj 運用は、静的な `tasks.yaml` + hooks + resume-cheatsheet の組み合わせで回っているが、状態遷移・checkpoint・stop 理由の分類・evaluator loop が散在し、どこが「正本」かが曖昧。結果として次のようになる:

- 同じ停止理由が blocked / sleeping / escalated のどれになるか場当たり的
- resume 時にどの state から再開すべきかが曖昧
- evaluator round loop が sub-pj-do の指示文字列に埋め込まれており、機械可読ではない
- M3E の vision（システム〜1 task まで相似形で扱う）と静的 tree が噛み合わない

### 完了像

1 task 単位の workflow を、state / edge / checkpoint を持つ明示的な state machine として記述・実行できる。最小 engine が PJ03 自身の task を 1 本 dogfood で回しきる。設計上の分岐（正本・流用方針・最小粒度・M3E 統合境界）が確定し、Phase 1 以降の実装根拠になる。

### In Scope

- workflow state set / edge set / checkpoint 構造の確定
- 現行資産（tasks.yaml / hooks / ScheduleWakeup / reviews / resume-cheatsheet）の workflow element へのマッピング
- stop reason taxonomy（sub-pj-guard E1/E2/E3 を含む）
- TypeScript 型定義と最小 runner (`beta/src/shared` / `beta/src/node`)
- Generator / Evaluator / Router 構造の engine への落とし込み
- 1 task dogfood run による成立確認

### Out of Scope

- 可視化の強化（現状 poor のままでよい）
- M3E 本体の UI / viewer 改善（Phase 3 の最小統合を除く）
- 並列マルチ sub-PJ 実行
- LLM モデル選定・切替
- sub-pj protocol 自体の大幅改訂（改善提案は backlog に pool）
- 完成形 engine の実装（まずは 1 task が回ることを優先）

## 主成果物

1. **設計分岐の確定 memo 群** — workflow state set / edge / legacy asset mapping / stop taxonomy の 4 本（Phase 0 成果物、`docs/` 配下）
2. **最小 workflow engine** — `beta/src/shared/workflow_types.ts` + `beta/src/node/workflow_runner.ts`。state transition / evaluator loop / checkpoint-resume を含む
3. **dogfood run log** — PJ03 自身の 1 task を engine 経由で回した実行ログ（`artifacts/dogfood_run_01.md`）

## メタ情報

| 項目 | 値 |
|---|---|
| PJ 名 | PJ03_SelfDrive |
| ブランチ | `prj/03_SelfDrive` |
| worktree | 本体 (`c:/Users/Akaghef/dev/M3E`) |
| マップ | DEV map に PJ03 ノード追加予定 |
| kickoff 日 | 2026-04-20 |
| 原典 | `backlog/meta-subpj-candidates.md` PJ-01 TrustEng / PJ-02 SelfImprove を源流 |

## ドキュメント構成

- [plan.md](plan.md) — Phase 設計・探索ログ・確定事項
- [tasks.yaml](tasks.yaml) — sprint contract 正本
- [resume-cheatsheet.md](resume-cheatsheet.md) — compact / 再開用 1 画面
- [runtime/README.md](runtime/README.md) — 4-view runtime 設計
- [reviews/](reviews/) — 判断負債プール
- [retrospective.md](retrospective.md) — 反省ログ

## 役割分担

| 領域 | 人間（akaghef） | Claude | Codex |
|---|---|---|---|
| ビジョン / 方向性 | ◎ | × | — |
| 設計分岐決定（正本・流用・統合境界） | ◎ Gate で承認 | ◎ 候補整理・比較 | △ レビュー |
| workflow spec 設計 | △ 承認 | ◎ | △ 代替案 |
| engine 実装 | × | ◎ | △ rescue |
| dogfood run 監査 | ◎ 結果確認 | ◎ 実行・記録 | — |
| Phase 遷移判定 | **◎ 必ず人間** | × 勝手に進めない | — |
| 環境崩壊エスカレーション | ◎ 最終判断 | ◎ 検知・報告 | — |

### human outer loop / autonomous inner loop

- **inner loop**: Generator → Evaluator → writeback → 次 task。人間なしで回す
- **outer loop**: 人間が board を見て方向性修正、Phase gate 判断

### Claude が止まって確認すべき境界

1. Phase 遷移（README 進捗ログに「遷移可能」と書くまで）
2. 環境崩壊（ツール不在・依存停止・map サーバー停止）
3. スコープ逸脱（本 PJ の Out of Scope に触れる判断）
4. 破壊的操作（`reset --hard`, force-push, main 操作, secrets）

それ以外は止まらず進める。ambiguity は `reviews/Qn*.md` に pool して tentative default で進行。

## 運用ルール（要点）

- workflow engine 開発中は、この PJ 自体が dogfood 対象になる。engine の欠陥や仕様穴は即 `reviews/` へ pool
- Phase 0 の設計 memo は実装より先に書く。実装が memo を追い越したら memo を先に更新する
- engine の最小構成は「9 state set + edge table + tasks.yaml writeback + checkpoint」の 4 点で成立させる。追加要素は必要性が見えてから
- `tasks.yaml` は workflow instance の永続化先であり、手動編集は dogfood run 外でのみ許可（run 中は runner が正本）

## Future Work

- workflow engine の複数 task 並列実行（現在は 1 task dogfood のみ）
- Hermes 的な自己改善ループの engine 化（evaluator の提案を次 round に反映）
- M3E の 1 scope 内に workflow instance を埋め込む完全統合（Phase 3 の延長）
- workflow instance の UI 可視化（Evaluation Board 拡張）
- 自動 retrospective 生成（session ログ → 反省抽出）

## 進捗ログ

- 2026-04-20: kickoff。skeleton 生成、branch `prj/03_SelfDrive` 作成
- 2026-04-20: plan.md reframe（friction-harness → workflow engine dogfood）、tasks.yaml v2 生成
- 2026-04-21: Qn2_stale_docs tentative default 適用。README.md Vision / 主成果物 / 役割分担 / 運用ルール / Future Work と runtime/README.md の View 役割を workflow engine フレームに整合
- 2026-04-21: Gate 1 承認（akaghef）→ Phase 1 kickoff (T-1-1..T-1-7)
- 2026-04-21: Gate 2 差戻（akaghef 8 指摘）→ Qn3 pool → P1-P4 方針確定
- 2026-04-21: Phase 1.5 rework (T-1-8..T-1-11) 完了、checkpoint JSON 分離 + reducer rename + Clock/Resolver injection + workflow_example 降格
- 2026-04-21: **Gate 2 v2 承認（akaghef）→ Phase 2 kickoff (T-2-*: Clock daemon / orchestrator / hook 配線 / sleeping・escalated 実稼働観察)**
