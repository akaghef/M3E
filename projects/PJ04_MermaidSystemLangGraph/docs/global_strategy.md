---
title: PJ04 — 大域戦略 (Global Strategy)
pj: PJ04
status: canonical (strategy)
date: 2026-04-22
role: "各 deep-dive 戦略 doc (layout / langgraph / state / concreteness / multi_root) を 1 本の時間軸と依存 DAG に束ねる指揮スコア。"
supersedes: none
references:
  - system_design.md (architecture canonical)
  - langgraph_integration_plan.md (Phase A-F)
  - layout_strategy.md (Phase 2 LAY)
  - state_and_channels.md (S-0..S-5)
  - concreteness_axis.md (L0-L5, T-CX-0..4)
  - multi_root_scope_investigation.md (Case A-D)
  - langgraph_feature_coverage.md (feature coverage table)
  - merge_strategy.md (PJ 終了後 merge)
---

# PJ04 大域戦略

> **TL;DR**: M3E を **LangGraph 系システムの協働 authoring 環境** にする。**技術 stack = MLG stack** (T1 Surface / T2 Map / T3 Compile / T4 Emit / T5 Bridge / T6 LangGraph / T7 Checkpoint、[system_design.md §2](system_design.md) 正本) × **authoring depth** (Outer = 骨格 / Inner = 詳細、どちらも T2 Map 内) を、**4 トラック並走 + 2 ゲート直列** で組み上げる。
> トラックは { Execution (A-F) / View (CX-0..4) / Layout (LAY-1..6) / Data (S-0..5) / Template (TPL-0..2) }。
> 直列ゲートは { **G1: Contract Freeze** → 大多数のトラックを開く / **G2: Bridge MVP** → L3+ / L5 / trace を開く }。
> 実用検証の縦糸は **CLI-first Template PJv Factory**: System Block Template を CLI で完結させ、AI が Template System Spec から PJv34 Weekly Review system を再構築し、さらに PJv34 以外の PJv* も同じ手順で仕様化・system diagram 化・Run/test まで通す。
> 到達度の正本は [langgraph_feature_coverage.md](langgraph_feature_coverage.md): LangGraph 機能ごとに Template / GraphSpec / CLI Run / Test / UI の状態を追跡する。
> 最終目的は **Collaboration Stance** (Sketch → Fill → Review → Tune → Run → Iterate) が map 内で完結する状態。
> **authoring は Outer 骨格のみ、詳細は Inner、surface にはエラーだけ**。この原則を破ったらトラックを止めて戻る。

---

## 1. 大域的な 1 行

**M3E を LangGraph 系システムの協働 authoring 環境とし、技術レイヤ L1 Surface → L2 Map → L3 GraphSpec → L4 Bridge → L5 LangGraph の 5 段と、L2 Map 内の authoring depth (Outer = 人間の骨格 / Inner = AI の詳細) を組み合わせて、map を壊さず 4 トラック並走で成立させる。**

- **作らない**: 独自 runtime / 独自 graph library / 独自 checkpoint fork (N1-N10 参照)
- **守る**: L2 Map は唯一の authoring 正本、node = scope 統一 (I12)、AI-fill は Inner 限定 (I13)
- **揃える**: 概観/詳細の境界 = 人間/AI の担当境界 = `[` / `]` 移動の境界 ([system_design.md §2](system_design.md))
- **降りる**: 全機能 TS 再実装は採用しない (feasibility 🔴)
- **量産する**: LangGraph pattern を System Block Template として持ち、AI が Template System Spec を書けば CLI で AppState / GraphSpec / Run / test まで通るようにする

---

## 2. 4 軸 × 4 トラック 対応表

PJ04 の仕事はすべて以下の **4 軸** のいずれかに落ちる。各軸を 1 本の deep-dive doc が担当する。

