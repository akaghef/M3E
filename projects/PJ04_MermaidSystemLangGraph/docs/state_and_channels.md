---
title: PJ04 — State / Channel Authoring Design
pj: PJ04
status: draft
date: 2026-04-22
covers: data 側 (state schema / channels / reducers / checkpoint) を M3E authoring にどう載せるか
related:
  - langgraph_integration_plan.md (execution layer、不変式 I1-I7)
  - concreteness_axis.md (view depth L0-L5)
  - map_attribute_spec.md (m3e:kernel-* contract)
principle: authoring は骨格だけ。正の情報は panel、負の情報だけ box。
---

# State / Channel を authoring にどう載せるか

## 0. なぜ別書にするか

[langgraph_integration_plan.md](langgraph_integration_plan.md) は **システム (graph 構造)** の取り込み設計。
[concreteness_axis.md](concreteness_axis.md) は **view の解像度** の設計。
本書は **データ (state schema / channels / reducers / checkpoint)** を authoring surface にどう載せるかを単独で決める。

LangGraph は「グラフ構造」と「状態」が**直交する 2 本の柱**で、我々は今のところ前者しか描けていない。本書で後者の扱いを確定する。

---

## 1. LangGraph の data model recap

### State Schema = 型
```python
class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]   # append
    plan: str                                              # replace (default)
    usage: Annotated[int, operator.add]                    # sum
```

- `TypedDict` (or Pydantic) で全体の形
- `Annotated[T, reducer]` で per-channel の merge semantics
- 未指定 → `replace` (last write wins)

### Channel (named data slot)
1 channel あたり: `name` / `reducer` / `version` / `type hint`。
`version` は書き込みで bump、delta 検出と stream("updates") に使われる。

### 組み込み reducer
| reducer | merge semantics |
|---|---|
| `replace` (default) | 上書き |
| `operator.add` | 数値加算 / list concat |
| `add_messages` | 会話履歴 append (id 衝突時は差し替え、tool_call 対応) |
| custom | 任意関数 (registry ref) |

### Checkpoint = データの時間軸
`{channel_values, channel_versions, pending_writes, parent_checkpoint_id}` が 1 checkpoint。
graph 構造は不変、data は checkpoint 列で進む。

### データを触る API
- `invoke(input)` — input は初期 channel 値として merge
- `stream(mode="values"|"updates"|"messages"|"debug")` — data の見せ方選択
- `get_state(threadId)` — 現在の channel values
- `update_state(threadId, values, asNode)` — 人力書き込み (time travel)

---

## 2. 我々が今いる位置

| LangGraph 概念 | M3E 実装 | 状態 |
|---|---|---|
| State Schema | scope root の `m3e:kernel-channels` (JSON array) | ✅ 足場 |
| Reducer 種別 | `append` / `replace` / `merge` / `custom` | ✅ 型定義済 |
| Channel values (live) | bridge 経由で Python が保持 | 🔴 未実装 |
| Checkpoint chain | SqliteSaver 本家流用予定 | 🔴 未実装 |
| Reducer 実体 | registry ref で Python が解決 | 🔴 未実装 |
| **Channel の read/write 注釈 (per node)** | **無い** | 🔴 設計未確定 |
| **Channel の surface 描画** | **無い** | 🔴 設計未確定 |

---

## 3. 基本方針 — authoring minimalism (核の原則)

**authoring と inspection は別の仕事**。authoring surface に情報を積むと作成が止まる。

### 3 つの原則
1. **authoring は骨格まで** — node を置いて線を引く速度を殺さない
2. **正の情報は panel、負の情報だけ box** — resolved は無印、unresolved / mismatch だけ赤バッジ
3. **bridge 依存を authoring に持ち込まない** — L2 までは pure map で完結

channels / state schema もこの原則に従う: **定義は panel、異常だけ surface**。

---

## 4. 決定事項 (★5段階評価)

### D1. データを surface にどう描くか

**選ぶ**: **(c) 折衷 — 正の情報は panel、負の情報だけ surface**

