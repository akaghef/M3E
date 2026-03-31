# M3E コマンド言語仕様

> **設計フェーズ:** Beta 以降の実装対象。MVP には未実装。

---

## 方針

**コマンド言語として JavaScript を採用する。**

M3E はブラウザ上の JS/TS で動作しており、モデルオブジェクトをグローバルに露出するだけで
パーサー実装ゼロのコマンドインターフェースが実現できる。

```javascript
// ブラウザのコンソール、またはコマンドパネルから直接実行できる
const hypo = m3e.add(m3e.root, "仮説")
m3e.attr(hypo, "status", "検証中")
m3e.focus(hypo)
```

変数・ループ・条件分岐・エラーハンドリングはすべて JS のセマンティクスに委ねる。
カスタム DSL は導入しない。

---

## 露出するグローバルオブジェクト

```typescript
window.m3e  // M3E コマンド API
```

`m3e` はブラウザコンソールおよび将来のコマンドパネルから参照できる。

---

## ノード参照

| 表記 | 型 | 意味 |
|------|----|------|
| `m3e.root` | `string` | ルートノードの ID（プロパティ） |
| `m3e.sel` | `string \| null` | 現在選択中のノード ID（読み取り専用プロパティ） |
| `m3e.parent(id?)` | `string \| null` | 指定ノードの親 ID。省略すると選択中ノードの親 |
| `m3e.children(id?)` | `string[]` | 指定ノードの子 ID 配列。省略すると選択中ノードの子 |
| `m3e.node(id)` | `TreeNode` | ノードオブジェクトの深いコピーを返す（変更しても反映されない） |
| `const id = ...` | `string` | JS 変数に束縛して後続で再利用 |

```javascript
const root     = m3e.root
const selected = m3e.sel              // プロパティとして参照
const parent   = m3e.parent()         // 選択中ノードの親
const children = m3e.children(root)   // ルートの子 ID 配列
const node     = m3e.node(selected)   // { id, text, note, ... } の深いコピー
```

---

## API リファレンス

### ノード作成

#### `m3e.add(parentId, label, index?)`

`parentId` の子ノードを追加し、新しいノード ID を返す。
`index` を省略すると末尾に追加。

```javascript
const obs  = m3e.add(m3e.root, "観察事実")
const hypo = m3e.add(m3e.root, "仮説")
const h1   = m3e.add(hypo, "温度上昇が主因")
const top  = m3e.add(m3e.root, "最優先", 0)   // 先頭に挿入
```

#### `m3e.sibling(nodeId, label, after?)`

`nodeId` の兄弟ノードを追加し、新しいノード ID を返す。
`after` を省略または `true` にすると直後、`false` にすると直前。

```javascript
const h2 = m3e.sibling(h1, "土壌劣化が主因")
const h0 = m3e.sibling(h1, "前置き仮説", false)  // h1 の直前
```

---

### ノード編集

#### `m3e.edit(nodeId, newLabel)`

ノードのテキストを変更する。

```javascript
m3e.edit(m3e.sel(), "修正済みラベル")
m3e.edit(h1, "仮説 A（検証済み）")
```

#### `m3e.del(nodeId)`

ノードとその部分木を削除する。ルートノードは削除不可（例外をスロー）。

```javascript
m3e.del(h2)
```

#### `m3e.move(nodeId, newParentId, index?)`

ノードを別の親の子として再配置する。
`index` を省略すると末尾に追加。循環する移動は例外をスロー。

```javascript
m3e.move(h1, obs)       // obs の末尾へ
m3e.move(h1, obs, 0)    // obs の先頭へ
```

#### `m3e.promote(nodeId)` / `m3e.demote(nodeId)`

兄弟リスト内で1つ上／下に移動する。
すでに先頭または末尾の場合は何もしない。

```javascript
m3e.promote(m3e.sel())
m3e.demote(h1)
```

#### `m3e.clone(nodeId, newParentId?)`

ノードとその部分木を再帰的に複製し、新しいノード ID を返す。
`newParentId` を省略すると元のノードと同じ親に追加される。

複製時の各フィールドの扱い：
- `text`, `details`, `note`, `attributes`, `link` はすべて値としてコピーする
- `id` と `parentId` は新しい値が付与される（元 ID は引き継がない）
- `link` フィールドに別ノードの ID が含まれていてもそのまま値コピーする（alias 解決は行わない）

