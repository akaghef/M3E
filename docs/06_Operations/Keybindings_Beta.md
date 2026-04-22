# キーバインド（beta）

> キー → アクション名のマッピング。リマップ時はこのファイルを編集する。  
> アクションの説明は [Actions_Beta.md](./Actions_Beta.md) を参照。  
> `—` は未割り当て。

---

## 単体キー（a–z）

| キー | アクション |
|------|------------|
| `a` | — |
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

## Ctrl / Cmd + キー

| キー | アクション |
|------|------------|
| `Ctrl+a` | `selectAll` |
| `Ctrl+b` | — |
| `Ctrl+c` | `copy` |
| `Ctrl+d` | — |
| `Ctrl+e` | — |
| `Ctrl+f` | — |
| `Ctrl+g` | `groupSelected` |
| `Ctrl+h` | — |
| `Ctrl+i` | — |
| `Ctrl+j` | — |
| `Ctrl+k` | — |
| `Ctrl+l` | — |
| `Ctrl+m` | — |
| `Ctrl+n` | — |
| `Ctrl+o` | — |
| `Ctrl+p` | — |
| `Ctrl+q` | — |
| `Ctrl+r` | — |
| `Ctrl+s` | `downloadJson` |
| `Ctrl+t` | — |
| `Ctrl+u` | — |
| `Ctrl+v` | `paste` |
| `Ctrl+w` | — |
| `Ctrl+x` | `cut` |
| `Ctrl+y` | `redo` |
| `Ctrl+z` | `undo` |
| `Ctrl+Shift+c` | `copyNodePath` |
| `Ctrl+Shift+i` | `copyScopeId` |
| `Ctrl+Shift+z` | `redo` |
| `Ctrl+Shift+t` | `generateRelatedTopics` |
| `Ctrl+Shift+l` | `applyMarkedLink` |
| `Ctrl+0` | `fitAll` |

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
| `Ctrl+Enter` | `cancelAndEditNext`（`Esc` -> `Down` -> `Enter` と同等） |
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

| `Ctrl (hold 400ms)` | `showShortcutCheatsheet` |
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