| 案 | 評価 | 詳細 |
|---|---|---|
| (a) panel 専用 | ★★★★☆ | 箱は system 図に徹する。channels / reducers は右 panel で編集・閲覧。authoring 最小主義と完全一致。ただし **構造的不整合 (dangling channel, reducer mismatch) が見えない** |
| (b) surface data lane | ★★☆☆☆ | 箱の上下に data lane を走らせ、read/write を線で描く。密度高、authoring 速度を殺す。Node-RED 的。pipeline tool 向きだが graph authoring 向きではない |
| **(c) 折衷 ✅** | ★★★★★ | 定義・値は panel。ただし **unresolved ref / dangling channel / reducer mismatch / write-only channel は box に赤バッジ**。"正の情報は出さない、負の情報だけ出す" |

**根拠**: authoring minimalism と **errors-visible** を両立。正常時の視覚ノイズが最小。

---

### D2. State Schema をどこに書くか

**選ぶ**: **(a) 現状維持 (scope root の `m3e:kernel-channels`)**

| 案 | 評価 | 詳細 |
|---|---|---|
| **(a) scope root 属性 ✅** | ★★★★☆ | 現実装。JSON array を scope root の `m3e:kernel-channels` に置く。scope = graph なので 1:1 対応が自然 |
| (b) 専用 "State node" を scope 内に置く | ★★☆☆☆ | 可視化しやすいが node が増えて authoring 時にノイズ。subgraph との isolation でも扱いが不明 |
| (c) 外部 Python schema file (TypedDict) を正本 | ★★★☆☆ | Python 型の完全互換が取れるが、map 単独で graph を閉じられない。**I1 (compile 決定性)** が外部ファイル依存で脆くなる |

**補強**: (a) のまま、右 panel に **structured channel editor** を作る (panel 上で add/remove/rename、JSON を直書きしなくて良い)。

---

### D3. Channel の read/write 注釈 (per node)

**選ぶ**: **(b) optional**

| 案 | 評価 | 詳細 |
|---|---|---|
| (a) required (全 node で必須) | ★★☆☆☆ | 型安全性は上がるが authoring 速度が落ちる。channels が少ない段階では overkill |
| **(b) optional ✅** | ★★★★☆ | `m3e:kernel-reads` / `m3e:kernel-writes` (JSON string array) を optional 属性として許可。書いた node だけ **static validation** 対象、書かない node は "全 channel 読み書き可能"。authoring は軽く、明示した node から順に型が強くなる |
| (c) 未導入 (runtime のみで検出) | ★★★☆☆ | 最小限で分かりやすいが、dangling channel warning が出せない |

**validation のトリガ**:
- 書かれていない channel を read している node → **赤バッジ "unknown channel"**
- どこからも write されない channel → **scope root に赤バッジ "channel never written"**
- write only channel (read する node 無し) → **黄バッジ (warning)** 、scope root に出す

---

### D4. Checkpoint chain の UI

**選ぶ**: **concreteness 軸とは別軸として扱う (history selector)**

- **concreteness (L0-L5)** = 同じ瞬間を**どの粒度で見るか**
- **checkpoint timeline** = 同じ粒度を**どの瞬間で見るか**

両者は独立。UI 上も別コントロール:

- 具象軸: `j` / `k` + 右 panel
- 時間軸: 画面上部の **checkpoint timeline bar** (Phase D で導入)
  - 丸印が checkpoint、現在位置に marker
  - クリックで時点 select、`Enter` で time travel (update_state 経由で fork)

**Phase D (Interrupt + Time Travel)** のスコープに含める。本書では仕様だけ確定。

---

## 5. 右 panel の data セクション構成

選択 node (or scope) に対して表示:

### scope root 選択時
- **Channels** (structured editor)
  - row per channel: name / reducer select / reducerRef (custom 時) / typeHint
  - + ボタンで add、× で remove
  - validation: 不整合 (never written 等) を channel row に赤マーク
- **Entry** (Node select dropdown, default = `__start__`)
- **Interrupt** (Before / After の JSON array、Phase D 以降)

### 通常 node 選択時
- **Reads / Writes** (optional)
  - JSON string array を編集
  - 無効化 toggle で "全 channel 読み書き" に戻せる
- **Callable ref** / **Router ref** (L3+ で signature 表示)

### Panel 表示条件
- authoring mode (L0-L2): panel は **selection で自動更新**、`L` で pin
- inspection mode (L3+): panel は常時、**現在実行中 node に追従** (選択と別 track)

