# Map Layout Modes 設計ドキュメント

> **Status**: Draft (Surface View 正本更新済み、コード移行は別タスク)
> **Author**: visual agent / Codex
> **Date**: 2026-06-03

---

## 1. 背景と目的

現在の M3E viewer は単一のレイアウトアルゴリズム (right-tree) のみ実装している。
`buildLayout()` はルートから右方向にツリーを展開し、depth ごとに列を割り当て、
兄弟ノードを縦に並べるクラシックなマインドマップ配置を行う。

Rapid モードでは「多様なグラフ構造」が目標であり、
ユーザーが Surface View を切り替えられるようにする必要がある。

### 参考ツールの調査結果

| ツール | 主要レイアウト |
|--------|---------------|
| Freeplane | 左右放射 (radial)、アウトライン表示 |
| XMind | Mind Map, Logic Chart, Org Chart, Tree Chart, Fishbone, Brace Map, Timeline, Matrix |
| MindNode | Horizontal, Vertical, Compact (org chart 風) |
| draw.io | Horizontal tree, Vertical tree, Radial tree, Org chart (linear/hanger/fishbone) |
| yEd | Hierarchical, Organic (force-directed), Tree, Radial, Circular, Balloon |

### 1.1 Surface View 正本 (2026-06-03)

M3E の見た目分類は、外部ツール名や旧実装名をそのまま Surface View にしない。
正本は次の 5 種とし、細かい違いは option / subtype として扱う。

```text
Surface View
├─ Tree
│  ├─ direction: right / left / both / up / down
│  ├─ space: tight / normal / loose
│  └─ edge: orthogonal / line / curve
├─ Axial
│  ├─ subtype: timeline / roadmap / pipeline / sequence
│  ├─ direction: right / left / up / down
│  ├─ space: tight / normal / loose
│  └─ edge: orthogonal / line / curve
├─ Radial
│  ├─ direction: clockwise / counterclockwise / balanced
│  ├─ space: tight / normal / loose
│  └─ edge: line / curve
├─ Disperse
│  ├─ subtype: scatter / cluster / force
│  ├─ space: tight / normal / loose
│  └─ edge: line / curve / force-link
└─ System
   ├─ subtype: containment / module / architecture
   ├─ direction: right / down / free
   ├─ space: tight / normal / loose
   └─ edge: orthogonal / line / curve
```

#### 旧ラベルとの対応

| 旧ラベル / 候補 | Surface View 正本 | 扱い |
|---|---|---|
| Mind Map / `balanced-tree` | Radial | 中心から放射する見た目。左右 balanced は Radial の direction option |
| Tree Chart / Logic Chart / `right-tree` / `down-tree` | Tree | 階層を一方向または両方向に展開する見た目。Logic Chart は Tree の preset |
| Timeline | Axial | timeline は Surface View ではなく Axial の subtype |
| Roadmap / Pipeline / Sequence | Axial | 軸に沿って進行・順序・段階を読む見た目 |
| Scatter / Force-directed | Disperse | 自由配置・クラスタ・力学配置の見た目 |
| System surface | System | containment / module / architecture を扱う見た目 |
| Matrix / Table | node object | Surface View ではなく、表・行列を表すノードオブジェクトとして実装する |

#### 意味上の分離

- **Tree**: 親子階層を読む。主眼は分解・包含・分類。
- **Axial**: 1本の軸に沿って読む。主眼は時間・順序・進行・段階。
- **Radial**: 中心から発散して読む。主眼は中心概念からの展開。
- **Disperse**: 空間的な近さやクラスタで読む。主眼は関係密度・分布・近接。
- **System**: 箱・境界・モジュール・リンクで読む。主眼は構造、責務、接続。

#### pipeline / system graph の参照 UI

2026-06-06 に取り込んだ [Pipeline UI Reference](../04_Architecture/Pipeline_UI_Reference.md)
は、`Axial.subtype=pipeline` と `System.subtype=architecture` の視覚・操作参考として扱う。
新しい Surface View 名は増やさない。M3E へ移植する対象は、左から右へ読む flow、typed card、port、selected-path focus、inspector、minimap、trace replay である。
既定の Rapid tree view を置き換えるものではない。

---

## 2. 現在の実装分析

### 2.1 buildLayout() の構造

```
buildLayout(state) -> LayoutResult { pos, order, totalHeight, totalWidth }
```

1. **visit()**: ルートから DFS で全ノードをメトリクス計測、depth 記録
2. **xByDepth 計算**: depth ごとの X 座標を `leftPad` から累積 (`columnGap` 間隔)
3. **subtreeHeight()**: 各サブツリーの高さをボトムアップ計算
4. **place()**: 各ノードの `(x, y)` を確定、Y はサブツリー中央に配置

### 2.2 render() のレイアウト依存部分

- エッジ描画: `startX = p.x + p.w + edgeStartPad` (右方向前提)
- ベジェ曲線: 水平方向の cubic bezier (`C c1x,c1y c2x,c2y endX,endY`)
- ノード配置: `pos[nodeId]` の `(x, y)` をそのまま SVG 座標に使用
- graph-link 描画: `forward = targetPos.x >= sourcePos.x` で方向判定