| 軸 | 問い | 担当 doc | Track ID | Phase tokens |
|---|---|---|---|---|
| **構造** (tree / graph) | atom / scope / edge をどう置く? | [system_design.md](system_design.md) §3 + [multi_root_scope_investigation.md](multi_root_scope_investigation.md) | — (axiom) | — |
| **遷移** (execution) | どう動かす? 中断・再開・分岐は? | [langgraph_integration_plan.md](langgraph_integration_plan.md) | **EXEC** | A, B, C, D, E, F |
| **具象度** (view depth) | 今どこまで見せる? | [concreteness_axis.md](concreteness_axis.md) | **VIEW** | CX-0..CX-4 (L0..L5) |
| **時間** (checkpoint) | どの時点を見ている? fork する? | [state_and_channels.md](state_and_channels.md) §D4 + EXEC Phase D | **TIME** | (EXEC D に合流) |
| **layout** (正本+1) | どう読める位置に置くか? | [layout_strategy.md](layout_strategy.md) | **LAY** | LAY-1..LAY-6 |
| **data** (state/channel) | 何を chan に流し誰が書く? | [state_and_channels.md](state_and_channels.md) | **DATA** | S-0..S-5 |
| **template** (system block) | LangGraph pattern をどう量産可能な block にする? | [system_design.md](system_design.md) + `docs/system_block_templates.md` (予定) | **TPL** | TPL-0..2 |

構造は **動かさない前提**。他の 5 本が構造を壊さないことが不変式の核。

---

## 3. 大域不変式 (I-G シリーズ)

各 doc が持つ I1-I13 を **横串で強制する大域 invariant**。トラックを跨いで守る。

| ID | 不変式 | 守る仕組み |
|---|---|---|
| **I-G1** | map は常に authoring 正本 (他の derive 先を書き戻さない) | I1 / I2 / I4 / I6 / I9 の総和 |
| **I-G2** | surface (Outer) には **負 (error/warning) しか置かない**、詳細は Inner | I8 / authoring minimalism |
| **I-G3** | ref 解決は常に Python 側、map は文字列のまま | I3 |
| **I-G4** | 具象度・時間軸・layout は volatile または cache (永続化しない) | I6 / I10 / HR-5 |
| **I-G5** | trace / checkpoint は append-only、map を汚染しない | I4 / I5 |
| **I-G6** | `workflow_*.ts` / `WorkflowState` / PJ03 contracts は不可侵 | PJ04 契約 |
| **I-G7** | 無傷の降下 — いずれかのトラックが詰まっても他トラックが続行可能 | トラック独立性 |
| **I-G8** | `AppState.rootId` 単数固定 (multi-root は map 分割で) | HR-6 |
| **I-G9** | node = scope 統一。leaf と container は kind が違うだけ | I12 |
| **I-G10** | AI-fill は Inner のみ。Outer は常に人間の担当 | I13 |
| **I-G11** | `m3e:provenance` で AI-generated / human-edited を区別できる | Collaboration Stance ⑥ iterate の前提 |

**I-G7 が最重要**。トラック依存を DAG に閉じ込める (§5) のはこのため。
**I-G9 / I-G10 は authoring の「床」**。これを破ると AI 協働ループ (§4.3) が成立しない。

---

## 4. 4 トラック × 2 ゲート

### 4.1 トラック独立性

| Track | 独立に進められる範囲 | G1 より前に開けるもの | G1 後 G2 前 | G2 後 |
|---|---|---|---|---|
| **EXEC** | — | — | Phase A (G1 本体) | Phase B/C/D/E/F |
| **VIEW** | CX-0 (L2) は bridge 不要 | CX-0 | — | CX-1/2/3/4 |
| **LAY** | 制約語彙 + 描画は独立 | **LAY-1..LAY-4 全部** | LAY-5 設計 | LAY-5 実装, LAY-6 判定 |
| **DATA** | S-0/S-2/S-3 は bridge 不要 | S-0, S-2, S-3 | S-1 (G1 合流) | S-4, S-5 |

### 4.2 直列ゲート

