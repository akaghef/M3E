# PJ04 — Resume Cheatsheet (session handoff)

**最終更新**: 2026-04-22 (system_design.md を L1 Outer / L2 Inner に再構成 + node=scope 統一 + Collaboration Stance 6-step)
**ブランチ**: `prj/04_MermaidSystemLangGraph`
**前セッション**: Claude (edge routing v3 完了)
**今セッション**: Claude (reload 時の system mode 復元 bug fix + tree edge を Bezier に戻す + LangGraph integration plan 確定)
**次の主目的**: **LangGraph 内部取り込み Phase A** (contract freeze + vitest) — 詳細は [docs/langgraph_integration_plan.md](docs/langgraph_integration_plan.md)

---

## 1. 確定事項 (決まった方針 — 動かさない)

### 1.1 思想・語彙
- **scope = subsystem の入口 (portal)**。`[` / `]` で出入り。root node は持たない (rootless)。
- システム内の関係は **Mermaid ふう動詞付き edge** (`approve`, `reject`, `fail`, `pass`, `blocked`, `resolved`, `escalate`, `phase_complete`, `advance`, `reopen`, `done`, `next`)。
- 語彙は **Map model** に統一 (「document」は引っ込めた)。
- **Map model = 永続化される正本**。**tree projection** / **system projection** はその見え方。**window state** (selection / zoom / pan / detail level / view mode) は正本に混ぜない。
- **具象軸** (shape / flow_rank / summary-expanded) を構造軸・遷移軸と分離。

### 1.2 LangGraph 再現方針 — 目的を切り直した
**「LangGraph を M3E で再現する」ではなく「LangGraph を M3E で描く・読む authoring + inspection layer を作る」**。これが最大の意思決定。
- 全機能 TS 再実装は **🔴 現実的ではない** (12-24ヶ月、継続メンテ、GUI 律速 3x) → [langgraph_feasibility.md](docs/langgraph_feasibility.md)
- **subprocess embed + 描画特化** が推奨 (1-2ヶ月で到達可能)
- Pregel super-step / time travel fork / tool schema adapter / LangSmith 互換 = 泥沼 4 点。自前実装しない。

### 1.3 実装境界
- 既存 `workflow_reducer.ts` / `graph_runtime.ts` / `WorkflowState` / 17 `ALLOWED_EDGES` は **一切触らない** (PJ03 契約)。
- `m3e:kernel-*` 名前空間は **execution 意味論のみ**。`m3e:layout` / `m3e:shape` / `m3e:display-role` / `m3e:scope-portal` は **描画専用**で独立。
- 新規データ (`scopes` / `surfaces`) は **optional**。旧 map は **read-time migration** で自動補完 (一括 migration 不要)。
- `graph_spec_types.ts` / `graph_spec_compile.ts` は **pure data + pure function**。runtime / registry / executor に踏み込まない。

### 1.4 運用
- **daily 更新は必須運用から外した** (AGENTS.md / Documentation_Rules.md / Operations README / Todo_Pool.md 変更済)。
- **merge 戦略**: PJ 継続中は beta 本体 docs に直接流さない。PJ 終了後に別セッションで merge。順序は **docs first → model second → viewer third**。詳細は [merge_strategy.md](docs/merge_strategy.md)。

---

## 2. 実装済み (working、未コミット)

### 2.1 描画層 (viewer.ts / viewer.css / viewer.html)
- `surfaceViewMode: "tree" | "system"` と UI toggle ボタン (`viewTreeBtn` / `viewSystemBtn`)
- `currentSurfaceIsFlowMode()` helper
- system surface: rootless flow-lr + portal bracket `[Subsystem]` + diamond shape + 4辺 link アンカー + scope frame/title
- `[` / `]` で scope enter/exit、selection / URL 追従 (`EnterScopeCommand` / `ExitScopeCommand` 経由に一本化)
- `j` / `k` で system surface の詳細度ズーム (`flowSurfaceDetailLevel`, `FLOW_SURFACE_PREVIEW_MAX_DETAIL` 上限)
- tree と system でキーバインド分岐
- `anchorPointBetweenRect()` で edge 端点を上下左右 4 中点から方向に応じて選択
- reference node (`m3e:display-role="reference"`) は主レーン外の flowRow 1 に逃がして重なり回避
- system では linear box を非表示 (`surfaceViewMode === "system"` で `linearPanelEl.hidden`)
- scope 出入り時に `m3e:layout` / `surfaces` から初期 view mode を推論