### 2.3 viewer.tuning.ts のレイアウト定数

```typescript
layout: {
  rootHeight: 104,    // ルートノードの高さ
  columnGap: 170,     // 親子間の水平距離
  leafHeight: 38,     // リーフノードの高さ
  siblingGap: 1,      // 兄弟間の垂直距離
  leftPad: 80,        // 左マージン
  topPad: 10,         // 上マージン
  // ...
}
```

### 2.4 技術的制約

- `render()` 内のエッジ描画は **右方向展開を前提** としたハードコード
- `NodePosition` は `{ x, y, depth, w, h }` のみ -- 角度や方向情報なし
- `applyZoom()` は `translate + scale` のみで回転なし
- linear panel の位置計算がレイアウト右端に依存
- drag/reparent のヒットテストが X 軸方向を前提にしている

---

## 3. 旧 LayoutMode 候補一覧

この章は実装アルゴリズム候補のカタログであり、Surface View の正本ではない。
ユーザー向け表示名と保存スキーマは 1.1 の `Tree / Axial / Radial / Disperse / System` を優先する。

### 3.1 Right Tree (現行) -- "Classic"

```
                    +-- Child A
                    |     +-- Grandchild A1
      Root ---------+
                    |     +-- Grandchild B1
                    +-- Child B
                          +-- Grandchild B2
```

| 項目 | 値 |
|------|-----|
| 名前 | `right-tree` (Classic) |
| 方向 | 左から右 |
| 適用場面 | 汎用マインドマップ、ブレインストーミング |
| M3E モード | Flash, Rapid, Deep すべて |
| エッジ | 水平 cubic bezier |
| 実装難易度 | -- (実装済み) |
| 技術的影響 | なし |

---

### 3.2 Down Tree -- "Org Chart"

```
              Root
           /   |   \
      Child A  B   Child C
       / \         |
     A1   A2      C1
```

| 項目 | 値 |
|------|-----|
| 名前 | `down-tree` (Org Chart) |
| 方向 | 上から下 |
| 適用場面 | 組織図、分類体系、上下階層 |
| M3E モード | Deep (オントロジー、taxonomy) |
| エッジ | 垂直 cubic bezier または直角折れ線 |
| 実装難易度 | **中** |
| 技術的影響 | `buildLayout` の X/Y 軸を入れ替え。`xByDepth` -> `yByDepth`。render() のエッジ描画を軸変換。drag ヒットテスト修正。 |

**buildLayout 変更方針**:
- depth 軸を Y 方向 (下向き) に、breadth 軸を X 方向に変更
- `columnGap` -> `rowGap` として depth 間の垂直距離に転用
- `siblingGap` を水平方向に適用
- `subtreeWidth()` を新規追加 (現 `subtreeHeight` の軸交換版)

---

### 3.3 Balanced Tree -- "Radial Mind Map"

```
          Child A1
          |
    Child A --- Root --- Child B
          |                |
          Child A2       Child B1
```

```
    Left subtree          Right subtree
     +-- A2               B1 --+
     |                         |
  A -+              Root ---  B
     |                         |
     +-- A1               B2 --+
```

| 項目 | 値 |
|------|-----|
| 名前 | `balanced-tree` (Radial Mind Map) |
| 方向 | 左右両方向 (Freeplane のデフォルトに近い) |
| 適用場面 | ブレインストーミング、中心テーマからの発散 |
| M3E モード | Flash (キャプチャ)、Rapid |
| エッジ | 左右両方向の cubic bezier |
| 実装難易度 | **中** |
| 技術的影響 | ルート直下の子を左右に振り分け (偶数/奇数 or ユーザー指定)。左側は `x` を負方向に展開。render() で左向きエッジの制御点を反転。 |

**buildLayout 変更方針**:
- ルート直下の children を2グループに分割
- 右グループ: 現行ロジックそのまま
- 左グループ: `xByDepth` を `rootX - columnGap * depth` で計算
- エッジの `startX`, `endX` を左右で場合分け (render() 内の graph-link 描画は既に forward/backward 判定あり)

---

### 3.4 Outline -- "Linear Outline"

```
  Root
    Child A
      Grandchild A1
      Grandchild A2
    Child B
      Grandchild B1
```

| 項目 | 値 |
|------|-----|
| 名前 | `outline` (Linear Outline) |
| 方向 | 上から下、インデントで depth 表現 |
| 適用場面 | テキスト中心のドキュメント構造、議事録、仕様書 |
| M3E モード | Deep (体系的知識の整理)、Rapid (タスクリスト) |
| エッジ | なし (インデント線のみ、または縦棒+横棒) |
| ノード見た目 | カード型ではなくテキスト行 |
| 実装難易度 | **中〜高** |
| 技術的影響 | `buildLayout` を完全別実装。固定幅のインデントで Y 方向に連続配置。ノード hit area を行単位に変更。エッジ描画不要 (ガイドライン描画に置換)。 |

