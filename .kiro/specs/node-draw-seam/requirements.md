# Requirements Document

## Project Description (Input)

**node-draw-seam** — positioned node を SVG/DOM fragment に描く nodeDraw seam と node-lab

**(a) 誰の課題か**
M3E Director / Codex worker / akaghef。特に `viewer.ts` の `drawNode()` が node 描画、parent-child edge 生成、folder preview、KaTeX、badge/lock/collapsed overlay、再帰 traversal を同時に持ち、layout / EdgePort / Markdown preview と結合している問題を解く。

**(b) 現状**
`beta/src/browser/viewer.ts` は `render()` 内に `drawNode()` を閉じ込め、`LayoutResult.pos` の `LayoutNodePosition` を直接読みながら SVG 文字列を連結している。`NodeStyleAttrs` / `m3e:style`、`uiLabel()` / `diagramLabel()`、`measureNodeLabel()` / `measureLayoutNode()`、KaTeX `foreignObject`、folder / alias / status / confidence / collapsed / scope lock の描画が同居する。さらに `drawNode()` の冒頭で child edge を生成し、folder preview 内では preview edge も生成するため、node-only drawing ではない。

**(c) 変えたいこと**
node 描画を `nodeDraw` として typed seam 化し、layout 済み node を pixels(SVG/DOM fragment) に変換する純粋層にする。layout(位置) と EdgePort(接続) と Markdown/Mermaid preview から分離する。viewer と node-lab は同一 `node_draw_svg.ts` renderer を import し、lab-only 再実装や viewer 内 SVG 直生成を ratchet で禁止する。

## Boundary Context

- **In scope**: `.kiro/specs/node-draw-seam/` の spec 草案、`NodeDrawPort` 契約、style normalize、label split、plain/latex content adapter、`node_draw_svg.ts` shared renderer、`src/labs/node/node-lab.tsx`、fragment golden、node-lab Playwright、EN1-5 / jscpd / dependency-cruiser ratchet 設計。
- **Out of scope**: この spec 作成時点での implementation code、`beta/` source 変更、package/workflow 変更、actual lab 実装、actual golden 採取、PR 作成、Markdown/Mermaid preview、parent-child edge / GraphLink / EdgePort 実装、layout algorithm 変更、RenderGraph 全体 seam、tabular node component seam、folder preview mini graph seam。
- **Binding sources**:
  - `.kiro/steering/ui_view_taxonomy_and_ports.md`
  - `docs/03_Spec/map_layout_modes.md`
  - `docs/06_Operations/Development_System.md`
  - `.kiro/specs/layout-seam-lab/*`
  - `.kiro/specs/edge-port-seam/*`
  - `beta/src/shared/layout_port.ts`
  - `beta/src/browser/viewer.ts`
  - `beta/src/browser/markdown_renderer.ts`
- **Exclusive seam rule**: product node drawing は `NodeDraw.renderNode` / `node_draw_svg.ts` を唯一経路にする。`viewer.ts` が node SVG / KaTeX `foreignObject` / badge fragment を直生成する状態は completion と見なさない。
- **Reference composition rule**: lab と product は同一 `NodeDrawPort` / `node_draw_svg` shared module を import する。copy / paste / lab-only fork は禁止する。
- **Surface View rule**: spec / types は canonical `Tree / Axial / Radial / Disperse / System` を使う。legacy `tree / mindmap / logic-chart / timeline / scatter / system` は migration alias であり、新しい Surface View 名として増やさない。

## Product and Operations Context

- **Related strategy**: `S3` 検証単位と配備単位の一致、CI gate、描画経路の seam 化。
- **Active development target**: `beta/`
- **Primary source of truth**:
  - node structure: `TreeNode` 相当の node data。
  - position: shared `LayoutNodePosition`。
  - surface: canonical Surface View + structured mode/root。
  - view state: transient selected / linkSource / cutPending / drag/drop / collapsed / scope lock。
- **Current failure mode**:
  - `drawNode()` は node-only fragment ではなく child edge と traversal も持つ。
  - KaTeX measure/render が viewer-local DOM / global cache に閉じており、lab と product で同一描画を検証しにくい。
  - Markdown/Mermaid preview は `markdown_renderer.ts` の panel concern だが、node content と混同されやすい。
  - `measureLayoutNode()` の boxSizes は node content/style に依存し、layout 入力境界と nodeDraw 境界の接点になっている。

## Requirements

### Requirement 1: NodeDraw typed pure contract

**Objective:** Codex worker と Director として、位置確定済み node から node-only fragment を生成する typed seam を持ちたい。これにより layout / EdgePort / Markdown preview と node drawing を分離できる。

#### Acceptance Criteria

