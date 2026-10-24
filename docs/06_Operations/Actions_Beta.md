# アクション定義（beta）

> アクション名 → 説明のリスト。アルファベット順。  
> キーへの割り当ては [Keybindings_Beta.md](./Keybindings_Beta.md) を参照。
> `Mod` = Mac の Command / Windows・Linux の Control。両者を同時に別名として扱わない。

---

| アクション | 説明 | 備考 |
|------------|------|------|
| `addAliasAsChild` | 選択ノードを参照するエイリアスを選択ノード自身の子として作成 | `addAliasInCurrentScope`（scope root の子）とは挿入先が異なる。alias ノードは対象外 |
| `addChild` | 選択ノードの子を追加して編集開始 | depth 方向に展開 |
| `addSibling` | 選択ノードの兄弟を追加して編集開始 | breadth 方向に展開。`Enter`（編集モード中）で実行 |
| `applyReparent` | `markReparent` でマークしたノードを現在の選択ノードの子として移動 | `markReparent` とセットで使用。循環移動は拒否 |
| `cancelCut` | カット状態（`cut` で予約した移動）をキャンセル | |
| `finishAndEditNext` | `Esc` -> `Down` -> `Enter` を連続実行したのと同等の動作 | Navigate では cut 解除 -> 次ノード選択 -> 編集開始。Edit では編集確定 -> 次ノード選択 -> 編集開始。いずれも文末カーソル。旧 `cancelAndEditNext` の変更破棄という記述は廃止 |
| `cycleView` | graph全体 → 選択ノード＋表示中の子孫 → graph＋linear panel → 選択ノード | `Alt+V`。`Alt+Shift+V` は逆順 |
| `copyNodePath` | 選択ノードのルートからのパス（`A / B / C` 形式）をクリップボードにコピー | `Mod+Shift+C` / `Mod+Alt+C`（Mac-safe 代替） |
| `copyScopeId` | 現在のスコープの ID をクリップボードにコピー | `Mod+Shift+I` / `Mod+Alt+I`（Mac-safe 代替） |
| `copy` | 選択ノードの部分木をクリップボードにコピー | システムクリップボードには M3E structured clipboard をコピー。node 状態と subtree 内で完結する link を含む |
| `cut` | 選択ノードを移動予約（カット）。`paste` で移動先に確定する | ノードはグレーアウト表示。`Esc` でキャンセル |
| `delete` | 選択ノードの部分木を削除 | 複数選択中は selection root をすべて削除。root ノードは削除不可。`Backspace` で scope root を選択中かつ scope 履歴あり → scope を一段上に戻る |
| `enterScope` | 選択ノードが持つ subsystem / folder scope に入る | 既定キーは `]`。tree surface では folder 選択時に `→` でも入れるが、子が無い場合に限る。system surface では `→` は移動専用 |
| `exitScope` | scope を一段上に戻る | 既定キーは `[` |
| `extendSelectionDown` | 選択範囲を breadth 方向に1ノード下へ拡張 | `navigateDown` との違い：単一選択に戻さず範囲を広げる |
| `extendSelectionUp` | 選択範囲を breadth 方向に1ノード上へ拡張 | `navigateUp` との違い：単一選択に戻さず範囲を広げる |
| `groupSelected` | 選択ノードを新しい共通親ノードにまとめる | 2ノード以上選択時のみ有効。新ノードの名前入力が開始される |
| `downloadJson` | 現在のドキュメントを JSON ファイルとしてダウンロード | `Mod+S` で実行 |
| `jumpToAliasTarget` | エイリアスノードの参照先ノードへジャンプ | alias 以外では無効 |
| `toggleFolder` | 選択ノードの folder スコープをトグル（folder ↔ 通常） | alias ノードは対象外。旧名 `makeFolder` |
| `zoomIn` | ズームイン | `=` / `+` キー |
| `zoomOut` | ズームアウト | `-` キー |
| `zoomReset` | ズームを 100% にリセット | `0` キー |
| `fitAll` | 現在のスコープのgraph全体が画面に収まるようフィット（linear panelを除く） | `Mod+0` |
| `toggleMetaPanel` | メタパネルの表示/非表示をトグル | `I` キー |
| `holdReparent` | ホールド未設定 → 選択ノードをホールド。ホールド済み → ホールドノードを現在選択ノードの子として reparent | `Alt+M` でトグル操作。`Esc` でキャンセル |
| `markReparent` | 選択ノードを reparent の移動元としてマーク | 複数選択中は全選択ノードをマーク。その後 `applyReparent` で実行 |
| `toggleReparentSource` | 選択ノードの移動元指定を切り替える | `Mod+M` |
| `openSelectedHyperlinkNode` | 選択ノードのハイパーリンクを開く | `Mod+O` |
| `navigateDown` | 選択を1ステップ下方向へ移動 | tree surface では breadth 方向（兄弟）の次ノード。system surface では下段候補へ移動。単一選択に戻す |
| `navigateLeft` | 選択を1ステップ左方向へ移動 | tree surface では親方向。scope root では `exitScope`。system surface では左隣候補へ移動 |
| `navigateRight` | 選択を1ステップ右方向へ移動 | tree surface では第一子方向。folder 選択時は `enterScope` を優先するが、子が無い場合のみ。system surface では右隣候補へ移動 |
| `navigateUp` | 選択を1ステップ上方向へ移動 | tree surface では breadth 方向（兄弟）の前ノード。system surface では上段候補へ移動。単一選択に戻す |
| `increaseSystemDetail` | system surface の詳細度を1段上げる | `J`。`flow-lr` surface で subsystem box 内の immediate child preview を表示 |
| `decreaseSystemDetail` | system surface の詳細度を1段下げる | `K`。`flow-lr` surface で subsystem preview を閉じる |
| `paste` | クリップボードの内容を primary 選択ノードの子として挿入 | `copy` 後 → 部分木と内部 link をクローン挿入（新 ID 発行）。別タブの M3E structured clipboard も読める。`cut` 後 → reparent を実行して移動確定（一度きり） |
| `redo` | 直前の Undo を取り消す（Redo） | |
| `selectAll` | 現在の scope 内の全可視ノードを選択 | |
| `startEditCursorEnd` | 選択ノードのテキスト編集を開始（カーソルを文末に配置） | `Enter` で起動。複数選択中は primary のみ対象 |
| `startEditSelectAll` | 選択ノードのテキスト編集を開始（テキスト全選択） | `Shift+Enter` / `F2` で起動。複数選択中は primary のみ対象 |
| `thinkingDeep` | 思考モードを deep（深掘り）に切り替え | |
| `thinkingFlash` | 思考モードを flash（素早い発想）に切り替え | |
| `thinkingRapid` | 思考モードを rapid（標準）に切り替え | |
| `showShortcutCheatsheet` | ショートカット一覧をオーバーレイ表示 | Mod または Alt を単体で 400ms 長押しすると表示。キーを離すと閉じる |
| `toggleCollapse` | 選択ノードの折り畳み／展開をトグル | 複数選択中は全選択ノードに適用 |
| `undo` | 直前の操作を取り消す | |

