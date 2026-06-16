# Scope Routing Shortcuts

最終更新: 2026-06-05

---

## 概要

`R` / `Shift+R` は、trackpad / wheel の移動量を通常 pan ではなく、M3E viewer 上の active target 移動へ割り当てる held shortcut である。

- `R`: 現在 scope 内の active node を高速に移動する
- `Shift+R`: scope tree を scope 単位の surface として表示し、active scope target を高速に移動する

どちらも、押している間だけ有効な一時 mode である。

---

## 用語

| 用語 | 意味 |
|---|---|
| active node | viewer 上で現在選択されている node |
| active scope target | `Shift+R` 中に選択されている遷移先 scope |
| scope routing popup | `Shift+R` 中だけ表示する scope target 選択 UI |
| routing | この仕様では構造移動ではなく、入力方向を active target 選択へ振り分けること |

---

## `R` held mode

### 起動と終了

| 操作 | 動作 |
|---|---|
| `R` を押す | active node routing mode に入る |
| `R` を押している間 | trackpad / wheel は pan ではなく active node 移動に使う |
| `R` を離す | active node routing mode を終了する |

### UI

- `R` 単体では popup を表示しない
- 通常の viewer surface をそのまま使う
- 通常 pan は抑止する

### 方向

`R` の左右方向は、既存 viewer の node navigation と同じ直感に合わせる。

| 入力方向 | 意味 |
|---|---|
| parent 側 | parent node へ近づく |
| child 側 | child node へ近づく |
| vertical | 同一階層または同一表示順の前後へ移動する |

---

## `Shift+R` held mode

### 起動と終了

| 操作 | 動作 |
|---|---|
| `Shift+R` を押す | scope routing popup を表示し、scope target routing mode に入る |
| `Shift+R` を押している間 | trackpad / wheel は pan ではなく active scope target 移動に使う |
| `R` または `Shift` を離す | 現在の active scope target へ入る |
| `Escape` | popup を閉じ、scope 遷移しない |

`Shift+R` の確定 trigger は held chord の release である。`Enter` は popup 表示中の補助確定として許可できるが、release trigger より優先される仕様ではない。

### UI

- popup は現在画面の上に表示する
- 背景は blurred / dimmed にして、元 surface との関係を保つ
- popup 内の main view は M3E surface style を流用する
- scope を node として表示し、scope 同士を edge で接続する
- node unit は scope であり、通常 node の内容一覧 UI ではない

### 初期 target

- popup を開いた時点の active scope target は現在 scope とする
- target の正本は index ではなく scope id とする
- popup 再描画や scope tree 再計算で target が root 等へ戻ってはいけない

### 方向

`Shift+R` の左右方向は `R` と同じ直感に揃える。flat list の前後移動ではない。

| 入力方向 | 意味 |
|---|---|
| parent 側 | active scope target の parent scope へ移動する |
| child 側 | active scope target の child scope へ移動する |
| vertical | scope traversal order 上の前後へ移動する |

child scope が複数ある場合、child 側移動は現在の scope surface 表示順で最初の child scope を選ぶ。parent / child が存在しない方向への入力は、target を変更しない。

---

## 確定時の動作

`Shift+R` release で行うのは scope transition だけである。

```
active scope target を決定
scopeHistory に現在 scope を積む
currentScopeId を active scope target に更新
表示 surface を target scope へ切り替える
```

---

## 禁止事項

`Shift+R` は見た目の scope selection / scope transition であり、map structure mutation ではない。

以下は禁止する。

- selected node を target scope 配下へ reparent する
- selected scope node 自体を target scope 配下へ reparent する
- `parentId` / `children` を変更する
- `applyMoveByParentAndIndex()` を呼ぶ
- `pushUndoSnapshot()` を呼ぶ
- `touchDocument()` を呼ぶ
- PersistedDocument の `savedAt` や map content を更新する
- Undo / Redo 対象にする

`Shift+R` release 後に変更されるのは ViewState と URL scope query だけである。

---

## エラー・境界条件

| ケース | 動作 |
|---|---|
| scope target が存在しない | popup を閉じ、scope 遷移しない |
| parent 方向に parent scope がない | target を維持する |
| child 方向に child scope がない | target を維持する |
| vertical 移動が端に達する | traversal order で wrap してよい |
| IME 入力中 | shortcut を発火しない |
| inline editor / linear editor focus 中 | shortcut を発火しない |

---

## 検証要件

### 必須テスト

1. `R` held 中の wheel / trackpad 入力で active node が移動し、popup が出ないこと
2. `Shift+R` held 中の wheel / trackpad 入力で active scope target が移動すること
3. `Shift+R` release で active scope target に入ること
4. `Shift+R` release 後、selected node / selected scope の `parentId` と親子構造が変わらないこと
5. `Shift+R` の左右方向が parent / child scope の意味に対応すること

### 手動確認

M3E GUI/browser 完了確認では、実ブラウザで以下を確認する。

- popup header が `source label -> target scope label` として更新される
- popup surface 上の selected scope が移動する
- release 後に target scope へ入る
- API readback で対象 node / scope の parent が変化していない

---

## 関連文書

- Scope 遷移仕様: [Scope_Transition.md](Scope_Transition.md)
- Scope/Alias 原則: [Scope_and_Alias.md](Scope_and_Alias.md)
- Map layout modes: [map_layout_modes.md](map_layout_modes.md)