1. implementation phase では `src/shared/node_draw_port.ts` または同等の shared public contract を定義する設計でなければならない。
2. public contract は `renderNode(input: NodeDrawInput, adapters?: NodeDrawAdapters): NodeDrawOutput` 相当を export しなければならない。
3. `NodeDrawInput` は node data、`position: LayoutNodePosition`、normalized style、view state、surface、content を入力にしなければならない。
4. `NodeDrawOutput` は `{ svg: string, overlays?: string, bounds: NodeDrawBounds }` 相当を返さなければならない。
5. output `svg` は node-only fragment であり、parent-child edge、GraphLink、Markdown/Mermaid preview、canvas-level surface frame を含んではならない。
6. `renderNode` は AppState、global `viewState`、DOM canvas、current scope globals、network、persistence に依存してはならない。
7. helper は shared module 内で module-private にし、product / lab / tests は public contract だけを呼ぶ設計でなければならない。

### Requirement 2: Node input, style normalize, and label/content split

**Objective:** node drawing に必要な product state を viewer adapter で明示化したい。これにより `uiLabel()` / `diagramLabel()` / `NodeStyleAttrs` の暗黙依存を contract に閉じ込められる。

#### Acceptance Criteria

1. node input は `id / type / label / text / alias / folder / scope flags` を持つ設計でなければならない。
2. alias は `read / write / broken` と target label / snapshot label を contract 上で表現しなければならない。
3. folder / scope は `isFolder`, `isScopePortal`, `isRoot`, `isScopeLocked` などの表示に必要な flag として渡す設計でなければならない。
4. style は `NodeStyleAttrs` 互換の normalized structure とし、`fill / text / border / shape / icon / status / confidence / urgency / importance` を第一 ratchet で扱わなければならない。
5. `m3e:style` JSON と legacy `m3e:bg` / `m3e:color` / `m3e:border` 等の normalize は `node_draw_port.ts` 側の public adapter または viewer-local adapterとして明示し、renderer 内に raw attributes parse を散らしてはならない。
6. label split は `uiLabel` 相当と `diagramLabel` 相当を分け、input は `plainLabel` と optional `displayLabel` / `labelLines` を持つ設計でなければならない。
7. content は `plainLabel | latexHtml` の discriminated union とし、Markdown/Mermaid content を nodeDraw に入れてはならない。

### Requirement 3: ViewState is transient and explicit

**Objective:** selection や drag/drop などの transient state を nodeDraw input として明示したい。これにより structure state と ViewState を混同しない。

#### Acceptance Criteria

1. `NodeDrawViewState` は `selected / primarySelected / linkSource / cutPending / dragSource / dropTarget / collapsedCount / lockedBy` を含む設計でなければならない。
2. `NodeDrawViewState` は canonical model state として保存されるものではなく、transient input として扱わなければならない。
3. `collapsedCount` は renderer が子孫数を数えず、viewer adapter が渡した数を描くだけにしなければならない。
4. scope lock は renderer が lock ownership を判定せず、`lockedBy: "self" | "other" | null` 相当を描くだけにしなければならない。
5. multi-select と primary-select は別 flag として表現し、CSS class / fragment snapshot で区別可能にしなければならない。
6. link-source / cut-pending / drag-source / drop-target は node-only state class として出力され、edge / command semantics を実行してはならない。

### Requirement 4: Surface View and node variants coverage

**Objective:** canonical Surface View と主要 node 種別で node appearance を固定したい。これにより legacy view 名や edge layout と混ざらずに node drawing を承認できる。

#### Acceptance Criteria

1. `NodeDrawSurface` は `view: "Tree" | "Axial" | "Radial" | "Disperse" | "System"` と structured mode/root metadata を持つ設計でなければならない。
2. legacy names は viewer adapter で canonical Surface View へ normalize し、nodeDraw contract に legacy Surface View 名を入れてはならない。
3. 第一 ratchet の node 種別は `root / plain / folder / latex / status` を含まなければならない。
4. 第一 ratchet の ViewState sample は `selected / primary / cut / link-source / collapsed / scope-locked` を含まなければならない。
5. 第一 ratchet の style sample は `fill / color / border / urgency / importance / status / confidence` を含まなければならない。
6. node-lab samples は `plain / long wrap / multiline / root / folder / alias(read/write/broken) / selected / multi / cut / link-source / collapsed / scope-locked / fill / color / border / status / confidence / KaTeX` を含む設計でなければならない。
7. Disperse scatter circle など Surface View 固有 shape は `NodeDrawSurface` と `position` から決まり、layout や edge route を呼んではならない。

### Requirement 5: KaTeX belongs to nodeDraw through adapters