**buildLayout 変更方針**:
- 全ノードを DFS 順で上から下に配置
- `x = leftPad + depth * indentWidth`
- `y = topPad + index * lineHeight`
- `subtreeHeight` 計算不要 (全ノードが均一高さ)
- エッジ: 縦の接続線 + 短い水平線 (L 字型) or 単純なインデントのみ

---

### 3.5 Fishbone -- "Cause & Effect"

```
                   cause A1 --\    /-- cause B1
                    cause A2 --+--+-- cause B2
    === effect ================+========
                    cause C1 --+--+-- cause D1
                   cause C2 --/    \-- cause D2
```

| 項目 | 値 |
|------|-----|
| 名前 | `fishbone` (Cause & Effect) |
| 方向 | 左から右の中心軸 + 斜め分岐 |
| 適用場面 | 因果分析、問題解決 (石川ダイアグラム) |
| M3E モード | Rapid (業務の分析フロー) |
| エッジ | 斜め直線 (45度) + 水平バックボーン |
| 実装難易度 | **高** |
| 技術的影響 | 完全カスタムレイアウト。depth=1 の子を上下交互に配置、depth=2+ は斜め方向に展開。専用のエッジ描画ロジック必要。 |

**buildLayout 変更方針**:
- ルートは左端に配置、水平バックボーンを右に伸ばす
- depth=1 (主要因) を上下交互に一定間隔で配置
- depth=2+ (副要因) を主要因から斜め 45 度方向に配置
- エッジ: 主要因→バックボーンは斜線、副要因→主要因も斜線

---

### 3.6 Timeline -- "Horizontal Timeline"

```
      2024-01        2024-02        2024-03
        |               |               |
  ======+===============+===============+======
        |               |               |
    Event A         Event B         Event C
    - detail 1      - detail 1      - detail 1
    - detail 2
```

| 項目 | 値 |
|------|-----|
| 名前 | `timeline` (Horizontal Timeline) |
| 方向 | 左から右の時間軸 |
| 適用場面 | プロジェクト計画、歴史年表、ロードマップ |
| M3E モード | Rapid (業務の進捗管理) |
| エッジ | 垂直接続線 + 水平タイムライン |
| 実装難易度 | **高** |
| 技術的影響 | 時系列メタデータ (日付属性) をソートキーに使用。depth=1 を時間軸上に等間隔配置、depth=2+ を上下に展開。 |

---

### 3.7 Matrix / Table -- "Grid View" (node object)

```
  +----------+----------+----------+
  |          | Column A | Column B |
  +----------+----------+----------+
  | Row 1    | Cell 1A  | Cell 1B  |
  +----------+----------+----------+
  | Row 2    | Cell 2A  | Cell 2B  |
  +----------+----------+----------+
```

| 項目 | 値 |
|------|-----|
| 名前 | `matrix` (Grid View) |
| 方向 | 行列グリッド |
| 適用場面 | 比較表、SWOT 分析、意思決定マトリクス |
| M3E モード | Rapid (構造化比較) |
| エッジ | グリッド線のみ |
| 実装難易度 | **高** |
| 技術的影響 | 2次元配置は Surface View ではなく node object として扱う。表ノード内部で行・列・セルを管理し、外側の Surface View からは 1 ノードとして配置する。 |

---

## 4. エッジスタイル一覧

現行はベジェ曲線のみ。レイアウトモードに応じて以下を使い分ける。

| エッジスタイル | 描画 | 適用レイアウト |
|---------------|------|---------------|
| `bezier` (現行) | `M sx sy C c1x c1y, c2x c2y, ex ey` | right-tree, balanced-tree |
| `straight` | `M sx sy L ex ey` | fishbone, simple diagrams |
| `orthogonal` | `M sx sy H mx V ey H ex` (直角折れ) | down-tree, org chart |
| `step` | `M sx sy H midX V ey H ex` (階段状) | outline |
| `none` | 描画なし (インデントのみ) | outline (オプション) |

---

## 5. ノード表示スタイル一覧

| スタイル | 概要 | 適用レイアウト |
|---------|------|---------------|
| `bubble` (現行) | 角丸矩形 + テキスト | right-tree, balanced-tree |
| `card` | 影付きカード、メタ情報表示領域あり | down-tree, outline |
| `text-only` | 枠なし、テキストのみ | outline |
| `pill` | 高さの低いカプセル型 | timeline |
| `folder` | フォルダアイコン付き枠 (既に実装あり: `folder-box`) | すべて |

---

## 6. M3E モード別の推奨レイアウト

| レイアウト | Flash | Rapid | Deep |
|-----------|-------|-------|------|
| `right-tree` (Classic) | **Primary** | OK | OK |
| `balanced-tree` (Radial) | Good | OK | -- |
| `down-tree` (Org Chart) | -- | Good | **Primary** |
| `outline` (Linear) | -- | Good | **Primary** |
| `fishbone` (Cause & Effect) | -- | Good | -- |
| `timeline` | -- | **Primary** | -- |
| `matrix` | -- | Good | -- |

凡例: **Primary** = そのモードのデフォルト候補、Good = 相性良、OK = 使用可、-- = 非推奨

---

## 7. 実装優先度

