# Qn5 — PJ03 完了判定が強すぎた (Gate 3 over-claim)

- **status**: resolved 2026-04-21 (akaghef が plan2.md で再定義、PJ reopen)
- **phase**: Plan 1 終盤 → Plan 2 冒頭
- **pooled**: 2026-04-21

## 何が起きたか

Gate 3 で Manager は PJ03 最終成功を「M3E が動的 workflow を scope 内で扱える方向へ進む」と判定し、
akaghef が一度承認した。しかし akaghef は直後に plan2.md を書き、判定が強すぎたと再評価した。

実際に成立したのは:

1. workflow state / edge / checkpoint の設計
2. reducer / orchestrator / clock / hook / projection の責務分離
3. M3E scope への **一方向 projection**

まだ成立していないのは（plan2.md §現在地の再評価）:

1. LangGraph 的な graph executor 本体
2. node graph を実行入力として辿る runtime
3. graph が実際に回ることを示す dogfood

つまり Plan 1 の PJ03 は「graph runtime の基礎工事」までで止まっており、
「LangGraph のようなものができた」とはまだ言えない状態だった。

## Manager 側の反省

Gate 3 readiness emit 時、以下の過大評価パターンを再発した（Gate 2 差戻と同構造）:

- "最終成功達成" を主張したが、実体は「基礎工事完了」
- node graph が実行入力として使われていないこと（T-3-2 projector は read-only の scope 出力で、graph を辿る runtime ではない）を成功基準に含めず通した
- LangGraph との比較を Phase 3 で完全に逃した（external_tools_review.md は Gate 1 時点の draft のまま）

[backlog/pj03-gate-integrity-lessons.md](../../../backlog/pj03-gate-integrity-lessons.md) §1 の「pre-gate adversarial reviewer」を Phase 3 で実施していれば、
node graph が実行で使われていない点は Gate 前に検出できた可能性が高い。

## akaghef の再定義

plan2.md で PJ03 の目的を次に置き換え:

> **PJ03 の成果を捨てずに、LangGraph 的実体を取り込む／もしくは同等物を成立させること**

Plan 2 は Phase A (Gap 固定) / B (Graph Runtime 試作) / C (LangGraph 比較 or 採用確定) / D (Scope 内 graph 接続) の 4 Phase。

## 対処

- PJ03 status: done → active（reopened）
- plan.md の「Phase 3 結論 / 最終成功判定」は Plan 2 で弱められる前提で参照留め
- plan2.md が active plan の正本
- 新 Phase に T-4-1..T-7-2 の 8 task を起票
- retrospective_general.md の 7 パターンに「**基礎工事と完成を混同しない**」を追加候補

## 決定者

akaghef（plan2.md でリオープン指示済み、本 Qn5 は事後記録）
