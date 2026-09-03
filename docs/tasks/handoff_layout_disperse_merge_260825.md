# Handoff: layout 語彙統合 / Disperse / WebGL のマージ作業

作成: 2026-08-25
宛先: マージ作業を行う別セッション
状態: **PR #89 / #90 はマージ可能。#87(WebGL) との順序に判断が要る。**

---

## 1. TL;DR

- **#89**（layout 語彙統合 + depth/breadth 軸 + edge port）— 全 unit **66 files / 586 tests green**（実測）。AI レビュー2周で Blocker 全解消。**マージ可**。
- **#90**（WebCola Disperse + lab 統合）— #89 の上に積載。#89 マージ後に着地。
- **#87**（WebGL rendering projection）— 未マージ。**viewer.ts を触るため #89/#90 と衝突しうる**。
- **未着手の設計課題**: `RenderSnapshot` に group 境界を入れる器がなく、このままでは Disperse の `cluster` を WebGL でも SVG でも描けない（§6）。

---

## 2. ブランチ / PR の現状

| PR | branch | HEAD | dev-beta からの commit 数 | 状態 |
|---|---|---|---|---|
| **#89** | `codex/layout-lab-synthetic-100` | `08dc255` | 21 | MERGEABLE / push 済み |
| **#90** | `codex/disperse-seam-lab` | `9bc055b` | 21 + 7 | MERGEABLE / push 済み |
| **#87** | `codex/webgl-rendering-projection-phase1` | `828bbaa` | — | 未マージ |

**#90 は #89 の上に積んでいる**（`codex/disperse-seam-lab` は `codex/layout-lab-synthetic-100` から分岐）。**#89 → #90 の順でマージすること。**

無関係で open のまま放置されているもの: #92, #88, #85, #84, #83, #55。本作業の対象外。

---

## 3. #89 の内容

### 語彙の確定（正本 = [map_layout_modes.md](../03_Spec/map_layout_modes.md) / [Glossary §1.7](../00_Home/Glossary.md) / [Decision_Pool 2026-08-23-001](../06_Operations/Decision_Pool.md)）

- **`direction` は1語**: `left/right` / `left` / `right` / `up/down` / `up` / `down`
- **`both` 廃止** → 水平両側 = `left/right`、垂直両側 = `up/down`
- **`branchDirection` 廃語** → `direction` に統合
- **`density` 廃語** → `space`（tight / normal / loose）。数値 gap はその展開値
- **depth 軸 / breadth 軸** は direction で X/Y のどちらに乗るかが入れ替わる

### 直した不具合

| 症状 | 原因 |
|---|---|
| Tree で間隔設定が効かない | `config.mode === "tree" ? LAYOUT.columnGap : config.columnGap` のハードコード分岐 |
| `up/down` で兄弟 box が重なる | depth=X / breadth=Y 固定で計算し座標だけ回転。box の w/h は回らないため |
| 左枝の edge が右 port から出る | lab が `selectPorts` を通さず bezier 直書き。`edge_port.ts` も up/down 未対応 |
| 単一子なのに edge が breadth 方向にズレる | 親 span が「自分の寸法+24」で下限を持つのに子は先頭詰めで余剰未配分 |
| Mind Map / Logic Chart で向きが効かない | `cardinalDirection()` が undefined を返し横向きのまま。`left` は再反転で右向き |
| 既存 map の設定が失われる | 旧 attribute `m3e:layout-density` / `m3e:branch-direction` を読む経路が消えていた |
| `branchPortSide` 欠如で描画が例外停止 | adapter が必須にしていた（Disperse / Mind Map / Axial / System / Timeline で計4回発生）|

### 設計上の到達点

- **`branchPortSide` 欠如時は center→center vector に落とす**のを全 mode 共通の既定にした。例外を投げない。
- **`LayoutResult` に `groups?` / `edges?` を追加**。Disperse の group 境界と集約 edge が共通契約に載り、lab の `layoutDisperse` 直接 import は 0 件になった（exclusive-seam）。
- **`viewer.ts` は wiring only**。migration は `beta/src/shared/surface_view_migration.ts` へ切り出し済み。

---

## 4. #90 の内容

