---
project: AlgLibMove
date: 2026-04-15
topic: AlgLibMove — プロジェクト概要
status: active
owner: akaghef
related: plan.md
---

# AlgLibMove

MATLAB 製 Hopf 代数ライブラリ [AkaghefAlgebra](https://github.com/SSuzukiLab/AkaghefAlgebra) を、M3E 上で世界モデル化したうえで Julia へ移植するプロジェクト。同時に M3E の scope 機構・Rapid/Deep レイヤ・link/alias を dogfood する。

## 主成果物

1. **world_model**（主）— Hopf 代数の世界観を M3E マップ上に構築。Julia 実装はその応用例
2. **Julia コード**（副）— VectAlg + VectHeisenbergDouble + CyclicGroupAlg の動作する最小実装
3. **port_log**（dogfood 成果）— M3E に追加すべき機能・scope 境界の痛み・判断履歴

## メタ情報

| 項目 | 値 |
|---|---|
| PJ 名 | `AlgLibMove` |
| git worktree | `prj-alglibmove`（`../M3E-prj-alglibmove/`） |
| ブランチ | `prj/AlgLibMove`（dev-beta から分岐） |
| M3E マップ | `AlgLibMove`（新規作成、PJ 専用） |
| Kickoff | 2026-04-15 午後 |
| 対象 repo | `tmp/tmp_repo/AkaghefAlgebra/`（clone 済） |

## ドキュメント構成

- [plan.md](plan.md) — 実行計画本体（Phase A–D、12 scope カタログ、運用ルール、本日の着手手順）
- `port_log/`（マップ内、サブツリー）— 作業中の痛み・決定・機能要求の一次記録

## セッション起動プロトコル

新規セッション開始時は以下の順で読む:

1. 本 README（PJ の現在地を確認）
2. [plan.md](plan.md) の「確定事項」と「進捗ログ」
3. M3E マップ `AlgLibMove` の `ROOT` ノード（phase_marker と quick_access）
4. `port_log/` の直近 5 件

## 役割分担

| 領域 | 人間（akaghef）主 | Claude 主 |
|---|---|---|
| 数学判断（concept の正当性、公理適用） | ◎ | 候補列挙のみ |
| MATLAB 構造抽出（grep, method 列挙） | — | ◎ |
| M3E マップへのノード書き込み | 方針決定 | ◎ 量産 |
| scope 境界判断 | ◎ 最終判定 | 候補提示 + pain 記録 |
| port_log 記録 | 方針 | ◎ 観察者として記録 |
| Phase 遷移判定（A→B など） | ◎ | × 勝手に進めない |

**Claude が止まって確認すべき境界**: 数学判断 / scope 境界の最終化 / Phase 遷移。

## 運用ルール（要点のみ、詳細は plan.md）

- **用語**: 本 PJ の 12 個の構造単位は **facet**（[Glossary 2.5](../../00_Home/Glossary.md)）。M3E の汎用 `scope` 機能とは別語。1 facet = 1 subtree
- **facet 跨ぎ操作の制限**: サブワーカーは facet 内に閉じた読み書きのみ。facet 跨ぎ link / alias はマネージャー session が batch で行う
- **実体の置き場**: そのノードの親子関係が自然に定まる facet に実体を置き、他 facet からは alias で参照
- **ambiguity は pool**: 迷った判断は port_log/open_question または map の reviews/Qn に積み、tentative default で進める。人間は週 1 で batch review
- **エイリアス**: M3E に機能として実装済。積極利用可
- **Rapid/Deep モード**: 作業中は気にしない。完了後に遡及判定する（これが dogfood の主目的）

## 外部ドキュメントへのリンク

- 実行タスク正本: [../../06_Operations/Todo_Pool.md](../../06_Operations/Todo_Pool.md)
- Core Principles: [../../../dev-docs/](../../)
- MATLAB 元 repo: [tmp/tmp_repo/AkaghefAlgebra/](../../../tmp/tmp_repo/AkaghefAlgebra/)

## Future Work（本 PJ 範囲外）

- **group 3-cocycle の新規実装** — AkaghefAlgebra に実装が存在せず新規設計になるため、別 PJ として切り出し
- **quasi-Hopf 分岐完走** — Nice ゴール扱い、本 PJ では追わない
- **研究データの保存経路監査**（cloud sync / cache / log / preview） — AlgLibMove 1 モジュール完遂後に別途判定

## 進捗ログ

- 2026-04-15: プロジェクト文書化完了、worktree 作成予定、午後 Step 0–5 着手予定
