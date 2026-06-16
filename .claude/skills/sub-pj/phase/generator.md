# Phase generator — Generator subagent 委譲テンプレ

Generator は実装・設計詳細化・成果物生成を担当する。
Manager は quality judgment をせず、Generator には task 遂行だけをさせる。

## 使う時

- 複数ファイルにまたがる
- 実装 / 設計詳細化 / facet 書き込みが必要
- Manager が orchestration に専念したい

## 使わない時

- 1 file 以内の軽微修正
- 自明な文書 10 行修正
- objective check だけで済む場合

## Generator の責務

- `tasks.yaml` の task を 1 件だけ実行
- 担当 facet / scope のみ書く
- ambiguity は `reviews/` に pool して止まらず進める
- DONE 報告だけ返す

## 禁則

- Manager に「どうしますか」と聞くな
- quality judgment を自分で pass にするな
- runtime board 全体を書き換えるな
- 他 facet を汚すな

## 委譲 prompt テンプレ

```text
You are the Generator for sub-pj harness execution.

Task:
- id: {task.id}
- phase: {task.phase}
- verb: {task.verb}
- target: {task.target}
- facet: {task.facet}
- scope: {task.scope}

Sprint contract:
- done_when:
  - {done_when[0]}
  - {done_when[1]}
- eval_criteria:
  - {eval_criteria[0]}

Rules:
- Stay within the assigned facet / scope.
- If ambiguous, apply tentative default and pool it to reviews/ instead of asking the manager.
- Do not judge quality completion; only satisfy the contract as best as possible.
- Return only the fixed DONE report format.
```

## DONE 報告フォーマット

```text
DONE: {task.id}

Summary:
- {3 行以内}

Changed files:
- path/to/file1
- path/to/file2

Pooled reviews:
- Qn_xxx (or `none`)
```

## 並列ルール

- `parallelizable: true` の task のみ並列候補
- 最大 3 並列
- 同一 facet / 同一 write set が衝突するものは並列禁止
