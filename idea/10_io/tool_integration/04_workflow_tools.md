# 04. ワークフローツール統合 — Calendar・Notion/Linear/Jira（H2, H7）

時間管理（Calendar）とタスク管理（Notion/Linear/Jira）の統合選択肢を列挙。
両者とも **チーム / 他者** が関与するため認証・プライバシー設計が H1〜H4 より重い。

## H2. Calendar 統合

### H2.1 接続先候補

| ID | サービス | 認証 | API 形式 |
|----|---------|------|---------|
| H2.1.a | Google Calendar | OAuth 2.0 | REST |
| H2.1.b | Outlook / Microsoft Graph | OAuth 2.0 | REST |
| H2.1.c | Apple Calendar | iCloud / CalDAV | CalDAV |
| H2.1.d | CalDAV 汎用 | Basic auth | CalDAV |
| H2.1.e | ICS ファイル import | 不要 | ファイル |
| H2.1.f | Fastmail / Proton | CalDAV | CalDAV |

→ 個人なら **H2.1.a Google + H2.1.e ICS** で大半カバー。

### H2.2 何をマップに入れるか（Mp）

| ID | 粒度 | 補足 |
|----|------|-----|
| H2.2.a | event = ノード | 1予定が1ノード |
| H2.2.b | 日 = ノード、event は子 | デイリー集約 |
| H2.2.c | calendar（複数calendarある）= subtree | calendar単位グループ化 |
| H2.2.d | 重要 event のみノード化 | 自動フィルタ |
| H2.2.e | 過去 event のみ（記録）/ 未来 event のみ（計画） | 用途分離 |
| H2.2.f | プロジェクトラベル別 subtree | プロジェクト軸 |

### H2.3 同期方向（Sd）

| ID | 方向 | 例 |
|----|------|---|
| H2.3.a | Calendar → M3E のみ | 予定を M3E に表示 |
| H2.3.b | M3E → Calendar | M3E ノードから予定作成 |
| H2.3.c | 双方向（編集も同期）| event 名・時刻変更が両側に |
| H2.3.d | 表示だけ（未保存）| M3E 起動中だけ重ねて見る |

### H2.4 ノード ↔ event の紐付け

予定がない M3E ノード（例: 研究テーマ）と Calendar event を関連づけ:

| ID | 関連付け方 |
|----|----------|
| H2.4.a | event 説明欄に node ID 埋め込み |
| H2.4.b | M3E ノード attribute に event ID |
| H2.4.c | 別 mapping テーブル（M3E 内）|
| H2.4.d | タグで暗黙的に紐付け（同タグの event とノードを link） |

### H2.5 トリガー

- H2.5.a 起動時に「今日の event」取得
- H2.5.b 5分ごと poll
- H2.5.c Google push notification（webhook）
- H2.5.d 予定開始時刻アラート → M3E 該当ノード自動オープン
- H2.5.e ICS ファイル更新監視

### H2.6 ビュー候補

- H2.6.a デイリービュー: 今日の予定 + 関連ノード
- H2.6.b ウィークリービュー: 1週間タイムライン
- H2.6.c カレンダーオーバーレイ: 既存マップに event を半透明重ね
- H2.6.d ガントチャート: 長期予定 → ノード期間
- H2.6.e タイムライン軸の地図モード（map_views と接続）

### H2.7 Calendar 統合のユースケース

- UC-C1. 朝の研究計画: 今日の予定リスト + 各予定の関連 subtree
- UC-C2. 「14:00 指導会」ノードに議論したい3点をリンク
- UC-C3. 投稿締切 event と論文執筆 subtree のリンク（H5 連動）
- UC-C4. ポモドーロ統合（G6）+ Calendar で実録時間記録
- UC-C5. 「過去のこの日に何やってた？」振り返り（I1 time travel と接続）
- UC-C6. 共同研究者の予定（公開 calendar）から会議候補を提案

### H2.8 プライバシーリスク

- 全 event を M3E に取り込むと機密会議も入る → policy_privacy 違反リスク
- 「特定 calendar のみ」「特定タグのみ」のフィルタ必須
- M3E 側に event タイトルだけ保存 / 詳細は外部参照のみ、の選択肢

## H7. Notion / Linear / Jira 統合

### H7.1 ツール特性比較

| ツール | データ単位 | 階層 | API |
|-------|----------|------|-----|
| Notion | block / page | 入れ子 | OAuth, Block API |
| Linear | Issue | Project / Cycle | GraphQL, OAuth |
| Jira | Issue | Epic / Sprint / Project | REST, PAT |
| Asana | Task | Project / Section | REST, PAT |
| Trello | Card | Board / List | REST, OAuth |
| ClickUp | Task | Space / Folder / List | REST |

### H7.2 マッピング戦略

#### Notion の場合

| Notion | → M3E |
|--------|-------|
| Workspace | M3E workspace |
| Page | subtree（page = root ノード）|
| Block | 子ノード |
| Database row | ノード（DB スキーマが attributes）|
| Linked page | link |
| Toggle | 折りたたみ subtree |

#### Linear/Jira の場合