- **Disperse の layout engine = WebCola**（決定 = [Decision_Pool 2026-08-23-003](../06_Operations/Decision_Pool.md)、設計 = [Disperse_Layout_Design.md](../04_Architecture/Disperse_Layout_Design.md)）。**思想で選定、ベンチマークはしていない**。
- 旧 Disperse（`layout_port.ts` の rank-flow tree seed = 横倒しの Tree）を置換。
- subtype: `scatter`（人の座標をそのまま使う。計算しない）/ `cluster`（tree group を空間的まとまりに）/ `force`（edge 張力と斥力）。
- **tree = group 階層、collapse = 縮約**（[Decision_Pool 2026-08-23-002](../06_Operations/Decision_Pool.md)）。粗視化の操作子は既存 collapse をそのまま使う。
- Disperse の edge は **port を使わず node 中心どうしの線分**（[Disperse_Layout_Design.md §5.1](../04_Architecture/Disperse_Layout_Design.md)）。
- 専用 lab は廃し **layout-lab に統合**（§5.2）。`Collapse subtree` は全 mode 共通コントロール。

### 実測（`synthetic-100-varied-boxes`, 100 node / depth 10 / 幅 37〜800）

| subtype | 重なり | bbox | アスペクト | 充填率 |
|---|---:|---:|---:|---:|
| scatter | 142 | 1876 × 1314 | 1.43 | 0.49 |
| cluster | **0** | 4382 × 2771 | 1.58 | 0.099 |
| force | **0** | 3909 × 2364 | 1.65 | 0.130 |

`scatter` の重なり 142 は**仕様どおり**（計算せず保存座標を使う subtype）。
修正前の Disperse は 2988 × 11580（アスペクト 1:3.9）の縦一列だった。

**残る不満点**: 充填率 約0.1 でスカスカ。group 枠が大きく取られ中に少数の箱が浮く。akaghef 未判断。

---

## 5. 検証の実態（重要）

**Codex の sandbox は `listen 127.0.0.1` を `EPERM` で拒否するため、server を立てるテストと dev server が一度も実行できていない。** Codex の「typecheck green / unit green」報告は常にこの16〜18 suite を除外している。

- **本セッションでは Director（ネットワーク可）が全 unit を実測して green を確認した**: `66 files / 586 tests passed, 12 skipped, 0 failed`。
- この穴で実際に回帰を1件見逃しかけた（`layout_composition_api` の root x 80→152）。Codex は毎回「sandbox 制約、実装失敗ではない」と報告していたが、**実際は本物の回帰だった**。
- **教訓: Codex が「sandbox 制約で未実行」と言ったテストは、必ずネットワークのある環境で回すこと。**

### Playwright

viewer 実経路の全 mode × 全 direction テストと Timeline stem テストが**追加済みだが未実行**（同じ bind 制約）。マージ前に回すことを推奨。

---

## 6. 未解決の設計課題: WebGL と group 境界

**#87 の `RenderSnapshot` が持つプリミティブは node（矩形/円）と edge（折れ線）の2種だけ。**

```typescript
RenderSnapshot = { revision, nodes: RenderNode[], edges: RenderEdge[], graphLinks: RenderEdge[], bounds }
```

Disperse の `cluster` に必要な **group 境界を入れる器がない**。

| 課題 | 内容 |
|---|---|
| **group を入れる器がない** | group 枠は「ラベルなし・node の背後・選択対象でない角丸矩形」。node でも edge でもない。`RenderNode` に混ぜると `hitTestNodes()` が group を node として返し**選択が壊れる** |
| **レイヤ順の概念がない** | `RenderSnapshot` は配列順しか持たず、z 帯の登録機構がない。UI Seam Integration Contract の `RenderRegistry` は未実装 |
| **super-node の縮約情報の置き場がない** | 「何個畳んだか」を入れるフィールドがない。`label` に埋めるしかない |
| **hit-test の意味論が未定義** | super-node クリックで展開するか、group 枠クリックで何が起きるか未定 |

**集約 edge は現契約で通る**: `DisperseEdge.weight` → `RenderEdge.width`。

### 効く事実

