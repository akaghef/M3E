# Map Layout Modes 設計ドキュメント

> **Status**: Draft (設計のみ、コード変更なし)
> **Author**: visual agent
> **Date**: 2026-04-09

---

## 1. 背景と目的

現在の M3E viewer は単一のレイアウトアルゴリズム (right-tree) のみ実装している。
`buildLayout()` はルートから右方向にツリーを展開し、depth ごとに列を割り当て、
兄弟ノードを縦に並べるクラシックなマインドマップ配置を行う。

Rapid モードでは「多様なグラフ構造」が目標であり、
ユーザーがレイアウトモードを切り替えられるようにする必要がある。

### 参考ツールの調査結果

| ツール | 主要レイアウト |
|--------|---------------|
| Freeplane | 左右放射 (radial)、アウトライン表示 |
| XMind | Mind Map, Logic Chart, Org Chart, Tree Chart, Fishbone, Brace Map, Timeline, Matrix |
| MindNode | Horizontal, Vertical, Compact (org chart 風) |
| draw.io | Horizontal tree, Vertical tree, Radial tree, Org chart (linear/hanger/fishbone) |
| yEd | Hierarchical, Organic (force-directed), Tree, Radial, Circular, Balloon |

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

## 3. レイアウトモード一覧

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

### 3.7 Force-Directed -- "Network Graph"

```
          NodeC
         / |
   NodeA --+-- NodeD
     \     |     /
      NodeB -- NodeE
```

| 項目 | 値 |
|------|-----|
| 名前 | `force-directed` (Network Graph) |
| 方向 | 全方向（物理シミュレーション） |
| 適用場面 | ネットワーク図、関係性の可視化、GraphLink の多いデータ |
| M3E モード | Rapid (関係性の俯瞰) |
| エッジ | 直線（ノード間の最短パス） |
| 実装難易度 | **高** |
| 技術的影響 | 親子エッジ + GraphLink を同等に扱う物理シミュレーション。ノード間の反発力 + エッジの引力でレイアウト。毎フレーム再計算 or 安定化後に固定。d3-force 等のライブラリ活用を検討。 |

**buildLayout 変更方針**:
- 親子関係と GraphLink を統合した adjacency list を構築
- force simulation: ノード間反発（クーロン力）+ エッジ引力（バネ）+ 中心引力
- 安定化後に NodePosition を確定（アニメーション or 即時）
- ユーザーがノードをドラッグして位置を固定可能（pinning）

**注意**: ツリー構造（parentId）は維持したまま、表示上のみ force-directed にする。データモデルは変更しない。

---

### 3.8 Matrix / Table -- "Grid View"

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
| 技術的影響 | 2次元配置はツリー構造と根本的に異なる。depth=1 を行ヘッダ、depth=2 をセルとして解釈する規約が必要。 |

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
| **P5** | `force-directed` | 高 | Rapid のネットワーク図に不可欠。d3-force 活用 |
| **P6** | `fishbone` | 高 | 完全カスタム。Rapid の分析ユースケースに有用 |
| **P7** | `timeline` | 高 | 時系列メタデータ依存。Rapid に有用 |
| **P8** | `matrix` | 高 | ツリー構造との整合が課題。将来検討 |

---

## 8. アーキテクチャ方針

### 8.1 buildLayout のストラテジーパターン化

```typescript
type LayoutMode = "right-tree" | "down-tree" | "balanced-tree" | "outline"
                | "fishbone" | "timeline" | "matrix";

interface LayoutStrategy {
  buildLayout(state: AppState, tuning: ViewerTuning): LayoutResult;
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

### 8.4 レイアウトモード切替 UI

- ツールバーにレイアウト切替ドロップダウンを追加
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
- 要件が具体化してから詳細設計

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
