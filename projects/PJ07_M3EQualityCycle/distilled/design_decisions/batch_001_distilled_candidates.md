---
batch_id: batch_001_m3e_design
date: 2026-05-17
status: candidate
---

# batch_001 Distilled Candidates

## DC1. MIOS Principle

TOON は LLM / 人間向けの軽量 I/O、JSON は M3E の論理正本、Command / Patch は唯一の変更媒体として分離する。

PJ07 では、この原則を次のように読む。

```text
source context
  -> proposal/result
  -> validated patch
  -> review
  -> approved apply
```

## DC2. Detector / Action / Safety Separation

品質改善は「何が悪いかを検出すること」と「どう直すか」を分ける。

```text
Detector
  -> Candidate Pool
  -> Action Proposal
  -> Safety Gate
  -> Review / Apply
```

最初の evaluator 候補:

- duplicate
- orphan / scratch stale
- stale
- deep tree
- huge node
- missing evidence
- weak projection

## DC3. Agent Worker Safety Checklist

PJ07 の worker は正本編集者ではなく proposal generator とする。

最低限の checklist:

- tool-first
- structured output
- bounded loop
- fail-closed
- hallucinated tool rejection
- trace log
- human review before apply