---

## マウス・ポインター操作

| 操作 | 説明 | 備考 |
|------|------|------|
| クリック | ノードを単一選択 | アンカーをリセット |
| `Mod` + クリック | ノードを選択にトグル追加／除外 | アンカーをクリックしたノードに更新 |
| `Shift` + クリック | アンカー〜クリックしたノードの範囲を選択 | `visibleOrder`（表示順）で範囲を決定 |
| ダブルクリック | 子なし → `startEdit` / 子あり → `enterScope` | |
| ノードをドラッグ → ドロップ | ドロップ先の子として reparent | |
| 背景をドラッグ | キャンバスをパン | |
| `Mod` + ホイール | ズームイン／アウト | ポインター位置を中心にズーム |
| ホイール（縦） | 上下スクロール（pan Y） | |
| ホイール（横） | 左右スクロール（pan X） | |

---

## Edit / Navigate のモード定義（2026-09-17）

ノードラベル編集を対象とする。Edit 中も対象ノードの選択は維持する。
Navigate はノードを選択・移動・操作する状態、Edit は選択ノードの文字列を編集する状態。
モードの正本は編集セッションであり、DOM フォーカス・SVG/WebGL・描画フレームの完了ではない。

### Navigate：ノードを選択中

| キー | 動作 | 次のモード |
|---|---|---|
| 矢印 | 選択ノードを移動 | Navigate |
| Shift+↑ / ↓ | ノードの選択範囲を拡張 | Navigate |
| Enter | 選択ノードの文末から編集 | Edit：同じノード |
| Shift+Enter / F2 | 選択ノードの文字列を全選択して編集 | Edit：同じノード |
| Tab / Shift+Tab | 子を1つ追加して編集（Shift+Tab は従来互換） | Edit：新しい子 |
| Mod+Enter | cut 解除、次ノードを選択して文末から編集 | Edit：移動先 |
| Escape | cut 予約を解除。ノード選択は保持 | Navigate |
| Delete / Backspace | 選択部分木を削除。root 保護、Backspace の scope 戻りは既存条件を維持 | Navigate |
| Mod+C / X / V / A / Z | 部分木コピー / カット / 貼付 / 全ノード選択 / マップ Undo | Navigate |
| 文字キー | 定義済みの操作のみ。自動で Edit に入らない | Navigate |