### 2.2 Map model 足場 (types.ts / viewer.globals.d.ts / viewer.ts)
- `AppState` に `scopes?: Record<string, MapScope>` / `surfaces?: Record<string, MapSurface>` を追加 (optional)
- `MapScope` / `MapSurface` / `SurfaceNodeView` 型定義
- `SurfaceKind = "tree" | "system"` / `SurfaceLayout = "tree" | "flow-lr"`
- `createEmptyDoc()` で root scope / root surface を持たせる
- `ensureDocShape()` で旧 map から `folder` と `m3e:layout` を見て `scopes` / `surfaces` を自動補完 (read-time migration)
- `touchDocument()` / `currentDocSnapshot()` / `setSurfaceViewMode()` で runtime 状態を `state.surfaces` に同期
- `surface.nodeViews` の `flowCol` / `flowRow` / `shape` を実レイアウト・描画に使用、`attrs` は fallback

### 2.3 PJ04 map (map_1776786701079_pan0ih) 正本
- Canonical Flow 用の `surface:n_pj04_flow_root:system` 明示追加
- Explore / Plan / Execute System / Terminal 各 subsystem の system surface を明示追加
- Canonical Flow では Explore → Plan → Execute System → Terminal を flowCol 0..3 に固定
- Source / Notes は主レーン外 flowRow 1 に逃がす
- 再読後 state: **6 scopes / 6 surfaces**

### 2.4 PJ04 独自の neutral 基盤 (このセッションで追加)
- [beta/src/shared/graph_spec_types.ts](../../beta/src/shared/graph_spec_types.ts) — GraphSpec 型 (node / edge / channel / sentinel) + `validateGraphSpec()`
- [beta/src/node/graph_spec_compile.ts](../../beta/src/node/graph_spec_compile.ts) — `compileFromMap(state, scopeId)` pure function、実行ランタイム非依存
- [docs/map_attribute_spec.md](docs/map_attribute_spec.md) — `m3e:kernel-*` 属性 contract
- **両 tsconfig (node + browser) 型チェック通過**

### 2.5 PJ04 docs
- [docs/langgraph_feasibility.md](docs/langgraph_feasibility.md) — 機能別 可能性/障壁/Cost 評価表
- [docs/system_diagram_map_model.md](docs/system_diagram_map_model.md) — Map model 定義 (正本)
- [docs/merge_strategy.md](docs/merge_strategy.md) — PJ 終了後 merge 戦略
- [docs/map_attribute_spec.md](docs/map_attribute_spec.md) — `m3e:kernel-*` 契約
- [idea/langgraph_full_feature_reproduction.md](idea/langgraph_full_feature_reproduction.md) — 再実装プラン (**idea プール、採否未定**)

### 2.6 運用系 docs 変更 (beta 本体)
- `AGENTS.md` — daily 必須を外す
- `docs/06_Operations/Documentation_Rules.md` — daily 運用を optional に
- `docs/06_Operations/README.md` / `Todo_Pool.md` — 同上
- `docs/06_Operations/Actions_Beta.md` / `Keybindings_Beta.md` — `[` / `]` / `j` / `k` / Tree・System toggle を追記

---

## 3. 未コミット状態

すべて uncommitted。`git add + commit` はまだ一度も打っていない。

```
M AGENTS.md
M beta/README.md
M beta/src/browser/viewer.globals.d.ts
M beta/src/browser/viewer.ts
M beta/src/shared/types.ts
M beta/viewer.css
M beta/viewer.html
M docs/06_Operations/Actions_Beta.md
M docs/06_Operations/Documentation_Rules.md
M docs/06_Operations/Keybindings_Beta.md
M docs/06_Operations/README.md
M docs/06_Operations/Todo_Pool.md
M projects/PJ04_MermaidSystemLangGraph/README.md
M projects/PJ04_MermaidSystemLangGraph/plan.md
M projects/PJ04_MermaidSystemLangGraph/tasks.yaml
?? beta/src/node/graph_spec_compile.ts
?? beta/src/shared/graph_spec_types.ts
?? projects/PJ04_MermaidSystemLangGraph/docs/langgraph_feasibility.md
?? projects/PJ04_MermaidSystemLangGraph/docs/map_attribute_spec.md
?? projects/PJ04_MermaidSystemLangGraph/docs/merge_strategy.md
?? projects/PJ04_MermaidSystemLangGraph/docs/render_target_definition.md
?? projects/PJ04_MermaidSystemLangGraph/docs/system_diagram_map_model.md
?? projects/PJ04_MermaidSystemLangGraph/idea/
```