| 優先度 | レイアウト | 難易度 | 理由 |
|--------|-----------|--------|------|
| **P1** | `right-tree` | -- | 実装済み |
| **P2** | `down-tree` | 中 | buildLayout の軸交換で実現可能。Deep モードに必須 |
| **P3** | `balanced-tree` | 中 | 左右分割ロジック追加。Flash モード改善 |
| **P4** | `outline` | 中〜高 | 別 buildLayout 実装だが描画は単純。Deep/Rapid に有用 |
| **P5** | `fishbone` | 高 | 完全カスタム。Rapid の分析ユースケースに有用 |
| **P6** | `timeline` | 高 | 時系列メタデータ依存。Rapid に有用 |
| **P7** | `matrix` | 高 | ツリー構造との整合が課題。将来検討 |

---

## 8. アーキテクチャ方針

### 8.1 buildLayout のストラテジーパターン化

```typescript
type SurfaceViewKind = "tree" | "axial" | "radial" | "disperse" | "system";

type SurfaceViewEdge = "orthogonal" | "line" | "curve" | "force-link";
type SurfaceViewSpace = "tight" | "normal" | "loose";
type SurfaceViewDirection =
  | "right" | "left" | "both" | "up" | "down" | "free"
  | "clockwise" | "counterclockwise" | "balanced";

interface SurfaceViewConfig {
  kind: SurfaceViewKind;
  subtype?: string;
  direction?: SurfaceViewDirection;
  space?: SurfaceViewSpace;
  edge?: SurfaceViewEdge;
}

interface LayoutStrategy {
  buildLayout(state: AppState, tuning: ViewerTuning, view: SurfaceViewConfig): LayoutResult;
}

// 現在の buildLayout() を RightTreeLayout クラスに抽出
// 新レイアウトは同じインターフェースで追加
```

### 8.2 NodePosition の拡張

```typescript
interface NodePosition {
  x: number;
  y: number;
  depth: number;
  w: number;
  h: number;
  // 追加候補:
  direction?: "right" | "left" | "down" | "up";  // balanced-tree で必要
  angle?: number;  // 将来の radial レイアウト用
}
```

### 8.3 render() のリファクタリング

現在の render() 内のエッジ描画ロジックを、LayoutStrategy に対応するエッジ描画関数に分離する。

```typescript
interface EdgeRenderer {
  renderEdge(parent: NodePosition, child: NodePosition, depth: number): string;
  renderGraphLink(source: NodePosition, target: NodePosition, link: GraphLink): string;
}
```

### 8.4 Surface View 切替 UI

- ツールバーに Surface View 切替ドロップダウンを追加
- ドキュメント単位で保存 (doc メタデータ)
- scope (部分ツリー) 単位での切替は将来検討

### 8.5 VIEWER_TUNING の拡張

```typescript
layout: {
  // 共通定数 (現行)
  rootHeight: 104,
  leafHeight: 38,
  siblingGap: 1,
  leftPad: 80,
  topPad: 10,
  // ...

  // レイアウト別定数
  rightTree: { columnGap: 170 },
  downTree:  { rowGap: 120 },
  balanced:  { columnGap: 170 },
  outline:   { indentWidth: 40, lineHeight: 32 },
  fishbone:  { boneAngle: 45, boneSpacing: 140 },
}
```

---

## 9. 段階的実装ロードマップ

### Phase 1: ストラテジーパターン導入
1. `buildLayout()` を `RightTreeLayout` クラスに抽出
2. `LayoutStrategy` インターフェース定義
3. `render()` のエッジ描画をストラテジーから分離
4. 既存テストが通ることを確認

### Phase 2: Down Tree (P2)
1. `DownTreeLayout` 実装
2. 直角折れ線エッジ描画
3. drag/reparent のヒットテスト修正
4. Playwright スナップショット追加

### Phase 3: Balanced Tree (P3)
1. 子ノードの左右振り分けロジック
2. 左方向エッジ描画
3. linear panel の位置計算修正

### Phase 4: Outline (P4)
1. テキスト行ベースの配置
2. インデントガイドライン描画
3. ノードスタイルの切替 (bubble -> text-only)

### Phase 5+: Fishbone, Timeline, Matrix
- Fishbone は Tree または Axial の特殊 preset として再評価する
- Timeline は Axial subtype として具体化する
- Matrix は Surface View ではなく node object として具体化する

---

## 11. ドキュメント/スコープへの Surface View 保存設計

### 11.1 SurfaceView 型定義

`beta/src/shared/types.ts` に追加:

```typescript
export type SurfaceViewKind = "tree" | "axial" | "radial" | "disperse" | "system";

export interface SurfaceViewConfig {
  kind: SurfaceViewKind;
  subtype?: string;
  direction?: string;
  space?: "tight" | "normal" | "loose";
  edge?: "orthogonal" | "line" | "curve" | "force-link";
}
```

移行期間中、既存実装の `mindmap` / `logic-chart` / `timeline` / `scatter` などの値は
UI・保存時に `SurfaceViewConfig` へ正規化する。