### Connection を選択・編集中

Connection 選択はnode編集とは別の対象を持つ。Alt+矢印で Connection を選択し、
F2でそのラベルを編集する。編集開始時の対象を固定し、親子edgeはchildの
`m3e:edge-label`、GraphLinkは`label`だけを変更する。Enter / blurで確定、Escで取消。
node編集のEsc（変更を保持）と混同しない。
単一GraphLinkのport・style・direction・Deleteは既存のUndo・保存経路に接続する。
集約線の編集、親子edgeのDelete、読み取り専用の変更は拒否する。
詳細な割当と巡回順は [Keybindings Beta](Keybindings_Beta.md#connection-の選択編集)。

### Edit：ノードの文字列を編集中

| キー | 動作 | 次のモード |
|---|---|---|
| 文字入力 / 矢印 / Shift+矢印 / Delete / Backspace | 文字入力・カーソル移動・文字選択・文字削除 | Edit：同じノード |
| Enter | 編集確定、兄弟を1つ追加して編集 | Edit：新しい兄弟 |
| Tab / Shift+Tab | 編集確定、子を1つ追加して編集（Shift+Tab は従来互換） | Edit：新しい子 |
| Mod+Enter | 編集確定、次ノードへ移動して文末から編集 | Edit：移動先 |
| Escape | **変更を保持・確定して編集終了**。キャンセルや Undo ではない | Navigate：同じノード |
| Shift+Enter | 改行 | Edit：同じノード |
| Mod+C / X / V / A / Z | ブラウザ標準の文字コピー / カット / 貼付 / 全文字選択 / 文字 Undo | Edit：同じノード |

### Grab：選択部分木をつかんで移動する状態（2026-10-16 採用）

Navigate・Edit に加える利用者向けの操作状態。Grab は、選択ノードとその全子孫をひとまとまりでつかみ、方向入力で構造上の配置を変える状態を指す。つかんだ直後、まだ移動していない時も Grab に含む。

`node move` は `reparent`（親の変更）と `reorder`（同じ親の下での兄弟順の変更）の総称。いずれも選択ノードを根とする部分木全体を移動し、部分木内の親子関係と順序を保持する。折りたたまれて見えない子孫も移動対象に含む。

| 入力（要求仕様） | 動作 | 次の状態 |
|---|---|---|
| Navigate で M を押す | 選択ノードを根とする部分木をつかむ | Grab |
| M を保持して方向キー | 表示上の方向に対応する reparent / reorder。選択はつかんだノードに維持する | Grab |
| M を保持して続けて方向キー | 同じ部分木をつかんだまま移動を続ける | Grab |
| M を離す / フォーカスを失う | 現在位置で確定・保存。保持中の連続移動全体を1回のUndoにする | Navigate：同じノード |
| Escape | 今回のGrabを取り消し、開始位置・選択・折りたたみ状態へ戻す | Navigate |
| 解放後の方向キー | 通常の選択ナビゲーション | Navigate |

方向はTreeの表示配置に従う。右・左へ子が伸びる表示では上下が兄弟順、子の伸びる向きが子側、その逆が親側となる。上・下へ子が伸びる表示では左右が兄弟順。left/right・up/downでは選択ノードが属する枝の側で親子方向を決め、同じ側の表示兄弟を対象にする。兄弟順の移動は実際の画面座標順に従う。

子側へは表示上の直前の兄弟の末尾の子へ移す。ただし先頭の兄弟なら直後の兄弟の末尾の子へ移す（2026-10-16ユーザー指定）。候補の兄弟がいなければ動かさない。親側へは現在の親の直後へ出す。map root・表示中のscope rootは動かさず、scopeの外へ出さない。

対象はTreeの選択ノードを根とする1つの部分木。独立した複数の選択部分木や非Tree面ではGrabを開始せず、その旨を表示する。ポインターによる複数選択ドラッグは既存のまま。未移動のGrabは保存もUndo履歴も作らない。保持中は選択移動・他の編集ショートカットを実行しない。クリックや入力欄へのフォーカス移動はGrabを確定してから次の操作へ移る。

保持中の構造変更はプレビューであり、autosave・他タブへの状態配信を保留する。M解放・フォーカス喪失時に既存の保存処理へ渡す。外部のマップ置換が届いた場合は未確定Grabを取り消して外部状態を適用し、M解放で古い状態を復元しない。

Edit 中の M は文字入力であり、Grab を開始しない。Grab の操作契約は SVG / WebGL に依存しない。内部状態 `Dragging` はポインター移動中の仮位置・drop 候補を扱う状態であり、Grab と同義の名称として扱わない。

**キーの移行**：2026-10-16ユーザー確定により、単体Mの移動元指定をGrabへ置換する。従来の単体M → P操作は廃止。移動元を指定して親を選ぶ操作自体は既存Mod+M → Pで使用できる。Alt+Mの既存操作も維持する。

### 境界条件と実装契約

- IME 変換中は Enter / Escape / Tab をノード操作にしない。文字入力側に委ねる。
- 編集欄からの blur は内容を確定して Navigate へ戻る。削除に伴う再入 blur は、終了済み編集や次の編集を確定し直さない。
- Edit で受けたキーは、その処理で編集欄を削除しても Navigate に伝播しない。1回のキー入力でノードを二重作成しない。
- 新規ノードの編集開始は最新 map / layout を参照する。古い WebGL snapshot に存在しないことを理由に拒否しない。
- 入力ごとの変更は対象ノードの draft とプレビューのみ。全体 layout・保存・Undo の更新は確定時。
- root に兄弟は作れないため、root 編集中の Enter は既存どおり子作成。alias への子作成は禁止し、作成失敗を別の作成操作に読み替えない。
- 次ノードがない場合は既存の選択移動規則に従い、現在ノードの Edit に留まる。
- メニュー・ダイアログ・edge ラベル編集は別の入力所有者。edge ラベルの Escape による破棄は今回変更しない。
- 非修飾キーへのフォールスルーは禁止。例：Mac の Control+Enter、Mod+Tab、Alt+Enter（ノードラベル編集中）でノードを追加しない。

この節は、以前の「Escape / Mod+Enter でノードラベル変更を破棄」という記述を置き換える。
描画方式の変更で本契約を変更しない。SVG と WebGL の両方で、編集後の内容・選択・ノード作成数・次のモードを検証する。

### Fit の対象と巡回

通常の自動フィットと `Mod+0` は graph 全体を対象にし、linear panel を含めない。
`Alt+V` の初回は graph 全体、逆送りの初回は選択ノード。手動パン・ズーム、map 読み込み、scope 移動、自動フィットで巡回をリセットする。選択変更だけでは巡回位置を維持する。

選択対象が描画されていない場合は選択系を、linear panel が非表示の場合は panel 込みをスキップする。子孫は現在表示中の範囲とし、折りたたみや scope 境界は開かない。選択ノード単独は最大100%で fit する。各 fit は固定UIを避けた表示領域へ収め、対象をステータスに表示する。