**差分サイズ**: 15 既存ファイル変更、1201 insert / 142 delete。+ 新規ファイル 7 本。

---

## 4. 直近の UI 問題 (次セッションの起点)

### 4.1 「エッジの見た目がカクッとしてない」 → ✅ 解決 (v3 until perfect, 2026-04-22)

**v1/v2 → v3 の流れ**:
- v1: Bezier → orthogonal L/コ字 (tree mode OK)
- v2: system mode で arc-over を TOP 面強制 U-arch 化 → **user reject**（全エッジが TOP に着地、box の 4 点を使ってない）
- v3: 10 iteration 自主確認ループで収束（loops/edge_v3/iter1-10）

**v3 最終実装**（全て [viewer.ts](../../beta/src/browser/viewer.ts) 内）:

| 箇所 | 内容 |
|---|---|
| 2393-2407 | `anchorPointBetween` → **`edgeEndBetween`** にリネーム（anchor 用語衝突解消） |
| 2410-2427 | `anchorPointBetweenRect` → `edgeEndBetweenRects` にリネーム |
| 2430-2458 | `roundedOrthogonalPath` (v2 のまま。L/コ字 + 直線フォールバック) |
| 2460-2539 | **node-avoidance helpers 追加**: `collectEdgeAvoidBoxes` / `chooseClearMidX` / `uArchTopApex` / `uArchBottomApex` / `uArchOrthogonalPath` |
| graph-link ループ (~3600-3720) | flowSurface + isBack/isReverseFlow で分岐。forward は `edgeEndBetween` の 4-midpoint → `roundedOrthogonalPath`。back-edge は box 4 点から TOP/BOTTOM U-arch |
| tree edge (class="edge", ~3700) | v2 から変更なし（L/コ字 維持） |
| flow-preview-edge (~3870) | v2 から変更なし（orthogonal r=6） |

**v3 の核心**:

1. **portal bracket `[[ ]]` の外側から edge を出す**: `isScopePortalNode` 判定で `PORTAL_BRACKET_ARM=14` を edge end に加算。edge が bracket 内から出る違和感を解消。
2. **node を貫通しない U-arch**: avoid box 集合から TOP/BOTTOM apex を計算。horizontal 中段が常に全 box を clear。
3. **side 選択の heuristic**: 他 box が主に下にあれば TOP、上にあれば BOTTOM。PJ04 で reject と reopen を両方 TOP にルーティング（Source/Notes が下にあるため）。
4. **multi-edge stagger**: `topArchCount` / `bottomArchCount` で TOP 面・BOTTOM 面それぞれに走る back-edge を lift 差で staggering、2 本以上の back-edge が同じ Y に重ならない。
5. **scope title reserve**: TOP 面は `titleReserve = 48` で scope frame タイトル（"Canonical Flow"）を上から clear。

**Node convention 明確化**（コード読み時の落とし穴）:
- `pos[id].x` = **LEFT edge** (not center)
- `pos[id].y` = **CENTER Y** (not top)
- `pos[id].w / h` = 全幅・全高
- `collectEdgeAvoidBoxes` はこの convention に合わせて `left = p.x`, `right = p.x + p.w`, `top = p.y - h/2`, `bottom = p.y + h/2` として計算

**検証ループ**:
- `loops/edge_v1/` (baseline + tree v1)
- `loops/edge_v2/` (tree v2 + system v2 rejected)
- `loops/edge_v3/iter1_*` ～ `iter10_*` (iter10 が最終: collisions=0)
- [tools/snapshot.mjs](tools/snapshot.mjs): Playwright chromium headless で screenshot + SVG path JSON + box rect JSON + **collision detection** + console log 出力