| legacy value | normalized SurfaceViewConfig |
|---|---|
| `tree`, `right-tree`, `down-tree`, `logic-chart` | `{ kind: "tree" }` |
| `mindmap`, `balanced-tree` | `{ kind: "radial" }` |
| `timeline` | `{ kind: "axial", subtype: "timeline" }` |
| `scatter`, `force-directed` | `{ kind: "disperse" }` |
| `system` | `{ kind: "system" }` |
| `matrix` | 非 Surface View。node object へ移行 |

### 11.2 ドキュメント単位の保存: AppState への追加

現在の `AppState`:

```typescript
export interface AppState {
  rootId: string;
  nodes: Record<string, TreeNode>;
  links?: Record<string, GraphLink>;
  linearNotesByScope?: Record<string, string>;
  linearTextFontScale?: number;
  linearPanelWidth?: number;
}
```

追加案:

```typescript
export interface AppState {
  rootId: string;
  nodes: Record<string, TreeNode>;
  links?: Record<string, GraphLink>;
  linearNotesByScope?: Record<string, string>;
  linearTextFontScale?: number;
  linearPanelWidth?: number;

  // --- 新規追加 ---
  /** ドキュメント全体のデフォルト Surface View。省略時は { kind: "tree", direction: "right" } */
  surfaceView?: SurfaceViewConfig;
  /** スコープ (folder) 単位の Surface View 上書き。キーは scopeRootId */
  surfaceViewByScope?: Record<string, SurfaceViewConfig>;
}
```

**設計判断**:
- `surfaceView` は optional。省略 (undefined) 時は `{ kind: "tree", direction: "right" }` にフォールバック。これにより既存ドキュメントとの後方互換性を保つ
- `linearNotesByScope` と同じパターン (`Record<string, T>` keyed by scopeRootId) を採用してスコープ単位の上書きを実現
- legacy `layoutMode` / `layoutModeByScope` は読み取り互換として残し、保存時には `surfaceView` / `surfaceViewByScope` へ寄せる

### 11.3 スコープ単位の保存: surfaceViewByScope

#### 解決方式の比較

| 方式 | 説明 | 利点 | 欠点 |
|------|------|------|------|
| **A. AppState.surfaceViewByScope** | `Record<string, SurfaceViewConfig>` を AppState に追加 | linearNotesByScope と同一パターン。シリアライズが自然。node の型を汚さない | スコープ ID が変わるとゴミエントリが残る |
| B. TreeNode.surfaceView | folder ノードの属性に surfaceView を追加 | ノードと1:1対応で分かりやすい | TreeNode の型が太る。非 folder ノードに設定された場合の扱い |
| C. TreeNode.attributes | 既存の `attributes: Record<string, string>` に `"surfaceView"` キーで保存 | 型変更不要 | 文字列なのでバリデーション必要。属性の名前空間衝突リスク |

**推奨: 方式 A (AppState.surfaceViewByScope)**

理由:
1. `linearNotesByScope` という先行実装パターンがあり、viewer.ts 内のスコープ関連ロジックと整合する
2. TreeNode は shared/types.ts で定義されており、ブラウザ専用のビュー設定を混入させるべきでない
3. スコープ外のノードにレイアウト設定が誤適用されるリスクがない
4. ゴミエントリの問題は、スコープ削除時にクリーンアップするユーティリティで対応可能 (linearNotesByScope も同じ問題を持つが、実用上問題になっていない)

#### Surface View 解決の優先順序

```
resolveSurfaceView(scopeRootId):
  1. surfaceViewByScope[scopeRootId]  -- スコープ固有の設定
  2. AppState.surfaceView             -- ドキュメントデフォルト
  3. legacy layoutModeByScope/layoutMode を正規化
  4. { kind: "tree", direction: "right" } -- ハードコードフォールバック
```

```typescript
// viewer.ts に追加するヘルパー
function resolveSurfaceView(scopeRootId: string): SurfaceViewConfig {
  const state = doc!.state;
  return state.surfaceViewByScope?.[scopeRootId]
      ?? state.surfaceView
      ?? normalizeLegacyLayoutMode(state.layoutModeByScope?.[scopeRootId] ?? state.layoutMode)
      ?? { kind: "tree", direction: "right" };
}
```

### 11.4 buildLayout() への統合

```typescript
function buildLayout(state: AppState): LayoutResult {
  const scopeRootId = currentScopeRootId();
  const view = resolveSurfaceView(scopeRootId);
  const strategy = layoutStrategies[view.kind]; // Record<SurfaceViewKind, LayoutStrategy>
  return strategy.buildLayout(state, VIEWER_TUNING, view);
}
```

### 11.5 ViewState への影響

ViewState はメモリ上のトランジェントな状態であり、Surface View は保持しない。
Surface View は常に `doc.state` から解決する。

ただし、スコープ切替時のカメラ位置リセットについて:
- Surface View kind が変わる遷移 (例: Tree スコープ -> Radial スコープ) ではカメラを初期位置にリセットするのが望ましい
- `viewState.zoom`, `viewState.cameraX`, `viewState.cameraY` を初期値に戻す

