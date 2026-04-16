# Keyboard Modes for M3E

「特定モードに入ると、そのモード専用の単一キー操作が大量に効く」設計の
モード候補とユースケースを集める。

## 方針

- **採用するか考えない**。とにかく業務効率化に効きそうなモードを並べる
- **実際のキーマップは決めない**。「こういう操作を1キーで打ちたい」という業務の列挙に集中
- **モード単位**でユースケースを整理する。1モード = 1ファイルではなく類縁モードはまとめる
- 既存の `thinkingMode` (flash/rapid/deep) や `inlineEditor` mode と直交する「業務モード」を中心に考える

## ファイル構成

- [01_modes_global_design.md](01_modes_global_design.md) — モード入る／抜ける／表示／衝突回避の共通論点
- [02_inbox_modes.md](02_inbox_modes.md) — レビュー、トリアージ、scratch整理
- [03_attribute_modes.md](03_attribute_modes.md) — ステータス、タグ付け、見積、決定
- [04_structure_modes.md](04_structure_modes.md) — 並び替え、リンク、整理（重複・削除）
- [05_capture_navigation.md](05_capture_navigation.md) — 高速入力、検索ジャンプ、ブックマーク
- [06_view_present_compare.md](06_view_present_compare.md) — 閲覧、プレゼン、比較
- [07_experimental_modes.md](07_experimental_modes.md) — スプリント計画、journal、投票、ペアリング、その他
- [08_queue_mode_pattern.md](08_queue_mode_pattern.md) — 「キュー→1件処理→次」共通パターンの詳細・モードを4種類に集約する仮説
- [09_numpad_quick_input.md](09_numpad_quick_input.md) — テンキー(Numpad)で色・緊急度・ステータスを片手高速入力する設計

## モード一覧（俯瞰）

業務性質ごとに分類:

### 入ってくる情報を捌く（inbox 系）
- M01. Review mode — proposal/Qn を承認・却下・差戻し
- M02. Triage mode — 新着 scratch を分類・移動・削除
- M03. Scratch organize mode — scratch 配下のグルーピング
- M04. Conflict resolve mode — collab 競合を1キー解消

### ノードの属性を更新する
- M05. Status mode — todo/wip/done/blocked のサイクル
- M06. Tagging mode — agent/priority/category 付与
- M07. Estimate mode — 見積（時間／工数／優先度）
- M08. Decision mode — go/no-go/defer/spike

### 構造を変える
- M09. Restructure mode — 親変更・上下移動・インデント
- M10. Link mode — ノード間リンク作成（種類別）
- M11. Cleanup mode — 削除・アーカイブ・マージ
- M12. Bulk select mode — 複数選択して一括操作

### 入れる
- M13. Capture mode — ペーストや音声入力で連続的に scratch 化
- M14. Outliner mode — Workflowy/Logseq 風アウトライン入力
- M15. Note dictation mode — 1ノードに対する長文入力に特化

### 動く・探す
- M16. Navigation mode — フォーカス移動と展開折り畳みに特化
- M17. Search/Jump mode — fuzzy search → 1キーで飛ぶ
- M18. Bookmark mode — 印を付ける／戻る

### 見る・出す
- M19. Read mode — 編集ロック、読みやすさ重視のキーバインド
- M20. Slideshow mode — 別 idea/slideshow/ で扱い済
- M21. Compare mode — 2スナップショット差分閲覧
- M22. Export select mode — エクスポート対象選択

### 計画・振り返り
- M23. Sprint plan mode — 一定数のタスクに in-this-week をマーク
- M24. Standup mode — yesterday/today/blocker を1キーで巡回
- M25. Retro mode — 良かった／悪かった／試す をクラスタ化
- M26. Journal mode — 日付ノードに連続追記

### エージェント協調
- M27. Assign mode — agent 列挙からの割当
- M28. Q&A mode — Qn 系ノードへの回答付与
- M29. Pair-with-agent mode — エージェント提案の受入を1キー判定

### その他
- M30. Vote mode — 複数選択肢に1〜9で重み付け
- M31. Color/visual mode — 色や強調を1キー切替
- M32. Type cycle mode — nodeType 切替
- M33. Time-travel mode — 過去スナップショット閲覧

合計 33 モード候補。各ファイルでユースケースと「打ちたい操作」を列挙する。
