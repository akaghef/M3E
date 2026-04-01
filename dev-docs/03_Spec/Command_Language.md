# M3E コマンド言語仕様

> **設計フェーズ:** Beta 以降の実装対象。MVP には未実装。

---

## 方針

**コマンド言語として JavaScript を採用する。**

M3E はブラウザ上の JS/TS で動作しており、モデルオブジェクトをグローバルに露出するだけで
パーサー実装ゼロのコマンドインターフェースが実現できる。

```javascript
// ブラウザのコンソールから実行できる
// 将来のコマンドパネルでは後述の Security Model に従って実行する
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

## Security Model（将来のコマンドパネル実装要件）

本節は「コマンドパネル実装前に満たす必須条件」を定義する。

### 脅威

- ユーザー入力をそのまま `eval` / `Function` / `new Function` で実行することによるコードインジェクション
- DOM / `window` / `document` へのアクセスを経由した XSS
- `fetch` など外部通信 API の悪用によるデータ流出

### 必須要件（MUST）

1. コマンドパネル実行系で `eval` / `Function` / `new Function` を使用しない。
2. 実行可能な文法は「M3E Command Script サブセット」に限定し、AST 検証で許可ノードのみ通す。
3. 実行コンテキストは `m3e` API と最小限ユーティリティのみを注入し、`window` / `document` / `globalThis` / `Function` / `XMLHttpRequest` / `fetch` にアクセス不可とする。
4. コマンドパネルからの外部ネットワークアクセスを禁止する。
5. コマンド実行前に「実行予定 API 一覧」と対象ノード数を表示し、明示承認後に実行する。
6. 実行ログは「時刻・呼び出し API・対象件数・成功/失敗」のみを保存し、入力全文の平文保存は既定で行わない。
7. 失敗時は fail-closed（実行中断）にする。

### 推奨要件（SHOULD）

- 実行環境は Web Worker など分離コンテキストを使う。
- 1 実行あたりの命令数・時間・変更件数に上限を設ける。
- 危険操作（`del`, `move`, `replaceAll`）は dry-run プレビューを提供する。

### 実装ガイド（段階導入）

- Phase A: ブラウザコンソールのみ（現状）。
- Phase B: 読み取り専用コマンドパネル（`info`, `tree`, `find`, `findAll` 等）。
- Phase C: 書き込み操作を許可（AST 検証 + 明示承認 + 監査ログが揃ってから）。

### 禁止事項

- 「ユーザー入力を JS としてそのまま評価する」方式でのコマンドパネル実装。
- CSP 緩和での暫定回避（`unsafe-eval` の追加など）。

### 受け入れ条件

- セキュリティテストで、`window`, `document`, `fetch`, `Function` を参照する入力が拒否される。
- コマンドパネル経由で許可 API 以外が呼べない。
- 監査ログに操作概要が残り、入力全文が既定で保存されない。

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

## 暗黙ターゲット（Implicit Targets）

Excel のアクティブセルのように、**UI で選択中のノードを基準に操作できる**オブジェクト。
ID を変数に束縛せずに操作したいときに使う。

| オブジェクト | 対象範囲 |
|-------------|---------|
| `m3e.active_node` | 選択中の単一ノード |
| `m3e.active_branch` | 選択中ノードを根とする部分木（ノード＋全子孫） |
| `m3e.active_scope` | 選択中ノードが属する最寄りの scope（`folder` 型の祖先ノード、なければルート） |

各オブジェクトはメソッドを持つ。また `.id` プロパティで生の ID を取り出せる。

```javascript
// ID を使う従来の書き方
const id = m3e.sel
m3e.edit(id, "新ラベル")
m3e.collapse(id)

// 暗黙ターゲットを使う書き方（同じ操作）
m3e.active_node.edit("新ラベル")
m3e.active_branch.collapse()
```

### `m3e.active_node` のメソッド

選択中の単一ノードに対して操作する。子孫には影響しない。

| メソッド | 動作 |
|---------|------|
| `m3e.active_node.edit(label)` | テキストを変更 |
| `m3e.active_node.del()` | ノードと部分木を削除 |
| `m3e.active_node.set(field, value)` | 拡張フィールドを設定 |
| `m3e.active_node.unset(field)` | 拡張フィールドをクリア |
| `m3e.active_node.attr(key, value)` | 属性を設定 |
| `m3e.active_node.attrDel(key)` | 属性を削除 |
| `m3e.active_node.setType(type)` | ノードタイプを変更 |
| `m3e.active_node.info()` | ノード情報を返す |
| `m3e.active_node.id` | ノード ID を返す（プロパティ） |

```javascript
m3e.active_node.edit("修正済み仮説")
m3e.active_node.attr("status", "検証中")
m3e.active_node.set("note", "先行研究 A と整合")
m3e.active_node.info()

// ID が必要なときは .id で取り出す
const id = m3e.active_node.id
m3e.add(id, "子ノード")
```

### `m3e.active_branch` のメソッド

選択中ノードを根とする部分木全体に対して操作する。

| メソッド | 動作 |
|---------|------|
| `m3e.active_branch.collapse()` | 部分木を折り畳む |
| `m3e.active_branch.expand()` | 部分木をすべて展開 |
| `m3e.active_branch.move(newParentId)` | 部分木ごと別の親へ移動 |
| `m3e.active_branch.clone(newParentId?)` | 部分木ごと複製 |
| `m3e.active_branch.del()` | 部分木ごと削除 |
| `m3e.active_branch.tree()` | 部分木の構造を文字列で返す |
| `m3e.active_branch.findAll(text)` | 部分木内を検索 |
| `m3e.active_branch.id` | 根ノードの ID（プロパティ） |

```javascript
m3e.active_branch.collapse()
m3e.active_branch.expand()
console.log(m3e.active_branch.tree())

