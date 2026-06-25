# Requirements Document

## Project Description (Input)

**layout-seam-lab** — layout seam の outside-in lab と ratchet enforcement

**(a) 誰の課題か**
M3E Director / Codex worker / akaghef。特に `viewer.ts` に埋もれた layout 変更が PN / scatter / routing scope など周辺 surface を壊し、人間の目視確認まで検出できない問題を解く。

**(b) 現状**
`beta/src/browser/viewer.ts` 内に `VisibleLayoutGraph`、`layout(...)`、`buildLayout(...)`、`buildRightTreeLayout(...)` などが同居している。`window.m3eLayout` と別 worktree の `beta/src/shared/layout_bridge.ts` は layout 共有の足場だが、現在の `dev-beta` には source の `layout_bridge.ts` がなく、既存 product path はまだ `viewer.ts` 内 helper に依存している。`renderRoutingScopeSurface` は `buildRightTreeLayout` / `buildMeasuredTreeContext` を直叩きしており、exclusive seam になっていない。

**(c) 変えたいこと**
layout を `LayoutPort` として typed seam 化し、lab と product が同一 module を参照する。akaghef が lab で配置の動作感を目視承認でき、かつ同じ port が product path と `createAppServer()` composition test で green になることを保証する。enforcement は big-bang ではなく、seam を切るたびに dependency-cruiser / jscpd / typecheck / composition test で戻れなくする ratchet とする。

## Boundary Context

- **In scope**: `.kiro/specs/layout-seam-lab/` の spec 草案、first unit としての enforcement harness、LayoutPort、`src/labs/layout/` layout-lab、tree / mindmap / routing-scope golden sample 採取、`createAppServer()` composition test、layout 境界 ratchet 設計。
- **Out of scope**: この spec 作成時点での implementation code、`beta/` source 変更、package/workflow 変更、actual lab 実装、actual golden 採取、PR 作成。
- **First-unit exclusions**: `layout_bridge.ts` の作成、scatter/system golden、node-lab / edge-lab 実装、mutation API 追加は第一ユニットの対象外。
- **Exclusive seam rule**: layout seam は唯一の経路でなければならない。`renderRoutingScopeSurface` のような helper 直叩き bypass を残した partial seam は completion と見なさない。
- **Reference composition rule**: lab と product は同一 `LayoutPort` module を import する。copy / paste / lab-only fork は禁止する。

## Product and Operations Context

- **Related strategy**: `S3` 保存・同期・復元の信頼性、CI gate、検証単位と配備単位の一致。
- **Active development target**: `beta/`
- **Primary source of truth**: product layout contract は shared source module。lab / golden / product はその参照者。
- **Existing constraints**:
  - `beta/src/browser/viewer.ts` に current layout implementation がある。
  - `beta/src/browser/workbench-ui.tsx` は既存 workbench と `window.m3eLayout` transitional alias を使う progressive navigation を持つ。
  - `beta/tsconfig.browser.json` は `rootDir: "src/browser"` / `include: ["src/browser/**/*.ts"]` で `src/shared` を読まない。
  - current CI beta job は `npm ci -> npm run build -> npm test`。
  - existing Vitest API tests use `createAppServer()` with ephemeral `127.0.0.1:0` and temp data dirs.
  - sandbox / native binding friction: `better-sqlite3` と listen permission は environment に依存するため、pure layout tests と composition tests を分ける。

## Requirements

### Requirement 1: Enforcement harness baseline

**Objective:** Codex worker と Director として、layout seam を切る前に ratchet 可能な CI baseline を持ちたい。これにより、後続の seam 境界を機械的に施錠できる。

#### Acceptance Criteria

1. `beta/package.json` に `typecheck`、`lint:deps`、`lint:copy` scripts を追加する設計でなければならない。
2. `typecheck` は `tsc --noEmit` 系の check とし、browser / workbench / shared port を含む tsconfig 構成を設計しなければならない。
3. `lint:deps` は `dependency-cruiser` を devDependency として使う設計でなければならない。
4. `lint:copy` は `jscpd` を devDependency として使う設計でなければならない。
5. `.github/workflows/test.yml` の beta job は `npm ci` 後、build/test の前に harness scripts を実行する設計でなければならない。
6. 初期導入時は current code を全面 fail させる big-bang ではなく、baseline + layout seam rule を段階導入できる設計でなければならない。
7. harness は custom scanner を主実装として自作してはならない。ただし tool config と narrow wrapper は許可する。

### Requirement 2: LayoutPort contract

