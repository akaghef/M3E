# M3E MCP α1

Basis: DP1 / TOB-V

## 目的と境界

M3Eの予備知識を持たないAgentが、MCPだけでMapへ参加し、認識・操作を継続できること。ChatGPT DesktopでMap／Scopeをメンション選択し、実際の書込まで完了できることをα1の完了条件とする。

既存BetaのCore、保存、サーバーを利用する。MCPは操作・文脈・通知のアダプターであり、別のMapデータベースや代替Viewerを作らない。Agent向けToolは `m3e_context`、`m3e_get`、`m3e_create`、`m3e_update`、`m3e_delete`、`m3e_feedback` の6つ。メンション検索はアプリ専用Toolとする。

Focusは一つ、Subscriptionは複数。参加状態は短命のContextハンドルで識別する。Resourceの参照自体は参加・購読を開始しない。Scope削除時にはCore側で生存する祖先へ退避し、旧前提の書込を拒否する。通知による再判断と書込時の整合性検査は両方必要。

通常の連続操作ではAgentによる再GET、全状態の編集、一時書込スクリプト、Node ID生成、自動再着色を要求しない。構造の判断規約は既存の正規仕様を参照する。Elicitation、永続Actor管理、ORRERY TelemetryやViewer UIの統合は対象外。

## 受入チェックツリー

### Core・意味操作

- [x] 既存CoreのCommand経路を再利用
- [x] 一括操作を原子的に保存
- [x] Scope変更イベント・削除時退避を実装

### MCP Tools

- [x] context: enter / focus / subscribe / unsubscribe / leave
- [x] get: 一覧・検索・取得
- [x] create: 生成・コピー・MF-H一括書込
- [x] update: 編集・移動・scopen / unscopen
- [x] delete: 削除
- [x] feedback: 5W1Hログ

### MCP Resources

- [x] Glossary・Data Model・規約を公開
- [x] Map / Scope / NodeをResource化
- [x] 安定URI・Resource Templatesを定義

### MCP Prompts

- [x] 階層設計・Scope判断ガイダンスを提供
- [x] Prompts非対応Hostでも通常CRUDが成立

### Map / Scopeメンション

- [x] Map / ScopeのMention Searchを実装
- [x] 検索結果にResource URIを付与
- [x] ChatGPT Desktopで補完・選択・参照を実証
- [x] 選択したURIからcontextへ接続

### Session・変更認識

- [x] Session-local Queue / Listenerを実装
- [x] 複数Scope購読に対応
- [x] PreToolUseで未読イベントを確認
- [x] Scope消滅時に旧書込を停止・再判断
- [x] 通知欠落時のみ再同期

### 既存Skillの廃止

- [x] m3e-mapのREST手順をMCPへ移行
- [x] map-manager規約をResources / Promptsへ整理
- [x] AGENTS.md等の旧依存を解消
- [x] SkillなしのCold Startを検証

### End-to-End受入

- [x] Map参加からA配下をB配下へコピー
- [x] 既知Scopeで再GETなしの連続編集
- [x] 生物分類図67ノードの一括作成
- [x] 他ActorによるScope削除・再判断
- [x] Scopeメンション指定から実際の書込まで成功
- [x] Feedbackログ保存と新規Sessionでの再現

## 検証境界

単体・契約・診断試験は実機受入の代わりにしない。個人workspaceに試験Mapを作らず、既存Betaを分離した一時workspaceと専用portで検証する。Cold StartのAgentへM3E専用Skill、AGENTS.md、正答、呼出順序や待機の指示を与えない。製品のTool説明・Resources・Promptsから自律的に発見させる。

最終シナリオは、メンション選択→Scope URI→参加・購読→67ノード一括保存→結果報告・継続。別ActorのScope削除後、次の書込前に中断して新しいFocusを認識し、再判断する。

チェックは証拠がそろった時点でのみ更新する。実装済み、本流統合済み、稼働反映済み、実機確認済みは区別する。

## 現在の確認状況

Core・MCP・フックの関連試験69件、既存保存系の回帰試験108件が成功。Skillなしの新規セッションでコピーと連続編集、67ノードの一括作成、別ActorによるScope削除後の停止を確認した。実フックがバックエンドへの書込呼出しを止めたことも独立検証済み。

デスクトップでは実ユーザーのメンション選択から参加、67ノードのコピー、名称変更、保存・Viewer表示まで確認した。33項目の個別証拠は揃ったが、同一実機Sessionでメンションから外部Scope削除後の停止まで連続する総合シナリオと、既存Viewerの識別子非表示条件は未完了。個別成功を総合受入へ読み替えない。実装・統合・通常稼働の状態と試験の証拠・制約は [検証記録](mcp-alpha1-verification.md) に記載する。
