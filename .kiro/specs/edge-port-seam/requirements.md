# Requirements Document

## Project Description (Input)

**edge-port-seam** — parent-child edge の branch-aware port / route seam と edge-port-lab

**(a) 誰の課題か**
M3E Director / Codex worker / akaghef。特に branch edge が GraphLink 端点編集用の nearest-port logic を流用し、Tree left / both / up / down などで「近い方の左右 port」に誤接続する問題を解く。

**(b) 現状**
`beta/src/browser/viewer.ts` には port / route / GraphLink endpoint edit / tree edge helper が同居している。`treeRightEdgeEndsBetween(parent, child)` は right-tree 前提で source right / target left を固定する一方、汎用の `edgePortPairBetweenRects(...)` と `nearestEdgePortSide(...)` は GraphLink 端点や近接選択に寄っている。`docs/tasks/handoff_layout_refactor_pn_integration.md`（2026-06-16）は Port layer を future work として `selectPorts(srcRect, dstRect) -> {srcPort, dstPort}` と記録したが、branch direction と Surface View 正本への接続が未定義だった。

**(c) 変えたいこと**
parent-child edge 用の `EdgePort` seam を typed pure layer として定義する。`selectPorts(srcRect, dstRect, branchDirection)` は Tree right / left / both / up / down と Surface View の direction に応じて正しい source / target side を返す。`route(ports, style)` は canonical edge route style（`orthogonal / line / curve / force-link`）だけを受けて path を返す。GraphLink 端点編集用の `nearestEdgePortSide` は branch edge path から隔離し、dependency-cruiser / jscpd / typecheck / EN5 composition の ratchet で再流用を止める。

## Boundary Context

- **In scope**: `.kiro/specs/edge-port-seam/` の spec 草案、EdgePort pure contract、branch direction ごとの port 選択規則、route contract、parent-child edge / route style / GraphLink の型分離、`nearestEdgePortSide` 隔離設計、`edge-port-lab`、golden sample、EN1-5 / jscpd / composition ratchet 設計。
- **Out of scope**: この spec 作成時点での implementation code、`beta/` source 変更、package/workflow 変更、actual lab 実装、actual golden 採取、PR 作成、LayoutPort algorithm 実装そのもの、GraphLink `LinkPort "auto"` から fixed side への migration。ただし Tree `both` の branch assignment を `LayoutResult` に載せる最小 contract 追加は EdgePort seam の dependency として扱う。
- **Binding sources**:
  - `.kiro/steering/ui_view_taxonomy_and_ports.md`
  - `docs/03_Spec/map_layout_modes.md`
  - `docs/06_Operations/Development_System.md`
  - `.kiro/specs/layout-seam-lab/*`
  - `docs/tasks/handoff_layout_refactor_pn_integration.md`（2026-06-16 Port pure-layer handoff）
- **Exclusive seam rule**: parent-child branch edge は `EdgePort.selectPorts` と `EdgeRoute.route` を唯一経路にする。GraphLink endpoint edit の nearest-port helper を branch edge から呼べる状態は completion と見なさない。
- **Reference composition rule**: lab と product は同一 `EdgePort` / `EdgeRoute` shared module を import する。copy / paste / lab-only fork は禁止する。
- **Layout dependency rule**: Tree `both` の branch assignment は LayoutPort が所有する。EdgePort は `LayoutResult` の explicit `branchSide` を consume し、rectangle position から branch assignment を再導出しない。

## Product and Operations Context

- **Related strategy**: `S3` 検証単位と配備単位の一致、`S4` Surface View / layout round-trip への接続。
- **Active development target**: `beta/`
- **Primary source of truth**:
  - Surface View: `Tree / Axial / Radial / Disperse / System`
  - relation: parent-child `edge`
  - route style: `orthogonal / line / curve / force-link`
  - cross relation: `GraphLink`
- **Current failure mode**:
  - Tree right では right→left 固定で成立する。
  - Tree left / both / up / down では parent-child edge の意図した branch direction が port 選択に入らない。
  - GraphLink endpoint edit 用の nearest side selection を branch edge に使うと、layout intent ではなくクリック点 / 近接 geometry に寄って誤接続する。
