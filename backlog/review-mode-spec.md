# Review Mode — 実装指示書

reviews/Qn のバッチレビューをマップ上で高速に行う簡易編集モード。

## 目的

判断負債（reviews/Qn）がレビュー律速で溜まる問題を解消する。
マップ上で accept/reject をキーボード1打で操作し、チャットに戻らず完結させる。

---

## UX フロー

```
1. ユーザーが reviews/ ノードを選択し、Review Mode に入る（キー: R）
2. 子ノード（Q1, Q2, ...）をナビゲーション（↑↓ or j/k）
3. Q ノードを選択すると、子の選択肢が展開表示される
4. 選択肢ノードにカーソルを合わせて:
   - a = accept（この選択肢を採用）
   - x = reject（この Q 自体を却下 — tentative default を破棄して再検討要）
   - s = skip（後回し）
5. accept 時: 選択肢に selected=yes、親 Q に status=decided を自動設定
6. 次の open Q に自動移動
7. 全 Q 処理完了 or Escape で Review Mode 終了
```

---

## 実装仕様

### ViewState 拡張

```typescript
interface ViewState {
  // 既存フィールドに追加
  reviewMode: boolean;  // Review Mode ON/OFF
}
```

### キーバインド（Review Mode 内）

| キー | 動作 | 実装 |
|------|------|------|
| `R` | Review Mode トグル（通常モード時）| `viewState.reviewMode = !viewState.reviewMode` |
| `a` | accept — 選択中の選択肢ノードを採用 | 下記 acceptOption() |
| `x` | reject — 選択中の Q を却下（要再検討マーク） | 下記 rejectQuestion() |
| `s` | skip — 何もせず次の Q へ | `navigateToNextOpenQ()` |
| `j` / `↓` | 次の Q or 選択肢へ | 既存ナビを流用 |
| `k` / `↑` | 前の Q or 選択肢へ | 既存ナビを流用 |
| `Escape` | Review Mode 終了 | `viewState.reviewMode = false` |

### Review Mode ガード

keydown ハンドラの既存ガード群の直後、通常ショートカット処理の前に挿入:

```typescript
// Review Mode shortcuts — 通常キーより先に処理
if (viewState.reviewMode) {
  if (event.key === "Escape") {
    event.preventDefault();
    viewState.reviewMode = false;
    // 視覚フィードバック: モード表示を消す
    scheduleRender();
    return;
  }
  if (event.key === "a") {
    event.preventDefault();
    acceptOption();
    return;
  }
  if (event.key === "x") {
    event.preventDefault();
    rejectQuestion();
    return;
  }
  if (event.key === "s") {
    event.preventDefault();
    navigateToNextOpenQ();
    return;
  }
  // j/k は既存の ↑↓ ナビにフォールスルー
}
```

### acceptOption()

```typescript
function acceptOption(): void {
  const node = map.state.nodes[viewState.selectedNodeId];
  if (!node || !node.parentId) return;
  
  const parent = map.state.nodes[node.parentId];
  if (!parent) return;
  
  // 選択肢ノードに selected=yes
  node.attributes = node.attributes || {};
  node.attributes["selected"] = "yes";
  
  // 他の兄弟の selected を消す
  for (const sibId of parent.children) {
    if (sibId !== node.id) {
      const sib = map.state.nodes[sibId];
      if (sib?.attributes?.["selected"]) {
        delete sib.attributes["selected"];
      }
    }
  }
  
  // 親 Q の status を decided に
  parent.attributes = parent.attributes || {};
  parent.attributes["status"] = "decided";
  
  // 視覚更新: 背景色で即判別
  updateStyleJson(node.id, (s) => { s.fill = "#d4edda"; s.border = "#2d8c4e"; });
  updateStyleJson(parent.id, (s) => { s.fill = "#d4edda"; s.border = "#2d8c4e"; delete s.status; });
  
  touchDocument();
  navigateToNextOpenQ();
}
```

### rejectQuestion()

