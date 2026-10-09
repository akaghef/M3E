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
| `m` | `markReparent` |
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
| `Alt+V` | `cycleView`（focus → fit all のトグル） |
| `Alt+M` | `holdReparent` |
| `Alt+P` | `toggleFolder`（`F` と同じ） |
| `F2` | `startEditSelectAll` |
| `Space` | `toggleCollapse` |
| `Delete` | `delete` |
| `Backspace` | `delete` |
| `Escape` | `cancelCut` |

| `Mod (hold 400ms)` | `showShortcutCheatsheet` |
| `Alt (hold 400ms)` | `showShortcutCheatsheet` |

補足: `addSibling` は通常モードでは割り当てず、編集モード中の `Enter` に限定する。

---

## 矢印キー

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
