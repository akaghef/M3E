# PJ03 Runtime

本 PJ は **4-view runtime** を使う（workflow engine を自分自身で回す dogfood PJ のため Evaluation Board を含む）。
可視化実装は Out of Scope なので、初期は master map 上の最小 scope 分割で運用する。

## View 構成

| view | scope（仮） | 主目的 |
|---|---|---|
| **Progress Board** | `pj03/board` | tasks.yaml の現状ミラー。phase / next task / blocker |
| **Evaluation Board** | `pj03/eval` | Evaluator verdict・round feedback・done_when 検証結果 |
| **Review** | `pj03/reviews` | 人間の outer loop 修正。方向性・quality bar・Phase gate |
| **Active Workspace** | `pj03/workspace` | workflow state/edge 設計・engine 実装・dogfood run のドリルダウン先 |

## 運用原則

- inner loop は outer loop を待たずに進む
- outer loop（人間）は Progress / Review を見て軌道修正
- Review は人間チャネル、Evaluation Board は機械検証チャネル
- map から chat に通知を送れない間は、phase gate readiness のみ手動で chat に出す
- 可視化は poor のまま。board の役割は traceability 保持であって見映えではない

## runtime 初期化

map サーバー稼働中に以下を行う（Phase 0 の bootstrap として実施、必須ではない）:

1. DEV map に PJ03 ノードを追加
2. 4 scope を子として配置
3. tasks.yaml の各 task を Progress Board に alias として配置
4. 本 runtime/README.md へのリンクを PJ03 ノードに貼る

可視化要件が Out of Scope のため、runtime 構築に手間がかかる場合は reviews/ に
pool して後回しにしてよい。workflow engine 本体の進行を止めるな。