- **Existing constraints**:
  - `GraphLink.sourcePort` / `targetPort` は shared `LinkPort = "auto" | "left" | "right" | "top" | "bottom"`。
  - browser 側 `sanitizeLinkPort(...)` は `"auto"` を `undefined` に落として fixed side only にしている。
  - `layout-seam-lab` は `LayoutPort` / lab / golden / EN5 / ratchet の先行 pattern。
  - `Development_System.md` は exclusive-seam と ratchet enforcement を必須にしている。

## Requirements

### Requirement 1: EdgePort typed pure contract

**Objective:** Codex worker と Director として、parent-child edge の port 選択を `viewer.ts` の暗黙 helper ではなく shared typed seam にしたい。これにより branch direction と Surface View intent を port selection に確実に渡せる。

#### Acceptance Criteria

1. implementation phase では `src/shared/edge_port.ts` または同等の shared public contract を定義する設計でなければならない。
2. public contract は `selectPorts(srcRect, dstRect, branchDirection): EdgePorts` を export しなければならない。
3. `selectPorts` は DOM / canvas / global viewState / AppState に依存しない pure function でなければならない。
4. `srcRect` / `dstRect` は `{ x, y, w, h }` 相当の measured rectangle だけを要求しなければならない。
5. returned ports は source / target の `{ x, y, side }` を含み、side は `"left" | "right" | "top" | "bottom"` に限定しなければならない。
6. `selectPorts` は parent-child edge 専用であり、GraphLink endpoint edit のクリック点や handle drag point を入力に取ってはならない。
7. port helper は shared module 内で module-private にし、product / lab / tests は public `selectPorts` だけを呼ぶ設計でなければならない。

### Requirement 2: Branch direction and Surface View coverage

**Objective:** akaghef として、どの Surface View / direction でも parent-child edge が意図した branch side に接続されることを確認したい。これにより Tree right 以外の Surface View で誤接続しない。

#### Acceptance Criteria

1. Tree direction `right` は source `right`、target `left` を選ばなければならない。
2. Tree direction `left` は source `left`、target `right` を選ばなければならない。
3. Tree direction `down` は source `bottom`、target `top` を選ばなければならない。
4. Tree direction `up` は source `top`、target `bottom` を選ばなければならない。
5. Tree direction `both` は LayoutPort output (`LayoutResult`) の explicit `branchSide` に基づき、right branch は source `right` / target `left`、left branch は source `left` / target `right` を選ばなければならない。
6. Axial direction `right / left / up / down` は Tree の同名 direction と同じ primary axis rule を使わなければならない。
7. Radial direction `clockwise / counterclockwise / balanced` は source center から dst center への outward vector で source side を選び、target はその opposite side を選ばなければならない。clockwise / counterclockwise は sibling ordering の入力であり、port side は radial vector から決まる設計でなければならない。
8. Disperse subtype `scatter / cluster / force` は explicit branch direction が無い場合、source center から dst center への vector で side を選ぶ設計でなければならない。route style `force-link` は route contract の責務であり、GraphLink endpoint edit へ fallback してはならない。
9. System direction `right / down` は同名 primary axis rule、`free` は vector rule を使わなければならない。
10. rules は `.kiro/steering/ui_view_taxonomy_and_ports.md` の canonical Surface View 名に従い、legacy `mindmap / logic-chart / timeline / scatter / system` を新しい Surface View 名として増やしてはならない。

### Requirement 3: EdgeRoute typed pure contract

**Objective:** parent-child edge の route path を port selection から分離したい。これにより route style を変えても branch-aware port selection が壊れない。

#### Acceptance Criteria

1. implementation phase では `src/shared/edge_route.ts` または `edge_port.ts` 内 public section に `route(ports, style): EdgePath` を定義する設計でなければならない。
2. `route` は `selectPorts` の returned ports と canonical route style `orthogonal / line / curve / force-link` だけを入力にする pure function でなければならない。
3. `route` は port side を再選択してはならない。
4. `orthogonal` は source / target side に合う axis-first polyline または rounded orthogonal path を返す設計でなければならない。
5. `line` は selected ports 間の直線 path を返す設計でなければならない。
6. `curve` は selected ports の outward normal に基づく bezier path を返す設計でなければならない。
7. `force-link` は Disperse / force layout 用の route style であり、parent-child relation と GraphLink relation を型で混ぜてはならない。
8. `EdgePath` は SVG `d` 文字列だけでなく、テスト可能な endpoints / segments または commands metadata を持つ設計でなければならない。

