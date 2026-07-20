---
pj_id: PJ03
doc_type: runbook
status: draft
date: 2026-04-21
---

# PJ03 Demo Runbook

## 目的

`idea/demo_skeleton.md` の構成を、実際に叩けるコマンド列として固定する。
デモ中はこの runbook か `npm run demo:pj03` を使う。

## 前提

```bash
cd c:/Users/Akaghef/dev/prj/03_SelfDrive/beta
npm install
npm run build:node
```

## 一発実行

```bash
npm run demo:pj03
```

これは次を順に実行する:

1. preflight test 5 本
2. PJ03 現在状態の summary
3. checkpoint JSON の sample 表示
4. `dogfood_run_02`（sleeping / escalated / failed）
5. `dogfood_run_03`（scope projection）

## 部分実行

```bash
node dist/node/pj03_demo.js --mode preflight
node dist/node/pj03_demo.js --mode core
node dist/node/pj03_demo.js --mode scope
```

## 既定パス

- tasks: `projects/PJ03_SelfDrive/tasks.yaml`
- runtime: `projects/PJ03_SelfDrive/runtime`
- reviews: `projects/PJ03_SelfDrive/reviews`
- artifacts: `projects/PJ03_SelfDrive/artifacts`
- sample checkpoint: `T-3-4`

必要なら上書き可能:

```bash
node dist/node/pj03_demo.js \
  --mode core \
  --sample-task T-2-4 \
  --artifacts ../projects/PJ03_SelfDrive/artifacts
```

## デモ中の読み方

- `Current Workflow Summary`:
  PJ03 全体の確定状態を 1 行で確認する
- `Checkpoint Sample`:
  machine SSOT が JSON であることを見せる
- `Core Demo: dogfood_run_02`:
  stopping / resume semantics を見せる
- `Scope Projection: dogfood_run_03`:
  workflow が scope に投影できることを見せる

## 失敗時

- preflight のどれかが落ちたらデモ続行しない
- `dogfood_run_02` が落ちたら `artifacts/dogfood_run_02.md` を開く
- `dogfood_run_03` が落ちたら `artifacts/workflow_scope_snapshot.json` を直接開く

## Cross-reference

- `projects/PJ03_SelfDrive/idea/demo_skeleton.md`
- `beta/src/node/pj03_demo.ts`
- `projects/PJ03_SelfDrive/artifacts/dogfood_run_02.md`
- `projects/PJ03_SelfDrive/artifacts/dogfood_run_03.md`
