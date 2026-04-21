---
pj_id: PJ03
project: SelfDrive
status: draft
date: 2026-04-21
---

# PJ03 SelfDrive — Plan CD

## TL;DR

PJ03 の demonstration は、汎用 GUI test framework を先に完成させるのではなく、
**PJ03 map 上の System Diagram を timed command replay で段階的に編集する concrete demo**
として進める。

この plan の目的は、LangGraph 的な system picture を M3E map 上で育てる実演経路を作ること。

## 背景

現状の PJ03 では、workflow runtime の責務分離や projection までは成立しているが、
**LangGraph 的な graph executor の絵が map 上で育っていく実演** はまだない。

また、汎用 API / skill の構想はあるが、今必要なのは一般化ではなく、
**1 本の具体的で再生可能な demonstration** である。

## この plan の主題

**`PJ03` map の `System Diagram` subtree を、command journey によって段階的に編集し、
viewer 上で「システム図が育つ」ことを見せる。**

## 非目標

- いきなり万能な GUI test framework を完成させること
- いきなり汎用 command API を server に常設実装すること
- LangGraph そのものをこの段階で完全統合すること
- 複数 map / 複数 journey 対応を先に作ること

## デモの核

対象:

- map: `PJ03`
- subtree: `System Diagram`

見せるもの:

- Inputs / Sources
- Runtime Layers
- Projection To M3E
- Boundary Rules
- reducer / orchestrator / clock daemon / projector の関係

見せ方:

- viewer を開いたままにする
- command script を timer 付きで実行する
- map が step-by-step に変化するのを観察する

## 実装方針

### 1. 専用 command schema を作る

この段階では汎用化しすぎない。
PJ03 System Diagram を編集するのに必要な最小 command に絞る。

候補:

- `create_node`
- `update_node_text`
- `move_node`
- `set_attr`
- `link_nodes`
- `sleep`

各 command は少なくとも次を持つ。

- `id`
- `type`
- `args`
- optional `delay_ms`

## 2. 専用 runner を作る

`system_diagram_runner.ts` を作り、既存 map REST API に対して command を順に実行する。

責務:

- script 読み込み
- map 特定
- command 実行
- delay 制御
- 実行ログ出力
- failure 時停止

この runner はまず PJ03 専用でよい。

## 3. PJ03 concrete script を作る

`system_diagram_pj03.json` のような script を用意し、次の順で図を育てる。

1. `System Diagram` anchor 作成
2. `Inputs / Sources`
3. `tasks.yaml`
4. `runtime/checkpoints/*.json`
5. `reviews/Qn*.md`
6. `Runtime Layers`
7. `workflow_reducer.ts`
8. `workflow_orchestrator.ts`
9. `clock_daemon.ts`
10. `Projection To M3E`
11. `workflow_scope_projector.ts`
12. `workflow_scope_snapshot.json`
13. `Boundary Rules`
14. `checkpoint JSON is machine SSOT`
15. `projection is one-way`
16. `tasks.yaml is human contract`
17. link 追加
18. attr / color 付与

## 4. 実演モードを用意する

runner は少なくとも次のモードを持つ。

- `step`
- `auto`

`auto` は fixed interval で十分。
将来 `scripted delay` を足せばよい。

## 5. 検証を分ける

この段階では GUI 検証を 2 つに分ける。

### 構造検証

- node が作られたか
- 親子関係が正しいか
- attrs / links が入ったか

### 人間観察

- viewer で step ごとに変化が見えるか
- 図として理解しやすいか
- pacing が適切か

## 成功基準

### 最小成功

- PJ03 `System Diagram` を script で再構成できる
- runner が timer 付きで順次実行できる
- viewer 上で図の成長を観察できる

### 中間成功

- link / attr / color まで含めて図として意味が出る
- 同じ script を再生して同じ構造にできる

### 最終成功

- この concrete demo をもとに、将来の demonstration skill の基底方式を説明できる

## 実装対象

最小セット:

- `beta/src/node/system_diagram_command_types.ts`
- `beta/src/node/system_diagram_runner.ts`
- `projects/PJ03_SelfDrive/artifacts/system_diagram_pj03.json`
- `projects/PJ03_SelfDrive/docs/system_diagram_demo.md`

