# M3E コマンド言語仕様

> **設計フェーズ:** この文書はコマンドインターフェースの設計仕様です。
> 現在の MVP には実装されていません。Beta 以降の実装対象として定義します。

---

## 目的

マインドマップのすべての操作をテキストコマンドで表現できるようにする。

- キーボードのみで完結する操作フローを支援する
- スクリプトや自動化ツールからの操作を可能にする
- 操作ログを人間が読めるテキストとして記録・再現できるようにする

---

## 構文ルール

### 基本形

```
command arg1 arg2 ...
```

### 戻り値の代入

コマンドがノード ID を返す場合、変数に束縛できます。

```
$var = command arg1 arg2
```

### 文字列引数

スペースを含むラベルはダブルクォートで囲みます。

```
$id = add @ "研究仮説 A"
```

### コメント

`#` 以降は無視されます。

```
add @ 検討中  # あとで整理する
```

---

## ノード参照（Node Reference）

コマンドの引数でノードを指定する方法は次のとおりです。

| 表記 | 意味 |
|------|------|
| `@` | 現在選択中のノード |
| `~` | ルートノード |
| `@..` | 選択中ノードの親 |
| `$varname` | 変数に束縛されたノード ID |
| `n_1234_abc` | ノードの実 ID（直接指定） |

---

## コマンド一覧

### ノード作成

#### `add`

```
$id = add <parent> <label>
```

`<parent>` の子ノードを末尾に追加します。
新しいノードの ID を返します。

```
$root = ~
$theme = add $root "研究テーマ"
$hypo  = add $theme "仮説 A"
```

#### `add-at`

```
$id = add-at <parent> <index> <label>
```

`<parent>` の子リストの `<index>` 番目（0始まり）に挿入します。

```
$id = add-at ~ 0 "最優先トピック"
```

#### `sibling`

```
$id = sibling <node> <label>
```

`<node>` の直後に兄弟ノードを追加します。

```
$alt = sibling $hypo "仮説 B"
```

#### `sibling-before`

```
$id = sibling-before <node> <label>
```

`<node>` の直前に兄弟ノードを追加します。

---

### ノード編集

#### `edit`

```
edit <node> <new-label>
```

ノードのテキストを変更します。

```
edit @ "修正済みラベル"
edit $hypo "仮説 A（検証済み）"
```

#### `del`

```
del <node>
```

ノードとその部分木を削除します。ルートノードは削除できません。

```
del $alt
```

#### `promote` / `demote`

```
promote <node>
demote <node>
```

兄弟リスト内で1つ上／下に移動します。`move <node> <parent> <index>` の糖衣構文です。
すでに先頭または末尾のノードに対しては何もしません。

```
promote @     # 選択中ノードを兄弟リストで1つ上へ
demote $hypo  # $hypo を兄弟リストで1つ下へ
```

#### `clone`

```
$id = clone <node>
$id = clone <node> <new-parent>
```

ノードとその部分木を複製します。新しいノードの ID を返します。
`<new-parent>` を省略すると元のノードと同じ親に追加されます。新規ノードには新しい ID が付与されます。

```
$copy = clone $hypo            # $hypo の兄弟として複製
$copy = clone $hypo $another   # $another の子として複製
```

#### `move`

```
move <node> <new-parent>
move <node> <new-parent> <index>
```

ノードを別の親の子として再配置します。
`<index>` を指定した場合、その位置に挿入します。
循環する移動（子孫への移動）は拒否されます。

```
move $hypo $theme        # $theme の末尾へ
move $hypo $theme 0      # $theme の先頭へ
```

---

### 選択・ナビゲーション

#### `sel`

```
sel <node>
```

指定したノードを選択します。

```
sel ~
sel $theme
```

#### `up` / `down`

```
up
down
```

表示ノードを1つ前後に選択を移動します。折り畳まれた部分木はスキップされます。

#### `nav`

```
nav parent
nav first
nav next
nav prev
```

ツリー構造上の相対位置へ選択を移動します。`up`/`down` が表示順であるのに対し、`nav` は親子・兄弟関係に沿って移動します。

| 引数 | 移動先 |
|------|--------|
| `parent` | 親ノード（ルートでは無効） |
| `first` | 最初の子ノード（子がなければ無効） |
| `next` | 次の兄弟ノード |
| `prev` | 前の兄弟ノード |

```
nav parent   # @.. へ移動
nav first    # 選択中の最初の子へ
nav next     # 次の兄弟へ
```

---

### 折り畳み

#### `collapse` / `expand` / `toggle`

```
collapse <node>
expand <node>
toggle <node>
```

```
collapse ~        # ルートの直下をすべて折り畳む（ルート自体は折り畳めない）
expand $theme
toggle @
```

#### `collapse-all` / `expand-all`

```
collapse-all
collapse-all <node>
expand-all
expand-all <node>
```

指定ノード以下の部分木を一括で折り畳み／展開します。引数を省略するとルートからすべてが対象です。

```
collapse-all          # ツリー全体を折り畳む
expand-all $theme     # $theme 以下をすべて展開
```

---

### 属性・メタデータ

#### `set`

```
set <node> <field> <value>
```

ノードの拡張フィールドを設定します。

| field | 対応する TreeNode フィールド |
|-------|---------------------------|
| `details` | `details` |
| `note` | `note` |
| `link` | `link` |

```
set @ note "この仮説は先行研究 X に基づく"
set $hypo link "https://example.com/paper"
set @ details "詳細な説明テキスト"
```

#### `unset`

```
unset <node> <field>
```

`set` で設定した拡張フィールドを空文字にクリアします。

| field | 対象 |
|-------|------|
| `details` | details フィールド |
| `note` | note フィールド |
| `link` | link フィールド |

