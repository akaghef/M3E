---
title: PJ04 Grill Decisions (2026-04-22)
pj: PJ04
status: decisions-log
date: 2026-04-22
role: "grill-me セッションで確定した決定事項の記録。system_design.md / map_attribute_spec.md への反映待ち。"
scope: "Python 契約は別議論。ここでは data side / authoring UX / stack 構造の決定のみ。"
---

# PJ04 Grill Decisions — 2026-04-22

grill-me セッションでの決定事項。Python 契約 (I22/I23 等) は**対象外** (別議論)。

## 決定一覧

### Q1. subsystem scope の linear text の位置づけ → **C 案**

- subsystem linear text = **intent 散文 (markdown) を primary**
- module-level Python (imports / constants) は専用 **`module-header` inline 子 scope** に退避
- I24 表に `module-header` kind を追記 (scope kind 別 payload 表)
- `m3e:intent` attribute (1-2 行短文) は subsystem 以外の kind (agent / tool / router) 用に残す

### Q2''. protocol 違反の検出と enforce → **P2 (全 soft)**

- L2 Map API は dumb store、validation しない
- 全 protocol 違反 (構造 / 意味とも) は **compile 時に検出**
- 赤/黄バッジで L1 Surface に提示
- ③ auto-repair が修正動線

帰結: Phase A deliverable は **violation catalog (赤/黄 分類)** 1 本。

### Q3. auto-repair の scope → **R3 (二段階)**

- **R3-a 即時 auto-repair (🟡)**: 構造補完のみ、linear text 不変、小 diff preview → 人間 accept 容易
- **R3-b 提案型 fill (🔴)**: linear text 生成含む意味修正、**人間発火必須**
- badge color = level 区分:
  - 🟡 = R3-a 自動候補 (構造)
  - 🔴 = R3-b 要人間発火 (意味)
- §0.1 workflow ③: 「skeleton error 🟡 は auto-repair、意味違反 🔴 は ⑤ Tune へ戻る or 明示 fill 要求」

### Q4 / S1. router branches shadow → **論理 shadow (derived-only)**

- `branches/` container は **sqlite に永続化しない**
- viewer が edge list から毎回 derive して表示
- §1.3 router scope schema から `branches/` を削除、derived view と明記
- §3.2 の router 子表記を「inline data のみ」に修正
- Phase A schema v1 で branches は virtual container として実装

### Q5 / M1. `add_messages` 表現 → **reducer enum に `messages` 追加**

- `reducer ∈ {replace, append, merge, messages, custom}` (5 値)
- L4 Bridge が `reducer == "messages"` 時に LangGraph の `add_messages` を import
- Phase A violation catalog: `reducer = "messages"` の channel は type hint = `list[BaseMessage]` 相当 🟡

### Q6-A. concreteness axis L0-L5 の名前衝突 → **park**

stack L1-L5 と concreteness L0-L5 の記法衝突は認識。今回セッションでは解決せず、未決として §8 に残す。

### Q6-B. stack 短縮名 → **MLG stack**

- 正式名 "M3E-LangGraph stack" は §2 冒頭 1 度だけ
- 以降は **MLG stack** で統一

### Q6-C. authoring 層 visibility 原則 → **V3 + V2**

- §2 冒頭に principle 1 段落を追加: "user facing = M1/M2 の authoring 層、M3 以降は implementation detail"
- **新不変式 I26**: `user-visible surface = authoring layer のみ (M1 + M2)、M3 以降は内部 layer`

### Q7 / U3. `[` / `]` key の UX → **統一 drill-down**

- `[` = 「詳細に進む」単一動詞、全 kind で統一
  - agent / subsystem / sub-agent: surface 遷移
  - tool / router / inline data: **panel focus 移動** (leaf に独立 surface を与えない、I20 維持)
- `]` = 戻り、統一
- inline data で `[`: linear text editor に focus
- Phase A keybind spec に kind 別挙動を明示

### Q8 / A3. source-of-truth matrix → **hash-gated emit**

