# Qn6 — Plan 4 が T-6-1 LangGraph 不採用決定を反転

- **status**: resolved 2026-04-21 (akaghef plan4.md で明示指示)
- **phase**: 9 (Plan 4 Phase 4-0 kickoff)
- **pooled**: 2026-04-21

## 何が起きたか

T-6-1 (Plan 2 Phase C) で「自前 graph runtime を継続採用、LangGraph 不採用」と決定した。
akaghef が plan4.md で次のように反転指示:

> Plan 4 では、LangGraph 取り込みを **参考** ではなく **主命題** として扱う。
> **A. LangGraph 採用を既定路線とする** — fallback の自前 runtime は、LangGraph で repo bridge が
> どうしても破綻した場合にのみ検討する。**この順序を逆転させない。**

さらに Plan 4 は次を禁止する:

1. 「LangGraph を取り込む」→「LangGraph 風の図を map に描く」への読み替え (Plan 3 で起きた誤読)
2. 「non-tree graph runtime」→「tree に workflow を投影する」への読み替え (Plan 2 の projection 偏向)
3. 「system diagram」→「knowledge tree の一種」への読み替え
4. 「scope に接続する」→「tree を runtime の正本にする」への読み替え

## Manager 側の反省

T-6-1 決定時に:

- Python/TS 境界コスト / checkpoint schema 粒度 / Plan 2 scope で LangGraph 優位機能が要らない
  を根拠に LangGraph 不採用とした
- これは **Plan 2 scope** の話で、**PJ03 本題 (tree と相補的な non-tree runtime を取り込む)** の
  話ではなかった
- Plan 2 scope で言えば自前継続は妥当だが、PJ03 全体の「LangGraph 的実体を成立させる」命題を
  Plan 2 scope が代替すると誤って振る舞った

Plan 3 の system_diagram_runner でも同パターンが起きた: map の System Diagram は **tree への projection** であり、
**non-tree graph runtime の代替にはならない**。adversarial reviewer が Gate 5 で "generic command runner" と
指摘したのは、このズレの副作用。

## 対処 (akaghef 指示)

- T-6-1 決定は **削除しない**。Plan 4 で反転したことを注記として残す
- Plan 1 groundwork / Plan 3 demonstration は **adapter / demo** として保持、runtime 本題の達成根拠に使わない
- Plan 4 Phase 4-0..4-3 で LangGraph を第一正本として実導入
- Gate 6 は Plan 4 §Gate ルールの 3 条件 (LangGraph 実動 / graph-first 成立 / tree 代替達成でない) を
  全部満たさないと emit しない

## 位置づけの再配置

| 資産 | Plan 1-3 の位置づけ | Plan 4 の位置づけ |
|---|---|---|
| workflow_reducer.ts | primary state machine | adapter (graph-adjacent, LangGraph 非担当領域 only) |
| checkpoint JSON | machine SSOT | adapter (LangGraph thread state と mapping) |
| workflow_orchestrator.ts | orchestrator shell | adapter (実 AI call 層、LangGraph runtime の外) |
| workflow_scope_projector.ts | one-way projection | M3E bridge (graph runtime からの projection 一方向) |
| system_diagram_runner.ts | Plan 3 concrete demo | demo runbook support (runtime 本題とは別物) |

## 決定者

akaghef (plan4.md で明示)。本 Qn6 は事後記録 + Manager 反省。
