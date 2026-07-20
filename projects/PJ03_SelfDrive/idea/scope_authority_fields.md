---
pj_id: PJ03
doc_type: idea
status: draft
date: 2026-04-21
---

# Scope に権限・責務フィールドを持たせる案

## 背景

PJ03 SelfDrive では、workflow を最終的に **1 scope の内部で扱う** 方向を本命としている。
このとき scope が単なる構造境界だけだと弱く、誰が編集できるか、誰が承認できるか、
どこまで自動で進めてよいかを表現できない。

つまり scope は将来的に:

- 構造境界
- 可視範囲境界
- 編集境界
- workflow 実行境界
- 承認・escalation 境界

をまとめて持つ単位になる可能性が高い。

## いま足すべきではないこと

- いきなり scope に巨大な ACL モデルを入れること
- user / role / team / policy を一度に一般化すること
- PJ03 Phase 1 の reducer 差戻し論点と同時に全部解くこと

まずは workflow 側で必要になった最小の権限語彙を見極め、そのうち安定したものだけを
scope の恒常属性に昇格する方が筋がよい。

## 最小候補フィールド

以下は「将来的に scope に載っていると自然」な候補。

| field | 役割 | 使い道 |
|---|---|---|
| `owner` | その scope の最終責任者 | 誰の判断が正本かを示す |
| `editable_by` | 編集可能主体 | sub-agent / human の書込み制限 |
| `approver` | 承認主体 | escalated → ready / blocked / failed の決定権 |
| `escalation_target` | エスカレーション先 | E1/E2/E3 の通知先 |
| `auto_run_policy` | 自動進行許容範囲 | ready → in_progress や retry を自動化してよいか |
| `visibility` | 閲覧可能範囲 | map/scope 表示制御 |
| `review_policy` | review 必須条件 | eval_required や human gate 条件との接続 |

## PJ03 との接点

今回の差戻しで見えた論点は:

- state machine の停止先はあるが、**誰が再開可否を決めるか** が薄い
- `escalated` はあるが、**どこへ上げるか** の永続情報が弱い
- `scope` を workflow 実行単位に寄せるなら、**責務境界** を scope 側に持たせた方が自然

したがって Phase 2 以降で workflow と scope を接続するなら、
少なくとも `approver` / `escalation_target` / `auto_run_policy` は強い候補になる。

## 仮説

`scope` を「木構造の整理単位」から「権限付き実行境界」へ拡張すると、
LangGraph 的な graph / checkpoint モデルとも整合しやすい。

ただし写像はまだ未確定:

- A. `1 scope = 1 workflow instance`
- B. `scope` は静的境界で、workflow instance は内部属性としてぶら下げる
- C. `scope` は authority だけ持ち、workflow は別実体

現時点の仮説としては **B が最も自然**。
既存の scope 概念を壊しにくく、workflow 側だけ独走するのも防ぎやすい。

## 次に検討すること

1. PJ03 Phase 2 で必要な authority 語彙を 3 個以内に絞る
2. `escalated` / `blocked` の resume 情報と scope 属性の責務分界を決める
3. M3E Glossary に入れるべき正規語か、PJ03 ローカル語で留めるか判断する