**追加修正 (iter11)**:
- system mode で linear-panel (`.linear-panel`) が非表示にならない問題（`hidden` 属性は TRUE なのに CSS `display: flex` で上書き）を修正。
- [viewer.css](../../beta/viewer.css) に `.linear-panel[hidden] { display: none; }` を追加。
- 結果: system mode で note ペインが完全に消え、diagram が全横幅を使える（[Execute System] が full 表示、`done` label も視認可）。tree mode では従来通り表示。

**残課題**:
- Execute System 内 surface の描画 (back edge の見え方) — 本スコープでは edges=0 で未検証
- preview (j/k detail level) での box 幅再計算 — 手つかず

### 4.2 他に懸念があった UI 事項
- Execute System 内の row 配置 (back edge の見え方)
- surface.nodeViews を正規に読む側の強化 (attrs 依存を段階的に外す)
- preview (j/k detail level) での box 幅再計算
- 「データがちょっと昔のになってる」問題 — 最新データを viewer が参照していない疑い (サーバ再起動で直ったかも？要確認)

---

## 5. 次セッションで触っていいもの / 触らないもの

### 触っていい (UI 関連セッションの範囲)
- `beta/src/browser/viewer.ts` — 描画 / キーバインド / surface 切替
- `beta/viewer.css` — スタイル
- `beta/viewer.html` — UI 骨組み
- `beta/src/browser/viewer.globals.d.ts` — type declarations
- `projects/PJ04_MermaidSystemLangGraph/docs/*.md` — 設計メモ更新
- PJ04 map そのもの (local API 経由で `map_1776786701079_pan0ih` を編集)

### 触らない (別セッション or 別 PJ 事項)
- `beta/src/node/workflow_*.ts` / `graph_runtime.ts` / `WorkflowState` (PJ03 契約)
- `beta/src/shared/workflow_types.ts` / `checkpoint_types.ts` (既存 field)
- `beta/src/node/graph_spec_compile.ts` (neutral、UI 非依存)
- `beta/src/shared/graph_spec_types.ts` (neutral、UI 非依存)
- `docs/06_Operations/` (PJ 終了後 merge 対象、小修正なら OK だが大幅改訂は避ける)
- beta 本体 docs への直接反映 ([merge_strategy.md](docs/merge_strategy.md) で禁止)

---

## 6. 立ち上げ手順 (忘備)

```bash
# 初回 clone / worktree 直後
cd beta && npm ci && cd ..

# 通常起動
scripts\beta\launch.bat
# → http://localhost:4173/home.html?ws=ws_REMH1Z5TFA7S93R3HA0XK58JNR

# 型チェックだけ
cd beta && npx tsc -p tsconfig.browser.json --noEmit
cd beta && npx tsc -p tsconfig.node.json --noEmit

# PJ04 map 直接開く URL
http://localhost:4173/viewer.html?ws=ws_REMH1Z5TFA7S93R3HA0XK58JNR&map=map_1776786701079_pan0ih&scope=n_pj04_flow_root
```

---

## 7. 次セッション開始時にやるべきこと (recommended)

