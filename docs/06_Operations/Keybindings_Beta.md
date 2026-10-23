# キーバインド（beta）

> キー → アクション名のマッピング。リマップ時はこのファイルを編集する。  
> アクションの説明は [Actions_Beta.md](./Actions_Beta.md) を参照。  
> `—` は未割り当て。

## プラットフォームとモード（2026-09-17）

`Mod` は共通操作用の修飾キーを表す。Mac は **Command**、Windows / Linux は **Control**。
Mac の Control と Command は同義ではない。Windows の Windows キー（Meta）も Control の代替にしない。
両方同時押しや未定義の修飾キー組合せは、修飾なしのノード操作へ読み替えない。

| 操作 | Mac | Windows |
|---|---|---|
| コピー / カット / 貼り付け | Command+C / X / V | Control+C / X / V |
| Undo | Command+Z | Control+Z |
| Redo | Command+Shift+Z | Control+Shift+Z または Control+Y |
| 全選択 | Command+A | Control+A |
| 次ノードの編集 | Command+Enter | Control+Enter |

上表の対象はモードで変わる。Navigate ではノード・マップ、Edit では入力中文字列が対象。
Edit の `Mod+Enter` だけは次ノードへの編集移動となる。
文字入力・文字選択・文字の Undo・IME はブラウザの入力欄が所有する。
ホイールのピンチ判定やポインターの修飾キーは、このキーボード変更の対象外。