```
    [now]
      │
      ├── LAY-1..LAY-4  ────┐
      ├── CX-0 (L2)        │
      ├── S-2 / S-3        │
      │                    ▼
      └── ⏸ G1: Contract Freeze (= EXEC Phase A = T-A-1)
                │           │
                ├── S-1 合流 │
                ▼           ▼
          ⏸ G2: Bridge MVP (= EXEC Phase B = T-B-1)
                │
                ├── CX-1 (L3 signature)
                ├── CX-2 (L4 source)   [CX-1 依存]
                ├── S-4 panel editor
                ▼
          EXEC Phase C (streaming) ──┐
                │                    ├── CX-3 (L5 live)
                ▼                    ├── S-5 (trace overlay)
          EXEC Phase D (interrupt + time travel)
                │
                ▼
          EXEC Phase E (Anthropic tools) ── EXEC Phase F (observability)
```

**G1 (Contract Freeze)** を通過させるには `map_attribute_spec.md` の穴 (subgraph channel 継承 / conditional default / non-START entry) を埋め、`compileFromMap` の vitest で determinism を示す必要がある。ここが唯一の「全トラック同期ポイント」。

**G2 (Bridge MVP)** は VIEW L3+ と DATA S-4 の開栓条件。G2 の前では signature / source / live state は box に出さない。

### 4.2.1 CLI-first Template PJv Factory

PJ04 の実用検証は、抽象的な canonical sample だけではなく **PJv34 Weekly Review** と複数の **PJv*** を使う。
viewer UI は後回しにし、CLI で catalog / spec / build / run / test を先に完結させる。

手順:

1. LangGraph pattern を System Block Template として定義する
2. AI が Template System Spec (YAML/JSON) を書く
3. CLI が spec から AppState / GraphSpec を生成する
4. CLI local runner が GraphSpec を実行する
5. CLI test が catalog / spec / build / run / failure / no-secret-output を検証する

成功条件:

- 上位 diagram は `Load Context -> Generate Doc -> Write Output` 程度の抽象度を保つ
- `Generate Doc` の内部 subsystem に provider call / evaluate / retry / fallback loop が入る
- AI がゼロから node 属性を手書きせず、Template System Spec の slots を埋めて system を作る
- Run の trace が Control Graph の node id と対応する
- CLI だけで PJv34 Run が再現でき、UI なしで regression test が回る
- `instructions/pjv_factory/` の Master / worker 指示で、PJv34 以外の PJv* を batch queue から並列に system 化できる
- M3E map の `開発/strategy/PJ04 PJv Factory` に PJv* ごとの work scope / review / run evidence が作られる

この縦糸は G1/G2 の実用 acceptance test として扱う。

### 4.3 Collaboration Stance (6-step) — 最終的な authoring ループ

4 トラックと 2 ゲートの **最終到達点** はこの 6 歩が map 内で完結すること ([system_design.md §0](system_design.md))。

```
① Sketch (人間)  Outer に骨格: agent 名 + 主要 edge
② Fill   (AI)    Inner を埋める: prompt / source / schema / channels / 子 tool
③ Review (人間)  [ で scope に入り Inner を確認
④ Tune   (人間)  Inner の inline data を直接編集 or AI に局所再生成指示
⑤ Run    (M3E)   compile → L4 Bridge → L5 LangGraph、live-view が Inner にストリーム
⑥ Iterate       ④ へ戻る (or ① へ戻って骨格修正)
```

**トラック別の寄与**:
- **LAY** は ①③ (surface が読める layout) を成立させる
- **EXEC** は ⑤⑥ (compile/run/iterate) を成立させる
- **VIEW** は ②③⑤ (AI-fill 後の確認 / live-view の表示) を成立させる
- **DATA** は ①②③ (channel 宣言を Inner の `channels-def` に置ける / 赤黄バッジで未定義を検出) を成立させる

**このループが 1 周回ったとき PJ04 は実質 done**。10 で定義する終了条件はこの要請を分解したもの。

---

## 5. 依存 DAG (task level)

トラック内の task レベル依存。**点線** は情報依存のみ (実装依存なし)、**実線** は実装依存。

