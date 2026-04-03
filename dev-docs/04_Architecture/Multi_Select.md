# Multi-Select（複数ノード選択）

## 目的

単一選択（`selectedNodeId: string`）だけでは実現できない以下の操作を可能にする：

- 複数ノードの一括削除
- 複数ノードの一括 collapse / expand
- 複数ノードの一括 reparent（全員を新しい親の子に並べる）
- 複数ノードを1つの新しい親にまとめる（group 操作）
- 視覚的な把握・参照

---

## 入力操作の定義

| 入力 | 動作 |
|---|---|
| Click | 単一選択（アンカーリセット） |
| Ctrl/Cmd+Click | 対象ノードを選択トグル（アンカーをその対象に更新） |
| Shift+Click | アンカー〜対象の範囲を選択（`visibleOrder` 順） |
| Shift+↑/↓ | breadth 方向に選択を1ノード拡張 |
| 矢印キー（Shift なし） | 単一選択に戻して移動 |
| Delete / Backspace | 複数選択中はすべての selection root を削除 |
| Space | 複数選択中はすべてのノードを collapse/expand |
| m | 複数選択中は全選択ノードを reparent source にマーク |
| Ctrl+G | groupSelected 実行 |
| Ctrl+A | 現在の scope 内の全可視ノードを選択 |
| Ctrl+C | 選択ノードをコピー（内部クリップボードに部分木スナップショットを保存） |
| Ctrl+X | 選択ノードをカット（移動予約）。貼り付け先にペーストすると reparent 実行 |
| Ctrl+V | クリップボードの内容を primary 選択ノードの子として貼り付け |

---

## State 設計

### ViewState への追加フィールド

```typescript
selectedNodeIds: Set<string>;      // 常に selectedNodeId を含む
selectionAnchorId: string | null;  // 範囲選択のアンカー（null = 単一選択モード）
reparentSourceIds: Set<string>;    // 既存の reparentSourceId を置き換え
```

`selectedNodeId`（既存）はそのまま残し、**primary カーソル**として機能させる。
`selectedNodeIds` は常にこれを含む。単一選択時は `selectedNodeIds = { selectedNodeId }`。

### 選択の種類

| 状態 | selectedNodeIds | selectionAnchorId |
|---|---|---|
| 単一選択 | `{ nodeId }` | null |
| range 選択中 | アンカー〜primary のスライス | アンカー nodeId |
| toggle 選択中 | 任意の Set | 最後に toggle したノード |

---

## "range" の定義

`visibleOrder`（DFS 表示順の配列）を用いる。

Shift+Click / Shift+Arrow でアンカーから primary までの slice を `selectedNodeIds` にセットする。
異なるブランチにまたがった範囲も許容する（ユーザー設計方針）。

---

## selection root の概念

group / multi-delete / multi-reparent では **selection root** のみを操作対象とする。

> **selection root** = `selectedNodeIds` に含まれるノードのうち、親も `selectedNodeIds` に含まれないもの

こうすることで、親を移動すれば子は自動的についてくるため、子を個別に操作する必要がなくなる。

---

## 各操作の詳細

### multi-delete

1. selection root を取得
2. depth 降順でソート（葉から削除してみなし孤立を防ぐ）
3. 各ルートに `model.deleteNode()` を順番に呼び出す
4. 削除後は最初の root の親を選択

### multi-collapse / expand

1. `selectedNodeIds` 全ノードを対象に `toggleCollapse()` を呼び出す

### multi-reparent

1. `m` キーで `reparentSourceIds = new Set(selectedNodeIds)`
2. target ノードに navigate して `p` キー
3. target が source の子孫でないことを確認（cycle チェック）
4. selection root のみを reparent（子ノードは親と一緒に移動するため個別処理不要）
5. 各 root に `model.reparentNode(rootId, targetId)` を順番に呼び出す

### groupSelected（Ctrl+G）

1. selection root を取得
2. root 群の LCA（最近共通祖先）を計算
3. LCA 子リスト内での先頭 root の index を取得
4. `model.addNode(lcaId, "", firstRootIndex)` で新しい親ノードを作成
5. 各 selection root を `model.reparentNode(rootId, newId)` で新ノードの子に移動
6. 新ノードを選択してインライン編集を開始（名前入力待ち）

**LCA の計算方法：**
各 root の祖先パス（root → ... → tree root）を収集し、
全パスに共通する最も深いノードを LCA とする。

### Ctrl+A（全選択）

1. `visibleOrder`（現 scope 内の可視ノード列）を全件 `selectedNodeIds` にセット
2. `selectedNodeId` = `visibleOrder[0]`（先頭 = アンカー）
3. `selectionAnchorId` = `visibleOrder[0]`

---

## クリップボード操作（Ctrl+C / X / V）

### State 設計

ViewState に追加：

```typescript
clipboardState: {
  type: "copy";
  snapshots: SubtreeSnapshot[];   // 部分木の直列化スナップショット
} | {
  type: "cut";
  sourceIds: Set<string>;         // 移動元ノードの ID（reparent に使う）
} | null;
```

```typescript
interface SubtreeSnapshot {
  text: string;
  details: string;
  note: string;
  attributes: Record<string, string>;
  children: SubtreeSnapshot[];    // 再帰
}
```

`clipboardState` はページリロードまで維持する（永続化しない）。

---

### Ctrl+C（コピー）

