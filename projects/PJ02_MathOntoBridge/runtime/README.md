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

## Safety

`render_runtime_map.mjs` は既定では **既存の `PJ02 Runtime` map を上書きしない**。

- map が未作成なら新規生成
- 同名 map が既にあるなら **中断して終了**
- 本当に再構築したいときだけ `--force-reset` を付ける

`--force-reset` 時は上書き前に `tmp/runtime_map_backups/` へ JSON backup を書く。

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

既存 map を明示的に再構築する場合:

`node projects/PJ02_MathOntoBridge/runtime/render_runtime_map.mjs --force-reset`

`node projects/PJ02_MathOntoBridge/runtime/sync_runtime_state.mjs --watch`
