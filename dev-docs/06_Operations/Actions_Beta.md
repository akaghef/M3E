# アクション定義（beta）

> アクション名 → 説明のリスト。アルファベット順。  
> キーへの割り当ては [Keybindings_Beta.md](./Keybindings_Beta.md) を参照。

---

| アクション | 説明 | 備考 |
|------------|------|------|
| `addAliasAsChild` | 選択ノードを参照するエイリアスを選択ノード自身の子として作成 | `addAliasInCurrentScope`（scope root の子）とは挿入先が異なる。alias ノードは対象外 |
| `addChild` | 選択ノードの子を追加して編集開始 | depth 方向に展開 |
| `addSibling` | 選択ノードの兄弟を追加して編集開始 | breadth 方向に展開 |
| `applyReparent` | `markReparent` でマークしたノードを現在の選択ノードの子として移動 | `markReparent` とセットで使用。循環移動は拒否 |
| `cancelCut` | カット状態（`cut` で予約した移動）をキャンセル | |
| `cycleView` | 1回目: 選択ノードを中央にフォーカス / 2回目: 全体フィット（交互にトグル） | `Alt+V` で連打 |
| `copy` | 選択ノードの部分木をクリップボードにコピー | システムクリップボードにはテキストラベルをコピー。alias/link メタデータは含まない |
| `cut` | 選択ノードを移動予約（カット）。`paste` で移動先に確定する | ノードはグレーアウト表示。`Esc` でキャンセル |
| `delete` | 選択ノードの部分木を削除 | 複数選択中は selection root をすべて削除。root ノードは削除不可。`Backspace` で scope root を選択中かつ scope 履歴あり → scope を一段上に戻る |
| `enterScope` | 選択ノードを scope として設定（scope に入る） | |
| `exitScope` | scope を一段上に戻る | |
| `extendSelectionDown` | 選択範囲を breadth 方向に1ノード下へ拡張 | `navigateDown` との違い：単一選択に戻さず範囲を広げる |
| `extendSelectionUp` | 選択範囲を breadth 方向に1ノード上へ拡張 | `navigateUp` との違い：単一選択に戻さず範囲を広げる |
| `groupSelected` | 選択ノードを新しい共通親ノードにまとめる | 2ノード以上選択時のみ有効。新ノードの名前入力が開始される |
| `makeFolder` | 選択ノードを folder スコープに変換 | alias ノード・既に folder のノードは対象外 |
| `holdReparent` | ホールド未設定 → 選択ノードをホールド。ホールド済み → ホールドノードを現在選択ノードの子として reparent | `Alt+M` でトグル操作。`Esc` でキャンセル |
| `markReparent` | 選択ノードを reparent の移動元としてマーク | 複数選択中は全選択ノードをマーク。その後 `applyReparent` で実行 |
| `navigateDown` | breadth 方向（兄弟）で1つ後のノードへ移動 | 単一選択に戻す |
| `navigateLeft` | depth 方向で親ノードへ移動 | scope root にいる場合は `exitScope` |
| `navigateRight` | depth 方向で第一子ノードへ移動 | folder ノードの場合は `enterScope` |
| `navigateUp` | breadth 方向（兄弟）で1つ前のノードへ移動 | 単一選択に戻す |
| `paste` | クリップボードの内容を primary 選択ノードの子として挿入 | `copy` 後 → 部分木をクローン挿入（新 ID 発行）。`cut` 後 → reparent を実行して移動確定（一度きり） |
| `redo` | 直前の Undo を取り消す（Redo） | |
| `selectAll` | 現在の scope 内の全可視ノードを選択 | |
| `startEdit` | 選択ノードのテキスト編集を開始 | 複数選択中は primary のみ対象 |
| `thinkingDeep` | 思考モードを deep（深掘り）に切り替え | |
| `thinkingFlash` | 思考モードを flash（素早い発想）に切り替え | |
| `thinkingRapid` | 思考モードを rapid（標準）に切り替え | |
| `toggleCollapse` | 選択ノードの折り畳み／展開をトグル | 複数選択中は全選択ノードに適用 |
| `undo` | 直前の操作を取り消す | |

---

## マウス・ポインター操作

| 操作 | 説明 | 備考 |
|------|------|------|
| クリック | ノードを単一選択 | アンカーをリセット |
| `Ctrl/Cmd` + クリック | ノードを選択にトグル追加／除外 | アンカーをクリックしたノードに更新 |
| `Shift` + クリック | アンカー〜クリックしたノードの範囲を選択 | `visibleOrder`（表示順）で範囲を決定 |
| ダブルクリック | 子なし → `startEdit` / 子あり → `enterScope` | |
| ノードをドラッグ → ドロップ | ドロップ先の子として reparent | |
| 背景をドラッグ | キャンバスをパン | |
| `Ctrl/Cmd` + ホイール | ズームイン／アウト | ポインター位置を中心にズーム |
| ホイール（縦） | 上下スクロール（pan Y） | |
| ホイール（横） | 左右スクロール（pan X） | |

---

## インライン編集中のキー

編集モード（`startEdit` 後）は通常モードとは別のキーマップになる。

| キー | 動作 |
|------|------|
| `Enter` | 編集を確定 |
| `Escape` | 編集をキャンセル（変更破棄） |
| `Shift+Enter` | 改行を挿入 |
| その他 | ブラウザ標準のテキスト入力（Ctrl+C/V/Z なども通常通り動作） |