```javascript
const copy  = m3e.clone(h1)          // h1 の兄弟として複製
const copy2 = m3e.clone(h1, obs)     // obs の子として複製
```

---

### 選択・ナビゲーション

#### `m3e.sel`（プロパティ）

現在選択中のノード ID を返す読み取り専用プロパティ。
選択を変更するには `m3e.select(id)` を使う。

```javascript
const current = m3e.sel             // 取得（プロパティ）
```

#### `m3e.select(nodeId)`

指定したノードを選択する。

```javascript
m3e.select(hypo)
m3e.select(m3e.root)
```

#### `m3e.nav(direction)`

ツリー構造上の相対位置へ選択を移動する。

| direction | 移動先 |
|-----------|--------|
| `"parent"` | 親ノード |
| `"first"` | 最初の子ノード |
| `"last"` | 最後の子ノード |
| `"next"` | 次の兄弟ノード |
| `"prev"` | 前の兄弟ノード |

```javascript
m3e.nav("parent")
m3e.nav("first")
m3e.nav("next")
```

---

### 折り畳み

#### `m3e.collapse(nodeId)` / `m3e.expand(nodeId)` / `m3e.toggle(nodeId)`

```javascript
m3e.collapse(m3e.root)
m3e.expand(hypo)
m3e.toggle(m3e.sel())
```

#### `m3e.collapseAll(nodeId?)` / `m3e.expandAll(nodeId?)`

指定ノード以下の部分木を一括折り畳み／展開する。
`nodeId` を省略するとルートから全体が対象。

```javascript
m3e.collapseAll()           // ツリー全体を折り畳む
m3e.expandAll(hypo)         // hypo 以下をすべて展開
```

---

### 属性・メタデータ

#### `m3e.set(nodeId, field, value)`

拡張フィールドを設定する。

| field | TreeNode フィールド |
|-------|-------------------|
| `"details"` | `details` |
| `"note"` | `note` |
| `"link"` | `link` |

```javascript
m3e.set(h1, "note", "先行研究 A, B と整合")
m3e.set(h1, "link", "https://example.com/paper")
```

#### `m3e.unset(nodeId, field)`

拡張フィールドを空文字にクリアする。

```javascript
m3e.unset(h1, "note")
```

#### `m3e.attr(nodeId, key, value)`

`attributes` マップにキーと値を設定する。

```javascript
m3e.attr(m3e.sel(), "status", "検証中")
m3e.attr(m3e.sel(), "priority", "高")
```

#### `m3e.attrDel(nodeId, key)`

`attributes` マップから指定キーを削除する。

```javascript
m3e.attrDel(m3e.sel(), "status")
```

---

### 履歴

#### `m3e.undo()` / `m3e.redo()`

操作を1ステップ巻き戻し／やり直す。
スタックが空の場合は `false` を返す（例外はスローしない）。モデルは最大 200 件の履歴を保持する。

```javascript
m3e.undo()
m3e.undo()
m3e.redo()

// スタックが空かどうかの確認
if (!m3e.undo()) console.log("これ以上戻れません")
```

---

### 読み取り・検索

#### `m3e.info(nodeId?)`

ノードオブジェクトの深いコピーを返す。
`nodeId` を省略すると選択中ノードが対象。
ブラウザコンソールで呼んだ場合は DevTools がオブジェクトを展開表示するため、別途 `console.log` は不要。

```javascript
m3e.info()
// → { id: "n_1234_abc", text: "仮説 A", note: "...", attributes: { status: "検証中" }, ... }

const data = m3e.info(h1)
console.log(data.text)
```

#### `m3e.tree(nodeId?)`

指定ノード以下のツリー構造を文字列で返す。
`nodeId` を省略するとルートから全体。折り畳まれたノードは `[+]` で表示。
コンソールで確認する場合は `console.log(m3e.tree())` を使う。

```javascript
console.log(m3e.tree())
// 気候変動と農業生産性
//   ├─ 観察事実
//   │   ├─ 収穫量が過去10年で15%減少
//   │   └─ 降水パターンの変化
//   └─ 仮説 [+]   ← 折り畳み中

console.log(m3e.tree(hypo))    // hypo 以下のみ
const s = m3e.tree()           // 文字列として変数に取ることも可能
```

