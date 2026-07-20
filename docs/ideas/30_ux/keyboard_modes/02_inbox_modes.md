# 02. Inbox 系モード

「外から入ってきたもの」を1つずつ捌くモード群。
共通特徴: **キューがある／1キーで処置／自動で次へ**。

## M01. Review Mode

**シーン**: エージェントが提案した節 (proposal) や、保留にした Qn を順番にレビューする。
feedback_ambiguity_pooling のフローと相性最高。

**キュー定義候補**:
- proposal タグの付いたノード全部
- attributes.status == "for-review"
- review/Qn 配下のノード

**1キーで打ちたい操作**:
- 承認 → status=approved、子に展開、次へ
- 却下 → status=rejected、折りたたみ、次へ
- 差戻し（再考） → status=needs-rework、コメント欄を開く
- 保留（あとで） → status=defer、リマインダ的に末尾へ
- 質問返し → 子ノードに Qn を生やしてエージェントに返す
- 分割（一部だけ承認） → 子ノード単位で個別判定モードに潜る
- マージ提案 → 既存ノードと merge する宛先を選ぶ
- ジャンプ（元の文脈を見る） → 関連ノードへ一時移動、戻るも1キー
- 採用理由ピン → 1行コメントを貼る
- 完全削除 → 提案を捨てる
- スキップ（判定保留で次） → status は変えず次へ
- 戻る（前の判定をやり直す） → undo 兼ねる
- 全部承認（残り全部） → 信頼ベースの一括処理
- 一時離脱 → 進捗を保存して通常モードへ

**有効な状況**: 朝1で溜まった提案を片付ける、エージェントタスク完了通知時、週次レビュー。

## M02. Triage Mode

**シーン**: scratch / inbox に溜まった「思いつき断片」を分類する。

**キュー定義候補**:
- scratch ノード配下の未分類（attributes.category 無し）
- 直近24時間以内に作成された未仕分けノード

**1キーで打ちたい操作**:
- カテゴリ移動（既存カテゴリへ）→ 1〜9 でメニュー表示、選択で移動
- 新カテゴリ作成 → "n" で名前入力モード
- delete（即削除）
- archive（消さず archive 配下へ）
- promote（scratch → strategy／research へ昇格）
- duplicate-mark（既存と重複してそうなら印を付ける）
- merge into … → 検索して選んだノードに本文を統合
- expand later（あとで詳細を書く印）
- next → ノータッチで次
- prev → 戻る
- bulk-select 開始 → 似たもの数件を選んで一括処理

**有効な状況**: 週次掃除、出張帰り、ブレストの直後。

## M03. Scratch Organize Mode

**シーン**: scratch 配下の整理（既存 m3e-scratch skill が言及している作業）。
Triage との違い: 「グループ化」と「親ノード作成」が中心。

**1キーで打ちたい操作**:
- group-start / group-end → 連続選択でグループにまとめる
- create-parent → 選択ノード群の親ノードを生成
- find-similar → 現在ノードと意味が近いノードをハイライト
- accept-suggested-grouping → エージェントの提案グループ案を受入
- swap-left/right → 兄弟内での並び替え
- move-up-tree → 親ノードに昇格
- demote → 直前の兄弟の子になる
- reroute → 別カテゴリの下に丸ごと付け替え

## M04. Conflict Resolve Mode

**シーン**: collab で同時編集が起きた、あるいは cloud_sync で衝突した時。
既存 conflict_backup.ts があるので結合可能。

**1キーで打ちたい操作**:
- accept-mine
- accept-theirs
- accept-both（両方を子ノードとして残す）
- merge-text-line-by-line（差分エディタを開く）
- view-history → どっちが新しいか確認
- skip → 後回し
- bulk: accept-mine-all / accept-theirs-all
- snapshot before resolving → 安全策

## モードまたぎの観察

Inbox 系は **「キュー → 1件処理 → 次」が共通骨格**。
ベース実装を共通化（`runQueueMode(queue, handlers)`）すれば
Review / Triage / Conflict resolve を同じ枠組みで作れる。

**論点 In1**: キューの並び順
- 古い順 / 新しい順 / 重要度順 / ランダム / エージェント推奨順

**論点 In2**: 処理済の見せ方
- グレーアウトして残す / 即座に視界から消す / アーカイブ枝に移動

**論点 In3**: モード入る時の初期キュー絞り込み
- 全部 / 自分宛のみ / 当日分のみ / 直近Nだけ
