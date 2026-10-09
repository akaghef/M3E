# PJ08 runtime

Phase 1 は静的 mock のみで、実行 runtime を持たない。以下は Phase 2 以降で使う。

| board | 役割 |
|---|---|
| **Progress Board** | `tasks.yaml` の task 状態。誰が何を持っているか |
| **Evaluation Board** | `eval_required: true` の task の Evaluator 判定。round と round_max |
| **Review** | `reviews/Qn_*.md` の未決論点。akaghef の回答待ちが可視になる |
| **Active Workspace** | 実作業中の worktree。`plan.md` の吸収表と対応させる |

## Phase 1 の扱い

`runtime_opt_out` **ではない**。Phase 1 が短く、board を回す前に Gate 1 に当たるため未使用なだけ。
Phase 2（node type カタログ）着手時に Progress / Evaluation Board を起こす。

## 注意

- ここに **Telemetry を書かない**（`farthest_goal` RQ4 / 拘束規則5）。正本が runtime で汚れると
  グラフは年単位の蓄積ではなくリセットされる dashboard に退化する。
- board の状態は agent の自己申告であり、観測ではない（`RQ3`）。
  観測由来の値と同じ field に流さない。
