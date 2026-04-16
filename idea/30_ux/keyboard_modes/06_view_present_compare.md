# 06. 閲覧・プレゼン・比較系モード

書き換えではなく「見る」ことに最適化したモード群。

## M19. Read Mode

**シーン**: 編集を止めて読み物として眺める。誤操作防止。

**1キーで打ちたい操作**:
- 編集系キー全部を無効化（誤って文字を打っても何も起きない）
- スペース / 矢印で進む（次の意味のあるノードへ）
- f → フォントサイズアップ
- F → フォントサイズダウン
- + / - → ズーム
- d → ダーク／ライト切替
- l → 行間広げる
- r → 注釈（details）の表示・非表示
- t → 樹木表示 / 線形表示 切替
- s → 読了マーク
- Esc → 編集モードへ戻す
- 1〜9 → ブックマーク移動
- Shift+? → 操作一覧

**派生**: M19a. **Browse mode** — Read mode の中でも「webブラウザ的に」リンクを辿る挙動に特化。
- click でリンク先ノードへ
- back/forward で履歴移動

## M20. Slideshow Mode

別ファイル `idea/slideshow/` で詳細扱い済。
ここでは **モード群の中での位置付け** だけメモ:
- Read mode の発展形（編集無効 + カメラがツアー順序で自動移動）
- Read mode と共通の操作を持たせると学習コスト下がる

## M21. Compare Mode

**シーン**: 2つのスナップショット（昨日 vs 今日、main vs dev-beta、ローカル vs vault）の差分を見る。
backup.ts や cloud_sync.ts の延長線。

**1キーで打ちたい操作**:
- a / b → A 側 / B 側に視点切替
- d → 差分のあるノードだけにフィルタ
- next-diff / prev-diff → 差分を順に巡回
- accept-a / accept-b → 該当ノードをどちらかに揃える
- ignore → この差分を以後表示しない
- export-diff → 差分一覧を md 出力
- toggle-additions-only / toggle-deletions-only / toggle-modifications-only

**派生**: M21a. **Three-way merge mode** — base / mine / theirs の3面表示。
collab で上手いマージが必要なときの専用モード。

## M22. Export Select Mode

**シーン**: マップの一部だけを選んで Markdown / PDF / JSON に出す。

**1キーで打ちたい操作**:
- 数字キー → 既定セット選択（"strategy 全部", "done だけ", "scratch を除外" 等）
- a → ノード追加（クリックで個別追加）
- A → サブツリー全部追加
- r → ノード除外
- preview → 出力プレビュー
- format-cycle → md / pdf / json / html サイクル
- destination-cycle → ファイル / クリップボード / 共有リンク
- Enter → 出力実行

**派生**: M22a. **Quote mode** — 1ノードだけを引用形式でクリップボードに（ID + 抜粋）。
チャットや Slack に貼る用途に特化。

## M23. Time-Travel Mode

**シーン**: 過去のスナップショットを「触って読む」モード。
バックアップ機構 (backup.ts) と接続。

**1キーで打ちたい操作**:
- ← / → → 前のスナップショット / 次のスナップショット
- 数字 → 直接 N 個前へ
- d → 当時の差分（直前との差）を表示
- restore-this-node → 過去のこのノードだけ現在に戻す
- restore-subtree → サブツリー単位で復元
- restore-full → スナップショット全体を復元（要強い確認）
- compare-with-current → compare mode に派生
- jump-to-date → 日付を指定してジャンプ

## モードまたぎの観察

閲覧系は **編集を完全停止** が共通。安全装置不要、その代わりキー数を全部別用途に再割当できる。
- "編集モード" と "閲覧モード" を上位で2分するアーキテクチャがあると清潔
- Slideshow / Compare / TimeTravel はすべて閲覧系の派生として整理可能

**論点 Vw1**: 「編集モード」「閲覧モード」を上位2分するか
- 利点: キー衝突がモード内で閉じる、学習しやすい
- 欠点: モード切替が増える、編集中に「ちょっと過去を見る」が手間

**論点 Vw2**: 閲覧モード中に来た外部更新（vault watch）の扱い
- リアルタイム反映 / 通知のみ / 完全無視（読書中の中断防止）
- 推し: 通知のみ + Esc で反映

**論点 Vw3**: マップを「印刷可能なレイアウト」に再整列する閲覧モード
- 現マップの座標を捨てて、教科書的に並べ直して見せる
- 紙やPDFを意識した完全別レイアウト
- 重い機能だが価値は高い