```
LAY-1 ──► LAY-2 ──► LAY-4
  │                   ▲
  ▼                   │
LAY-3 ────────────────┘
                      │
          [Phase 3 trigger: node 30 超 / lane 4 段 / 手作業疲弊 3 回]
                      ▼
                    LAY-5 ◄── T-A-1 (G1)
                    LAY-6 (Go/No-Go)

T-A-1 (G1) ──► T-B-1 (G2) ──► T-C-1 ──► T-D-1 ──► T-E-1 ──► T-F-1
                 │               │
                 ├──► CX-1 ─►CX-2┤
                 ├──► CX-4       │
                 └──► S-4        │
                                 ├──► CX-3
                                 └──► S-5

CX-0 ·····(情報依存)····► LAY-2    # kind icon の描画位置を lane band が決める
S-2 ·····(情報依存)····► S-4      # surface バッジ定義が panel editor の UI を決める

TPL-0 ──► TPL-1 ──► TPL-2 ──► TPL-3
  │        │        │        │
  │        │        │        └──► T-B-1/T-C-1 acceptance (bridge Run)
  │        │        └──────────► CLI local runner acceptance (PJv34 Run)
  │        └───────────────────► T-A-1 (template-derived GraphSpec determinism)
  └────────────────────────────► CX-0 later (template kind / channel badge)
```

---

## 6. 週次ロードマップ (calendar 指向)

前提: 1 セッション ≈ 1/2〜1 人日、週 3-5 セッション。

| 週 | 主戦場 | Track | 狙い | 出口 |
|---|---|---|---|---|
| **W1** (現在) | LAY-1 / LAY-3 並列 | LAY | 制約語彙 + snapshot gate | map_attr_spec に lane-role、`canonical_layout.svg` 凍結 |
| **W2** | LAY-2 / LAY-4 | LAY | breadth lane 描画 + multi-lane 開放 | PJ04 canonical map に observer lane 追加 |
| **W2 並行** | CX-0 | VIEW | CX-L2 (kind icon + channels badge) | bridge 無しで box が役割を示す |
| **W2 並行** | S-2 / S-3 | DATA | surface validation バッジ + panel skeleton | 赤/黄バッジ 1 周回 |
| **W2 並行** | TPL-0 | TPL | System Block Template catalog | LangGraph pattern → M3E block 対応表 |
| **W3** | **G1**: T-A-1 | EXEC | GraphSpec v0.1 freeze + vitest | determinism 証明、S-1 spec 穴埋め合流 |
| **W3 並行** | TPL-1 | TPL | Template System Spec + generic build CLI | YAML/JSON spec → AppState / GraphSpec |
| **W4** | **G2**: T-B-1 | EXEC | bridge MVP (`bridge.py` / `registry.py` + TS client) | invoke 往復、`introspect` / `fetch_source` IPC |
| **W4-5** | TPL-2 | TPL | generic local runner + tests | PJv34 run / failure route / no-secret-output |
| **W5+** | TPL-3 | TPL | bridge runner 接続 | CLI spec が Python bridge でも走る |
| **W4-5** | CX-1 / CX-4 並列 | VIEW | signature in panel + per-node override | ref 解決済 symbol が panel に出る |
| **W5** | T-C-1 | EXEC | streaming + checkpoint | thread 再開 OK、viewer highlight |
| **W5-6** | CX-3 / S-5 | VIEW/DATA | live state overlay + trace persistence | active node pulse |
| **W6** | T-D-1 | EXEC | interrupt + time travel | approval UI、`update_state` fork |
| **W7** | T-E-1 | EXEC | Anthropic tools + ReAct agent sample | end-to-end 1 本走る |
| **W8** | T-F-1 | EXEC | observability + crash recovery | NDJSON ring、OTel opt-in |
| **W8+** | merge 準備 | — | [merge_strategy.md](merge_strategy.md) 発動 | docs→model→viewer の PR 3 本化 |

**計画の嘘 buffer**: 各 Phase に round_max が 2-3 ある。1 回目 reject は想定内、3 回連続 reject で戦略見直し。

---

## 7. Gate / Go-No-Go 表 (triggers → decisions)

