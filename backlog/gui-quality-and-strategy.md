# GUI quality and strategy — backlog

M3E viewer/editor の GUI 関連 idea と改善戦略の集約。
今回の Chrome 実演で見えた `alias jump -> n=7 node add -> Cmd+0 fit` を、今後の標準 GUI スモークとして扱う。

## 0. 直近で分かったこと

- `Cmd+0` が `fitAll` の正操作。
- `Alt+V` は `cycleView` であり、fit all と混同しない。
- `Tab -> text input -> Escape` が、子ノード追加と編集確定の安定操作。
- 編集中 `Enter` は sibling 追加挙動が混ざるため、手動テストでは注意が必要。
- DOM 上にノードが存在するだけでは不十分。実際に viewport 内で読めることを確認する必要がある。

## 1. 標準 GUI スモーク候補

最小シナリオ:

1. M3E を Chrome で開く。
2. alias node をクリックして選択する。
3. `Alt+J` で target scope へ jump する。
4. target node 配下に `n=1` から `n=7` まで手動追加する。
5. `Cmd+0` を実行する。
6. 以下を確認する。

期待:

- URL に `scope=<target scope>` が入る。
- meta が `selected: Inside Target` になる。
- status が `Jumped to target: Inside Target` になる。
- node count が `4 -> 11` になる。
- `n=1` から `n=7` が全て画面内に見える。
- toolbar / linear panel / canvas edge に主要ノードが食われない。

このシナリオは、自動 Playwright だけでなく AI GUI テスト / Chrome 目視でも回す。

## 2. 最優先課題

### 2.1 Fit / camera の正規化

- `Cmd+0` を fit all の正本として docs / tests / UI 表示で統一する。
- fit 対象 viewport から toolbar と linear panel の占有領域を除外する。
- scope root / selected node / children が全て読める framing を保証する。
- `Alt+V` は cycle view として扱い、fit all の代替にしない。
- 編集中の active node は常に主役として扱う。ノード追加やテキスト編集で active node が safe viewport から外れそうになったら、ズームは維持したまま camera を smooth に寄せる。
- zoom / pan 中は通常の web page scroll 並みに軽くする。map の構造やノード内容が変わっていない限り、毎フレーム node position 再計算や DOM 再構築を走らせない。

### 2.2 操作系の正本化

- `Cmd+0`: fitAll
- `Alt+J`: jumpToAliasTarget
- `Tab`: addChild
- `Escape`: inline edit 確定 / 終了
- `Enter`: start edit または編集中 sibling 系挙動。手動テストでは確定操作に使わない。

docs, tests, user-facing explanation, implementation を一致させる。

### 2.3 GUI テスト三層化

- Unit: layout / command / save-load / scope transition。
- Playwright: shortcut / DOM state / regression。
- AI GUI test: Chrome 上で実操作に近くクリック・キー入力し、スクショ目視する。

「通過」の条件に、DOM state だけでなく screenshot 目視を入れる。

## 3. Viewer / Layout 戦略

### 3.1 LayoutStrategy 化

`buildLayout()` を strategy pattern に分離する。

優先順:

1. `right-tree` を抽出して既存挙動を維持。
2. `down-tree` を追加。
3. `balanced-tree` を追加。
4. `outline` を追加。
5. `fishbone`, `timeline`, `matrix` は要件具体化後。

参照: `docs/03_Spec/map_layout_modes.md`

### 3.2 scope 単位 layout

- `AppState.layoutMode` と `AppState.layoutModeByScope` を検討する。
- folder/scope ごとに layout を保存できるようにする。
- scope 移動で layout が変わる場合は camera reset / fit を明示的に走らせる。

### 3.3 linear panel との干渉

- 現状、linear panel が fit / 目視を邪魔するケースがある。
- fit all は board 全体ではなく「実際に読める作業領域」に合わせる。
- panel visible / hidden 両方の GUI テストを用意する。

## 4. Visual design 戦略

### 4.1 構造優先

- 装飾より hierarchy / selection / drag / edit を優先する。
- 色は意味に使いすぎない。
- selection は常に最強の視覚状態にする。

参照: `docs/04_Architecture/Visual_Design_Guidelines.md`

### 4.2 hit area と visible label

- 操作対象は `text` ではなく `rect.node-hit` を第一級に扱う。
- ラベルが見えるのに hit しづらい、または hit area が見えない、というズレを潰す。
- GUI テストも visible label と hit rect の両方を確認する。

### 4.3 metadata の表示圧

- node label は primary text に寄せる。
- `details`, `note`, `attributes`, `link` は side panel / inspector に逃がす。
- `note:` の inline 表示が地図の可読性を落とす場合は、表示モードを切る。

## 5. Interaction ideas

### 5.1 subsystem UI

- 上位では 1 node として見せ、入ると内部 flow を表示する。
- `Enter` / `[` / `]` / `j-k` で抽象度や scope を移動する。
- `Generate Doc Subsystem` は試作題材として適している。

参照: `backlog/generate-doc-subsystem-ui.md`

### 5.2 command journey

- GUI demo を手操作ログではなく replay 可能な command stream として扱う。
- demo / regression / future skill の共通基盤にする。
- command ごとに precondition / postcondition / screenshot を持たせる。

参照: `projects/PJ03_SelfDrive/idea/gui_demo_command_journey.md`

### 5.3 tour / slideshow mode

- ノードを順番に巡る review / presentation mode。
- camera pan, spotlight, progress bar を組み合わせる。
- `details` or tour-specific note をナレーション欄に出す。

参照: `idea/30_ux/slideshow/03_runtime_ui.md`

### 5.4 numpad quick input

- priority / status / color をテンキーで一発入力する。
- 複数選択に対して一括適用する。
- ノートPC向け fallback も用意する。

参照: `idea/30_ux/keyboard_modes/09_numpad_quick_input.md`

## 6. Testing backlog

### 6.1 GUI品質ゲート

PR 前に最低限見るもの:

- `Cmd+0` 後に全ノードが画面内に見える。
- 選択ノードが toolbar / panel に隠れない。
- 編集中に子ノードを連続追加しても、active editing node が画面外へ消えず、camera が smooth に追従する。
- wheel / trackpad で zoom / pan しても、構造変更がない限り browsing が軽い。通常操作でカクつきや再計算ループに見える挙動がない。
- alias jump 後に target が選択され、scope URL も変わる。
- add / edit / delete / reparent / collapse を Chrome で一通り触る。

### 6.2 Screenshot を成果物にする

- DOM assertion だけでは「あるが見えない」を見逃す。
- Playwright screenshot と Chrome 目視 screenshot の両方を残せるとよい。

### 6.3 古い visual spec の整理

- hidden button / `#fit-all` 前提の古いテストを現行 UI に合わせる。
- 現行 UI で使う操作は `Cmd+0`, `rect.node-hit`, `#board` focus を基本にする。

## 7. 実行順案

1. `Cmd+0 fitAll` の仕様・実装・テストを固定する。
2. `alias jump + n=7 add + Cmd+0` を標準 GUI スモークにする。
3. linear panel あり/なしで fit framing をテストする。
4. LayoutStrategy 化へ進む。
5. command journey / tour mode で再生可能な GUI demo に進化させる。

*2026-05-19*
