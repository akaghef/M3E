---
pj_id: PJ03
project: SelfDrive
date: 2026-04-20
status: active
owner: akaghef
related: plan.md
---

# PJ03 — SelfDrive

定義した PJ 進行フローを agent が確実に自動履行するための自走ハーネスを作る。

## Vision

### 問題

すべてのステップが摩擦になっている。ユーザーが毎回「次のタスクへ」「Phase 進めて」「resume して」と指示しないと agent が動かない。sub-pj protocol には自動運転の原則があるが、実際には gate・task 間・session 再開・エラー回復のあらゆる境界で人間を呼ぶ。結果として akaghef が agent 開発そのもののボトルネックになっている。

### 完了像

定義された PJ 進行フロー（sub-pj protocol の kickoff → planning → do → gate → retrospective）を、agent が **人間介入なし** で履行する。人間が介入するのは以下に限定される:

- Phase 遷移判定（Gate 1 / Gate 2）
- 環境・前提崩壊のエスカレーション
- スコープ逸脱判断
- outer loop の方向性修正

それ以外（task 間遷移、round loop、resume、軽微なエラー回復、ambiguity pooling）は harness が自律で回す。

### In Scope

- 自走ハーネスの設計・実装
- 既存 PJ フロー（sub-pj-plan / sub-pj-do / sub-pj skills）の自動履行機構
- ScheduleWakeup / /loop / hooks / resume-cheatsheet の連携
- 摩擦発生点の実観察と分類
- Evaluator / Generator の自律 round loop
- エスカレーション境界の機械判定

### Out of Scope

- 可視化の強化（現状 poor のままでよい）
- M3E 本体の UI / viewer 改善
- 並列マルチ sub-PJ 実行
- LLM モデル選定・切替
- sub-pj protocol 自体の大幅改訂（改善提案は backlog に pool）

## 主成果物

1. **摩擦インベントリ** — PJ01/PJ02 の進行で人間介入が必要だった箇所の分類表
2. **自走ハーネス MVP** — 1 PJ を 1 日無人で進行させられる最小構成
3. **エスカレーション境界仕様** — どの条件で人間を呼び戻すかの機械判定ルール

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
| 摩擦観察・分類 | △ 仕上げ確認 | ◎ | △ レビュー |
| harness 設計 | △ 承認 | ◎ | △ 代替案 |
| harness 実装 | × | ◎ | △ rescue |
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

- 自走ハーネス開発中は、この PJ 自体が dogfood 対象になる。harness の欠陥は即 `reviews/` へ
- 摩擦観察は PJ01 / PJ02 の sessions ログを 1 次資料とする。憶測で分類しない
- harness の最小構成は「ScheduleWakeup + resume-cheatsheet + tasks.yaml」の 3 点で成立させる。追加要素は必要性が見えてから

## Future Work

- 並列マルチ PJ 実行（複数 worktree の harness 協調）
- harness の UI 可視化（Evaluation Board 拡張）
- 自動 retrospective 生成（session ログ → 反省抽出）
- M3E 本体への harness 機能統合（Resource 型として）

## 進捗ログ

- 2026-04-20: kickoff。skeleton 生成、branch `prj/03_SelfDrive` 作成
