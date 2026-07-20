# 07. 実験的・小規模モード

ニッチだが特定状況で爆発的に効くモード群。
採用判断は後段、ここでは可能性の網羅。

## M23. Sprint Plan Mode

**シーン**: 週次／日次の計画を立てる時に「やる印」を高速付与。

**1キーで打ちたい操作**:
- y → in-this-sprint タグ
- n → not-this-sprint
- s → stretch goal
- ? → undecided
- next → DFS で次タスク
- show-capacity → 累積見積を画面端に表示しながら入れる
- show-burndown → 過去スプリント比較表示
- finalize → スプリント確定（タグを permanent 化）

## M24. Standup Mode

**シーン**: 朝会／個人デイリーで「昨日／今日／障害」を整理。

**3パス周回**:
1. yesterday: done になったもの巡回
2. today: in-this-sprint で wip 候補に印
3. blocker: blocked タグのものを巡回

**1キーで打ちたい操作**:
- y / t / b → どのパス中か切替
- mark-done-yesterday
- mark-today-target
- mark-blocked-now → 1行で blocked 理由
- generate-summary → 3行サマリを clipboard へ
- send-to-slack → 既定チャンネルに投稿（policy_privacy 注意）

## M25. Retro Mode

**シーン**: スプリント振り返り。Keep / Problem / Try のクラスタ作成を高速化。

**1キーで打ちたい操作**:
- k / p / t → 現ノードに Keep / Problem / Try 印
- voting → 数字キーで賛同数加算
- group-similar → 類似ノードを自動でグルーピング提案
- promote-as-action → Try → action item ノード昇格

## M26. Journal Mode

**シーン**: 日付ノード配下にその日の活動を timestamp 付きで連続追加。

**1キーで打ちたい操作**:
- Enter → 現時刻スタンプ付き新ノード
- Tab → 直前ノードの子として追加（詳細）
- mood-1〜5 → 気分タグ
- task-link → 触ったタスクへのリンク
- summarize-today → 末尾に今日のまとめノード自動生成
- prev-day / next-day → 別日付ノードへ移動

## M27. Assign Mode

**シーン**: タスクをエージェントに割当てる。複数タスクを連続で。

**1キーで打ちたい操作**:
- a / d / t / v → agent 一覧から選択（akaghef/data/team/visual等）
- self → 自分担当に
- unassign → 担当解除
- show-load → 現在の各 agent の wip 件数を画面端に
- balance → 自動均等割を提案
- delegate-to-best → 過去実績から「最適 agent」をエージェントに提案させる

## M28. Q&A Mode

**シーン**: pooled question に答える。
feedback_ambiguity_pooling のフローに直結。

**1キーで打ちたい操作**:
- a → 回答テキスト入力
- y / n / ? → yes / no / unsure 即答
- defer → あとで考える
- ask-back → 質問返し
- jump-to-context → 質問の元ノードへ
- batch-yes / batch-no → 残り全部に同じ回答

## M29. Pair-with-Agent Mode

**シーン**: エージェントの提案を「採用するか」をリアルタイムで判定し続ける。
LLM コーディング体験的なノード版。

**1キーで打ちたい操作**:
- y → accept
- n → reject + reason
- e → edit then accept
- regenerate → 同じ箇所で再提案
- next → 次の提案
- pause / resume → エージェント止める／動かす
- raise-temperature / lower-temperature → 提案の冒険度
- save-prompt-as-template → このパターンの指示を再利用可能に保存

## M30. Vote Mode

**シーン**: 複数案からの選択を、自分一人 or 複数人で重み付け決定。

**1キーで打ちたい操作**:
- 1〜9 → 候補 N に1票投じる
- - / + → 重み増減
- veto → この候補を脱落
- show-results → 集計表示
- finalize → 多数決確定

## M31. Color/Visual Mode

**シーン**: 重要度や種別を視覚的に色分け。

**1キーで打ちたい操作**:
- 0〜9 → 色プリセット
- bg → 背景色 vs 文字色 vs 枠色 切替
- shape → 角丸/角張/円形
- icon → ノード前の絵文字／アイコン
- size → ノードサイズ強調
- reset → デフォルトに戻す
- propagate → 子ノードに同じ色を伝播
- fade → ノードを薄く（参考扱い）

## M32. Type Cycle Mode

**シーン**: nodeType を素早く切替（text / table / list / code / image 等）。

**1キーで打ちたい操作**:
- t → text
- l → list
- a → table
- c → code
- i → image / asset
- q → question
- d → decision
- next-type → サイクル
- preview → 切替後のプレビュー

## M33. Time-Sensitive Mode（締切ピンポイント）

**シーン**: 締切が迫ったノードを抽出して着手判断。

**1キーで打ちたい操作**:
- show-overdue → 期限切れだけ
- show-this-week → 今週分
- snooze → +N 日
- escalate → 優先度＋
- assign-help → 助太刀依頼
- archive-as-missed → 諦めて記録

## まだ言語化できていない可能性のあるモード

- M34. Reference / Citation mode (10a と統合候補)
- M35. Diagram-extract mode（手書き図 → ノード化）
- M36. Translation mode（言語切替）
- M37. Privacy review mode（policy_privacy 観点で機微情報を含むノードを巡回し対処）
- M38. Cost estimate mode（LLM コスト・人件費の見積）
- M39. Health check mode（マップの構造的健全性を巡回 - 孤立・循環・過深ツリー）
- M40. Tutorial author mode（map から教材ステップを切出し）

## 横断的な気づき

- 多くのモードが **「キュー → 1件処理 → 次」** の構造を持つ → 共通基盤化可能
- **「現在ノードに属性付与」「対象を選ぶ」「一括」** が3大プリミティブ
- モードは **業務フェーズ** とほぼ1:1（朝＝review/triage、午前＝capture、午後＝attribute、夜＝journal/retro）
  → 時刻や曜日でモード推奨をサジェストする補助 UI もありうる
- ユーザの実際のワークフロー（akaghef の1日の流れ）が分かれば、優先度付け可能
- **モードが多すぎて学べない** リスクが現実 → 段階的開放（最初の3つだけ提示、慣れたら次）の UX も検討