**Objective:** KaTeX node の measure/render を nodeDraw seam に含めつつ、DOM/stylesheet 依存を adapter に隔離したい。これにより lab で実 KaTeX stylesheet を読んだ描画を検証できる。

#### Acceptance Criteria

1. `content.kind = "latex"` は nodeDraw の in-scope content でなければならない。
2. `measureLatex` と `renderLatex` は `NodeDrawLatexAdapter` 相当として adapter 化し、renderer は adapter output の `latexHtml` / metrics を使う設計でなければならない。
3. node-lab は KaTeX stylesheet を読み、実 `foreignObject` 描画を Playwright で確認する設計でなければならない。
4. renderer は KaTeX が未ロードの環境でも adapter failure を fallback content として出力できる設計でなければならない。
5. KaTeX `foreignObject` snapshot は sanitized deterministic HTML を比較し、random IDs や environment-specific style dump を golden に含めてはならない。
6. `measureLayoutNode()` は latex metrics を layout `boxSizes` に渡す境界であり、nodeDraw implementation は layout 再計算を実行してはならない。

### Requirement 6: Markdown/Mermaid preview and edges are excluded seams

**Objective:** nodeDraw の責務を node pixels に限定し、Markdown/Mermaid preview と edge を別 seam として残したい。これにより drawNode 内の混入を明示的に分離できる。

#### Acceptance Criteria

1. Markdown preview panel は `markdown_renderer.ts` / preview seam の concern とし、nodeDraw output に Markdown/Mermaid rendered HTML を含めてはならない。
2. Mermaid block rendering は nodeDraw non-goal として記録しなければならない。
3. parent-child edge は EdgePort / EdgeRoute seam の concern とし、nodeDraw renderer から edge path を生成してはならない。
4. GraphLink は nodeDraw non-goal とし、nodeDraw input/output に GraphLink relation を含めてはならない。
5. `drawNode()` 内の child edge 生成は implementation phase で `renderParentChildEdges` / EdgePort adapter 相当へ移す設計でなければならない。
6. folder 内 preview edge / preview mini-node は nodeDraw 第一 ratchet の非目標とし、後続 `surfaceDraw` または `folderPreview` seam として扱わなければならない。
7. `node_draw_svg.ts` は `edgePortPairBetweenRects`, `layoutEdgePath`, `smoothGraphLinkPath`, `markdown_renderer.ts` を import してはならない。

### Requirement 7: Node-lab and golden samples

**Objective:** akaghef として、layout/edge なしで node drawing の動作感だけを承認したい。これにより node の字組、style、badge、KaTeX を outside-in に固定できる。

#### Acceptance Criteria

1. `node-lab` は standalone app として起動でき、shared `NodeDrawPort` / `node_draw_svg` contract を import しなければならない。
2. lab source は `src/labs/node/` 配下に置き、product `src/browser/` implementation を import してはならない。
3. lab は固定 `positionedNode[]` を並べ、layout / EdgePort / product `render()` を呼ばずに node だけを表示しなければならない。
4. lab は sample selector と Surface View selector を持ち、canonical Surface View 名だけを表示しなければならない。
5. node-lab は product の実 `viewer.css`（実装時の product viewer CSS bundle に解決する）と KaTeX stylesheet を読み込み、lab の見た目が product viewer と同じ CSS source に依存する設計でなければならない。
6. golden は pure fragment snapshot と node-lab Playwright screenshot/DOM checks の両方を持つ設計でなければならない。
7. fragment golden は deterministic string compare とし、attribute order / whitespace normalize 方針を設計しなければならない。
8. node-lab Playwright は KaTeX `foreignObject`、collapsed badge、scope lock、alias variants、status/confidence badges を確認する設計でなければならない。
9. node-lab Playwright は product viewer stylesheet と KaTeX stylesheet が実際に読み込まれていることを検査しなければならない。

### Requirement 8: EN1-5 ratchet and composition

**Objective:** nodeDraw seam を一度切った後に再結合しないよう、LayoutPort / EdgePort pattern と同じ ratchet を持ちたい。

#### Acceptance Criteria