| 物件 | 正本性 | 書く場所 | 編集可? | 保存期間 |
|---|---|---|---|---|
| Map | canonical | sqlite | ✅ | 永続 |
| GraphSpec | derived | in-memory | ❌ | 実行中のみ |
| generated Python | emitted (Map hash-gated cache) | `runtime/registry/*.py` | ❌ (overwrite warn) | hash 一致時 skip |
| checkpoint | snapshot | LangGraph SqliteSaver | ❌ (update_state API 経由のみ) | thread 生存中 |
| trace | append-only log | NDJSON per session | ❌ (追記のみ) | session 単位 rotate |

- **新不変式 I27**: 上 matrix を正本として固定
- §8 未決 Q3 (trace) は解消、外す
- debug 時は `--dump-spec` flag で GraphSpec を JSON 書き出し可 (canonical ではない)

### Q9. channel 定義 migration → **取り下げ (clean cut)**

- **migration 不要**、`m3e:kernel-channels` attr は legacy read も**しない**
- `channels-def` 子 scope のみが canonical、attr は無視
- map_attribute_spec.md の `m3e:kernel-channels` を deprecated / removed 明記
- Phase A violation catalog: attr 存在時の warn 不要

### Q10. A* 層の境界 (4 sub-questions)

- **Q10-1 (b)**: A1 vs A2 は直交軸、drill-down (`[`/`]`) と独立。A1↔A2 切替は別 shortcut or split view
- **Q10-2 (a)**: A3 (GraphSpec / Python preview) は **read-only**、編集は A2 経由
- **Q10-3 (a)**: A4 inspection 中は A3 を**隣接サブ panel**として表示
- **Q10-4 (a)**: intent markdown は **A1 側** (system diagram 上の subsystem 箱選択で読める)

### MLG stack 二軸構造 (Q10 議論で確定)

**A\* × T\* の 2 軸 matrix、融合しない (F3)**。

user-facing layer (A\*):

| A | user が見るもの |
|---|---|
| A1 Diagram | node, edge, lane |
| A2 Contract | prompt, channels, tools, router |
| A3 Executable contract | GraphSpec + emitted Python preview (read-only) |
| A4 Runtime inspect | state, trace, checkpoint, interrupt |

technical layer (T\*、**T 中、7 本**):

| T | 名前 | 旧 L* |
|---|---|---|
| T1 | Surface render | L1 |
| T2 | Map API + persistence | L2 |
| T3 | Compile (Map → Spec) | L3 前半 |
| T4 | Emit (Spec → .py) | L3 後半 |
| T5 | Bridge IPC | L4 |
| T6 | Runtime (LangGraph) | L5 |
| T7 | Checkpoint store | L5 副次 |

A × T 対応:

| A | 支える T |
|---|---|
| A1 Diagram | T1 + T2 |
| A2 Contract | T2 |
| A3 Executable | T3 + T4 + T5 |
| A4 Runtime | T5 + T6 + T7 |

### Q11 / G2. agent data contract 必須最小 → **薄**

agent scope の required:

| 項目 | kind | required? | 省略時 default |
|---|---|---|---|
| prompt-text child | inline | ✅ 必須 | — |
| tools/ container | child container | ✅ 必須 (空 `[]` 可) | — |
| writes/ container | child container | ✅ 必須 (空 `[]` 可) (Q12 W2 追加) | — |
| reads/ container | child container | optional | "全 channel 可読" |
| schema-json | inline | optional | `{messages: append}` default |
| handoff | attribute / edge | optional | なし |
| escalate | attribute | optional (Phase D) | なし |

### Q12 / W2. reads/writes 省略時意味論 → **reads 広く、writes 明示**

- **reads**: optional、省略時 "全 channel 可読"、🟡 warn "interpreted as all channels readable"
- **writes**: **必須** (空 container 可)、欠落は 🔴 compile error
- compile 検査:
  - 🟡 `writes/ declared but function body returns different keys`
  - 🟡 `writes/ declared but some keys never returned`
- 非対称の根拠: read は副作用なし、write は他 agent に見える副作用あり。**write だけ契約明示** が authoring コスト / validation 効果のバランス最良

## 残り問題の再開順 (ユーザ指示)

