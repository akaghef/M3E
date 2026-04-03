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
| `e` | `toggleCollapse` |
| `f` | — |
| `g` | — |
| `h` | — |
| `i` | — |
| `j` | — |
| `k` | — |
| `l` | — |
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
| `Ctrl+s` | — |
| `Ctrl+t` | — |
| `Ctrl+u` | — |
| `Ctrl+v` | `paste` |
| `Ctrl+w` | — |
| `Ctrl+x` | `cut` |
| `Ctrl+y` | `redo` |
| `Ctrl+z` | `undo` |
| `Ctrl+Shift+z` | `redo` |
| `Ctrl+[` | `exitScope` |
| `Ctrl+]` | `enterScope` |

---

## 数字キー

| キー | アクション |
|------|------------|
| `1` | `thinkingFlash` |
| `2` | `thinkingRapid` |
| `3` | `thinkingDeep` |
| `4`–`9` | — |

---

## 特殊キー

| キー | アクション |
|------|------------|
| `Tab` | `addChild` |
| `Enter` | `startEditCursorEnd` |
| `Shift+Enter` | `startEditSelectAll` |
| `Ctrl+Enter` | `cancelAndEditNext`（`Esc` -> `Down` -> `Enter` と同等） |
| `Alt+Enter` | `enterScope` |
| `Alt+A` | `addAliasAsChild` |
| `Alt+V` | `cycleView`（focus → fit all のトグル） |
| `Alt+M` | `holdReparent` |
| `Alt+P` | `makeFolder` |
| `F2` | `startEditSelectAll` |
| `Space` | `toggleCollapse` |
| `Delete` | `delete` |
| `Backspace` | `delete` |
| `Escape` | `cancelCut` |

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
