# Development System（開発体制）

最終更新: 2026-06-25

> M3E の開発を「壊さず・独立に作って・統合する」ための体制を定義する。
> `CLAUDE.md`（root）が拘束契約、`Director_Playbook.md` が how-to、本書は
> **なぜこの体制なのか（診断と原理）と、当面の進め方の決定**を保持する。
> 関連: `Director_Playbook.md` / `AI_Instruction_Routing.md` / `Worktree_Separation_Rules.md` / `../09_Decisions/`

---

## 1. 問題（なぜ現体制が壊れるか）

3ヶ月の開発で蓄積した症状と、その構造的原因（2026-06 診断、Codex read-only）。

- **IS1** 新機能追加でどこかが壊れる（リグレッション）。
- **IS2** UX テストが人間律速。最終確認が akaghef のボトルネック。
- **IS3** AI が修正箇所をピンポイントできず、同じバグを再発させる／同じ修正要求を何度も出す。
- **IS4** 「独立なはず」の機能（例: layout と node/edge 描画）が同時に噴出する。

これらは別々の問題ではなく **1つの根** に収束する：

> **コードに seam（型付き境界）が無いので、(1) 指示が狙う境界が存在せず、(2) バグの原因が局所化されず、(3) 修正を固定する安全なテストが書けない。**

実体（`project-viewer-coupling-root`）:
- import グラフは健全・循環依存ゼロ。結合の根は **1ファイル内**にある。
- `beta/src/browser/viewer.ts` ≈ 16,220 行に controls(buttons/keydown) + canvas 描画 + API client + state 変更 が同居し、共有 `map.state` で結合。server 側も `start_viewer.ts` ≈ 3,745 行で同型。
- controls が core 状態を直叩き（command 層なし）: `addChild` / `addSibling` / `deleteSelected` / `applyMoveByParentAndIndex` / global keydown。
- canvas が `AppState` を adapter なし直読: `buildLayout` / `render`。

検証の空洞（IS2 の機械的原因）:
- Playwright visual は専用 static server（port 14174、4173 流用拒否）の **fixture** に当たり、実 `start_viewer.ts`(sync/collab/vault/persistence) は未検証。
- 「単体は緑なのに複数同時／本番で破綻」＝ **検証単位（孤立機能・fixture）≠ 配備単位（viewer.ts 全体・実 server）**。

## 2. 原理（smart な分割）

### 2.1 自然言語の限界と seam

「マップを描画する」は多義。これは語彙不足ではなく、**自然言語はプロセス木のノードには名前を与えるが、ノード間の辺（contract）には名前を強制しない**ことの帰結。`render(map)` は実際には複数プロセスの木：

```
render(AppState)
  → resolveVisible(scope/facet/alias) ─[AppState]→ VisibleLayoutGraph
  → layout(visibleGraph, boxSizes, mode, options) ─→ LayoutResult   ← 既存 seam・漏れあり
  → deriveRenderGraph ─[LayoutResult]→ RenderGraph{positionedNodes, edgeGeometry}  ← 未実装 seam
  → { nodeDraw(positionedNodes) | edgeDraw(edgeGeometry) | surfaceDraw(scatter/PN/scope/pen) }
```

> **seam とは、プロセス木の1ノードに「名前 + 型付き契約」を与える操作。** 多義性を解くのは良い散文ではなく、各辺を型で書くこと。`AppState → VisibleLayoutGraph → LayoutResult → RenderGraph` と辺に型名を貼った瞬間、「どのノードを触っているか」が一義になる。これは M3E の主張（概念を木に開く）そのもの。

### 2.2 組織原理

> **1 agent ⇄ 1 seam ⇄ 1 contract ⇄ 1 test surface.**

- タスクが well-formed なのは「型付き境界と headless テスト面を持つノード」を名指せる時だけ。そう書けないなら、足りないのは良いプロンプトでなく seam。
- 分割軸は **feature 別でも worktree 別でもなく seam 別**。worktree は並行作業の道具であって結合を止める道具ではない（結合は 1ファイル内の共有 state で起きている）。
- Director（akaghef / Claude）の仕事は **seam マップを保ち、契約を経ずに seam をまたぐタスクを拒否・整形すること**。組織は seam に同型になる。