実行契約の核 (Q13 router / subgraph / checkpoint / time travel / contract preview closedness) を先に閉じて、その後 UI と運用語彙 (badge / interrupt / trace UI) を詰める。provenance と concreteness 名前衝突は park。

### 閉じる順

1. **time travel 一貫性** (runtime 全体の揺れを止める)
2. **checkpoint 保存境界** (time travel の前提)
3. **Q13 router と data の接続** (compile contract の核)
4. **subgraph state isolation** (Phase A で shared-only 確定)
5. **Contract Preview closedness** (「確認できた」の意味を固定)

### その後

6. **data violation badge taxonomy**
7. **interrupt / escalation payload**
8. **trace / live state / timeline UI 統一**

### park

- **provenance 粒度** (log 用途のみ、必要出てから)
- **Q6-A concreteness axis 名前衝突**

---

## 追加決定 (ユーザ推奨を採用)

### time travel 一貫性 → **old spec 正本**

- resume は **checkpoint 時点の freeze (old spec)** に従う
- current spec で再実行は**別操作**として分離 (`resume` と `replay-with-current` を区別)
- I2 (実行不可侵) と整合

### checkpoint 保存境界 → **識別 hash 併存**

- 最低限: **GraphSpec hash + map snapshot id** を checkpoint と一緒に保存
- できれば **emitted Python hash** も
- 「値本体より何で作られた state かの識別が重要」

### Q13. router と data の接続 → **R1 (edge list 正本、branch key 独立)**

- edge list が branch key 正本
- `"default"` edge ラベル明示必須
- Python annotation `Literal[...]` は optional な照合用
- branch key は **state channel に直結必須ではない** (router output として独立でよい)

### subgraph state isolation → **Phase A = shared のみ**

- Phase A は **shared のみ確定**
- isolated + input/output mapper は **Phase C/D へ deferred** (park ではなく、時期指定)
- 今 mapper まで入れると契約が重くなりすぎる

### Contract Preview の closedness → **Phase A の 4 条件**

「確認できた」= 下記をすべて満たす:
1. 必須項目が埋まっている
2. 🔴 バッジ 0
3. compile 成功
4. A3 preview が生成できる

**「実行 1 回通過」は stronger condition として別扱い** (closedness の基本定義には含めない)

### data violation badge taxonomy → **意味ベース 2 色**

- **🟡** = 構造・宣言の補完 / 正規化で直せる
- **🔴** = 意味判断、本文生成、実装と宣言の乖離
- `writes/` 宣言と function body return の不一致 → **基本 🔴** (実装と宣言の乖離)

### interrupt / escalation payload → **summary + changed channels + optional full**

- 初期: summary + changed channels (+ optional full state)
- いきなり full dump を正本にしない
- Phase D で詰める

### trace / live state / timeline UI 統一 → **A4 内 3 pane or tabs**

A4 runtime inspect の中で:
- timeline
- current state
- trace

を 3 pane or tabs で表示。具体 UI は構造決定より後。

### provenance 粒度 → **park (当面 scope 単位)**

- 当面は **scope 単位** の `m3e:provenance`
- linear text 単位 / channel schema history は必要出てから
- 現状 log 用途のみ

### Q6-A concreteness axis 名前衝突 → **完全 park**

## doc 反映 TODO

- [ ] system_design.md §2 に MLG stack 名称 + A× T 二軸表 + I26 / I27
- [ ] system_design.md §1.3 から router `branches/` 削除
- [ ] system_design.md §1.7 の I24 表に `module-header` inline kind 追記
- [ ] system_design.md §4 に I26 (authoring layer visibility) / I27 (matrix 固定) 追加
- [ ] system_design.md §8 未決表から Q3 (trace)、Q5 (messages)、Q14 (channels migration) を削除
- [ ] system_design.md §8 に Q6-A / Q13 / subgraph isolation / contract preview / provenance 等を追加
- [ ] map_attribute_spec.md の `m3e:kernel-channels` を deprecated 化
- [ ] Phase A deliverable: violation catalog (🟡/🔴 分類) を新規 doc 化