### Requirement 4: Parent-child edge, route style, and GraphLink type separation

**Objective:** `edge` の両義をコードと spec 上で分離したい。これにより parent-child relation、route style、GraphLink の混同を再発させない。

#### Acceptance Criteria

1. parent-child relation は `ParentChildEdge` または同等の typed input として扱い、`GraphLink` と同じ型に統合してはならない。
2. route style は `EdgeRouteStyle = "orthogonal" | "line" | "curve" | "force-link"` のような value として扱い、relation type と混同してはならない。
3. GraphLink は cross relation として separate adapter を持ち、parent-child branch edge adapter から GraphLink endpoint edit helper を呼んではならない。
4. `GraphLink.sourcePort` / `targetPort` は GraphLink endpoint edit / rendering の concern とし、parent-child edge の branch port selection 入力にしてはならない。
5. `LinkPort "auto"` の意味は GraphLink 側の未固定 endpoint として扱い、parent-child `EdgePortSide` には `"auto"` を持ち込まない設計でなければならない。
6. public type names と docs は `edge` を parent-child relation として使い、route style には `route` / `EdgeRouteStyle` を使わなければならない。

### Requirement 5: `nearestEdgePortSide` quarantine and exclusive seam

**Objective:** GraphLink endpoint edit 専用の nearest-side selection を branch edge から物理的に呼べないようにしたい。これにより同じ誤接続を ratchet で止める。

#### Acceptance Criteria

1. implementation phase では `nearestEdgePortSide` を GraphLink endpoint edit 専用 module へ抽出するか、既存 module 内で branch edge から参照不能な private function にしなければならない。
2. branch edge adapter / renderer / lab / tests は `nearestEdgePortSide` を import または呼び出してはならない。
3. dependency-cruiser は branch edge modules から GraphLink endpoint edit module への import を禁止する設計でなければならない。
4. dependency-cruiser は `src/labs/edge-port/**` から `src/browser/**` implementation file への import を禁止し、shared `edge_port` / `edge_route` contract だけを許可する設計でなければならない。
5. `jscpd` は product / lab 間で port selection logic の copy を検出する gate として設定されなければならない。
6. acceptance は “nearest helper を使っていないように見える” ではなく “branch edge から nearest helper へ依存を追加すると CI が落ちる rule が存在する” でなければならない。

### Requirement 6: Edge-port golden samples

**Objective:** 実 layout から branch direction ごとの port input/output を採取して固定したい。これにより lab と product の同一 contract を検証できる。

#### Acceptance Criteria

1. golden sample は実 product layout output から `srcRect`、`dstRect`、Surface View / direction、`LayoutResult.branchSide`、route style、expected source / target side、expected path summary を採取する設計でなければならない。
2. initial golden set は少なくとも `tree-right`、`tree-left`、`tree-both-left`、`tree-both-right`、`tree-up`、`tree-down`、`axial-right`、`axial-up`、`radial-balanced-quadrants`、`disperse-force-vector`、`system-right`、`system-down` を含まなければならない。
3. golden JSON は deterministic で、node label など personal payload を含めない設計でなければならない。
4. golden update は明示 command でのみ実行し、normal test run が暗黙更新してはならない。
5. port side expectation は exact compare し、path numeric output は deterministic exact または明示 tolerance を使わなければならない。
6. golden は `edge-port-lab` と unit tests の共通 source でなければならない。

### Requirement 7: Edge-port-lab

**Objective:** akaghef として、各 branch direction の port 接続を product 全体なしで目視・機械検査したい。これにより port seam の動作感承認と誤接続検出を独立 surface に移す。

#### Acceptance Criteria

1. `edge-port-lab` は standalone app として起動でき、shared `EdgePort` / `EdgeRoute` contract を import しなければならない。
2. lab source は `src/labs/edge-port/` 配下に置き、product `src/browser/` implementation を import してはならない。
3. lab は golden sample selector、Surface View、direction、route style、branch assignment、rect geometry を確認できなければならない。
4. lab は source / target rectangles、selected port dots、route path、expected side mismatch を可視化しなければならない。
5. lab は機械検査として selected side、endpoint coordinate、path endpoint、rect intersection、obvious wrong-side connection を表示・テストできなければならない。
6. lab green 単独を product green と見なしてはならず、golden parity と EN5 composition test を通して昇格可能にしなければならない。

### Requirement 8: EN1-5 ratchet and composition