**現在の SVG renderer も group 枠を描けない。** lab が `rect.disperse-group` を直接 SVG に書いているだけ。つまり **SVG / WebGL 双方に同じ拡張が要る**ので、`RenderSnapshot` への `groups` 追加は WebGL 固有作業ではなく**両 renderer 共通の契約拡張として1回で済む**。

### 順序のリスク

**#87 も `viewer.ts` を触る。** #89/#90 と衝突しうる。放置すると両方が viewer を編集して解決コストが上がる。

---

## 7. 推奨するマージ順序

1. **#89 をマージ**（土台。語彙・軸・port が確定する）
2. **#90 をマージ**（Disperse。#89 の上）
3. **#87 の状態を確認して着地**（viewer.ts の衝突を解消）
4. その後に `RenderSnapshot` への `groups` 追加 + 描画帯の定義（§6）
5. 続いて製品反映 D1〜D3（§8）

**#87 を先に入れる案もある**（衝突を後回しにしない）。ただし #89/#90 は既に green かつ MERGEABLE で、#87 の検証状態は本セッションで未確認。**判断は #87 の green 状態を見てから。**

---

## 8. この先の予定（未着手）

viewer への Disperse 反映を3段で計画済み。**まだ1行も着手していない。**

| 段 | 内容 | なぜこの順か |
|---|---|---|
| **D1** | viewer の `runScatterSimulation()`（`viewer.ts:6512`）を撤去し `shared/disperse_layout.ts` に一本化 | 競合実装を先に消す。lab と製品が同一経路になる |
| **D2** | `MapSurface` に `subtype` / `space` を追加。kind の legacy `scatter` → `disperse` migration | 既存 map を壊さず新語彙を永続化 |
| **D3** | viewer UI に Disperse 固有コントロール | 人が触れるのは最後 |

**D1 が最重要**: viewer の `runScatterSimulation()` は収束条件なしで frame ごとに無限反復し、半径は実 box でなく node 数と depth から生成、衝突は半径の和を使っていない。**消さずに WebCola を足すと二重実装が残る。**

---

## 9. 環境の落とし穴

- **`webcola` は `--no-save` で primary の `node_modules` に入れてある**（`/Users/nisimoriyuuya/dev/M3E/beta/node_modules/webcola`、`@types/d3-dispatch`、`@types/d3-timer` も同様）。**primary で `npm install` が走ると prune されて消える。** `#90` の `beta/package.json` は `webcola` を宣言済みだが、型2つは未宣言 — **マージ前に devDependencies へ追加すること**（無いと typecheck が TS7016 で落ちる）。
- worktree の `beta/node_modules` は primary への **symlink**。`npm install` を worktree で打つと symlink を壊す可能性がある。
- **vite dev server の稼働中に共有 `node_modules` へ `npm install` すると、開いているページが白飛びする**（依存最適化キャッシュの不整合）。リロードで復帰。
- `scripts/codex.sh` は `~/.local/bin/codex`（0.149.0）を優先するよう修正済み。Homebrew 版（0.139.0）が新モデルを拒否する問題への対処。
- Codex は **worktree での commit に `--add-dir /Users/nisimoriyuuya/dev/M3E/.git` が要る**（worktree の git メタデータが sandbox 外のため）。
- Codex は **DNS 制限で push できない**。push は Director 側で行う。

---

## 10. 参照

- [map_layout_modes.md](../03_Spec/map_layout_modes.md) — Surface View 正本、Disperse の目的 / subtype 定義 / tree との粗視化関係
- [Glossary §1.7](../00_Home/Glossary.md) — depth 軸 / breadth 軸、edge の3義、seam interface / edge port / LinkPort
- [Disperse_Layout_Design.md](../04_Architecture/Disperse_Layout_Design.md) — ライブラリ思想比較と WebCola 採用理由
- [Decision_Pool](../06_Operations/Decision_Pool.md) — 2026-08-23-001（語彙）/ -002（Disperse 目的と粗視化）/ -003（WebCola 採用）
- [UI_Seam_Integration_Contract.md](../03_Spec/UI_Seam_Integration_Contract.md) — `RenderRegistry` を含む shared resource catalog
- [Development_System.md §2.4](../06_Operations/Development_System.md) — 検証直積（components × logic × Surface View）