1. **この cheatsheet を読む**
2. `git status` で uncommitted を確認 (この dump 時点と変わってないか)
3. 立ち上げて PJ04 map (map_1776786701079_pan0ih) を開く
4. エッジが今どう見えているか目視 → 改善前後で比較できるようスクリーンショット
5. [viewer.ts:3833-3847](../../beta/src/browser/viewer.ts#L3833-L3847) 周辺で Bezier → rounded orthogonal に切替を検討
6. main graph link 側の edge path 生成箇所も同じ方式に揃える (grep で他の `<path` の edge 生成を洗う)
7. 型チェック + ブラウザ目視 → 納得いったら user レビュー → commit 相談

---

## 8. 未決定 / 保留

- **コミット粒度**: 1 本の巨大 commit にするか、(1) daily 運用外し + docs (2) map model 足場 (3) viewer 描画 (4) PJ04 neutral 基盤 + docs (5) PJ04 map edit の 5 本に分けるか — 未決定
- **PJ04 map の sqlite 側書き込み**: local API 経由で書いたが、本当に state が `6 scopes / 6 surfaces` で保存されたか次セッションで再確認
- **orthogonal routing の具体仕様**: rounded corner 半径、label 位置、cross 時の処理 — 実装時に決める
- **Execute System 内部 surface の描画**: Codex セッション終盤で「back edge 見え方」が懸念として残った

---

## 9. 参照 docs (このセッション関連)

**単一入口** (まずここから):
| ファイル | 役割 |
|---|---|
| [docs/system_design.md](docs/system_design.md) | **canonical master** (5-layer stack / I1-I13 / Collaboration Stance 6-step) |
| [docs/global_strategy.md](docs/global_strategy.md) | **大域戦略** (4 トラック × 2 ゲート / 週次ロードマップ / 終了条件) |

**planning / tracking**:
| ファイル | 役割 |
|---|---|
| [plan.md](plan.md) | PJ04 最上位プラン (Phase 0-5 waterfall、上位は global_strategy) |
| [README.md](README.md) | PJ04 入口 (doc 構成 index) |
| [tasks.yaml](tasks.yaml) | T-0〜T-F 定義 + current_focus ヘッダ |

**deep-dive 戦略** (トラック別):
| ファイル | 役割 |
|---|---|
| [docs/langgraph_integration_plan.md](docs/langgraph_integration_plan.md) | EXEC: Phase A-F (subprocess embed) |
| [docs/layout_strategy.md](docs/layout_strategy.md) | LAY: Phase 2 (lane-role / snapshot gate / elkjs Go/No-Go) |
| [docs/state_and_channels.md](docs/state_and_channels.md) | DATA: S-0..S-5 (channel authoring) |
| [docs/concreteness_axis.md](docs/concreteness_axis.md) | VIEW: L0-L5 (具象軸) |
| [docs/multi_root_scope_investigation.md](docs/multi_root_scope_investigation.md) | Root 4 case 評価 (A-D) |

**contracts / seeds**:
| ファイル | 役割 |
|---|---|
| [docs/system_diagram_map_model.md](docs/system_diagram_map_model.md) | Map model 定義 |
| [docs/render_target_definition.md](docs/render_target_definition.md) | 描画契約 (node.kind / render.shape) |
| [docs/map_attribute_spec.md](docs/map_attribute_spec.md) | `m3e:kernel-*` 属性 contract |
| [docs/langgraph_feasibility.md](docs/langgraph_feasibility.md) | 機能別 可能性評価表 (再実装 🔴、embed 🟢) |
| [docs/merge_strategy.md](docs/merge_strategy.md) | PJ 終了後 merge 方針 |
| [docs/canonical_subpj_flow.md](docs/canonical_subpj_flow.md) | canonical flow (authoritative, seed) |
| [docs/mermaid_parity_checklist.md](docs/mermaid_parity_checklist.md) | Mermaid parity requirement (seed) |
| [idea/langgraph_full_feature_reproduction.md](idea/langgraph_full_feature_reproduction.md) | 再実装プラン (**採否未定 idea**) |

---

## TL;DR for 次セッション

> **戦略 re-priority: Phase 2 (layout L-META 構築) が先、Phase 3 (LangGraph contract freeze) は後**。
> 戦略本 [docs/layout_strategy.md](docs/layout_strategy.md) が親。意味 (制約) を正本・座標は cache。main lane は 1本、観察者は別 lane。Case D (multi-lane) は今すぐ開ける、Case C (multi-entry) は Phase 3、Case A (S-Root forest) は閉じたまま、Case B (Sc-Root multi) は保留。
>
> **次セッション initial queue**:
> 1. **T-LAY-1** — `map_attribute_spec.md` に `lane-role` / `anchor` / `edge-kind` 追加 (docs、並列可)
> 2. **T-LAY-3** — `fixtures/canonical_layout.svg` 凍結 + `tools/snapshot.mjs` _diff.json (tool、並列可)
> 3. **T-LAY-2** — viewer に breadth lane band 描画 (T-LAY-1 依存)
> 4. **T-LAY-4** — canonical map に lane-role を当てて multi-lane 正式開放 (T-LAY-2/3 依存)
> (T-LAY-5 / T-LAY-6 は Phase 3 トリガ時に起動)
>
> Phase 3 に pool された項目: T-A-1 (GraphSpec contract freeze), T-LAY-5 (multi-entry), T-LAY-6 (elkjs Go/No-Go)。parallel 先行可: T-CX-0 (L2 map-attr summary、bridge 不要)。
> 制約: `workflow_*` 不可侵、`AppState.rootId` 単数固定 (HR-6)、auto は lane 内に閉じる (HR-4)、座標正本を x/y に置かない (HR-5)。
> Pool に残る OQ (L1〜L7) は [layout_strategy.md §4](docs/layout_strategy.md) を正本とする。

## 10. LangGraph Integration Plan (2026-04-22 追加)

**アーキ確定**:
- 正本 = M3E map (sqlite)
- derived = GraphSpec JSON (毎回再生成、永続化しない)
- runtime = Python LangGraph subprocess (thread / checkpoint / trace 所有)
- viewer = inspection overlay のみ、**map に実行状態を書かない**

**不変式 I1-I5**:
1. compile 決定性 (同 map → 同 spec)
2. 実行不可侵 (map 編集は実行中 thread に影響しない)
3. ref 一方向 (map は文字列、Python が解決)
4. trace 非破壊 (append-only、map に戻さない)
5. checkpoint 分離 (PJ03 CheckpointFile と別 table)

**Phase**:
- A: Contract Freeze (2-3日) ← **次ここ**
- B: Python Bridge MVP (1週)
- C: Streaming + Checkpoint (1週)
- D: Interrupt + Time Travel (1週)
- E: Tool / LLM (Anthropic 1本) (2週)
- F: Observability + Hardening (1週)

**未決 (plan §4)**: Q1 venv 場所 (推奨 PJ04 配下) / Q2 registry 場所 (推奨 PJ04 配下) / Q3 trace 保存形式 (推奨 NDJSON file) / Q4 interrupt UI token (Phase D で決める)

## 11. 具象軸 拡張 (2026-04-22 追加)

[docs/concreteness_axis.md](docs/concreteness_axis.md) 参照。

**L 階層**:
- L0: 箱のみ (既存)
- L1: 1 段 preview (既存)
- L2: + kernel attr 要約 (kind icon / channels badge) ← **bridge 不要**、先行可
- L3: + Python signature (bridge `introspect_callable`)
- L4: + Python 関数 body (bridge `fetch_source`、side panel)
- L5: + live channel values (stream buffer、active node pulse)

**不変式追加**:
- I6 具象軸 volatile (level は window state、map に書かない)
- I7 introspect 無害 (bridge read-only)

**タスク追加**: T-CX-0 (L2、先行可) / T-CX-1 (L3) / T-CX-2 (L4) / T-CX-3 (L5) / T-CX-4 (per-node override)

## 12. Layout + Multi-Root 戦略 (2026-04-22 追加)

セッション議論を受けて `docs/layout_strategy.md` を戦略本として追加。
併せて `docs/multi_root_scope_investigation.md` に layout 節を追補。

**戦略の骨**:
- **制約 (lane-role / anchor / edge-kind) を正本、座標 (flowCol/flowRow/x/y) は cache**
- **Mermaid / dagre / ELK は fork せず elkjs を npm dep で借りる**
- engine は **Phase 3 前後で導入判定** (Go 条件: node 30 超 / lane 4 段 / 手作業疲弊 3 回)
- breadth (縦) に lane を積む = 既存 `lane` 概念の延長
- **監視する神**は既定 = 案 B (frame 肩書き)、指し先あり = 案 A (sky lane)、重い = 案 E (別 surface)

**Case 採否**:
- A (S-Root forest): 閉じたまま
- B (Sc-Root multi): schema 開・運用保留
- C (E-Root multi-entry): **Phase 3 で開ける** (virtual START compile)
- D (multi-lane surface): **Phase 2 で即開ける**

**Hard Rule**:
- HR-1: lane-role=main は surface 内 1 本のみ
- HR-2: user が手で動かした座標は auto で上書きしない (sticky)
- HR-3: engine 導入時は snapshot diff が閾値内
- HR-4: auto layout は lane 内に閉じる
- HR-5: 座標正本を x/y に置かない
- HR-6: AppState.rootId の単数性を破る schema 変更は禁止

**タスク追加** (tasks.yaml):
- T-LAY-1: 属性 (lane-role / anchor / edge-kind) を map_attribute_spec.md に追加
- T-LAY-2: breadth lane band の viewer 描画
- T-LAY-3: canonical SVG snapshot 回帰 gate
- T-LAY-4: Case D (multi-lane surface) 正式開放
- T-LAY-5: Case C (multi-entry) 対応 (Phase 3)
- T-LAY-6: elkjs 導入 Go/No-Go 判定 (Phase 3)

**次セッション initial queue** (Phase 2 実行順):
1. T-LAY-1 (docs) と T-LAY-3 (tool) は **並列可** — 依存なし
2. T-LAY-2 は T-LAY-1 依存 (attr が決まらないと lane band が書けない)
3. T-LAY-4 は T-LAY-2 / T-LAY-3 依存 (lane 描画 + snapshot gate 両方揃ってから)
4. T-LAY-5 / T-LAY-6 は Phase 3 トリガ時 (node 数 30 超 / lane 4 段 / 手作業疲弊 3 回)

**OQ pool** (レビュー後に fix):
- OQ-L1: `lane-role` values の最終固定 → Phase 2-1 で fix
- OQ-L2: lane 並び規約 hard default vs soft → Phase 2-2 で fix
- OQ-L3: elkjs vs dagre → Phase 3-2 で fix
- OQ-L4: engine を browser / node どちらで動かすか → Phase 3-2 で fix
- OQ-L5: multi-entry default invoke 挙動 → Phase 3-1 で fix
- OQ-L6: snapshot gate 閾値 tuning → Phase 2-4 で fix
- OQ-L7: S-Root 1 固定を docs 正式化 → beta merge 時

**参照**:
| ファイル | 役割 |
|---|---|
| [docs/layout_strategy.md](docs/layout_strategy.md) | 戦略本 (親文書) — HR-1〜HR-6 / X1〜X7 / OQ-L1〜L7 の正本 |
| [docs/multi_root_scope_investigation.md](docs/multi_root_scope_investigation.md) | 4 case 評価 (Root の 4 層分離 + data/layout 影響) |

## 13. State / Channel (data 側) 設計 (2026-04-22 追加)

[docs/state_and_channels.md](docs/state_and_channels.md) 参照。

**核の原則**: **authoring は骨格、panel で詳細、box には問題だけ** (authoring minimalism)。
データ側もこれに従う — channels / reducers は右 panel で編集、surface には validation error (赤) / warning (黄) のみ。

**決定事項 (D1-D4)**:
- **D1 データ可視化**: (c) 折衷 — 正=panel、負=surface バッジ (★★★★★)
- **D2 State Schema の置き場**: (a) scope root `m3e:kernel-channels` 維持 + panel 上で structured editor (★★★★☆)
- **D3 node の reads/writes 注釈**: (b) optional — 書いた node だけ validation 対象 (★★★★☆)
- **D4 Checkpoint chain UI**: 具象軸と別軸 = 画面上部 timeline bar (Phase D)

**不変式追加**:
- I8 data authoring minimal (channel 定義は scope 属性、surface には error のみ)
- I9 schema も map (外部 Python file を正本にしない → I1 compile 決定性のため)
- I10 時間軸と具象軸の独立 (concreteness と checkpoint timeline は別コントロール)

**surface 赤バッジ カタログ**:
- node: `unknown channel` / `unresolved ref` / `router missing` / `unreachable`
- scope root: `channel never written` / `channel schema invalid` / `entry missing`
- 黄 (warning): `write only` / `reducer custom, ref empty`

**実装順 (S-0 ... S-5)**: S-1 (spec 抜け穴埋め) は T-A-1 に合流、S-2/S-3 (panel editor + validation バッジ) は bridge 不要で先行可、S-4 以降は Phase B/D に合流。

**未決 (Q5-Q8)**:
- Q5: `add_messages` を append の extension にするか新 kind にするか → 推奨 **新 kind**
- Q6: channel 名命名規則 → 推奨 **ascii lower snake + digit**
- Q7: subgraph state isolation UI → Phase 4 で決める
- Q8: channel editor の type hint → 推奨 **列挙 + custom**