// 選択ブランチを別の親に移動
m3e.active_branch.move(m3e.find("実験計画"))

// ブランチを複製して派生案を作る
const copy = m3e.active_branch.clone()
m3e.select(copy)
m3e.active_node.edit("派生案 B")
```

### `m3e.active_scope` のメソッド

選択中ノードが属する最寄りの scope（`folder` 型の祖先ノード）に対して操作する。
scope が存在しない場合はルートが対象になる。

| メソッド | 動作 |
|---------|------|
| `m3e.active_scope.info()` | scope のノード情報を返す |
| `m3e.active_scope.collapse()` | scope 以下を折り畳む |
| `m3e.active_scope.expand()` | scope 以下をすべて展開 |
| `m3e.active_scope.tree()` | scope の構造を文字列で返す |
| `m3e.active_scope.findAll(text)` | scope 内を検索 |
| `m3e.active_scope.id` | scope の根ノード ID（プロパティ） |

```javascript
// 今いる scope の構造を確認
console.log(m3e.active_scope.tree())

// scope 内で検索
m3e.active_scope.findAll("仮説").forEach(id => m3e.attr(id, "reviewed", "true"))

// scope を折り畳んで俯瞰する
m3e.active_scope.collapse()
m3e.focus(m3e.active_scope.id)
```

### 暗黙ターゲットを引数として渡す

`.id` プロパティで ID が必要な既存メソッドと組み合わせられる。

```javascript
// 選択ブランチの根に子を追加
m3e.add(m3e.active_branch.id, "新しい観点")

// 選択ノードの兄弟を追加
m3e.sibling(m3e.active_node.id, "比較案")

// 選択 scope を基準にビューを合わせる
m3e.focus(m3e.active_scope.id)
m3e.select(m3e.active_scope.id)
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

## 追加コマンド

### マーク選択（複数ノードへの一括操作）

単一選択に加えて、複数ノードをマークし一括操作できる。

#### `m3e.mark(nodeId)` / `m3e.unmark(nodeId)` / `m3e.clearMarks()`

```javascript
m3e.mark(h1)
m3e.mark(h2)
m3e.mark(h3)
m3e.unmark(h2)         // 解除
m3e.clearMarks()       // 全解除
```

#### `m3e.marked`（プロパティ）

マーク済みノード ID の配列を返す（読み取り専用）。

```javascript
// マーク済み全ノードに属性を一括設定
m3e.marked.forEach(id => m3e.attr(id, "status", "レビュー済み"))

// マーク済みを全て折り畳む
m3e.marked.forEach(id => m3e.collapse(id))
```

---

### 構造クエリ

ツリーの形を数値・配列で問い合わせる。

#### `m3e.depth(nodeId?)`

ルートからの深さを返す。省略すると選択中ノードが対象。

```javascript
m3e.depth()            // → 3
m3e.depth(m3e.root)    // → 0
```

#### `m3e.count(nodeId?)`

部分木のノード総数を返す（自身を含む）。省略すると選択中ノードが対象。

```javascript
m3e.count(hypo)        // → 12
m3e.count(m3e.root)    // → ツリー全体のノード数
```

#### `m3e.leaves(nodeId?)`

部分木内の葉ノード（子を持たないノード）の ID 配列を返す。

```javascript
m3e.leaves(hypo).forEach(id => m3e.attr(id, "leaf", "true"))
```

#### `m3e.ancestors(nodeId?)`

対象ノードからルートまでの祖先 ID 配列を返す（近い順）。

```javascript
m3e.ancestors()        // → ["parent_id", "grandparent_id", ..., "root_id"]
```

#### `m3e.path(nodeId?)`

ルートから対象ノードまでの ID パスを返す（遠い順）。

```javascript
m3e.path(m3e.sel)      // → ["root_id", ..., "parent_id", "sel_id"]
```

---

### 検索・置換

#### `m3e.replaceAll(search, replacement, scopeId?)`

テキストが部分一致するすべてのノードのラベルを置換する。
`scopeId` を省略するとツリー全体が対象。

```javascript
m3e.replaceAll("仮説", "Hypothesis")
m3e.replaceAll("要検証", "要確認", m3e.active_scope.id)

// 件数を確認してから実行
const targets = m3e.findAll("旧用語")
console.log(`${targets.length} 件置換します`)
targets.forEach(id => m3e.edit(id, m3e.node(id).text.replace("旧用語", "新用語")))
```

---

### ノードタイプの変更

#### `m3e.setType(nodeId, type)`

ノードの type を変更する。

| type | 意味 |
|------|------|
| `"text"` | 通常のテキストノード（デフォルト） |
| `"folder"` | scope の根になるノード |
| `"alias"` | 別ノードへの参照 |
| `"image"` | 画像ノード |

```javascript
m3e.setType(m3e.sel, "folder")     // 現在のノードを scope の根にする
m3e.active_node.setType("folder")  // 暗黙ターゲット版
```

`"alias"` に変更する場合は参照先 ID も必要（詳細は Scope_and_Alias.md 参照）。

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

### 暗黙ターゲットを使った対話的操作

```javascript
// UIで「仮説」ノードを選択した状態でコンソールを開き、そのまま操作する

// 今選んでいるノードを確認
m3e.active_node.info()

// ラベルを直すだけ
m3e.active_node.edit("仮説（改訂版）")

// 下の枝を全部展開して構造確認
m3e.active_branch.expand()
console.log(m3e.active_branch.tree())

// この scope にある "要検証" を全部探して属性更新
m3e.active_scope.findAll("要検証").forEach(id => {
  m3e.attr(id, "status", "着手待ち")
})

// 別の scope に枝ごと移動
const dest = m3e.find("実験計画")
m3e.active_branch.move(dest)
```

---

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