### 2.3 exclusive-seam ルール（最重要）

> **seam は「唯一の経路」である時だけ守ってくれる。bypass を残した部分 seam は、リファクタ費用と破綻の両方を払って利益ゼロ＝無 seam より厳密に悪い。**

実例（`project-layout-seam-history`）: 2026-06-15 に `buildLayout` を `layout(...)` へ純関数化したが、`renderRoutingScopeSurface` 等が layout helper を直叩きしたまま並存し、06-16 に PN + scatter-surface rendering が破綻、2セッションで rollback。

seam を彫る spec には必ず2点を入れる:
1. **排他化** — 全 caller を seam 経由に強制し、helper 直叩きを禁止（private 化 / lint / module 境界で強制）。
2. **巻き込まれる surface の不変条件を headless テストで固定**（layout なら PN / scatter / scope-routing / edge）。直したバグは seam 上の pure テストにして制度的記憶にする（`npm test` の better-sqlite3 / sandbox listen 制限は pure 関数テストなら回避できる）。

## 3. 進め方の決定（当面）

### 3.1 Obsidian-first（dogfooding 先送り）

**DC（2026-06-25）**: M3E GUI が壊れて作業性が悪いため、**M3E での dogfooding を先送りし、現時点で AI 相性が最良の Obsidian（`docs/` vault）で先に dev体制・アーキ知識・決定ログを構造化する**。M3E が安定してから dogfooding に移す。

理由 = **ブートストラップのパラドックス**: 壊れた GUI を、その GUI を直すための作業基盤に使おうとすると作業性が落ちる。→ ADR_008 として起票予定。

ドキュメント基盤の正本は既存 **`docs/` Obsidian vault**（`project-docs-obsidian-vault`）。新 vault は作らない（二重管理＝破綻の再生産）。追加は既存住所へ:
- dev体制 → `06_Operations/`（本書）
- アーキ知識 → `04_Architecture/`（+ `for-akaghef/m3e_design_philosophy.canvas` に projection）
- 決定 → `09_Decisions/`（ADR）+ `Decision_Pool.md` 索引
- Canvas は正本でなく projection/navigation。実験/大量生成 vault は `docs/obsidian/PJ<YYMMDD>-n/` sandbox（`.kiro/specs/obsidian-experiment-vault`）。

### 3.2 seam を spec の貼り付け先にする

§2.1 のプロセス木の各ノードが「1 agent ⇄ 1 seam ⇄ 1 contract ⇄ 1 test」の単位。タスクは「描画を直して」でなく **「`deriveRenderGraph` ノードを実装、契約 `LayoutResult → RenderGraph`、不変条件を test で固定」** と書く。これにより指示導線・仕様書の曖昧さ（IS3 の上流原因）が消える。プロセス木は `04_Architecture/` に Canvas projection として置き、生きた seam マップにする。

### 3.3 承認ゲートの配置（人間律速 IS2 の圧縮）

人間の動作感承認が要るのは **知覚が不可約な surface（pixels / feel）だけ**。data 変換（状態→状態、木→木）は人間が見ても判定できないので **機械ゲート（golden / 契約 / EN）に任せる**。

- **人間ゲート（動作感）= 視覚 lab のみ**: layout-lab / node-lab / edge-lab / surface-lab。
- **機械ゲート = data seam**: resolveVisible / deriveRenderGraph / command（契約は1度だけ人間レビュー）。
- **統合**: composition で manifest 解決 ＋ EN5 機械テスト ＋ 動作感の最終1回。

小アプリ / seam 一覧:

| # | 小アプリ / seam | 種別 | 入力契約 → 出力 | 承認ゲート |
|---|---|---|---|---|
| 1 | layout-lab（最初） | 視覚 lab | `VisibleLayoutGraph + boxSizes → LayoutResult` | 人（配置・間隔・mode、ノード=矩形） |
| 2 | node-lab | 視覚 lab | `positionedNodes → pixels` | 人（描画・md/katex・字組、配置固定） |
| 3 | edge-lab | 視覚 lab | `edgeGeometry → pixels` | 人（線種・routing、端点固定） |
| 4 | surface-lab | 視覚 lab | `substrate + overlays → pixels` | 人（scatter/PN/scope/pen） |
| 5 | resolveVisible | data module | `AppState + scope/facet/alias → VisibleLayoutGraph` | 機械（golden、契約1度） |
| 6 | deriveRenderGraph | data module | `LayoutResult → RenderGraph` | 機械（golden、契約1度） |
| 7 | command | data module（薄い harness 可） | `AppState + 操作 → AppState′` | 機械（golden + 不変条件、契約1度） |
| 8 | composition | 統合 | manifest 解決 | 機械 EN5 ＋ 人1回（創発的破綻の確認） |

1–4 が真の「小アプリ（視覚 lab）」、5–7 は UI を持たない tested module。これにより人間の役割が「毎回全 UX を手で確認」から「視覚 lab 4つ + 統合1回の承認」に縮む。

### 3.4 独立 GUI 検証ゲート（G-GUI、人間承認の前段）

視覚 lab は、人間が見る前に **第三者 Codex が実際に GUI を駆動して通す** ゲートを必須とする（2026-06-25 akaghef 指示）。これで人間は「独立エージェント検証済みの lab」だけを承認すればよく、IS2 がさらに圧縮される。

- **誰**: 実装した Codex とは別セッションの fresh Codex（self-certification を避け第三者性を担保）。Codex 側の computer-use skill で lab UI を実際に操作。
- **何**: lab 起動 → controls 操作 → golden が想定通り描画されるか / console エラー無し / spec の lab acceptance との一致 を確認 → PASS/FAIL の check レポート（gate artifact）を生成。
- **対象**: 視覚 lab（layout / node / edge / surface）＋ composition のみ。data seam は GUI が無いので対象外（機械 golden 継続）。一般に GUI を触る PR にも適用。
- **強制方法（手続き＋必須 artifact）**: computer-use は表示を要し CI ハード gate にできない。よって:
  - `scripts/ops/gui-gate.sh <lab>` が lab 起動＋独立 Codex 検証を回し、`docs/06_Operations/gates/<lab>-gui-check.md`（PASS/FAIL）を生成。
  - **この artifact が PASS で存在しない限り、Director は人間承認に回さず、PR もマージしない。**
  - checked-in script + 本ルールにより durable（chat 約束で済ませない、persistent-rule gate）。

視覚 lab の確定フロー:

```text
Codex 実装
  → Director が headless gate(EN1-5) を fresh 検証
  → G-GUI ゲート（独立 Codex computer-use、PASS artifact 必須）
  → akaghef 動作感承認
  → PR マージ
```

## 4. 既存ハーネスとの接続

本体制は Director→Codex × Kiro（`Director_Playbook.md`）の上に乗る。seam 化作業の標準フロー:

1. discovery/steering（Claude）で対象 seam を framing。
2. Codex が spec/design/tasks 草案（§2.3 の排他化 + 不変条件テストを acceptance に必須化）。
3. Claude が review/approve。
4. Codex が worktree で impl（TDD、pure 関数は headless）。
5. Claude が review + verify（fresh evidence）。統合は実 `start_viewer.ts` に当てる（fixture 緑を昇格条件にしない）。

## 5. アーキテクチャ強制（documented ≠ enforced）

> ドキュメント化された分割は drift する。意図した分割は **機械的に強制** する＝architecture-as-code。
> 規則と契約の正本は Claude が持ち、実装と「実際に動くか」のテスト実行は Codex が担う。

役割分担（2026-06-25 akaghef 指示）:
- **Claude（上流）**: 大域方針、seam / port / contract 定義、分割規則（architecture-as-code）の起票とレビュー。「意図した分割になっているか」を強制する規則の正本を持つ。
- **Codex**: module / lab / test の実装、テストの実行（unit / composition / e2e）、CI green 化。「実際に動くか」を回す。

強制スタック（各 = 迂回不能な guardrail、CI gate。自作せず実績ある外部ツールに寄せる）:

- **EN1 レイヤ / 境界規則 → `dependency-cruiser`**。`controls → command-port → core` / `view → render-port → core` を許可し、view の core 直 import・controls の `map.state` 直変更・cross-seam bypass を禁止。意図した分割をコード化。**強制の中核。**
- **EN2 単一正本 / no-copy → `jscpd`**（複製検出）＋ cruiser 規則（lab は `src/<seam>/` を import、再実装禁止）。切り貼り drift を検出。
- **EN3 port = 型契約**。各 seam の port を `src/shared/<seam>_port.ts` に型定義。lab と製品が `tsc --noEmit` で同一契約に整合。golden sample が実 M3E 出力との一致を pin。
- **EN4 exclusive-seam**。seam helper を非 export（module-private）、ESLint `no-restricted-imports` で port 迂回を禁止。
- **EN5 composition test（実際に動くか）**。実データ → 全パイプライン → snapshot を fixture(14174) でなく実 `start_viewer.ts` で。Codex が起票・実行、昇格 gate。
- **G-GUI 独立 GUI 検証ゲート**（§3.4）。EN1-5 は CI 決定論 gate だが、視覚 lab は computer-use を要するため CI 化できない。よって第三者 Codex が GUI を駆動する手続き＋必須 PASS artifact で強制（人間承認・PR マージの前段）。EN 系を補完する agent-procedural gate。

これらは durable rule-system（checked-in guard / CI workflow）として着地させる。chat 約束で済ませない（root `CLAUDE.md` の persistent-rule gate）。

### 5.1 効かせ方は ratchet（壁でなく爪車）

dependency-cruiser はモジュール**間**の境界を強制するが、現状の結合は `viewer.ts` の**中**（intra-file）。よって EN1 は「seam をモジュールに切り出した瞬間」まで噛まない。enforcement は一枚の壁を先に建てるのではなく **ratchet**：

> **seam を1本切り出すたびに、その境界を cruiser ルールで施錠し、二度と再結合できなくする。**

これが「部分 seam が裏口で再結合して破綻」（2026-06-16 の layout 破綻）を構造的に封じる。強制ルールは seam と一緒に育つ。big-bang のルールセットは現コードに全面 fail するだけで無意味。

### 5.2 現状 substrate（2026-06-25 棚卸し）

- CI: `.github/workflows/test.yml`（Build & Test）。beta job = `npm ci → npm run build → npm test`(vitest unit)。ESLint / dependency-cruiser / jscpd / Playwright は CI 未実行＝強制ゼロ。
- TypeScript strict あり、専用 `tsc --noEmit` gate なし。
- EN5 の種: Vitest API テストが `createAppServer()` を ephemeral `127.0.0.1:0` で起動＝実 server に当てるパターン既存。composition test の土台。
- port 型置き場は `src/shared/` だが browser tsconfig は `src/browser/**` のみ読む→ tsconfig 調整要。
- 前例: `scripts/ops/check-persistent-rule-gate.sh` + 専用 workflow（checked-in guard を CI gate 化する型）。
- 挿入点: `beta/package.json` に `typecheck` / `lint:deps`(cruiser) / `lint:copy`(jscpd) を足し、`test.yml` beta job の `npm ci` 後に走らせる。EN4(ESLint) は後段の狭い補助。

## 6. 未解決（Decision_Pool 同期）

- **OP1 vs OP2 — 最初に彫る seam**:
  - OP1: 既存 layout seam の排他化に直行（赤の bypass を消す）。望みの edge/node 分離に最短だが、最も entangle した場所で過去2回破綻。
  - OP2（推奨）: command seam（`addChild` 等を pure 化、cost 中・低 entangle）で「排他化 + dependent-surface テスト」の spec テンプレを実証 → それを武器に layout seam 排他化 → RenderGraph。
- ADR_008（Obsidian-first dev体制）起票。
- `docs/` 内 index/MOC の粒度、プロセス木 Canvas projection の作成。
- ゴミ掃除: 空の `無題のファイル.canvas`（root 未追跡 / `docs/` 追跡）。