**Objective:** EdgePort seam を一度切った後に再結合しないよう、LayoutPort / EN5 pattern と同じ ratchet を持ちたい。

#### Acceptance Criteria

1. `typecheck` は shared port / route / lab / product adapter の同一 contract import を検査する設計でなければならない。
2. `dependency-cruiser` は EdgePort public contract と GraphLink endpoint edit quarantine を検査する設計でなければならない。
3. `jscpd` は lab-only or product-only copied port/route logic を検出する設計でなければならない。
4. pure unit tests は `selectPorts` と `route` の branch direction table を網羅しなければならない。
5. typecheck / unit tests は Tree `both` の `EdgeBranchDirection` が explicit `branchSide` を持つことを検査し、EdgePort 側の fallback 再導出を許してはならない。
6. EN5 composition は `createAppServer()` path または既存 real app server diagnostic を使い、fixture server `14174` を昇格 gate にしてはならない。
7. EN5 は real product path から edge port snapshot を取得し、golden と比較する設計でなければならない。
8. sandbox / native binding / localhost listen の制限で EN5 がローカル実行不能な場合、pure tests は実行可能に保ち、blocked reason を明示する設計でなければならない。

## 確定事項（Decisions）

### (a) `EdgePort` は parent-child branch edge 専用

**決定:** `selectPorts` は parent-child relation の branch-aware pure function とする。GraphLink endpoint edit は別 adapter / helper に隔離する。

**根拠:** binding steering は `nearestEdgePortSide` を GraphLink 端点編集専用とし、branch edge に流用するなと明示している。

### (b) `route` は port side を再選択しない

**決定:** route style は path 形状だけを決める。port side は `selectPorts` の責務であり、`route` が nearest side / scoring を再実行することは禁止する。

**根拠:** Port と Route は 2026-06-16 handoff の layer 分離であり、混ぜると branch direction が route 実装に漏れる。

### (c) enforcement は ratchet

**決定:** EdgePort seam も LayoutPort と同じく、抽出した瞬間に dependency-cruiser / jscpd / typecheck / EN5 で施錠する。現コード全体を big-bang で縛ることはしない。

**根拠:** `Development_System.md` は exclusive-seam と ratchet を M3E の開発体制原理にしている。

## Director Resolved

### B-Q1: Tree `both` branch assignment

**決定:** LayoutPort の出力 (`LayoutResult`) が各 node / edge の `branchSide` (`left` / `right` など) を明示的に持ち、`EdgePort.selectPorts` はそれを consume する。EdgePort 側で branch assignment を再導出しない。現 `LayoutResult` が `branchSide` を持たない場合、EdgePort implementation の前提 dependency として LayoutPort に最小 contract 追加を行う。

**根拠:** placement は layout が所有し、edge は契約で受ける。center fallback は二重真実を作るため禁止する。

### B-Q2: Disperse `force-link` and GraphLink visual distinction

**決定:** 型分離は維持する。`force-link` は parent-child edge の `EdgeRouteStyle` の一つであり、GraphLink relation ではない。GraphLink との視覚区別は style token（色 / 太さなど）で表現し、EdgePort / EdgeRoute の pure contract には持ち込まない。具体の見た目は `edge-port-lab` の動作感承認で akaghef が決める。

**根拠:** seam contract は geometry と route semantics を固定し、知覚上の style は lab approval surface へ分離する。

### B-Q3: `LinkPort "auto"`

**決定:** `EdgePortSide` は `"auto"` を含まない。`auto` は GraphLink concept のまま維持する。GraphLink の `auto` -> fixed side migration は EdgePort seam の Out of Boundary であり、別タスクとする。

**根拠:** parent-child edge port は `selectPorts` 後に常に concrete side を持つ。GraphLink の未固定 endpoint と混ぜない。

## Requirements Traceability Notes

- B-Q1 updates Requirement 2, Requirement 6, and Requirement 8: Tree `both` samples and tests must consume `LayoutResult.branchSide`; EdgePort-side fallback derivation is forbidden.
- B-Q2 updates Requirement 3, Requirement 4, and Requirement 7: `force-link` remains an `EdgeRouteStyle`; visual style token choice is lab approval, not pure contract.
- B-Q3 updates Requirement 4 and Boundary Context: `LinkPort "auto"` remains GraphLink-only and is not part of EdgePort implementation.