1. `selectedNodeIds` の selection root を取得
2. 各 root の部分木を `SubtreeSnapshot` として深くシリアライズ
3. `clipboardState = { type: "copy", snapshots }` をセット
4. カット状態（`type: "cut"`）があれば上書きして解除
5. システムクリップボードにはノードのテキストラベルを改行区切りでコピー（テキストエディタへの貼り付けを容易にするため）

**コピーされないもの：**
- ノード ID（貼り付け時に新規発行）
- alias / link のメタデータ（MVP では割愛。コピー先では通常テキストノードになる）
- `collapsed` 状態（貼り付け時は展開状態とする）

---

### Ctrl+X（カット）

1. `selectedNodeIds` の selection root を取得
2. `clipboardState = { type: "cut", sourceIds: new Set(roots) }` をセット
3. カットされたノードをレンダリング上でグレーアウト（`cut-pending` CSS クラス）
4. ノード自体はまだ削除しない（ペーストで初めて移動する）

**ESC キー:** `clipboardState` をクリアしてカット状態を解除。

---

### Ctrl+V（ペースト）

ペースト先は **`selectedNodeId`（primary）の子**として追加する。

#### コピー後のペースト（`type: "copy"`）

1. `snapshots` を DFS で再帰的にクローン
2. 各ノードに `model.addNode(parentId, text)` を呼び出し（新 ID 発行）
3. 複数 snapshot がある場合、全クローンが primary ノードの子として順番に追加
4. ペースト後の選択: クローンされた最初のノードを選択
5. `clipboardState` はそのまま維持（連続ペースト可能）

#### カット後のペースト（`type: "cut"`）

1. `sourceIds` の各ノードを `model.reparentNode(id, selectedNodeId)` で移動
2. target（selectedNodeId）が source の子孫でないことを確認（cycle チェック）
3. ペースト後 `clipboardState = null` にクリア（一度きりの移動）
4. カットビジュアル（`cut-pending` クラス）を解除

---

### ペースト先の設計根拠

「primary ノードの**子**として追加」を採用した理由：

- `Tab`（addChild）と操作の意味が一致する
- ペースト = 「この概念の配下に置く」という思考モデルに合致
- reparent（m+p）や addChild と一貫したセマンティクスを持つ

**代替案（兄弟として追加）の問題点：**  
root ノードを選択してペーストすると「root の兄弟」になり、スコープ外に置かれる可能性がある。

---

### キーボード競合の注意

インライン編集（`startInlineEdit`）中は Ctrl+C/V/X/A をインターセプトしない。
既存の keydown ハンドラがインライン編集中を検出して早期 return する仕組みと同じ制御。
ブラウザデフォルトのテキスト操作をそのまま利用する。

---

## レンダリング

- `selectedNodeIds.has(nodeId)` で `selected` クラスを付与（全選択ノード）
- `nodeId === viewState.selectedNodeId` で追加の `primary-selected` クラスを付与（primary のみ強調）
- `reparentSourceIds.has(nodeId)` で `reparent-source` クラスを付与（既存の単一判定を拡張）
- `clipboardState?.type === "cut" && clipboardState.sourceIds.has(nodeId)` で `cut-pending` クラスを付与（グレーアウト）

---

## 単一ノード専用操作のガード

以下の操作は `selectedNodeIds.size === 1` のときのみフル動作。
複数選択中は **`selectedNodeId`（primary）にのみ作用**する：

- `addChild` / `addSibling`
- `startInlineEdit`
- `enterScope`

---

## 既知の制限

### undo が N ステップになる

`rapid_mvp.ts` のモデルは全操作が個別にスナップショットを pushHistory するため、
multi-delete / multi-reparent / group はそれぞれ N 回の undo ステップになる。
まとめて一手で戻すには `model.beginBatch()` / `endBatch()` API が必要（別タスク）。

### コピー・ペーストで alias / link が失われる

`SubtreeSnapshot` は alias / link メタデータを含まない（MVP の割愛）。
コピーした alias ノードは通常のテキストノードとしてペーストされる。
alias / link を保持したコピーは将来拡張として対応する。

### Ctrl+V は複数回ペーストで ID が重複しない

毎回 `model.addNode()` で新規 ID を発行するため、同じスナップショットを繰り返しペーストしてもノード ID は衝突しない。

### Shift+Arrow は breadth 方向のみ

depth 方向（Shift+←/→）の選択拡張は定義しない。
depth 移動は構造の変化が大きく、range の意味が不明確になるため。

---

## 変更対象ファイル

| ファイル | 変更内容 |
|---|---|
| `beta/src/browser/viewer.globals.d.ts` | ViewState に selectedNodeIds, selectionAnchorId, reparentSourceIds を追加 |
| `beta/src/browser/viewer.ts` | selectNode, drawNode, keydown, pointerdown/up, deleteSelected, applyReparent, 新ヘルパー関数群, copySelected, cutSelected, pasteClipboard |
| `beta/viewer.css` | `.primary-selected`, `.multi-selected`, `.reparent-source`（複数対応）, `.cut-pending` |

`rapid_mvp.ts` への変更は不要（既存の addNode / reparentNode / deleteNode を順次呼び出す）。

---

## 関連文書

- レイアウト・軸定義: [./Layout_Algorithm.md](./Layout_Algorithm.md)
- 編集操作設計: [./Editing_Design.md](./Editing_Design.md)
- ドラッグ・reparent: [./Drag_and_Reparent.md](./Drag_and_Reparent.md)
