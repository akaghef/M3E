# 03. 属性更新系モード

ノードを動かさず、属性だけを高速に書き換えるモード群。
共通: **選択中ノード or キュー上のノードに属性を一発で付与**。

## M05. Status Mode

**シーン**: strategy ボードのタスクを巡回して todo/wip/done/blocked を更新。

**今ある選択肢** (m3e-map.json から推測): todo, wip, done, blocked

**1キーで打ちたい操作**:
- t → todo
- w → wip
- d → done（Sub: 完了日を attributes.completedAt に自動記録）
- b → blocked（Sub: blocked 理由を1行入力）
- p → pending
- next/prev → 兄弟ノード移動（連続更新を快適に）
- jump-next-blocked → 詰まりだけ巡回
- jump-next-wip → 着手中だけ巡回
- toggle-archive → done を仕舞う
- bump-priority / lower-priority → 優先度上下
- set-due-today / +1d / +1w / +1m → 締切のショートカット
- assign-to-me / assign-to-akaghef / assign-agent → 担当者付与
- comment → 1行ステータスコメント

## M06. Tagging Mode

**シーン**: 大量のノードに agent / category / domain タグを付ける。

**1キーで打ちたい操作**:
- 数字キー → 既登録タグ Top9 から選択
- letter キー → タグ頭文字検索
- new-tag → 新規タグ作成
- remove-tag → 現在タグを外す
- copy-tags-from-prev → 直前ノードと同じタグを当てる（連続作業に強い）
- inherit-from-parent → 親ノードのタグを継承
- propagate-to-children → 自分のタグを子に伝播
- show-untagged-only → 残りタスクが見えるフィルタ

## M07. Estimate Mode

**シーン**: 見積を入れる週次計画。複数ノードに高速 size を割当。

**サイズ系候補**: T シャツサイズ (XS/S/M/L/XL) / フィボナッチ点 / 時間 (15min/1h/4h/1d)

**1キーで打ちたい操作**:
- 数字キー → スケール直接指定
- inc / dec → 段階的に上下
- copy-from-similar → 過去の類似ノードから流用
- show-history → 同種タスクの実績を表示して校正
- mark-uncertain → ±幅をつけて記録
- auto-suggest → エージェントに見積提案させる
- accept-suggestion → エージェント案を採用
- reset → 見積を消す

## M08. Decision Mode

**シーン**: 「やる／やらない／棚上げ／調査」を決定するモード。
review mode との違い: review は「他者提案を判定」、decision は「自分の意思決定」。

**1キーで打ちたい操作**:
- go → status=adopted、決定日記録
- no-go → status=rejected、却下理由を1行
- defer → 棚上げ（再検討日付き）
- spike → 「調査タスク作って判断保留」
- need-input → 誰かに聞く（assignee 必須）
- delegate → エージェントに任せる
- archive-as-non-decision → 決定不要だった
- link-evidence → 判断根拠ノードへリンク
- record-rationale → 1行の判断理由を記録

**派生**: M08a. Architecture Decision Record mode — ADR フォーマットで status/context/decision/consequence の各欄を順に埋める専用モード

## モードまたぎの観察

Status / Tagging / Estimate / Decision は **「現在ノードに属性付与 → 次へ」** が共通。
共通 UI: 「現在のノード」「効くキー」「次の対象」が見える3要素パネル。

**論点 At1**: 「次へ」のデフォルト挙動
- 兄弟次へ / DFS 次へ / フィルタ条件にマッチする次へ
- 推し: モード毎にデフォルト + 操作で切替

**論点 At2**: タグ・ステータスの値セットをどこで定義するか
- ハードコード / マップ内ノードで定義 / 設定ファイル / scratch から自動学習
- 推し: マップ内 `meta/status` `meta/tags` ノードで定義（自己記述的）

**論点 At3**: 連続作業中の「直前操作の取り消し」
- 1キー undo（z や Backspace） / 通常 Ctrl+Z / 確認なし高速 undo

**論点 At4**: 操作のバッチ確定
- 1キー押下で即書き込み vs 複数操作をまとめて Enter で確定
- 推し: 即書込みが速い、ただし1秒程度の "soft commit" 期間（その間 Esc で取消）