必要なら補助:

- map API client の薄い wrapper
- reset / replace 用 utility

## フェーズ

### CD-1. command schema 固定

目的:

- PJ03 System Diagram 用の最小 command set を決める

成果物:

- `system_diagram_command_types.ts`
- command JSON schema 相当の定義

### CD-2. runner 実装

目的:

- command を順次実行できるようにする

成果物:

- `system_diagram_runner.ts`
- CLI entry

### CD-3. concrete script 作成

目的:

- PJ03 の system picture を 1 本の journey にする

成果物:

- `system_diagram_pj03.json`

### CD-4. demo runbook

目的:

- viewer を見ながら再生する手順を固定する

成果物:

- `docs/system_diagram_demo.md`

## 直近タスク

1. command schema を固定する
2. PJ03 map を編集する最小 runner を作る
3. `System Diagram` 再構成 script を書く
4. viewer を開いたまま replay する runbook を書く

## 将来への接続

この plan はあくまで concrete demonstration 用である。

将来、universal skill を作るときには、ここで作った

- command schema
- timed replay
- execution log
- structure assertion

を一般化すればよい。

## 確定事項（Plan 3 CD-1〜CD-4 完了 2026-04-21）

| CD Phase | 成果物 | 根拠 |
|---|---|---|
| CD-1 command schema 固定 | `beta/src/shared/system_diagram_command_types.ts` (6 command: reset_subtree / create_node / update_node_text / set_attr / link_nodes / sleep) | T-8-1 Evaluator pass |
| CD-2 runner 実装 | `beta/src/node/system_diagram_runner.ts` (dry-run default / --live opt-in / --backup-dir 必須 for destructive / exact label match / step / auto mode、HTTP client、failure 停止) | T-8-2 Evaluator pass + live 実走行で PJ03 map 書込確認 |
| CD-3 concrete script | `projects/PJ03_SelfDrive/artifacts/system_diagram_pj03.json` (31 command) | T-8-3 Evaluator pass + live run で 4 section / 5 link / 7 `set_attr` command 適用 |
| CD-4 demo runbook | `projects/PJ03_SelfDrive/docs/system_diagram_demo.md` (3 mode + 安全ポリシー + 失敗対応) | T-8-4 本追記 |

### live 実走行確認

PJ03 map (map_1776759461174_2jkvil) に対し `--live --backup-dir .../backups --auto --interval 20` で 31 command 全適用。
結果（curl 確認、**count check のみ**。parent/child 関係・link endpoints・attribute 値の完全な構造 assertion は実装していない）:

- System Diagram children: 4 section (Inputs / Runtime Layers / Projection / Boundary Rules)
- links: 5 本（l_sd_in_to_ly / l_sd_ly_to_pr / l_sd_rl_to_ly / l_sd_rule_ckpt / l_sd_rule_oneway）
- `set_attr` commands executed: 7 回（4 section に fill、3 leaf に importance）。各 command は 1 node に 1 attribute 追加

pre-run snapshot が `artifacts/backups/` に書かれる（destructive re-run からの復元用）。
reset_subtree が先に走るので、**runner 実走直後の状態** においては同 script 再実行で同構造。
viewer 手動で node を動かした後の「idempotent 再実行」は reset_subtree で subtree 全削除してから再構築されるので、実質 from-scratch。

### 適用 pacing

- demo runbook canonical: `--interval 500`（約 30〜40 秒完走、audience 向け）
- 開発中の structural verification: `--interval 20`（約 3 秒完走、上記 live 確認で使用）

### 既知の軽微 flag（Gate 5 adversarial reviewer 指摘、本 gate では説明扱い）

- runner 自体は map-edit の汎用 command をサポートする。PJ03 System Diagram 専用性は「script 側の map_id + map_label_expected による」運用で担保（型レベルの制約ではない）
- 構造 assertion は count のみ。parent/child 関係や link endpoints の完全一致は検証していない

## 一言でいうと

Plan CD は、「PJ03 の system picture を viewer 上で段階的に育てる demonstration」を
先に成立させるための計画である。