1. **EN3**: `typecheck` は shared `node_draw_port.ts`、product adapter、node-lab、tests が同一 contract を import することを検査する設計でなければならない。
2. **EN2**: `jscpd` は node-lab と product 間で SVG generation / style normalize / label split logic の copy を検出する gate として設定されなければならない。
3. **EN2**: node-lab は `node_draw_svg.ts` を import し、renderer を再実装してはならない。
4. **EN4**: viewer の `drawNode()` は `node_draw_svg` 経由化し、node SVG 直生成の再導入を dependency-cruiser ratchet で禁止する設計でなければならない。
5. **EN1**: `src/labs/node/**` から `src/browser/**` implementation file への import を禁止し、shared contract だけを許可する設計でなければならない。
6. **EN5-Lite**: 第一 ratchet の promotion gate は pure fragment golden、node-lab Playwright screenshot、EN4 dependency-cruiser ratchet、EN3 typecheck 共有 port、EN2 jscpd で構成されなければならない。
7. **EN5-Lite**: node-lab Playwright は product の実 `viewer.css`（実装時の product viewer CSS bundle に解決する）と KaTeX stylesheet を読み込むことを必須条件にし、lab が product visual fidelity を偽らない担保にしなければならない。
8. **EN5-Full**: real-server node snapshot route (`createAppServer()` 経由または既存 diagnostic) は broad promotion 前の必須 follow-up とし、第一 ratchet の必須条件にしてはならない。
9. fixture-only green を product green と見なしてはならない。
10. sandbox / native binding / localhost listen の制限で EN5-Full がローカル実行不能な場合でも、EN5-Lite の pure/lab/ratchet checks は実行可能に保ち、blocked reason を明示する設計でなければならない。

## 確定事項（Decisions）

### (a) nodeDraw is positioned node -> pixels

**決定:** nodeDraw は layout 済み node を SVG/DOM fragment に描く純粋層であり、layout placement と edge routing を所有しない。

**根拠:** `Development_System.md` の process tree は `layout(...) -> RenderGraph -> { nodeDraw | edgeDraw | surfaceDraw }` と分ける。nodeDraw は `LayoutNodePosition` を consume する側である。

### (b) KaTeX is in scope, Markdown/Mermaid is out of scope

**決定:** KaTeX node は node の inline visual content なので nodeDraw に含める。ただし `measureLatex` / `renderLatex` は adapter 化する。Markdown/Mermaid preview は preview panel /別 seam であり nodeDraw には入れない。

**根拠:** current `drawNode()` は KaTeX `foreignObject` を node body として描く一方、Markdown/Mermaid は `markdown_renderer.ts` の preview panel で描く。境界が異なる。

### (c) child edge generation must leave `drawNode()`

**決定:** `drawNode()` 内の child edge 生成は nodeDraw extraction の前提分離として扱う。nodeDraw renderer は parent-child edge path を生成しない。

**根拠:** node-only fragment と edge path が同じ関数にあると EdgePort seam と nodeDraw seam が相互に bypass になる。

### (d) NDQ1: tabular component is out of first ratchet

**決定:** tabular node component は第一 ratchet から除外する。後続で別 seam として起票する。

**根拠:** tabular は node body の基本 shape/label/badge ではなく component rendering であり、nodeDraw first ratchet に含めると component seam まで巻き込む。

### (e) NDQ2: folder preview stays viewer-owned

**決定:** folder preview mini graph は第一 ratchet では切らず、viewer-owned helper として温存する。nodeDraw が扱う folder node は frame/label/lock/collapsed/status/confidence までに限定する。folder 内 preview child nodes / preview edges は out of boundary とし、将来 `folderPreview` または `surfaceDraw` seam として別起票する。

**根拠:** preview mini graph は node-only pixels ではなく mini surface / edge rendering を含むため、nodeDraw に入れると EdgePort / surfaceDraw 境界を崩す。

### (f) NDQ3: first ratchet uses EN5-Lite

**決定:** 第一 ratchet は EN5-Lite で確定する。EN5-Lite は pure fragment golden、node-lab Playwright screenshot、EN4 dependency-cruiser ratchet、EN3 typecheck 共有 port、EN2 jscpd で構成する。node-lab は product の実 `viewer.css` と KaTeX stylesheet を読み込むことを必須にする。real-server node snapshot route は EN5-Full として broad promotion 前の必須 follow-up に置き、第一 ratchet の必須条件にはしない。

**根拠:** nodeDraw の純粋契約は fragment golden で固定でき、視覚 fidelity は product CSS と KaTeX stylesheet を読んだ node-lab Playwright で確認できる。real-server snapshot は viewer adapter wiring の確認であり、第一 ratchet に入れると環境依存が先に立つ。

## Requirements Traceability Notes

- Requirement 1-4: nodeDraw contract と第一 ratchet scope。
- Requirement 5: KaTeX adapter と `measureLayoutNode()` 境界。
- Requirement 6: Markdown/Mermaid/edge/folder preview の non-goal。NDQ2 により folder preview mini graph は viewer-owned helper として温存し、後続 seam 化する。
- Requirement 7: node-lab と golden。NDQ3 により product `viewer.css` と KaTeX stylesheet 読込を lab fidelity acceptance に含める。
- Requirement 8: EN2/EN3/EN4/EN5 ratchet。NDQ3 により第一 ratchet は EN5-Lite、real-server snapshot は EN5-Full follow-up とする。