```typescript
// スコープ遷移時に呼ぶ
function onScopeChange(prevScopeId: string, nextScopeId: string): void {
  const prevView = resolveSurfaceView(prevScopeId);
  const nextView = resolveSurfaceView(nextScopeId);
  if (prevView.kind !== nextView.kind) {
    viewState.zoom = 1;
    viewState.cameraX = VIEWER_TUNING.pan.initialCameraX;
    viewState.cameraY = VIEWER_TUNING.pan.initialCameraY;
  }
}
```

### 11.6 SavedDoc / シリアライズへの影響

`SavedDoc` は `{ version: 1, savedAt: string, state: AppState }` であり、AppState の変更がそのままシリアライズに反映される。追加フィールドはすべて optional なので、version は 1 のまま据え置きできる。

古い viewer で新しい JSON を読み込んだ場合: `surfaceView` / `surfaceViewByScope` は無視されるだけで、right-tree で表示される。完全な後方互換。
新しい viewer は legacy `layoutMode` / `layoutModeByScope` も読み取り、正規化して表示できる必要がある。

### 11.7 UI: Surface View 切替

ツールバーに追加するコントロール:

```
[Flash | Rapid | Deep]  [View: ▼ Tree / Right ]  [+] [-] [Fit] ...
                            ├ Tree
                            │   ├ direction: right / left / both / up / down
                            │   ├ space: tight / normal / loose
                            │   └ edge: orthogonal / line / curve
                            ├ Axial
                            │   └ subtype: timeline / roadmap / pipeline / sequence
                            ├ Radial
                            ├ Disperse
                            └ System
```

- ドキュメント全体のデフォルト変更: Ctrl+Shift+L (仮)
- 現在のスコープのみ変更: ドロップダウンから選択
- 「スコープ設定をクリア (ドキュメントデフォルトに戻す)」オプションも表示

---

## 12. テスト方針

この章の `right-tree` / `balanced-tree` / `timeline` / `matrix` などの値は、
旧 LayoutMode 設計時点のテスト名である。
Surface View 移行後は `SurfaceViewConfig` ベースのテスト名へ置換する。

### 12.1 テスト対象の全体像

```
                       +-------------------+
                       | Unit Tests        |  vitest / node:test
                       | (buildLayout)     |  高速, 各ストラテジー
                       +-------------------+
                                |
                       +-------------------+
                       | Visual Regression |  Playwright + スナップショット
                       | (pixel diff)      |  8 レイアウト x N データ
                       +-------------------+
                                |
                       +-------------------+
                       | Interaction Tests |  Playwright
                       | (切替/drag/zoom)  |  E2E シナリオ
                       +-------------------+
                                |
                       +-------------------+
                       | Performance Tests |  Playwright + measureTime
                       | (大量ノード)       |  100/500/1000 ノード
                       +-------------------+
```

### 12.2 ユニットテスト: LayoutStrategy ごとの buildLayout()

#### テストフレームワーク

既存の `beta/tests/unit/rapid_mvp.test.js` は `node:test` + `node:assert` を使用。
新テストも同じパターンに従う。

#### テストファイル

```
beta/tests/unit/layout_strategies.test.js
```

#### サンプルデータ: テスト用ツリー構造

```typescript
// 3階層、12ノードの標準テストツリー
function createTestTree(): AppState {
  // Root
  //   ├── A
  //   │   ├── A1
  //   │   ├── A2
  //   │   └── A3
  //   ├── B
  //   │   ├── B1
  //   │   └── B2
  //   └── C
  //       ├── C1
  //       ├── C2
  //       └── C3
}

// 4階層、20ノードのディープテストツリー
function createDeepTestTree(): AppState { ... }

// 単一ノード (ルートのみ)
function createSingleNodeTree(): AppState { ... }

// 非対称ツリー (左に深い、右は浅い)
function createAsymmetricTree(): AppState { ... }
```

#### 各ストラテジー共通の検証項目

```javascript
// 1. 全ノードが配置されていること
test(`${mode}: all nodes have positions`, () => {
  const state = createTestTree();
  const layout = strategies[mode].buildLayout(state, TUNING);
  const nodeIds = Object.keys(state.nodes);
  for (const id of nodeIds) {
    assert.ok(layout.pos[id], `node ${id} should have a position`);
  }
});

// 2. ノード同士が重ならないこと
test(`${mode}: no node overlap`, () => {
  const state = createTestTree();
  const layout = strategies[mode].buildLayout(state, TUNING);
  const positions = Object.values(layout.pos);
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i];
      const b = positions[j];
      const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
      const overlapY = a.y - a.h/2 < b.y + b.h/2 && a.y + a.h/2 > b.y - b.h/2;
      assert.ok(!(overlapX && overlapY),
        `nodes at (${a.x},${a.y}) and (${b.x},${b.y}) should not overlap`);
    }
  }
});

// 3. 全ノードが正の座標であること (画面外に飛び出さない)
test(`${mode}: all nodes in positive coordinate space`, () => {
  const state = createTestTree();
  const layout = strategies[mode].buildLayout(state, TUNING);
  for (const [id, pos] of Object.entries(layout.pos)) {
    assert.ok(pos.x >= 0, `node ${id} x should be >= 0`);
    assert.ok(pos.y >= 0, `node ${id} y should be >= 0`);
  }
});

// 4. totalWidth / totalHeight が全ノードを包含すること
test(`${mode}: canvas bounds contain all nodes`, () => {
  const state = createTestTree();
  const layout = strategies[mode].buildLayout(state, TUNING);
  for (const pos of Object.values(layout.pos)) {
    assert.ok(pos.x + pos.w <= layout.totalWidth,
      `node at x=${pos.x} w=${pos.w} exceeds totalWidth=${layout.totalWidth}`);
  }
});

// 5. order 配列が全ノードを含むこと
test(`${mode}: order contains all nodes`, () => {
  const state = createTestTree();
  const layout = strategies[mode].buildLayout(state, TUNING);
  assert.equal(layout.order.length, Object.keys(state.nodes).length);
});
```