```
unset @ note
unset $hypo link
```

#### `attr`

```
attr <node> <key> <value>
```

ノードの任意属性（`attributes` マップ）を設定します。

```
attr @ status "検証中"
attr @ priority "高"
```

#### `attr-del`

```
attr-del <node> <key>
```

`attributes` マップから指定キーを削除します。

```
attr-del @ status
```

---

### 履歴

#### `undo` / `redo`

```
undo
redo
```

操作を1ステップ巻き戻し・やり直しします。
モデルは最大 200 件の履歴を保持します。

```
undo
undo
redo
```

---

### ビュー操作

#### `fit`

```
fit
```

ツリー全体が画面に収まるようにズーム・パンを調整します。

#### `focus`

```
focus
focus <node>
```

指定したノードを画面中央に表示します。引数を省略すると選択中のノードが対象です。

```
focus $theme
focus @
focus
```

#### `zoom`

```
zoom <factor>
zoom reset
```

`<factor>` は倍率（例: `1.5`, `0.8`）。`reset` で等倍（1.0）に戻します。

```
zoom 0.5
zoom reset
```

---

### 読み取り・検索

#### `info`

```
info
info <node>
```

ノードの全フィールドを出力します。引数を省略すると選択中のノードが対象です。

```
info @
# → id:       n_1234_abc
# → text:     仮説 A
# → parent:   n_0001_xyz
# → children: [n_5678_def, n_9012_ghi]
# → note:     先行研究と整合
# → status:   検証中

info ~
```

#### `tree`

```
tree
tree <node>
```

指定ノード以下のツリー構造をテキストで出力します。引数を省略するとルートから全体を表示します。

```
tree
# → 気候変動と農業生産性
#   ├─ 観察事実
#   │   ├─ 収穫量が過去10年で15%減少
#   │   └─ 降水パターンの変化
#   └─ 仮説
#       ├─ 温度上昇が主因
#       └─ 土壌劣化が主因

tree $hypo
```

#### `find`

```
$id = find <text>
```

テキストが一致する最初のノードの ID を返します。一致がなければ空を返します。
部分一致で検索します。

```
$target = find "仮説 A"
sel $target
focus $target
```

#### `echo`

```
echo $var
```

変数の値（ノード ID）を出力します。変数が未定義の場合はエラーを表示します。

```
echo $hypo
# → n_1234_abc
```

---

### ドキュメント管理

#### `new`

```
new
new <root-label>
```

ツリーを初期化し、新しいドキュメントを開始します。現在の変更は失われます（保存済みの場合のみ実行を推奨）。

```
new
new "新しい研究テーマ"
```

---

### ファイル操作

#### `save`

```
save
save <filename>
```

現在のツリーを `SavedDoc`（`version: 1`）形式で保存します。
`<filename>` を省略するとデフォルトのパスに保存します。

#### `load`

```
load <filename>
```

JSON または Freeplane `.mm` ファイルを読み込みます。

```
load data/rapid-sample.json
load data/aircraft.mm
```

---

## 組み合わせ例

### 研究ツリーの構築

```
# ルートを編集してテーマを設定
edit ~ "気候変動と農業生産性"

# 大分類を追加
$obs   = add ~ "観察事実"
$hypo  = add ~ "仮説"
$exp   = add ~ "実験計画"

# 観察事実を入力
$o1 = add $obs "収穫量が過去10年で15%減少"
$o2 = add $obs "降水パターンの変化"
attr $o1 status "確認済み"
attr $o2 status "要検証"

# 仮説を追加してメモ
$h1 = add $hypo "温度上昇が主因"
set $h1 note "先行研究 A, B と整合"
$h2 = sibling $h1 "土壌劣化が主因"

# 実験計画を追加
$e1 = add $exp "温度と収穫量の相関分析"
move $e1 $exp 0    # 先頭に移動

# ビューを調整
fit
focus $hypo
```

### 既存ノードの検索・更新

```
# テキストでノードを特定して属性を更新
$target = find "土壌劣化"
info $target              # 内容を確認してから編集

attr $target status "却下"
set $target note "データ不足のため保留"

# 誤って変更した場合は undo
undo
```

### ツリーの整理

```
# 全体を折り畳んでから特定ブランチだけ展開
collapse-all
expand-all $hypo

# 仮説の優先順位を変更
promote $h2    # 「土壌劣化が主因」を上へ

# 仮説を複製して別案として派生
$h3 = clone $h1 $hypo
edit $h3 "温度と土壌の複合要因"

# 構造を確認
tree $hypo
```

---

## 変数スコープ

- 変数はセッション内で有効です（ページリロードでリセット）
- `$var = command` で代入し、以降の任意のコマンドで参照できます
- 同名変数への再代入は可能です
- 変数名は英数字とアンダースコアのみ使用可能です（`$root_node`, `$h1` 等）

---

## エラー処理

| エラー | 動作 |
|--------|------|
| 存在しないノード ID | コマンド拒否、メッセージ表示 |
| ルートの削除・再配置 | コマンド拒否 |
| 循環する `move` | コマンド拒否（モデル側が検出） |
| 未定義変数の参照 | コマンド拒否、変数名を表示 |
| 不正な `<index>` | 末尾挿入にフォールバック |

エラー時も正本（モデルの状態）は変化しません。

---

## 関連文書

- モデルの操作 API: [../../mvp/src/node/rapid_mvp.ts](../../mvp/src/node/rapid_mvp.ts)
- 編集設計: [../04_Architecture/Editing_Design.md](../04_Architecture/Editing_Design.md)
- コマンド操作リファレンス（現 MVP のキー操作）: [../06_Operations/Command_Reference.md](../06_Operations/Command_Reference.md)