モード遷移と確定タイミングの正本は [Actions_Beta.md のモード定義](./Actions_Beta.md#edit--navigate-のモード定義2026-09-17)。
以下の割り当て表は、特記がなければ **Navigate** のもの。

---

## Grab のキー割り当て（2026-10-16）

[Actions_Beta.md](./Actions_Beta.md) に Grab の要求仕様を追加した。Navigate で M を押している間、方向キーで選択部分木を移動し、M 解放で Navigate へ戻る。

単体 `m` の移動元指定をGrabへ置換することをユーザーが確定。単体 M → P は廃止し、移動元指定は既存の `Mod+M`、親への適用は `P` に残す。`Alt+M` は別の既存操作として維持。Edit 中の M は文字入力。Grab 中は方向キーで移動し、M解放またはフォーカス喪失で1回のUndoとして確定、Escapeで今回の移動を取り消す。

## 単体キー（a–z）

| キー | アクション |
|------|------------|
| `a` | `addAliasAsChild` |
| `b` | — |
| `c` | — |
| `d` | — |
| `e` | — |
| `f` | `toggleFolder` |
| `g` | — |
| `h` | — |
| `i` | `toggleMetaPanel` |
| `j` | tree: `navigateRight` / system: `increaseSystemDetail` |
| `k` | tree: `navigateLeft` / system: `decreaseSystemDetail` |
| `l` | `markLinkSource` |
| `m` 保持 | `Grab`（Treeの選択部分木を方向キーで移動） |
| `n` | — |
| `o` | — |
| `p` | `applyReparent` |
| `q` | — |
| `r` | — |
| `s` | — |
| `t` | — |
| `u` | — |
| `v` | — |
| `w` | — |
| `x` | — |
| `y` | — |
| `z` | — |

---

## Mod + キー

| キー | アクション |
|------|------------|
| `Mod+a` | `selectAll` |
| `Mod+b` | — |
| `Mod+c` | `copy`（部分木と subtree 内 link を structured clipboard にコピー） |
| `Mod+d` | — |
| `Mod+e` | — |
| `Mod+f` | — |
| `Mod+g` | `groupSelected` |
| `Mod+h` | — |
| `Mod+i` | — |
| `Mod+j` | — |
| `Mod+k` | — |
| `Mod+l` | — |
| `Mod+m` | `toggleReparentSource`（移動元の指定を切替） |
| `Mod+n` | — |
| `Mod+o` | `openSelectedHyperlinkNode` |
| `Mod+p` | — |
| `Mod+q` | — |
| `Mod+r` | — |
| `Mod+s` | `downloadJson` |
| `Mod+t` | — |
| `Mod+u` | — |
| `Mod+v` | `paste`（同一タブまたは structured clipboard から貼り付け） |
| `Mod+w` | — |
| `Mod+x` | `cut` |
| `Ctrl+y`（Windows / Linux のみ） | `redo` |
| `Mod+z` | `undo` |
| `Mod+Shift+c` | `copyNodePath` |
| `Mod+Shift+i` | `copyScopeId` |
| `Mod+Shift+z` | `redo` |
| `Mod+Shift+t` | `generateRelatedTopics` |
| `Shift+l`（Mod なし） | `applyMarkedLink` |
| `Mod+Alt+c` | `copyNodePath`（Mac-safe 代替。Option 入力は物理キーで判定） |
| `Mod+Alt+i` | `copyScopeId`（Mac-safe 代替。Option 入力は物理キーで判定） |
| `Mod+0` | `fitAll` |

---

## ブラウザ標準（Chrome / Edge へパススルー）

M3E が `preventDefault()` していないため、通常のブラウザ操作として動作する。

| キー | ブラウザ動作 |
|------|--------------|
| `Mod+f` | ページ内検索 |
| `Ctrl+h`（Windows） / `Command+y`（Mac） | 履歴を開く |
| `Mod+l` | アドレスバーへフォーカス |
| `Mod+r` | 再読み込み |
| `F5` | 再読み込み |
| `Mod+t` | 新しいタブ |
| `Mod+w` | 現在のタブを閉じる |

補足: `Mod+s` は M3E の `downloadJson`、`Mod+0` は `fitAll` として扱うためブラウザ標準動作ではない。

---

## 数字キー・記号キー

| キー | アクション |
|------|------------|
| `1` | `thinkingFlash` |
| `2` | `thinkingRapid` |
| `3` | `thinkingDeep` |
| `4`–`9` | — |
| `0` | `zoomReset` (100%) |
| `-` | `zoomOut` |
| `=` / `+` | `zoomIn` |
| `[` | `exitScope` |
| `]` | `enterScope` |

---

## 特殊キー

| キー | アクション |
|------|------------|
| `Tab` | `addChild` |
| `Enter` | `startEditCursorEnd` |
| `Shift+Enter` | `startEditSelectAll` |
| `Mod+Enter` | `finishAndEditNext`（`Esc` -> `Down` -> `Enter` と同等。編集中の内容は保持） |
| `Alt+J` | `jumpToAliasTarget` |
| `Alt+A` | `addAliasAsChild` |
| `Alt+V` | `cycleView`（graph全体 → 選択ノード＋表示中の子孫 → graph＋linear panel → 選択ノード） |
| `Alt+Shift+V` | `cycleView` を逆順に巡回 |
| `Alt+M` | `holdReparent` |
| `Alt+P` | `toggleFolder`（`F` と同じ） |
| `F2` | node選択: `startEditSelectAll`。Connection 選択: 選択した Connection の label編集（下記参照） |
| `Space` | `toggleCollapse` |
| `Delete` | `delete` |
| `Backspace` | `delete` |
| `Escape` | `cancelCut` |

| `Mod (hold 400ms)` | `showShortcutCheatsheet` |
| `Alt (hold 400ms)` | `showShortcutCheatsheet` |

補足: `addSibling` は通常モードでは割り当てず、編集モード中の `Enter` に限定する。

---

## 矢印キー

### Connection の選択・編集

board が入力を持つときの操作。入力欄・IME変換中には適用しない。
Tree / Axial / System / Disperse / Lane の描画されている対象に共通。

| キー | node 選択中 / Connection 選択中の動作 |
|---|---|
| `Alt+←` / `Alt+→` | 起点nodeに接続する描画線を逆順 / 正順に巡回 |
| `Alt+↑` / `Alt+↓` | 親へのedge / 子へのedgeを選択 |
| 矢印 | Connection 選択中は、対応する描画端のnodeへ移動。対応しない方向では移動しない |
| `Esc` | Connection 選択前のnodeへ戻る |
| `F2` | 選択した Connection（集約 GraphLink を除く）のラベルを編集 |
| `[` / `]` | 単一GraphLinkのsource / target portを right → bottom → left → top で巡回 |
| `Shift+S` | 単一GraphLinkのstyleを default → dashed → soft → emphasis で巡回 |
| `Shift+B` | 単一GraphLinkのdirectionを none → forward → backward → both で巡回 |
| `Delete` / `Backspace` | 単一GraphLinkを削除。親子edgeの削除は禁止 |
| `Mod+Z` / `Mod+Shift+Z` | 変更をUndo / Redo |

線ラベル入力中はEnter / フォーカス移動で確定、Escで取消。
前後の空白を除き、空文字ならラベルを解除する。無変更・取消は履歴を追加しない。
複数GraphLinkを表す集約線は件数を表示し、全編集とport操作を拒否する。
読み取り専用では選択・移動だけを許可する。非描画端への移動は理由を表示して拒否し、
自動展開やscope変更はしない。Connection 選択中のnode変更キーはnodeを選び直すまで拒否する。

### tree surface

| キー | アクション |
|------|------------|
| `↑` | `navigateUp` |
| `↓` | `navigateDown` |
| `←` | `navigateLeft` |
| `→` | `navigateRight` |
| `Shift+↑` | `extendSelectionUp` |
| `Shift+↓` | `extendSelectionDown` |
| `Shift+←` | — |
| `Shift+→` | — |

補足:

- tree では `→` は通常どおり deeper 移動。folder を選択していて、かつそのノードに子が無い場合だけ `enterScope` として扱う。
- tree では `[` / `]` でも scope を出入りできる。
- tree では `J` / `K` は child / parent 方向の移動。

### system surface（`m3e:layout=flow-lr`）

| キー | アクション |
|------|------------|
| `←` | `navigateLeft`（左隣へ移動） |
| `→` | `navigateRight`（右隣へ移動） |
| `↑` | `navigateUp`（上段へ移動） |
| `↓` | `navigateDown`（下段へ移動） |
| `Shift+↑` | `extendSelectionUp` |
| `Shift+↓` | `extendSelectionDown` |
| `[` | `exitScope` |
| `]` | `enterScope` |

補足:

- system surface では矢印キーは flow 配置上の移動に専用化される。
- system surface では `→` による `enterScope` は行わず、subsystem の出入りは `[` / `]` に統一する。
- system surface では `J` / `K` は詳細度の上げ下げ。`J` で subsystem box 内の 1 段下 preview を開き、`K` で閉じる。