---

## 6. surface 上の "負の情報" カタログ

node box に赤バッジを出すケース (validation 起動条件):

| バッジ | 条件 |
|---|---|
| `unknown channel` | 宣言されてない channel を reads に書いた |
| `unresolved ref` | `m3e:kernel-callable-ref` が registry に存在しない |
| `router missing` | 2 本以上 `cond:*` link が出てるのに `m3e:kernel-router-ref` が無い |
| `unreachable` | `__start__` から到達不能 |

scope root に赤バッジを出すケース:

| バッジ | 条件 |
|---|---|
| `channel never written` | 宣言した channel を誰も write しない |
| `channel schema invalid` | `m3e:kernel-channels` の JSON parse 失敗 |
| `entry missing` | `m3e:kernel-entry` が存在しない node を指している |

黄バッジ (warning、無視可能):

| バッジ | 条件 |
|---|---|
| `write only` | channel を read する node 無し |
| `reducer custom, ref empty` | reducer=custom なのに reducerRef 未設定 |

---

## 7. この設計の不変式 (既存 I1-I7 の延長)

- **I8 (data authoring minimal)**: channel 定義 / reducer ref は scope root 属性に閉じる。node は optional で reads/writes を宣言可能。**surface にはエラーのみ現れる**
- **I9 (schema も map)**: State Schema は map の一部。外部 Python ファイルを正本にしない (I1 compile 決定性のため)
- **I10 (時間軸と具象軸の独立)**: checkpoint timeline と concreteness level は直交。UI も別コントロール

---

## 8. 実装順 (既存 Phase との接続)

| Step | Phase | 成果物 |
|---|---|---|
| S-0 | 現状 | `m3e:kernel-channels` 読み取り (✅ compile 側は実装済) |
| S-1 | T-A-1 (Phase A) | channel spec の抜け穴を map_attribute_spec に明文化: subgraph 継承、reducer=custom の reducerRef 必須、channel 名の naming rule |
| S-2 | Phase 1-2 | 右 panel の **Channels editor** UI (pure map、bridge 不要) |
| S-3 | Phase 1-2 | surface 上の **赤/黄バッジ validation** (pure map) |
| S-4 | Phase B | `m3e:kernel-reads` / `m3e:kernel-writes` を compile 時に dependency graph に変換 |
| S-5 | Phase D | **checkpoint timeline bar** UI + `update_state` 呼び出し |

S-1 は T-A-1 の延長で **無料**。S-2 / S-3 は bridge 不要で先行可能。

---

## 9. 未決定 (E1/E2/E3 候補)

| Q | 候補 | 現時点の推奨 |
|---|---|---|
| Q5. `add_messages` reducer を M3E で 4 種類のうちどれに mapping? | (a) `append` の extension / (b) 新 `messages` kind を追加 | **(b) 新 kind を追加** (message id 衝突時の置換は通常 append と違う semantics) |
| Q6. Channel 名の命名規則 | ascii lower snake / camel 自由 | **ascii lower snake + 数字** (LangGraph の TypedDict key と合わせる) |
| Q7. Subgraph の state isolation UI | 属性 `m3e:kernel-subgraph-mode = shared / isolated` / input/output mapper も属性? | **mode 属性のみ先行、mapper は Phase 4 時点で決める** |
| Q8. Channel editor での type hint | free string / 列挙 (string, number, boolean, list, object, message[]) | **列挙 + "custom" (free string)** |

---

## 10. 非目標

- **Channel を surface に描画すること** (data lane 方式) — (b) 却下、D1 参照
- **State Schema を外部 Python ファイルから import** — I9 違反
- **node ごとに reducer を再定義** — reducer は channel 単位
- **reactive channel (RxJS 的)** — LangGraph にない概念

---

## 11. TL;DR

- 正本 = `m3e:kernel-channels` (scope 属性、JSON array) のまま
- authoring surface には **バッジ (validation error / warning) しか出さない**
- Channels / Reducers / Entry / Interrupt は **右 panel で編集**
- Reads/Writes 注釈は **optional**、書いた node だけ validation 対象
- Checkpoint timeline は **具象軸とは別軸**、Phase D で着手

**原則**: data も "authoring は骨格、panel で詳細、box には問題だけ"。