#### `m3e.find(text)`

テキストが部分一致する最初のノードの ID を返す。
一致なしの場合は `null` を返す（例外をスローしない）。

```javascript
const target = m3e.find("仮説 A")
if (target) {
  m3e.sel(target)
  m3e.focus(target)
}
```

#### `m3e.findAll(text)`

テキストが部分一致するすべてのノードの ID 配列を返す。
一致なしの場合は空配列 `[]` を返す。

```javascript
const results = m3e.findAll("仮説")
results.forEach(id => m3e.attr(id, "reviewed", "true"))
```

---

### ビュー操作

#### `m3e.fit()`

ツリー全体が画面に収まるようにズーム・パンを調整する。

#### `m3e.focus(nodeId?)`

指定ノードを画面中央に表示する。`nodeId` を省略すると選択中ノードが対象。

```javascript
m3e.focus(hypo)
m3e.focus()       // 選択中ノードにフォーカス
```

#### `m3e.zoom(factor)`

ズーム倍率を数値で設定する（例: `0.5`, `1.5`）。

```javascript
m3e.zoom(0.5)
m3e.zoom(1.5)
```

#### `m3e.zoomReset()`

ズームを等倍（1.0）に戻す。

```javascript
m3e.zoomReset()
```

#### `m3e.pan(dx, dy)`

キャンバスを指定ピクセル分パンする。

```javascript
m3e.pan(200, 0)    // 右に 200px
m3e.pan(0, -100)   // 上に 100px
```

---

### ドキュメント管理

#### `m3e.new(rootLabel?)`

ツリーを初期化し新しいドキュメントを開始する。
未保存の変更がある場合は `confirm()` で確認する（ユーザーがキャンセルすれば何もしない）。

```javascript
m3e.new()
m3e.new("新しい研究テーマ")
```

#### `m3e.save(filename?)`

現在のツリーを `SavedDoc`（`version: 1`）形式でブラウザダウンロードとして保存する。
ブラウザ環境のため任意のパスへの書き込みは行わない。`filename` を省略するとデフォルト名（`m3e-export.json`）を使用する。戻り値なし。

```javascript
m3e.save()
m3e.save("research-2026.json")
```

#### `m3e.load(source)`

JSON または Freeplane `.mm` を読み込む。
`source` には以下のいずれかを渡す：

| 型 | 動作 |
|----|------|
| `string`（URL またはサーバー相対パス） | `fetch()` で取得して読み込む |
| `File` オブジェクト | File API で読み込む（`<input type="file">` からの参照） |

パスはサーバー起動時のルート（`http://localhost:4173/`）からの相対パス。
**読み込み後、以前のセッションで使用していた JS 変数（ノード ID）は無効になる。**
ファイルが見つからない、またはパースに失敗した場合は例外をスロー。

```javascript
m3e.load("data/rapid-sample.json")   // サーバー相対パス
m3e.load("data/aircraft.mm")

// File ピッカーから取得した場合
const [file] = document.querySelector("input").files
m3e.load(file)
```

#### `m3e.export(format)`

現在のツリーを指定フォーマットでブラウザダウンロードとして保存する。

| format | 出力 | 状態 |
|--------|------|------|
| `"json"` | M3E SavedDoc 形式（`save` と同等） | 実装済み相当 |
| `"mm"` | Freeplane `.mm` 形式 | **未実装（Beta 以降）** |

```javascript
m3e.export("json")
m3e.export("mm")   // 未実装時は例外をスロー: "mm export is not yet implemented"
```

---

## JS を使うことで解決される点

カスタム DSL では別途定義が必要だった以下の問題が JS のセマンティクスで自動的に解決される。