#### レイアウト固有の検証

| レイアウト | 固有検証 |
|-----------|---------|
| `right-tree` | 子の X > 親の X。兄弟は同じ X。 |
| `down-tree` | 子の Y > 親の Y。兄弟は同じ Y。 |
| `balanced-tree` | ルート直下の子が左右に分かれている。左子の X < root.X。右子の X > root.X。 |
| `outline` | 全ノードの X = leftPad + depth * indentWidth。Y が DFS 順で単調増加。 |
| `fishbone` | depth=1 ノードが上下交互に配置。バックボーン (ルートの Y) が一定。 |
| `timeline` | depth=1 ノードの X が単調増加 (左→右の時間軸)。 |
| `force-directed` | ノード重なりなし (共通テストでカバー)。エッジ長がゼロでない。 |
| `matrix` | depth=1 ノードが同じ X に縦並び (行ヘッダ)。depth=2 ノードがグリッド状に配置。 |

### 12.3 ビジュアルリグレッションテスト (Playwright スナップショット)

#### テストファイル

```
beta/tests/visual/layout_modes.visual.spec.js
```

#### テストデータ設計

各レイアウトモード用の固定 JSON ドキュメントを用意する。
テストデータは `beta/tests/fixtures/` に配置。

```
beta/tests/fixtures/
  layout_test_standard.json     -- 3階層12ノード (全レイアウト共通)
  layout_test_deep.json         -- 4階層20ノード (down-tree, outline 向け)
  layout_test_wide.json         -- 1階層10子ノード (balanced-tree, fishbone 向け)
  layout_test_timeline.json     -- 日付属性付きノード (timeline 向け)
  layout_test_matrix.json       -- 行列構造ノード (matrix 向け)
```

**テストデータの要件**:
- ノード ID は固定 (UUID ではなく `"node-a"`, `"node-b"` 等の決定論的 ID)
- テキスト内容は英語 (フォントレンダリングの環境差を最小化)
- 折り畳み状態なし (全展開)

#### スナップショットテストの構造

```javascript
const layouts = [
  "right-tree", "down-tree", "balanced-tree", "outline",
  "fishbone", "timeline", "force-directed", "matrix"
];

for (const mode of layouts) {
  test(`layout snapshot: ${mode} with standard data`, async ({ page }) => {
    await loadJsonDocWithLayout(page, standardDoc, mode);
    await page.click("#fit-all");
    await page.waitForTimeout(300);

    // SVG 領域のみスナップショット (ツールバーを除外して環境差を減らす)
    const board = page.locator(".board");
    await expect(board).toHaveScreenshot(`layout-${mode}-standard.png`, {
      maxDiffPixelRatio: 0.01,  // 1% まで許容
    });
  });
}
```

#### スナップショット更新フロー

```bash
# 基準スクリーンショット生成
npx playwright test beta/tests/visual/layout_modes.visual.spec.js --update-snapshots

# 差分確認
npx playwright test beta/tests/visual/layout_modes.visual.spec.js
```

スナップショットファイルは `beta/tests/visual/layout_modes.visual.spec.js-snapshots/` に格納。
CI では `--update-snapshots` を使わず、差分があれば fail にする。

### 12.4 インタラクションテスト (Playwright E2E)

#### テストファイル

```
beta/tests/visual/layout_interaction.visual.spec.js
```

#### テストシナリオ

