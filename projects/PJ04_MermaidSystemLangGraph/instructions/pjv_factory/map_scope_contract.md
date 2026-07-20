---
pj_id: PJ04
package: pjv_factory
doc: map_scope_contract
date: 2026-04-30
---

# Map Scope Contract — PJv Factory

対象 map は beta の `開発` map。

PJ04 用の batch 作業スコープは次の場所に置く。

```text
開発
└── strategy
    └── PJ04 PJv Factory
        ├── Master Queue
        ├── Work Scopes
        │   ├── PJv35
        │   ├── PJv36
        │   └── PJv37
        ├── Spec Review
        ├── System Diagram Review
        ├── Run Evidence
        └── Done
```

## Node Responsibilities

| scope | owner | meaning |
|---|---|---|
| `PJ04 PJv Factory` | Master | factory 全体の root |
| `Master Queue` | Master | ready / claimed / blocked の queue |
| `Work Scopes/PJvXX` | assigned worker | PJvXX 固有の仕様・diagram・run evidence |
| `Spec Review` | Master | freeze 前の判断待ち |
| `System Diagram Review` | Master + human | diagram 粒度・subsystem 境界の確認 |
| `Run Evidence` | Master | build/run 結果へのリンク |
| `Done` | Master | 完了した PJv* の summary |

## PJvXX Work Scope Shape

各 PJv* scope はこの形にする。

```text
PJvXX <short name>
├── Assignment Spec
├── System Contract
├── Data View
├── System Diagram
│   ├── Load Sources
│   ├── Build Context
│   ├── Generate Artifact
│   │   └── Generate Artifact Subsystem
│   └── Write Output
├── Template Spec
├── Run Evidence
└── Residuals
```

## Parallel Write Rule

- Master だけが `Master Queue`, `Spec Review`, `System Diagram Review`, `Run Evidence`, `Done` を更新する
- worker は自分の `Work Scopes/PJvXX` の中だけを更新する
- 同じ `PJvXX` に複数 worker を割り当てない
- map への bulk write は read-modify-write で行い、保存後に再読込して確認する

## Display Intent

PJvXX の `System Diagram` は人間が overview するための場所。

- 上位 node は 3-5 個に抑える
- fallback / retry / provider call は subsystem に入れる
- Data View は実体ファイル・フォルダ・tmp artifact だけを置く
- trace / runtime state は map 正本へ直接書かない

## Status Labels

| status | meaning |
|---|---|
| `ready` | queue にあり未着手 |
| `claimed` | worker が担当中 |
| `spec_review` | 仕様書レビュー待ち |
| `spec_frozen` | YAML 作成可能 |
| `template_built` | build 成功 |
| `run_done` | mock run 成功 |
| `blocked` | 判断待ち |
| `done` | map / spec / template / run が揃った |