| 問題 | JS での解決 |
|------|------------|
| クォート・エスケープ | JS 文字列リテラルのルールをそのまま使う |
| 空文字列 | `m3e.edit(id, "")` — JS の空文字列として有効 |
| `find` が null の場合 | `if (target) { ... }` で標準的に対処 |
| ループ・繰り返し処理 | `for`, `forEach`, `map` など JS ネイティブ |
| 条件分岐 | `if`, `switch` など JS ネイティブ |
| `undo` スタック空 | `false` を返す。`if (!m3e.undo())` で確認可能 |
| 変数一覧 | ブラウザの DevTools で確認 |
| スクリプトファイルの実行 | JS ファイルをコンソールに貼り付けまたは `<script>` タグで読み込み |
| 複雑なエラー処理 | `try { ... } catch (e) { ... }` |
| `sel` getter/setter 兼用の曖昧さ | `m3e.sel`（プロパティ）と `m3e.select(id)`（メソッド）に分離 |
| `zoom` の型混在 | `m3e.zoom(factor)` は数値のみ、リセットは `m3e.zoomReset()` に分離 |
| `node()` の書き換え防止 | `structuredClone()` で深いコピーを返す |
| `info()`/`tree()` の二重出力 | `info()` は戻り値のみ（DevTools が表示）、`tree()` は文字列を返すのみ |

---

## 組み合わせ例

### 研究ツリーの構築

```javascript
m3e.edit(m3e.root, "気候変動と農業生産性")

const obs  = m3e.add(m3e.root, "観察事実")
const hypo = m3e.add(m3e.root, "仮説")
const exp  = m3e.add(m3e.root, "実験計画")

const o1 = m3e.add(obs, "収穫量が過去10年で15%減少")
const o2 = m3e.add(obs, "降水パターンの変化")
m3e.attr(o1, "status", "確認済み")
m3e.attr(o2, "status", "要検証")

const h1 = m3e.add(hypo, "温度上昇が主因")
m3e.set(h1, "note", "先行研究 A, B と整合")
const h2 = m3e.sibling(h1, "土壌劣化が主因")

const e1 = m3e.add(exp, "温度と収穫量の相関分析")
m3e.move(e1, exp, 0)

m3e.fit()
m3e.focus(hypo)
m3e.select(hypo)   // sel はプロパティなので変更は select() を使う
```

### 検索・一括更新

```javascript
// "仮説" を含む全ノードに reviewed フラグを立てる
m3e.findAll("仮説").forEach(id => {
  m3e.attr(id, "reviewed", "true")
  console.log(m3e.node(id).text, "→ reviewed")
})
```

### ツリーの整理

```javascript
m3e.collapseAll()
m3e.expandAll(hypo)

m3e.promote(h2)   // 「土壌劣化が主因」を上へ

const h3 = m3e.clone(h1, hypo)
m3e.edit(h3, "温度と土壌の複合要因")

console.log(m3e.tree(hypo))
```

### エラー処理

```javascript
// ノードが見つからない場合の安全な処理
const target = m3e.find("存在しないノード")
if (!target) {
  console.warn("ノードが見つかりませんでした")
} else {
  m3e.sel(target)
}

// 例外をキャッチして継続
try {
  m3e.del(m3e.root)   // ルート削除は例外をスロー
} catch (e) {
  console.error(e.message)  // "Root node cannot be deleted."
}
```

---

## エラー仕様

| 状況 | 動作 |
|------|------|
| 存在しないノード ID を渡す | 例外をスロー: `"Node not found: <id>"` |
| ルートの削除・再配置 | 例外をスロー |
| 循環する `move` | 例外をスロー: `"Cycle detected"` |
| `find` / `findAll` で一致なし | `null` / `[]` を返す（例外なし） |
| `undo` / `redo` でスタック空 | `false` を返す（例外なし） |
| `load` でファイルが見つからない | 例外をスロー |
| `new` で未保存変更あり | `confirm()` でユーザー確認。キャンセルで中断 |
| `load` 後に古い ID を使用 | 次の操作で `"Node not found"` 例外をスロー |
| 不正な `index` | 末尾挿入にフォールバック（例外なし） |

---

## 実装メモ

- `window.m3e` は `viewer.ts` の初期化完了後に代入する
- 各メソッドは既存の `RapidMvpModel` のメソッドを薄くラップする
- ビュー操作（`fit`, `focus`, `zoom`, `pan`）は `viewer.ts` の既存関数を呼び出す
- `m3e.node(id)` の戻り値は読み取り専用コピー（直接変更しても反映されない）

---

## 関連文書

- モデルの操作 API: [../../mvp/src/node/rapid_mvp.ts](../../mvp/src/node/rapid_mvp.ts)
- 編集設計: [../04_Architecture/Editing_Design.md](../04_Architecture/Editing_Design.md)
- コマンド操作リファレンス（現 MVP のキー操作）: [../06_Operations/Command_Reference.md](../06_Operations/Command_Reference.md)
