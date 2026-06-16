# sub-pj 用語集

agent が誤読しやすい重要語の正本。
重要語はここだけに閉じ込めず、`SKILL.md` / `protocol.md` / 各 phase に短い定義を再掲する。

---

## facet

PJ 固有の意味軸。
同じ対象を「何を主役に読むか」で切り分ける単位であり、map / scope の意味を決める。

例:
- `review` facet
- `implementation` facet
- `dependency` facet

## facet type

facet の汎用パターン。
個別 PJ の facet をゼロから作るのではなく、既存の型を借りて契約を決める。

例:
- `flow`
- `dependency`
- `reviews`
- `task-management`

## view

runtime 上で人間に見せる画面構成。
view は facet そのものではなく、facet を人間向けに前景化した実行面である。

例:
- `Progress Board`
- `Evaluation Board`
- `Review`
- `Active Workspace`

## board

runtime 上で状態を要約し、判断や追跡の起点になる view。
summary であっても traceability を失ってはいけない。

## sprint contract

task 実行前に固定する終了条件。
todo ではなく、Generator と Evaluator が共有する契約。

通常含むもの:
- `done_when`
- `eval_required`
- `eval_criteria`
- `round_max`

## Generator

実装・設計詳細化・成果物生成を担当する実行 agent。
担当 facet / scope のみを書き換え、DONE 報告を返す。

## Evaluator

Generator と独立した検証 agent。
`done_when` を objective に検証し、`eval_criteria` を grading する。
品質 judgment を Manager に返し、必要なら round 2 以降の feedback を生成する。

## Manager

main Claude。
ループを回し、task を選び、Generator / Evaluator を起動し、結果を board とファイルに writeback する。
quality judgment を自分で下してはいけない。

## Secretary

人間向け最適化レイヤ。
chat 窓口や表示導線は Secretary 的役割だが、実装上は Manager と一体でもよい。

## inner loop

人間を待たずに回る自走ループ。

```
Manager -> Generator -> Evaluator -> pass/fail -> writeback -> next task
```

## outer loop

人間が board を見て軌道修正・品質改善・phase gate を行う層。
inner loop は outer loop を待たずに進む。
