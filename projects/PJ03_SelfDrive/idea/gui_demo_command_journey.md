---
pj_id: PJ03
doc_type: idea
status: draft
date: 2026-04-21
updated: 2026-04-21
---

# GUI Demo / Test Framework as Command Journey

## 目的

GUI デモを「その場限りの手操作」ではなく、**再生可能な command journey** として扱う。

この方式を採ると、同じ仕組みを次の 3 用途に再利用できる。

1. GUI demonstration
2. GUI regression test
3. 将来の M3E demonstration skill の実行基盤

PJ03 では、この一般方式を先に定義し、そのうえで **具体例として PJ03 map を段階的に育てるデモ** を作る。

## 基本発想

検証したいのは GUI の見た目そのものではなく、次の鎖である。

1. command stream がある
2. command が map API に対して順番に実行される
3. timer により pacing できる
4. map が step-by-step に変化する
5. 最終 state が期待通りである

つまり本体は GUI test framework ではなく、**map evolution harness** である。
GUI はその再生を人間が観察する表示面とみなす。

## この方式がよい理由

- demo と test を同じ command で回せる
- 一度作った journey を replay できる
- 途中停止 / resume / speed change が可能
- 「人間が map を見て進化を追う」体験を自然に作れる
- 将来 LangGraph 的 orchestration を載せても、実 map 編集は同じ executor を使える

## レイヤ分割

### 1. Command Model

map 編集を小さな command に分解する。

最小 command 候補:

- `create_node`
- `update_node_text`
- `move_node`
- `set_attr`
- `delete_node`
- `link_nodes`
- `sleep`
- `snapshot`

各 command は少なくとも次を持つ。

- `id`
- `type`
- `args`
- `expected_precondition`
- `expected_postcondition`
- optional `delay_ms`

ここで重要なのは、command を単なる操作ログではなく **検証可能な unit** にすること。

## 2. Executor

`MapCommandExecutor` を用意し、1 command ずつ map API に対して実行する。

責務:

- command 実行
- 結果記録
- pre/postcondition 検査
- failure 時停止
- optional snapshot 保存

これは GUI 専用ではなく、将来の agent edit API の最小核でもある。

## 3. Journey Runner

executor の上に timed runner を載せる。

モード:

- `step`: 手動で 1 step ずつ進める
- `auto`: 固定 interval で進める
- `scripted`: command ごとの `delay_ms` に従う

この runner が「map 上の旅」を作る。
人間は M3E viewer を開いたまま、その変化を観察する。

## 4. Assertion Layer

GUI の検証は 2 層に分ける。

### 構造検証

- node count
- parent-child
- text
- attributes
- links
- snapshot diff

### 人間観察

- viewer で map がどう育つか
- pacing は自然か
- journey が理解しやすいか
- どこで止まり、何が追加されたかが追えるか

これにより、機械検証と live demo を分離できる。

## LangGraph との関係

ここで LangGraph をそのまま map editor として使う必要はない。
むしろ再利用したいのは **graph runtime の形** である。

対応づけ:

- graph node = command-producing stage
- graph edge = 次にどの command block を実行するかの routing
- checkpoint = 現在 command index + run metadata
- timer = delayed transition / wakeup

つまり、**map 編集の実行器は手元の TypeScript layer** に置き、
その上に LangGraph 的 orchestration を載せるのが自然。

## API の方向性

将来の手動 / agent 編集 API は薄く始める。

候補:

- `POST /api/maps/:mapId/commands/execute`
- `POST /api/maps/:mapId/commands/replay`
- `GET /api/maps/:mapId/commands/runs/:runId`
- `POST /api/maps/:mapId/commands/runs/:runId/pause`
- `POST /api/maps/:mapId/commands/runs/:runId/resume`
- `POST /api/maps/:mapId/commands/runs/:runId/step`

この時点では「万能 API」にしない。
最初は demonstration と replay を成立させる最低限でよい。

## skill との関係

将来作る demonstration skill は、次の 2 層に分けるとよい。

### universal skill

役割:

- journey script を受け取る
- map command executor を叩く
- timer 付き replay を行う
- run status を返す

### project-specific content

役割:

- 何を見せるか
- どの順番で node を増やすか
- どういう物語として map を育てるか

PJ03 では後者を concrete example として作る。

## PJ03 で作るべき具体例

PJ03 では、task list の replay ではなく、**system diagram が段階的に立ち上がるデモ** を作るべき。

理由:

- 目で追いやすい
- map evolution の価値が分かりやすい
- 「workflow runtime の層構造」を GUI 上で説明しやすい

## PJ03 concrete journey 案

対象 map:

- `PJ03`

見せる対象:

- Inputs / Sources
- Reducer
- Orchestrator
- Clock Daemon
- Projection To M3E
- Boundary Rules

### 旅の流れ

1. root に `System Diagram` を作る
2. `Inputs / Sources` を作る
3. `tasks.yaml`
4. `runtime/checkpoints/*.json`
5. `reviews/Qn*.md`
6. `Runtime Layers` を作る
7. `workflow_reducer.ts`
8. `workflow_orchestrator.ts`
9. `clock_daemon.ts`
10. `Projection To M3E`
11. `workflow_scope_projector.ts`
12. `workflow_scope_snapshot.json`
13. `Boundary Rules`
14. `checkpoint JSON is machine SSOT`
15. `projection is one-way`
16. `tasks.yaml is human contract`
17. relation/link を追加
18. status / role / layer color を付ける

これで、map が単なる tree ではなく「構成要素の関係図」として育つ。

## PJ03 concrete command 例

```json
{
  "id": "cmd-07",
  "type": "create_node",
  "args": {
    "parentPath": ["PJ03", "System Diagram", "Runtime Layers"],
    "text": "workflow_reducer.ts",
    "nodeType": "text"
  },
  "expected_precondition": {
    "parentExists": true,
    "nodeAbsent": true
  },
  "expected_postcondition": {
    "nodeExists": true,
    "parentText": "Runtime Layers"
  },
  "delay_ms": 1200
}
```

## テストとしての成立条件

この方式を「GUI test framework」と呼ぶなら、最低限次を満たす必要がある。

1. 同じ journey を再実行しても同じ結果になる
2. command failure 時に何 step 目で止まったか分かる
3. pre/postcondition violation を即座に出せる
4. run log と final snapshot を保存できる
5. viewer を見なくても構造的 pass/fail が分かる

## デモとしての成立条件

1. 一手ごとの変化が目で分かる
2. pacing が速すぎない
3. 10〜20 step 程度で意味が伝わる
4. 最後に「何が出来上がったか」が明確

## 実装メモ

まず必要なのは GUI 自動化ツールではなく、以下である。

- `map_command_types.ts`
- `map_command_executor.ts`
- `map_journey_runner.ts`
- `map_command_test.ts`
- `artifacts/demo_journey_01.json`

ここで map API 呼び出しは既存 M3E REST API を薄く wrap する。

## PJ03 以後への接続

この方式が固まれば、PJ03 後に作る universal skill は次を共有基盤にできる。

- command schema
- replay runner
- timer orchestration
- assertion model
- snapshot / log 保存

つまり、PJ03 は単発 demo ではなく、**M3E demonstration skill の具体例第 1 号** と位置づけられる。

## 一言でいうと

GUI demonstration を「map を時間とともに育てる command journey」として定義し、
PJ03 ではその一般方式の concrete example を作る。