| トリガ | 判定 | 結果 |
|---|---|---|
| `map_attribute_spec.md` vitest 通過 | G1 通過 | EXEC Phase B 以降を open |
| `bridge.py` smoke test round-trip OK | G2 通過 | VIEW L3+ / DATA S-4 を open |
| 1 surface の node > 30 **or** lane 段 ≥ 4 **or** 手作業 `flowCol/flowRow` 調整 ≥ 3 回 | elkjs Go 条件 | LAY-6 を起動、`layerConstraint` に lane-role pass-through |
| snapshot diff: bbox 20px↑ 動いた node ≥ 3 | LAY blocker | LAY コミット pause、原因特定 |
| snapshot diff: 交差数 +30% 以上 | LAY blocker | 同上 |
| T-1-1 の mermaid parity checklist 全 pass | Phase 1 close | `plan.md` Phase 1 done 宣言 |
| feasibility 🔴 item が「やっぱり必要」になった | 戦略見直し | `system_design.md` §9 (非目標) に照らして再判断、idea/ に pool |
| `workflow_*.ts` の変更提案 | 即却下 | PJ03 契約不可侵 (I-G6) |

---

## 8. 非目標 (explicit)

**やらない** ことを明示しておかないと誰かが手を出す。

| # | やらない | 理由 |
|---|---|---|
| N1 | LangGraph の全機能 TS 再実装 | 12-24ヶ月、継続メンテ、GUI 律速 3x (feasibility 🔴) |
| N2 | Pregel super-step の自前実装 | LangGraph 本家がやる |
| N3 | Time travel fork の map 側実装 | `update_state` で Python 側 fork、map に書かない |
| N4 | LangSmith 互換 trace schema | 独自 NDJSON + OTel opt-in で足りる |
| N5 | OpenAI / Gemini binding | Anthropic 1 本に絞る (N1 の亜種) |
| N6 | multi-root graph (S-Root forest) | map 分割で解く (HR-6) |
| N7 | tree projection の runtime 正本化 | tree は inspection 用、compile は system から |
| N8 | 複数 map 対応の一般化 | 固定 map sandbox の範囲で閉じる |
| N9 | Mermaid import/export round-trip | authoring は M3E、Mermaid は参考のみ |
| N10 | 完成 IDE を目指すこと | PJ04 は sandbox、authoring + inspection 最小単位まで |

---

## 9. Failure modes (PJ を殺すパターン)

観測したら即停止して原因特定。

| 症状 | 何が壊れたか | リカバリ |
|---|---|---|
| map が実行後に変わっている | I-G1 / I2 違反 (trace が書き戻された) | bridge の writer を止める、I-G5 再確認 |
| Python 側 exec が map 文字列を eval | I-G3 違反 | registry に whitelist、ref 検証強化 |
| concreteness level が map に永続化 | I-G4 違反 | window state に戻す、migration で除去 |
| layout engine が lane 境界を越える | HR-4 違反 | lane-role を fixed anchor に、engine 入力を lane 内に制限 |
| T-A-1 が 3 round reject | 契約 under-specified | map_attribute_spec の穴をもう一段洗い、G1 を 1 週延期 |
| 同じ UI 手戻りが 3 セッション続く | 戦略の想定が現場と乖離 | 当該トラックを pool、別トラックへ focus 移動 (I-G7) |
| viewer.ts が 3000 行超 | single-file 肥大 | routing / surface / projection を module 分割、LAY Phase 3 同期 |
| docs が実装と乖離 | 戦略本の追認忘れ | draft → canonical 昇格 or status: outdated を立てる |

---

## 10. PJ04 終了条件 (merge exit gate)

以下 **全て** を満たしたら PJ04 を close し [merge_strategy.md](merge_strategy.md) へ。

