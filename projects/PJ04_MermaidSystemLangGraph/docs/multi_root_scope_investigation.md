---
title: Multi-Root Scope 包括調査
pj: PJ04
status: draft (investigation)
date: 2026-04-22
scope: PJ04 map model / GraphSpec / viewer / compile / execution
---

# Scope に Root を複数置いたらどうなるか — 包括調査

## 趣旨

現在 PJ04 は「1 scope = 1 Root」という原則で運用している。
本書は、この原則を緩めて **複数 Root を許す** ときに、map model /
compile / execution / viewer の各層で何が壊れ、何が開くのかを、
採否を決めずに網羅する。

最初に重要な事実を一つ固定する。

> `MapScope.rootNodeIds: string[]` は **既に配列** である
> ([beta/src/shared/types.ts:57](../../../beta/src/shared/types.ts#L57))。
> したがって「1 Root」は schema 不変条件ではなく、
> compile 契約と運用規約の層で守られている約束にすぎない。

この前提で、以降「Root を複数にする」がどの層に効くかを分けて論じる。

## Step 1. 「Root」の 4 つの意味を分離する

PJ04 で Root と呼ぶ対象は、少なくとも次の 4 種類が重なっている。
先に切り分けないと議論が噛み合わない。

| 記号 | 名前 | 現在の単複 | 典型的な出どころ |
|---|---|---|---|
| `S-Root` | Structural Root (tree 正本の根) | 1 固定 | `AppState.rootId: string` |
| `Sc-Root` | Scope Root (scope の入口 / channels 保持 node) | 1 運用 (schema は配列) | `MapScope.rootNodeIds: string[]`, `compileFromMap(scopeNodeId)` |
| `E-Root` | Entry Root (graph 実行の入口) | 1 固定 | `GraphSpec.entry: string`, LangGraph `START` |
| `Su-Root` | Surface Root (1 図面の最上位箱) | 1 運用 | `render_target_definition.md` の「`root node` の代わりに `surface` を置く」 |

本書で「複数化する」と言うとき、どの Root を指しているかを常に明示する。

## Step 2. 現在の Root 一意原則がどこに効いているか

走査して見つかった、単一 Root を前提にしている地点。

### 2-1. Map の永続化層

- `AppState.rootId: string` — 単数
  ([beta/src/shared/types.ts:63](../../../beta/src/shared/types.ts#L63))
- data-model.md の invariant:
  「Root must exist — `state.rootId` must point to an existing node with
  `parentId: null`」
  「No orphans — every non-root node must be reachable from the root」
  ([.claude/skills/m3e-map/references/data-model.md:111-113](../../../.claude/skills/m3e-map/references/data-model.md#L111))

### 2-2. Compile 契約

- `compileFromMap(state, scopeNodeId)` は `scopeNodeId` を **単数で** 受ける
  ([beta/src/node/graph_spec_compile.ts:80-89](../../../beta/src/node/graph_spec_compile.ts#L80))
- channels / entry は **scope root node の attributes** にしか書けない規約
  ([map_attribute_spec.md:106-113](map_attribute_spec.md#L106))
- flat scope 前提で、scope root の `children` を node 集合にする
  ([graph_spec_compile.ts:148-154](../../../beta/src/node/graph_spec_compile.ts#L148))

### 2-3. GraphSpec

- `GraphSpec.scopeId: string`、`GraphSpec.entry: string` はともに単数
  ([beta/src/shared/graph_spec_types.ts:88-89](../../../beta/src/shared/graph_spec_types.ts#L88))
- `validateGraphSpec` は entry を 1 個しか検査しない
  ([graph_spec_types.ts:121-123](../../../beta/src/shared/graph_spec_types.ts#L121))

### 2-4. LangGraph 側の対応点

- LangGraph は `START` / `END` の sentinel が単数（公式 API）。
  multi-entry graph は「仮想 START から複数ノードに Send fan-out」で表現する慣例。
- `get_state_history` は parent_id を辿る **線形** chain 前提
  ([langgraph_feasibility.md:83-88](langgraph_feasibility.md#L83)).
- `checkpoint_ns` は compiled graph 単位で 1 namespace。

### 2-5. Viewer / Surface

- `render_target_definition.md` で `surface` が `root node` の代替基準語になっている
  ([render_target_definition.md:42](render_target_definition.md#L42))
- 運用: `1 scope = 1 primary surface`
  ([system_diagram_map_model.md:108-111](system_diagram_map_model.md#L108))
- viewer の `[` / `]` は 1 scope を 1 surface に解決してから window を切り替える

### 2-6. 既存の skill / path 解決

- `/api/maps/MAP_ID/resolve?path=Map:Root/...` の breadcrumb path は
  先頭セグメント `Root` が 1 個固定
  ([.claude/skills/m3e-map/references/read.md:57](../../../.claude/skills/m3e-map/references/read.md#L57))

したがって「Root 一つ原則」は schema ではなく、
**compile / 検証 / 表示 / path 解決** という **実装と運用** に染み込んでいる。

## Step 3. 複数化の 4 ケース

Root の 4 意味 × 複数化 で、以下の 4 ケースが立つ。
それぞれ独立に評価する。

### Case A — S-Root 複数化 (structural forest)

意味: map が tree ではなく **forest** (parentId=null が複数) になる。

影響:

| 層 | 影響 |
|---|---|
| 永続化 | `AppState.rootId` を `rootIds: string[]` へ schema 変更必須 |
| data-model invariant | 「Root must exist (単数)」「No orphans from the root」が書き換え必須 |
| Tree projection | home 操作 / breadcrumb / Map:Root パスが多義化 |
| Viewer | tree view の最上位が並ぶ。linear panel の「最上段」が曖昧 |
| Scope 解決 | scope が複数 tree をまたぐと `?scope=<nodeId>` が二重所属を許すことに |
| compile | scope から見える node 集合の自然な閉包が壊れやすい (forest 越境リンク) |

得るもの:
- 未接続の実験 tree / scratch pool を並べて 1 map に入れられる
- 「scope 1 つ = 独立アプリ」をそのまま並べた workspace にできる

失うもの:
- mind map としての「帰る場所」が無くなる
- 既存の全 read API / path API が破壊的変更

**判定**: 開ける価値が薄い。scratch や実験場は別 map にすれば足りる。
**推奨**: S-Root は **1 固定のまま維持**。複数 scratch tree は `ROOT/SCRATCH/...` の
subtree でシミュレートする現行運用で十分。

### Case B — Sc-Root 複数化 (multi scope-root node)

意味: 1 つの `MapScope` が複数の scope root node を持つ
(schema はすでに `rootNodeIds: string[]` で許している)。
各 scope root node がそれぞれ channel 定義や entry attribute を持ちうる。

影響:

| 層 | 影響 |
|---|---|
| compile 契約 | `compileFromMap(scopeNodeId)` が単数なので API 変更必須。`compileScope(scopeId)` が自然 |
| channels 宣言 | 複数 root node の `m3e:kernel-channels` を **union** する規則が要る。reducer 衝突時の優先度は? |
| entry 宣言 | 各 root node の `m3e:kernel-entry` が食い違う場合の裁定が要る |
| GraphSpec | `scopeId` は単数で良い (scope ≠ scope root node)。node 集合は複数 root の children を合集合 |
| Viewer | scope frame が複数 root box を囲む表示になる。bracket / preview が複雑化 |
| Map attribute spec | 「scope root node の attributes に置く」規約を「scope に紐づくどれか 1 個の宣言 node」等に再定義 |

得るもの:
- **モジュール合成**: channel 宣言を部分ごとに分けた「節」を同じ scope に並べて最終 graph を合成できる
- scope 配下に `__state_decl__` / `__entry_decl__` / `__logic__` のような役割別 island を置ける
- 将来の「subgraph shared state」の自然な表現

失うもの:
- channels の衝突解決ルールを定める必要が出て、compile が倍の複雑さ
- viewer の「scope = 1 入口の箱」という読み方が崩れる
- LangGraph への compile 時に root 束ねの post-process が要る

**判定**: 理論的には有用だが、**現時点では costly すぎ**。
単一 scope root で足りている。ただし `rootNodeIds: string[]` を
schema からも消すのは早計 (将来のモジュール合成余地を閉じる)。

**推奨**: schema は現状維持 (配列のまま)、**運用は 1 固定**。
`map_attribute_spec.md` に「scope root node は 1 個とする (将来の複数化を禁じない)」
と明文化する。

### Case C — E-Root 複数化 (multi-entry graph)

意味: 1 つの graph に **複数の執行入口** が立つ。
外部 invoke 時にどちらの入口を使うかを選ぶ、あるいは全入口が並列 fan-in される。

影響:

| 層 | 影響 |
|---|---|
| GraphSpec | `entry: string` → `entries: string[]` 変更。単数は deprecated alias として残す |
| validate | reachability 判定は「いずれか 1 entry から届く」に緩和 |
| LangGraph compile | LangGraph は START 単数なので **virtual START** を compile 時に挿入し Send fan-out または conditional routing で分配 |
| Checkpoint / thread | thread 毎にどの entry で始まったかが state に載る必要あり |
| `get_state_history` | 線形 chain 前提が維持できる (入口違いでも履歴は 1 本) |
| Viewer | 複数入口が並ぶ surface レイアウト。main lane の定義が揺らぐ |

得るもの:
- **event-driven graph**: 複数の外部イベント源 (webhook, timer, user event) が同じ state 上で動く自然な表現
- 複数 entrypoint agent (supervisor + worker 併存) がそのまま書ける
- M3E map 上で `terminal / entry` sentinel を複数描くと即動く (現在は事実上 1 個しか意味を持たない)

失うもの:
- invoke API に「どの入口か」を選ぶ引数が必要 (`invoke({input, entry?})`)
- LangGraph subprocess への送信時に virtual START を毎回挿入する post-process が要る
- time travel の fork 点に entry 曖昧性が入る

**判定**: **開ける価値が高い**。LangGraph 互換は virtual START で機械的に吸収できるので、
M3E 側の表現だけ開いても実害が小さい。

**推奨**: Phase 3c 以降で **`entries: string[]`** を正とし、
LangGraph 出力時に virtual START を挿入する compile option を足す。

### Case D — Su-Root 複数化 (multi-lane surface)

意味: 1 つの surface に、親を共有しない **複数の島 (island)** が
並ぶ描画を許す。

影響:

| 層 | 影響 |
|---|---|
| map model | 影響なし (純 viewer 事項) |
| GraphSpec | 影響なし |
| Viewer layout | flow-lr 時に複数 main lane を許容。lane 間の間隔・並び順 UI が必要 |
| scope | 1 scope に対して primary surface 1 枚の原則はそのまま |

得るもの:
- 非連結成分のある graph を 1 surface で見渡せる
- reference / notes を別 lane に逃がせる (主経路とは交わらない可視化)
- `system_diagram_map_model.md` の「1 scope = 1 primary surface」前提を
  崩さずに可視化幅を広げられる

失うもの:
- 主経路 (`main lane`) が自動判定できなくなる。明示指定が要る
- layout アルゴリズムの複雑度が一段上がる

**判定**: **即開けて良い**。model 層の変更が一切不要で、
Mermaid も実質「disconnected subgraph を並べて描く」を許している。

**推奨**: Phase 2 の layout 仕事に混ぜて viewer のみで対応。

## Step 4. 横断的な影響

4 ケースの横断効果をもう一段詰める。

### 4-1. 永続化 / schema migration

| 変更 | 破壊性 |
|---|---|
| `AppState.rootId` → `rootIds: string[]` (A) | **破壊的**。全 read/write API、path 解決、skill が影響 |
| `MapScope.rootNodeIds` の運用緩和 (B) | 非破壊。schema すでに配列 |
| `GraphSpec.entry` → `entries: string[]` (C) | 中程度。0.1 → 0.2 で単数 deprecated |
| surface multi-lane (D) | 非破壊 |

結論: A だけが本体永続化に踏み込む。B/C/D は non-breaking に収められる。

### 4-2. LangGraph 互換性

LangGraph の **単数 START** 制約を基準にすると:

- A: そもそも map 単位の話で、LangGraph compile には波及しない
- B: **channels union** の定義 (順序 / 衝突) を PJ04 側で決める必要あり。
  LangGraph 側に伝わる channels は 1 集合なので、union 後の JSON を渡す
- C: **virtual START** 挿入で吸収できる。LangGraph 側は気付かない
- D: 影響なし

したがって LangGraph 互換を保ちつつ緩められるのは **B / C / D**。
A だけは tree の正本を動かすので互換の話ですらない。

### 4-3. Checkpoint / Time Travel

時間巻き戻しでの fork がとくに繊細。

- C (multi-entry) でも、state history は **1 本の parent chain** のままにできる
  (どの entry で始まったかは checkpoint metadata に記録)
- B で channels 宣言が複数 root に散ると、checkpoint schema の channel_versions
  は最終 union 後の 1 map で持てば問題ない
- A は thread 単位で「今どの tree にいるか」が要る。重い

### 4-4. Viewer navigation

- A: `[`/`]` の scope 遷移の「最上位に戻る」操作が ambiguous
- B: scope の入口 preview が複数箱になる
- C: entry が複数あると start 表示 (`▶`) が複数並ぶ
- D: main lane の定義が揺らぐ。tab や lane label が要る

UX の痛みは **A > B > D > C** の順。

### 4-5. 運用 / skill

- `m3e-map` skill の path API (`Map:Root/...`) は A で破壊
- `canvas-protocol` の `ROOT.children → SYSTEM → DEV → ...` という固定 path も A で破壊
- B / C / D は skill 側に波及しない

## Step 5. まとめ

| Case | 意味 | 開ける価値 | 開けるコスト | 判定 |
|---|---|---|---|---|
| A | 構造 forest | 低 (別 map で代替可) | **高** (schema / skill / path 破壊) | **閉じたまま** |
| B | scope に複数 scope root node | 中 (モジュール合成) | 中 (channels union 規約) | **schema は開、運用は閉** |
| C | multi-entry graph | **高** (event-driven / supervisor) | 低 (virtual START で吸収) | **Phase 3c 以降で開く** |
| D | surface multi-lane | 中 (非連結成分表示) | **低** (viewer のみ) | **すぐ開ける** |

## Step 6. もし開けるなら — 段階的移行

**短期 (Phase 2 内)**:
- D を開ける。`render_target_definition.md` に multi-lane surface の layout 規約を追記

**中期 (Phase 3c — control primitives)**:
- C を開ける。`GraphSpec` に `entries: string[]` を追加、`entry` は deprecated alias
- compile_from_map が 0 個以上の `m3e:kernel-node-kind="entry"` を検出して entries に集約
- LangGraph adapter 側で virtual START 挿入

**長期 (Phase 4 以降 / 要判断)**:
- B を運用緩和する場合: channels union / entry 選択の衝突解決ルールを
  `map_attribute_spec.md` に明文化してから

**開けない (現時点)**:
- A: map 永続化の S-Root 単数は維持。forest が必要なら map 分割で対応

## Step 7. Open Questions (Phase 3 以降で決める)

1. C を開けたとき、invoke API は `invoke(input, { entry: id? })` と
   `invoke(input)` (全 entry 並列起動) のどちらを default にするか
2. B を将来開けるとき、channel 衝突の解決順は宣言順 / 重複 reducer 融合 / 衝突エラーのどれか
3. multi-entry graph を viewer で描くとき、START sentinel を
   仮想 1 箱として表示するか / 各 entry box に `▶` marker を付けるか
4. S-Root を 1 固定のまま、`ROOT/SCRATCH/` を forest 代用に使う運用を
   data-model.md に明記するか

## 次アクション

- 本書は採否ではなく **場の整理**。akaghef の review を待って、
  採用分は `map_attribute_spec.md` / `render_target_definition.md` /
  `system_diagram_map_model.md` に順次反映する
- Phase 3c 着手時に C を必ず再議する (この時点の結論だけで固定しない)
- tasks.yaml への反映は review 後

## Layout 節 (2026-04-22 追補)

セッション議論の結果、レイアウト側の結論は以下に集約された (詳細は
[layout_strategy.md](layout_strategy.md))。

### Layout 側の合意

1. **正本 4 層の分離**: topology (①) / 見た目 snapshot (②) / 座標 (③) / 制約 (④)。
   ③ は cache、④ (lane-role / anchor / main lane / edge-kind) を正本にする
2. **breadth (縦) に lane を積む**: `render_target_definition.md` の既存 `lane`
   概念の延長。flow-lr は depth (横) に走り、lane を上下に重ねる
3. **engine は fork せず elkjs を npm dep で借りる**。Phase 3 前後で導入判定
4. **Mermaid は破綻しない**。PJ04 が足すのは engine ではなく「意味論 layer (lane role /
   anchor)」だけ
5. **神 (観察者) の配置**: 既定は案 B (frame 肩書き)、指し先ありは案 A (sky lane)、
   重い観察者は案 E (別 surface)

### Case ごとの採否 (Layout 観点の結論)

| Case | Layout 観点の採否 |
|---|---|
| A (S-Root forest) | **閉じたまま**。tree projection の home が無くなる |
| B (Sc-Root multi) | **schema 開、運用は保留**。scope frame の意味が揺らぐ |
| C (E-Root multi) | **Phase 3 で開ける**。補助 entry は別 lane の先頭に落とす |
| D (multi-lane surface) | **即開ける**。breadth lane stacking で自然 |

### Layout 着手順序

Phase 2 で以下を順に入れる:

1. `m3e:lane-role` / `m3e:anchor` 属性の追加 (制約正本の骨格)
2. breadth lane band の描画実装 (flow-lr に lane 解釈を乗せる)
3. canonical SVG snapshot 回帰 gate (破綻検知)
4. Case D (multi-lane surface) を正式開放

Phase 3 以降:

5. Case C (multi-entry) を開放、virtual START compile
6. elkjs 導入判定 (node 数 30 / lane 4 段 / 手作業疲弊 のいずれか)

## 参照

- [layout_strategy.md](layout_strategy.md) — 本調査を受けた戦略 (親文書)
- [map_attribute_spec.md](map_attribute_spec.md)
- [render_target_definition.md](render_target_definition.md)
- [system_diagram_map_model.md](system_diagram_map_model.md)
- [langgraph_feasibility.md](langgraph_feasibility.md)
- [beta/src/shared/types.ts](../../../beta/src/shared/types.ts)
- [beta/src/shared/graph_spec_types.ts](../../../beta/src/shared/graph_spec_types.ts)
- [beta/src/node/graph_spec_compile.ts](../../../beta/src/node/graph_spec_compile.ts)
- [.claude/skills/m3e-map/references/data-model.md](../../../.claude/skills/m3e-map/references/data-model.md)
