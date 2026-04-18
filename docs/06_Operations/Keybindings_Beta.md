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
| `j` | `navigateRight`（子方向 / deeper） |
| `k` | `navigateLeft`（親方向 / shallower） |
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
| `Ctrl+[` | `exitScope` |
| `Ctrl+]` | `enterScope` |
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

---

## 特殊キー

| キー | アクション |
|------|------------|
| `Tab` | `addChild` |
| `Enter` | `startEditCursorEnd` |
| `Shift+Enter` | `startEditSelectAll` |
| `Ctrl+Enter` | `cancelAndEditNext`（`Esc` -> `Down` -> `Enter` と同等） |
| `Alt+Enter` | `enterScope` |
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
