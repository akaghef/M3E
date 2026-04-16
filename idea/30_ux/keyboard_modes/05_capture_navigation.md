# 05. 入力・移動系モード

「打ち込む」「探して飛ぶ」のスループットを上げるモード群。

## M13. Capture Mode

**シーン**: ブレスト中、会議中、思考の流れを止めずに ノードを連続生成する。
flash_ingest との接続点。

**1キーで打ちたい操作**:
- Enter → 兄弟ノード作成
- Tab+Enter → 子ノード作成
- Shift+Tab+Enter → 親の兄弟ノード作成
- 二重 Enter → セクション区切り（親に戻る）
- Ctrl+V → クリップボード断片を1ノード化
- Ctrl+Shift+V → クリップボードを行ごとに複数ノード化
- ` で囲む → コードノード化
- 数字+Tab → 連番ノード生成
- 音声入力トグル → 句点で自動分割しノード化
- AI 補完サジェスト → エージェントが続きを提案
- accept-suggestion / reject-suggestion
- topic-jump → 文脈変えるとき、別の親へワープ

**派生**: M13a. **Voice capture mode** — 完全マイク前提、無音1秒で確定、3秒で次ノード。

## M14. Outliner Mode

**シーン**: 書きながら整理する Workflowy/Logseq 流。
通常の M3E は graph 寄りだが、線形入力に特化したサブモード。

**1キーで打ちたい操作**:
- Enter → 同階層ノード追加
- Tab → 1段下げ（直前ノードの子に）
- Shift+Tab → 1段上げ
- Cmd+Up/Down → ノード並べ替え
- Cmd+. → ハイライト切替
- Cmd+/ → コメント/メモトグル
- zoom-in (Alt+→) → 現ノードをルート扱いで集中
- zoom-out (Alt+←) → 元のスコープに戻る
- collapse / expand → 折り畳み
- Cmd+Enter → タスク化（status=todo を付与）
- Cmd+Shift+Enter → 完了化トグル

## M15. Note Dictation Mode

**シーン**: 1ノードに腰を据えて長文を書く。details に資料的に書き溜める用途。

**1キーで打ちたい操作**:
- スペル補正サイクル
- markdown 強調 / リンク / 引用ブロック挿入を1キーで
- save-and-next-node → 次のノードに移動
- save-as-draft → 確定せず仮置き
- summary-extract → 末尾にエージェントが summary 行を追加
- ai-rewrite → 選択範囲を別文体で書き直し
- attach-file → ファイル参照
- voice-to-text トグル

## M16. Navigation Mode

**シーン**: 編集せず、構造を読みに行く。

**1キーで打ちたい操作**:
- hjkl → 左右上下（Vim 風）
- Ctrl+u/d → 半画面ジャンプ
- gg → ルートへ
- G → 最深ノードへ
- t → 子展開トグル
- T → 全展開
- C → 全折畳
- f / F → 兄弟方向の高速移動
- z → 中央寄せ
- 0/^/$ → 階層先頭・末尾
- *  → 同名ノードを次々ジャンプ
- mX → bookmark X
- 'X → bookmark X へ jump
- () → 直前のフォーカス履歴 prev/next

## M17. Search/Jump Mode

**シーン**: 大規模マップで目的ノードに最速で到達。

**1キーで打ちたい操作**:
- / → fuzzy 検索開始（インクリメンタル）
- n / N → 次/前マッチ
- 数字キー → 検索結果上位を直接ジャンプ
- Enter → 1件目に飛ぶ
- Tab → 候補プレビューで切替
- Esc → 検索キャンセル、元の位置に戻る
- !attribute=value → 属性検索
- @agent → エージェント担当ノード絞込
- #status → ステータス絞込
- date:today → 当日操作したノード
- regex モード切替

## M18. Bookmark Mode

**シーン**: 作業中によく戻るノードに印を付けて巡回する。

**1キーで打ちたい操作**:
- 1〜9 で「現ノードを No. に登録」
- Shift+1〜9 で「No. ノードへ jump」
- 0 で bookmark 一覧表示
- d で現 bookmark 削除
- next-bookmark / prev-bookmark で巡回
- temp-mark → 一時印（Esc で消える）
- session-bookmark vs persistent-bookmark の区別

**派生**: M18a. **Recent mode** — 「最近触ったノード Top10」を1キーで巡る。
bookmark を能動的に置かなくても済む。

## モードまたぎの観察

入力系（Capture/Outliner/Dictation）は **何をどこに、どう生やすか** が共通課題。
ナビ系（Navigation/Search/Bookmark）は **対象ノードの指定** が共通課題。
両者は実は補完関係にあり、入力中に「あ、ここに足したい」→ ナビでジャンプ → 戻るが頻発する。

**論点 Cap1**: 入力モード中に通常の編集・読了との切替頻度
- 排他にする（割り切り）
- 重ね掛けする（Ctrl 押下中だけ navigation が一時的に有効、等）

**論点 Nav1**: bookmark を JSON に保存するか localStorage か
- 共有する性質ではないので localStorage で十分という立場もある
- マルチデバイスなら JSON 内、または別ファイル

**論点 Nav2**: 検索結果に「マップ全体」「現スコープ内」を切替できるか
