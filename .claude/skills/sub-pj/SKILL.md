---
name: sub-pj
description: |
  sub-PJ 用のメタスキル。自分では長い手順を抱えず、要求を plan 段階か do 段階に振り分ける。
  以下の場面でトリガーする:
  - 「/sub-pj」と直接呼ばれたとき
  - 「sub-pj で進めて」「PJ の型で回して」と言われたとき
  - kickoff / planning / runtime / gate のどちらを使うか曖昧なとき
---

# sub-pj — Meta Router

`sub-pj` は dispatcher。
実務は次の 2 skill に振り分ける。

## Core Terms

- `plan`: kickoff / planning / gate。何をやるか、どこまでやるか、何を正本にするかを固める段階
- `do`: runtime / resume / generator / evaluator。固めた plan を自走ループで消化する段階
- `gate`: 人間専権。Claude は readiness を示すが、通過は人間が決める

## Routing

| ユーザー意図 | 振り分け先 |
|---|---|
| 新 PJ を立ち上げる | `sub-pj-plan` |
| plan を詰める / Gate 1 / Gate 2 を確認する | `sub-pj-plan` |
| Phase 遷移の readiness を確認する | `sub-pj-plan` |
| 今日の作業開始 / resume / 自走ループ / handoff | `sub-pj-do` |
| Generator / Evaluator を回したい | `sub-pj-do` |

## Reading Order

1. まずこのファイルで `plan` と `do` のどちらかを決める
2. 実際の手順は対応する skill に移る
3. 両方必要なら `plan -> do` の順に直列で使う

## Guardrails

- `sub-pj` 自体は重い手順を再掲しない
- gate は常に人間手動
- `do` 側は gate を実行せず、ready を報告して止まる