1. **Collaboration Stance が 1 周回る** — 人間が Outer に agent scope を描き、AI-fill で Inner が埋まり、compile → run → live-view が Inner に戻るループが 1 本成立 (§4.3)
2. **G2 通過** (bridge MVP が動く) — EXEC Phase B 完了、`introspect_callable` / `fetch_source` IPC 成立
3. **LAY-1..LAY-4 完了** — L-META 語彙が固定され canonical map が lane-role 上に乗っている
4. **T-1-1 / T-3-1 が review → done** (mermaid parity checklist 署名済)
5. **system_design.md が outdated バッジなしで最新** (架空の未来機能で書いていない、I12/I13 が維持されている)
6. **T-E-1 (Anthropic tools) が end-to-end 1 本走る** — ReAct agent sample が map から起動できる
7. **T-F-1 (observability 最小限)** — trace が NDJSON に残り、crash 後に thread_id 再開できる

**出口後の merge 順** (固定): docs first → model second → viewer third ([merge_strategy.md](merge_strategy.md))。

---

## 11. Pool (現時点の全 OQ 集約)

複数 doc に散らばっている未決を、ここに一度集約して見通す。詳細は各 doc。

| ID | 問い | 担当 doc | 解決 target |
|---|---|---|---|
| OQ-L1 | `lane-role` values の最終固定 | layout | Phase 2-1 (LAY-1) |
| OQ-L2 | lane 並び hard vs soft | layout | Phase 2-2 (LAY-2) |
| OQ-L3 | elkjs vs dagre | layout | Phase 3-2 (LAY-6) |
| OQ-L4 | engine を browser / node どちらで動かすか | layout | Phase 3-2 (LAY-6) |
| OQ-L5 | multi-entry default invoke 挙動 | layout | Phase 3-1 (LAY-5) |
| OQ-L6 | snapshot gate 閾値 tuning (20px / 30%) | layout | Phase 2-4 (LAY-3) |
| OQ-L7 | S-Root 1 固定を docs 正式化 | layout | beta merge 時 |
| Q1 | Python venv 配置 (推奨: PJ04 配下) | langgraph | G1 手前 |
| Q2 | registry 配置 (推奨: PJ04 配下) | langgraph | G1 手前 |
| Q3 | trace 保存形式 (推奨: NDJSON file) | langgraph | Phase C |
| Q4 | interrupt UI token フォーマット | langgraph | Phase D |
| Q5 | `add_messages` を append 拡張か新 kind か (推奨: 新 kind) | state | S-1 合流時 |
| Q6 | channel 名命名規則 (推奨: ascii lower snake + digit) | state | S-1 合流時 |
| Q7 | subgraph state isolation UI | state | Phase 4 |
| Q8 | channel editor type hint (推奨: 列挙 + custom) | state | S-4 |
| — | `system_design.md` / `render_target_definition.md` を draft → canonical 昇格? | 全体 | 実装が先行しているので追認待ち |
| — | `idea/langgraph_full_feature_reproduction.md` を `status: rejected` にするか | 全体 | feasibility 🔴 を受けて次セッションで処理 |

---

## 12. 各セッションの冒頭に読む順序

このドキュメントは長い。セッション開始時は次の順で読む:

1. **[system_design.md §0 Collaboration Stance](system_design.md)** で「今どの stance (authoring / inspection)」を確認
2. **本書 §6 週次ロードマップ** で「今週どこ」を確認
3. **[tasks.yaml](../tasks.yaml)** の `current_focus` ヘッダで「次の task 1 本」を確認
4. **[resume-cheatsheet.md §TL;DR](../resume-cheatsheet.md)** で前セッションの継ぎ目を確認
5. 対応する deep-dive doc (LAY なら layout_strategy、EXEC なら langgraph_integration_plan、VIEW なら concreteness_axis、DATA なら state_and_channels) の該当 §へ

迷ったら次の 4 つに立ち返る:
- **I-G1** (map は authoring 正本)
- **I-G7** (トラック独立性)
- **I-G9** (node = scope 統一)
- **I-G10** (AI-fill は Inner のみ)

この 4 つが PJ の全判断の土台。

---

## 13. 1 文要約

> **map を壊さず LangGraph を描き・動かし・見る**。4 トラック並走、2 ゲート直列、authoring は骨格・詳細は panel・surface はエラーだけ。