**Objective:** lab と product の唯一の layout 契約として `layout(VisibleLayoutGraph, boxSizes, mode, options): LayoutResult` を shared source に確定したい。これにより、配置 logic を `viewer.ts` の暗黙 helper ではなく typed seam として扱える。

#### Acceptance Criteria

1. `LayoutPort` は `src/shared` 配下の typed module として定義されなければならない。
2. contract は `layout(visibleGraph: VisibleLayoutGraph, boxSizes: Record<string, LayoutNodeMetric>, mode: LayoutMode, options?: LayoutOptions): LayoutResult` を export しなければならない。
3. `VisibleLayoutGraph`、`LayoutNodeMetric`、`LayoutMode`、`LayoutOptions`、`LayoutResult` は product と lab が同一型を import できる形で export されなければならない。
4. layout helper (`buildRightTreeLayout`, `buildMeasuredTreeContext`, branch splitter, bounds finalizer など) は module-private とし、public export してはならない。
5. `layout_port.ts` は唯一の canonical contract でなければならず、第一ユニットで `layout_bridge.ts` を別 contract として作成または復活させてはならない。
6. browser tsconfig が `src/browser` のみ読む現制約を解消し、browser build が `src/shared/layout_port.ts` を型検査・bundle できる設計でなければならない。
7. `window.m3eLayout` は `LayoutPort.layout` を呼ぶだけの transitional alias でなければならず、layout logic を持ってはならない。

### Requirement 3: Product path uses the exclusive LayoutPort

**Objective:** M3E product として、viewer の visible graph 生成後の配置は必ず `LayoutPort.layout` 経由にしたい。これにより、`renderRoutingScopeSurface` の helper bypass を閉じ、layout seam を唯一経路にする。

#### Acceptance Criteria

1. `buildLayout(state)` は AppState / viewState から `VisibleLayoutGraph` と `boxSizes` を作る adapter に縮小され、実配置は `LayoutPort.layout` を呼ばなければならない。
2. `renderRoutingScopeSurface` は `buildRightTreeLayout` / `buildMeasuredTreeContext` を直叩きしてはならず、routing graph と dummy/app metric を `LayoutPort.layout` へ渡さなければならない。
3. PN / scatter / system / tree / mindmap / logic-chart / timeline の既存 surface behavior は `LayoutPort` 上の mode/options で表現されなければならない。
4. layout 内部 helper を `viewer.ts` や workbench から import できる経路を残してはならない。
5. product path と lab path が別実装を持つ場合、その state は requirement violation として扱わなければならない。

### Requirement 4: Layout lab app

**Objective:** akaghef として、product 描画全体を起動せずに layout の動作感だけを目視承認したい。これにより、配置 seam の UX 調整を outside-in に進められる。

#### Acceptance Criteria

1. layout-lab は standalone app として起動でき、`LayoutPort` module を import しなければならない。
2. lab は node drawing の product logic を持たず、dummy rectangle と label だけで `LayoutResult` を可視化しなければならない。
3. lab は golden sample を選択し、mode、direction、depthAlign、density、branchDirection、spacing を切り替えられなければならない。
4. lab は selected sample の input graph、boxSizes、options、output summary を確認できなければならない。
5. lab が green でも product green と見なしてはならず、golden parity と composition test を通して初めて昇格可能でなければならない。
6. lab source は `src/labs/layout/` 配下に置き、product `src/browser/` から分離されなければならない。
7. lab は専用 tsconfig（例: `tsconfig.labs.json`）と Vite entry を持ち、将来の node-lab / edge-lab と同じ labs home に拡張できる設計でなければならない。
8. lab は product browser implementation (`src/browser/viewer.ts` など) を import してはならず、shared port と fixture/schema だけを参照しなければならない。

### Requirement 5: Golden sample capture and parity

**Objective:** 実 M3E から layout input/output を採取して固定したい。これにより、lab の配置確認が product と同じ契約上の確認であることを保証できる。

#### Acceptance Criteria

1. golden sample は実 product state から `VisibleLayoutGraph`、`boxSizes`、`mode`、`options`、`LayoutResult` を採取する仕組みを持たなければならない。
2. 第一ユニットの initial golden set は `tree`、`mindmap`、`routing-scope` の 3 つに限定しなければならない。
3. sample fixture は deterministic JSON とし、node order と numeric layout output を比較可能にしなければならない。
4. numeric comparison は exact snapshot と tolerance comparison の使い分けを設計しなければならない。
5. golden update は明示 command でのみ実行でき、通常 test run が fixture を暗黙更新してはならない。
6. sample は product data の secret / personal payload を含めず、必要なら label を sanitize しなければならない。
7. scatter/system golden は後続 ratchet とし、第一ユニットの completion 条件に含めてはならない。