| Linear/Jira | → M3E |
|-------------|-------|
| Project | subtree |
| Issue | ノード |
| Sub-issue | 子ノード |
| Epic | 親ノード |
| Cycle/Sprint | tag |
| Status | status |
| Assignee | attribute |
| Priority | attribute |
| Label | tag |

### H7.3 同期方向

- H7.3.a 双方向（同じ Issue を両側で編集可能）
- H7.3.b M3E は read-only（タスク管理は外部、思考は M3E）
- H7.3.c M3E → 外部のみ（M3E が思考の場、外部はタスクのみ）
- H7.3.d 選択的（特定タグ・特定 status のみ同期）

### H7.4 ID 戦略（Id）

双方向同期で最重要:

| ID | 戦略 |
|----|------|
| H7.4.a | 外部 ID をノード attributes に保持 |
| H7.4.b | M3E ID を外部の説明欄に埋め込み |
| H7.4.c | 別 mapping table（M3E 内）|
| H7.4.d | URL を attribute として保持、解決時に検索 |
| H7.4.e | 双方向リンク（外部 description に M3E URL、M3E に外部 URL） |

推し: **H7.4.a + H7.4.e のハイブリッド**。検索もできるし human-readable。

### H7.5 衝突解決（Cf）

| ID | 戦略 |
|----|------|
| H7.5.a | last-write-wins（時刻比較）|
| H7.5.b | M3E 優先（自分の思考が正）|
| H7.5.c | 外部優先（チームの記録が正）|
| H7.5.d | フィールド単位で優先設定 |
| H7.5.e | 衝突時は手動 merge ノード生成 |
| H7.5.f | 衝突時はノードに「conflict」status を立てて両方保存 |

### H7.6 トリガー

- H7.6.a webhook（Linear/Jira/Notion 全て対応）
- H7.6.b 定期 poll
- H7.6.c 起動時 fetch
- H7.6.d 手動 sync ボタン
- H7.6.e 編集時にローカル保存、定期 push

### H7.7 認証の負荷

| ツール | 認証 | トークン期限 | 個人 vs 組織 |
|-------|------|-----------|-------------|
| Notion | OAuth | 永続 | Integration 単位 |
| Linear | OAuth or PAT | PAT は永続 | Workspace 単位 |
| Jira | PAT or OAuth | PAT 設定次第 | Site 単位 |
| Asana | PAT | 永続 | Workspace 単位 |
| Trello | API key + token | 設定次第 | Member 単位 |

PAT 系は楽。OAuth はリフレッシュトークン管理が必要。

### H7.8 ユースケース

- UC-N1. 研究室 Notion の輪読ページ → M3E に subtree 化、議論 link を追加
- UC-N2. M3E で書いた研究計画 → Notion ページに公開（共有）
- UC-N3. Linear の自分のタスク → M3E daily ビューに表示
- UC-N4. Jira の sprint backlog → M3E で構造可視化
- UC-N5. Notion DB の論文管理 → M3E で文献マップ化（H4 代替）
- UC-N6. M3E のスクラッチで思いついたタスク → Linear/Jira に Issue 化

### H7.9 Notion/Linear/Jira 統合のリスク

- API rate limit
- データモデル差（Notion の入れ子 block vs M3E の link）
- 機密プロジェクトの取り込み → policy_privacy
- チームメンバーの編集が M3E に流入する混乱
- API 仕様変更時の追従コスト

## H2 + H7 横断の論点

### Wf1. 時間軸 vs プロジェクト軸の統合
- Calendar = 時間軸、Notion/Linear/Jira = プロジェクト軸
- M3E 上で両者を **同じノード** にリンクできるか
- 「このタスクは来週木曜のスプリントで」+「14時から作業」を1ノードに

### Wf2. SaaS vs ローカルファイル
- H1 H3 H4 はローカルで完結可能（OAuth 不要）
- H2 H7 はクラウド前提（OAuth 必須）
- → 統合インフラが2系統必要

### Wf3. 「外部システムが真実」モード
- H7.3.b（M3E read-only）案を採るなら、外部から M3E への **一方向ミラー** で十分
- 双方向同期の難しさを回避できる

### Wf4. プロジェクト粒度の分離
- 仕事プロジェクト（Linear/Jira）と研究プロジェクト（M3E）の境界
- 同じ workspace に混ぜるか、別 workspace か

### Wf5. 通知の M3E への取り込み
- Calendar reminder, Linear assignment, Notion mention
- 全部 M3E に流すと爆発
- ユーザ ロール別フィルタ必須

## 推し度ランキング（H2, H7 内）

| ランク | 案 | 理由 |
|-------|---|------|
| 1 | H2.1.e ICS ファイル import | 認証不要、最小構成、即試せる |
| 2 | H2.6.a デイリービュー（今日の予定 + 関連ノード）| UC-C1 の体験価値高い |
| 3 | H7.3.b Notion/Linear/Jira を read-only ミラー | 双方向の難しさ回避、価値十分 |
| 4 | H2.4.b ノード attribute に event ID | 紐付け方として一番素直 |
| 5 | H7.4.a + H7.4.e ID 双方向埋め込み | 双方向同期に進む時の基盤 |
