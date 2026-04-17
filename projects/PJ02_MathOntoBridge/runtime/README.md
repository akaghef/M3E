# PJ02 Runtime System

PJ02 を M3E 上で実際に回すための最小 runtime system。

目的は:

- 人間が 3 つの view を見れば現在地を判断できること
- `reviews` の変化を受けて progress board が自動で追従すること
- chat を操作面ではなく補助窓に落とすこと

## 構成

1. `Progress Board`
   - phase / next gate / task DAG / blocker
2. `Review`
   - `reviews/Qn` と選択肢
3. `Active Workspace`
   - README / plan / importer / contracts / external map への導線

これらは 1 つの master map の 3 scope として構築する。
同じ map を 3 窓で開くことで、実質 3-map runtime として使う。

## ファイル

- `runtime_spec.json`
  - map の正本 spec
- `render_runtime_map.mjs`
  - spec から master map を再構築
- `sync_runtime_state.mjs`
  - `Review` の状態から `Progress Board` の状態・色・メタ情報を再計算

## 運用

1. `render_runtime_map.mjs` で map を生成
2. `sync_runtime_state.mjs --watch` を常駐
3. 人間は 3 scope を開いて作業
4. `Review` の Q 状態が変わると board が自動で追従
5. phase gate は人間が `次フェーズへ` を出す

## 手動通知

現状、map から chat へは送信できない。
したがって:

- review の accept / reject / skip は map 上で行う
- 重要な区切りや phase gate だけは人間が chat で通知する

## この設計で割り切ること

- chat 自動通知はまだない
- board は review 由来の状態を自動反映する
- 人間 gate は自動化しない

## 補足

`node projects/PJ02_MathOntoBridge/runtime/render_runtime_map.mjs`

`node projects/PJ02_MathOntoBridge/runtime/sync_runtime_state.mjs --watch`