### Requirement 6: EN5 composition test on real app server

**Objective:** Codex worker と Director として、fixture server 緑ではなく実 `createAppServer()` path で layout composition を検証したい。これにより、lab green が product path に接続されていることを確認できる。

#### Acceptance Criteria

1. composition test は `createAppServer()` を import し、ephemeral `127.0.0.1:0` で起動する既存 Vitest pattern を使わなければならない。
2. composition test は port `14174` static fixture server を昇格 gate として使ってはならない。
3. test は temp `M3E_DATA_DIR` / `M3E_DB_FILE` を使い、real user data を変更してはならない。
4. test は実データ投入または API 経由で map state を作り、既存 viewer diagnostic で layout snapshot を取得できる場合はそれを優先しなければならない。
5. `better-sqlite3` native binding や sandbox listen 制限で実行不能な環境では、pure layout tests は実行可能に保ち、composition test の skip / failure reason を明示できなければならない。
6. CI では composition test を beta job の normal gate に入れる設計でなければならない。
7. 既存 viewer diagnostic で layout output を返せない場合のみ、`createAppServer()` 経由の narrow read-only test/debug route を追加できる。mutation API を開けてはならない。

### Requirement 7: Dependency-cruiser ratchet for layout boundary

**Objective:** Director と Codex worker として、layout seam の bypass を CI で落としたい。これにより、一度切った seam が再結合しない。

#### Acceptance Criteria

1. dependency-cruiser config は `src/shared/layout_port.ts` を public contract として扱い、layout 内部 module への import を禁止する設計でなければならない。
2. product browser code、workbench、`src/labs/**` は `LayoutPort` public entrypoint のみ import できる設計でなければならない。
3. `renderRoutingScopeSurface` 等の helper 直叩き再発は dependency-cruiser または module-private export absence により CI failure にならなければならない。
4. `jscpd` は lab / product 間の layout logic copy を検出する gate として設定されなければならない。
5. ratchet rule は first unit で layout seam に狭く適用し、後続 seam へ拡張できる形で記録されなければならない。
6. acceptance は “bypass が見つからない” ではなく “bypass を追加すると CI が落ちる rule が存在する” でなければならない。
7. `src/labs/**` から `src/browser/viewer.ts` への import は禁止されなければならない。
8. `src/labs/**` から `src/browser/**` への import は原則禁止され、許可される product-facing dependency は `src/shared/*_port` など shared contract に限定されなければならない。

## 確定事項（Decisions）

### (a) 最初の seam は layout

**決定:** first unit は enforcement harness + layout seam の最初の ratchet とする。

**根拠:** `Development_System.md` は layout を既存 seam・漏れありと診断し、`renderRoutingScopeSurface` の helper 直叩きを partial seam failure の具体例としている。最初の成功条件は実装量ではなく、port + exclusive seam + tests + CI ratchet の型を作ること。

### (b) lab green 単独を昇格条件にしない

**決定:** lab green / 目視承認は必要条件だが十分条件ではない。昇格には golden parity と `createAppServer()` composition test を必須にする。

**根拠:** Development System の問題設定は「fixture / isolated surface green と配備単位 green が違う」こと。lab は outside-in UX 面であり、product 同一 module 参照と real server composition test が product green を担保する。

### (c) enforcement は ratchet

**決定:** dependency-cruiser rule は現コード全体を一度に縛らず、layout seam を切った瞬間にその境界を施錠する。

**根拠:** 現状の結合は `viewer.ts` intra-file にあり、module graph tool は seam 抽出前には効かない。big-bang enforcement は全面 fail か空振りになる。

### (d) Director resolved decisions

**DC-Q1:** `layout_port.ts` を唯一の canonical contract とする。第一ユニットでは `layout_bridge.ts` を作らない。`window.m3eLayout` は `LayoutPort.layout` を呼ぶ transitional alias に限定する。

**DC-Q2:** layout-lab は `src/labs/layout/` に置く。専用 tsconfig と Vite entry を持たせ、labs を product browser から分離する。

**DC-Q3:** initial golden set は `tree`、`mindmap`、`routing-scope` の 3 つに限定する。scatter/system は後続 ratchet。

**DC-Q4:** EN5 snapshot は既存 viewer diagnostic を優先し、無い場合のみ `createAppServer()` 経由の narrow read-only test/debug route を追加する。mutation API は開けない。