```typescript
function rejectQuestion(): void {
  // 選択中が選択肢ノードなら親へ、Q ノードなら直接
  let qNode: TreeNode;
  const node = map.state.nodes[viewState.selectedNodeId];
  if (!node) return;
  
  const parent = node.parentId ? map.state.nodes[node.parentId] : null;
  if (parent?.attributes?.["status"]) {
    qNode = parent;  // 選択肢ノードから親 Q を取得
  } else {
    qNode = node;    // Q ノード自体を選択中
  }
  
  qNode.attributes = qNode.attributes || {};
  qNode.attributes["status"] = "rejected";
  
  updateStyleJson(qNode.id, (s) => { s.fill = "#f8d7da"; s.border = "#d94040"; delete s.status; });
  
  touchDocument();
  navigateToNextOpenQ();
}
```

### navigateToNextOpenQ()

```typescript
function navigateToNextOpenQ(): void {
  // reviews/ 配下の全 Q ノードから status=open を探す
  const reviewsNode = findNodeByPath("reviews");  // or iterate to find
  if (!reviewsNode) { viewState.reviewMode = false; scheduleRender(); return; }
  
  const openQs = reviewsNode.children
    .map(id => map.state.nodes[id])
    .filter(n => n && (!n.attributes?.["status"] || n.attributes["status"] === "open"));
  
  if (openQs.length === 0) {
    // 全完了 — Review Mode 自動終了
    viewState.reviewMode = false;
    // TODO: 完了メッセージ表示
    scheduleRender();
    return;
  }
  
  // 次の open Q を選択し展開
  const next = openQs[0];
  setSingleSelection(next.id);
  expandNode(next.id);  // 選択肢を表示
  scheduleRender();
}
```

### Review Mode 視覚フィードバック

```typescript
// renderSvg() 内に追加
if (viewState.reviewMode) {
  // ステータスバーまたは画面隅に「REVIEW MODE」表示
  // 背景を微妙に変える（薄紫のオーバーレイ等）
  // open Q ノードをハイライト
}
```

---

## 属性設計

| 属性 | 対象 | 値 | 意味 |
|------|------|---|------|
| `status` | Q ノード | `open` / `decided` / `rejected` | レビュー状態 |
| `selected` | 選択肢ノード | `yes` / (なし) | 採用された選択肢 |
| `raised` | Q ノード | ISO 8601 | 起票日 |
| `decided` | Q ノード | ISO 8601 | 決定日（accept/reject 時に自動付与） |

### 視覚マッピング（ノード背景色で即判別）

Q ノード自体の背景色を変える。枠線だけだと視認性が弱い。

| status | fill（背景色） | border | 意味 |
|--------|---------------|--------|------|
| open | `#fff3cd`（薄黄） | `#e89b1a`（オレンジ） | 未レビュー — 目立つ |
| decided | `#d4edda`（薄緑） | `#2d8c4e`（緑） | 採用済み — 安心色 |
| rejected | `#f8d7da`（薄赤） | `#d94040`（赤） | 却下 — 要再検討 |
| skipped | そのまま | そのまま | 未処理（色なし） |

選択肢ノード（selected=yes）: `fill: #d4edda` + `border: #2d8c4e`（親 Q と同じ緑系）
選択肢ノード（未選択）: 変更なし

Review Mode 中の現在カーソル位置: `border: #9b59b6`（紫太枠）でフォーカス表示

---

## スコープ外（将来）

- 選択肢へのコメント付与（details に追記）
- レビュー結果のサマリー自動生成（plan.md への反映）
- 複数レビュアー対応
- レビュー履歴の追跡

---

## 実装手順

1. ViewState に `reviewMode: boolean` 追加
2. keydown ハンドラに Review Mode ガードブロック挿入
3. `acceptOption()`, `rejectQuestion()`, `navigateToNextOpenQ()` 実装
4. Review Mode 時の視覚フィードバック追加（ステータスバー表示）
5. `R` キーで Review Mode トグル登録

全て `beta/src/browser/viewer.ts` 内の変更のみ。サーバー側・データスキーマ変更なし。

*2026-04-17*