```javascript
// 1. レイアウト切替後にノード選択が維持される
test("selection preserved after layout switch", async ({ page }) => {
  await loadJsonDocWithLayout(page, standardDoc, "right-tree");
  // ノード A を選択
  await page.click('rect[data-node-id="node-a"]');
  // レイアウトを down-tree に切替
  await switchLayout(page, "down-tree");
  // ノード A がまだ selected クラスを持つ
  const nodeA = page.locator('rect[data-node-id="node-a"]');
  await expect(nodeA).toHaveClass(/selected/);
});

// 2. zoom/pan 状態: レイアウトモードが変わるとカメラリセット
test("camera resets on layout mode change", async ({ page }) => {
  await loadJsonDocWithLayout(page, standardDoc, "right-tree");
  // ズームイン
  await page.click("#zoom-in");
  await page.click("#zoom-in");
  // レイアウト切替
  await switchLayout(page, "outline");
  // fit-all 相当の状態になっている (カメラリセットを確認)
  // -- 具体的には SVG の transform を検証
});

// 3. drag & drop がレイアウト方向に応じて動作する
test("drag reparent works in down-tree layout", async ({ page }) => {
  await loadJsonDocWithLayout(page, standardDoc, "down-tree");
  // ノード A1 を ノード B にドラッグ
  await dragNodeLabel(page, "A1", "B");
  // A1 の親が B に変わったことを検証
  // (メタ表示 or DOM 構造で確認)
});

// 4. スコープ切替時にレイアウトモードが変わる
test("scope-specific layout mode applies on scope enter", async ({ page }) => {
  // ドキュメントデフォルト: right-tree
  // folder ノード X のスコープ: outline
  await loadJsonDocWithScopeLayout(page, scopeDoc, {
    default: "right-tree",
    scopes: { "folder-x": "outline" }
  });
  // folder-x にスコープイン
  await page.dblclick('rect[data-node-id="folder-x"]');
  await page.waitForTimeout(300);
  // outline レイアウトが適用されていることを視覚的に確認
  // (ノードの X 座標がインデントパターンに従う)
});
```

### 12.5 パフォーマンステスト

#### テストファイル

```
beta/tests/visual/layout_performance.visual.spec.js
```

#### テストデータ生成

```javascript
function generateTree(nodeCount) {
  // 幅優先でバランスのとれたツリーを生成
  // branching factor = 4 で、nodeCount に達するまで子を追加
  // 100ノード -> 深さ3, 500ノード -> 深さ4, 1000ノード -> 深さ5
}
```

#### 測定方法

```javascript
const sizes = [100, 500, 1000];
const layouts = ["right-tree", "down-tree", "balanced-tree", "outline",
                 "fishbone", "timeline", "force-directed", "matrix"];

for (const size of sizes) {
  for (const mode of layouts) {
    test(`perf: ${mode} with ${size} nodes`, async ({ page }) => {
      const doc = generateTree(size);
      await loadJsonDocWithLayout(page, doc, mode);

      // buildLayout + render の合計時間を測定
      const timing = await page.evaluate(() => {
        const start = performance.now();
        // scheduleRender() を同期的に呼ぶ or render() を直接呼ぶ
        (window as any).__forceRender();
        return performance.now() - start;
      });

      console.log(`${mode} / ${size} nodes: ${timing.toFixed(1)}ms`);

      // しきい値: 100ノード < 50ms, 500ノード < 200ms, 1000ノード < 500ms
      const threshold = size <= 100 ? 50 : size <= 500 ? 200 : 500;
      assert.ok(timing < threshold,
        `${mode} with ${size} nodes took ${timing}ms, threshold is ${threshold}ms`);
    });
  }
}
```

#### パフォーマンス目標

| ノード数 | buildLayout + render 合計 | 備考 |
|----------|--------------------------|------|
| 100 | < 50ms | 16ms (60fps) が理想 |
| 500 | < 200ms | インタラクティブ操作に支障なし |
| 1000 | < 500ms | 初回描画は許容、ドラッグ中は要注意 |

**注意**: `force-directed` は反復計算のため、他のレイアウトより遅い可能性が高い。
force-directed のみ別のしきい値 (2-3倍) を許容するか、
初期配置のみ buildLayout で計算し、アニメーションは requestAnimationFrame で段階的に収束させる設計とする。

### 12.6 テスト実行コマンド

```bash
# ユニットテストのみ
cd beta && npx vitest run tests/unit/layout_strategies.test.js

# ビジュアルリグレッション
cd beta && npx playwright test tests/visual/layout_modes.visual.spec.js

# インタラクション
cd beta && npx playwright test tests/visual/layout_interaction.visual.spec.js

# パフォーマンス
cd beta && npx playwright test tests/visual/layout_performance.visual.spec.js

# 全テスト
cd beta && npx vitest run && npx playwright test
```

### 12.7 CI 統合方針

- ユニットテスト: 全 PR で必須実行
- ビジュアルリグレッション: `beta/src/browser/` 変更時のみ実行 (スナップショットは Linux CI 環境で生成し、OS 差によるフォントレンダリング差を排除)
- パフォーマンステスト: 週次 or `layout` ラベル付き PR で実行 (CI の負荷を抑制)

---

## 10. 調査ソース

- [Freeplane Documentation - Formatting maps and nodes](https://docs.freeplane.org/user-documentation/formatting-maps-and-nodes.html)
- [Freeplane Documentation - Styles](https://docs.freeplane.org/user-documentation/styles.html)
- [XMind - How to Combine Different Structures](https://xmind.com/blog/how-to-combine-different-structures-in-xmind-and-why)
- [XMind - Matrix and Fishbone Diagram](https://xmind.com/blog/matrix-fishbone)
- [yEd - Layout Algorithms](https://yed.yworks.com/support/manual/layout.html)
- [draw.io - Apply layouts](https://www.drawio.com/doc/faq/apply-layouts)
- [draw.io - Automatic Layout](https://drawio-app.com/blog/automatic-layout-in-draw-io/)
- [MindNode - Styling mind maps](https://www.mindnode.com/user-guide/styles/styling-mind-maps)
