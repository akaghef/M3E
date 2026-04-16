# 既存ツール統合（Tool Integration）— ブレインストーミング

M3E を Git/Calendar/Obsidian/Zotero/LaTeX/VSCode/Notion/Linear/Jira などの
**既存エコシステムに接続** する体験を網羅的に並べるブレスト。

レビュー保留のため、各論点について **複数の選択肢を並べ、決定はしない**。

## 目的（一言）

研究者・開発者の既存ワークフロー（commit する／予定が入る／文献を読む／論文を書く／コードを書く／タスクを管理する）に
M3E を **後付けで挿入** できる接続点を洗い出す。
M3E を「もう一つの島」にせず、既存ツール群と **双方向の橋** を架ける。

## 方針

- 採用判断はしない
- 実装は考えない（最後の MVP ファイルでだけボリューム感に触れる）
- 統合先（Git / Calendar / Obsidian系 / Zotero / LaTeX / VSCode / Notion系）を **横並びに比較**
- 既存ツールの **データモデル制約** を踏まえる（Obsidianのフォルダ仕様、Zotero の Item 構造、Jira の Issue ID 等）
- プライバシー（クラウド側に流す情報）は L1〜L5 / policy_privacy への参照で扱う
- 既存ブレスト（capture_ingest / export_publish / collaboration / cross_device）と接続

## ファイル構成

- [01_concept.md](01_concept.md) — 統合の意義・ユースケース・既存ツール差分・統合の三類型
- [02_dev_tools.md](02_dev_tools.md) — Git/GitHub・VSCode・コード系統合（H1, H6）
- [03_knowledge_tools.md](03_knowledge_tools.md) — Obsidian/Roam/Logseq・Zotero（H3, H4）
- [04_workflow_tools.md](04_workflow_tools.md) — Calendar・Notion/Linear/Jira（H2, H7）
- [05_publishing_tools.md](05_publishing_tools.md) — LaTeX/Overleaf・Markdown 出版（H5）
- [06_integration_patterns.md](06_integration_patterns.md) — 統合方式の共通パターン（pull/push/双方向/イベント駆動）とプライバシー
- [07_mvp_path.md](07_mvp_path.md) — 最小実装案・段階導入ロードマップ・未決質問

## 全体俯瞰 / 統合先カテゴリ

| カテゴリ | 代表 | 主ユーザ | 同期方向 | 認証難度 | 推し度 |
|---------|------|---------|---------|---------|-------|
| 開発ツール | H1 Git / H6 VSCode | 開発者・研究プログラマ | 双方向 | 低 | ⭐⭐ |
| 知識管理 | H3 Obsidian系 / H4 Zotero | 研究者・学習者 | import 中心 | 低（ローカル）〜中 | ⭐⭐ |
| ワークフロー | H2 Calendar / H7 Notion系 | チーム・PM | 双方向 | 高（OAuth） | ⭐ |
| 出版 | H5 LaTeX/Overleaf | 論文執筆者 | export 中心 | 中 | ⭐⭐ |

## 論点一覧（後で ID 単位で選ぶ）

- **Sd. 同期方向** — pull only / push only / 双方向 / イベント駆動
- **Tr. トリガー** — 手動（コマンド）/ ファイル監視 / webhook / cron / コミット時 hook
- **Mp. マッピング粒度** — Issue=ノード / commit=ノード / Calendar event=ノード / page=subtree
- **Id. ID 戦略** — 外部 ID をノード属性に保持 / 双方向リンク / URL 埋め込み / 別途 mapping table
- **Cf. 衝突解決** — last-write-wins / 手動 merge / 外部優先 / M3E 優先 / フィールド単位
- **Au. 認証** — Personal Token / OAuth / API key / ローカルファイル直読み（auth不要）
- **Pv. プライバシー境界** — どの情報を外部に流すか、機微情報の自動マスキング（L1〜L5 連動）
- **Ot. オフライン耐性** — 接続切れ時の動作、conflict_backup との関係
- **Sc. スコープ制限** — workspace 単位 / map 単位 / subtree 単位 / タグ単位の同期対象指定
- **Br. ブリッジ実装** — M3E 内蔵 / 別プロセス / VSCode拡張 / CLI / GitHub Action
- **Sm. スキーマ変換** — 双方の構造差をどう吸収するか（フィールド対応表 / プラグイン式）
- **Ev. イベントの出処** — どちら主導で同期がトリガーされるか（poll vs push）
- **Hi. 履歴保持** — 統合先の更新履歴を M3E 側に残すか、最新スナップショットだけか
- **Vw. 統合先用ビュー** — 「Git ノードだけ」「Calendar ノードだけ」のフィルタビュー
- **Co. コスト** — 各統合のメンテコスト（API 変更追従、認証期限切れ対応）
- **Mu. マルチアカウント** — 同じツールの複数アカウント（個人/組織 GitHub 等）
- **Pl. プラグイン化戦略** — コア vs 拡張、サードパーティに開放するか
- **Re. 再現性** — 同じ外部状態から同じマップが再生成されるか
- **No. 通知** — 統合先側のイベント（PR review、event reminder）を M3E に通知するか

## キーメッセージ（ブレスト前提）

- **統合は3類型に分かれる**: (1) import（取り込んで放置）(2) export（書き出して放置）(3) 双方向同期（最も難しい）
- **「ローカルファイル統合」は OAuth 統合より圧倒的に楽**。Obsidian Vault や Zotero SQLite を直接読むだけで価値が出る
- **Issue / event / commit を全部ノード化すると爆発する**。タグ・ラベル・スコープによるフィルタが必須
- **双方向同期は ID 戦略の選択で全てが決まる**。外部 ID を ノード属性で持つか、別 mapping を持つかで設計が変わる
- **プライバシー境界は統合先ごとに違う**。Notion クラウド送信と Obsidian ローカルでは制約が真逆
- **「すべて統合する」より「1個だけ深く統合する」方が価値が高い**。統合先選びこそが戦略
- **VSCode 拡張は M3E 体験を倍増させる可能性**。研究者でも開発者でもエディタで時間を使う
- **既存メモリ project_projection_vision との接続**: 半年で論文出力 → LaTeX 統合（H5）と Zotero（H4）が直結

## 関連ブレスト・既存メモリ

- [idea/10_io/capture_ingest/](../capture_ingest/) — 統合は capture チャネルの一種でもある
- [idea/10_io/export_publish/](../export_publish/) — H5 LaTeX は export_publish の B1 と重複領域
- [idea/50_collab/collaboration/](../../50_collab/collaboration/) — H7 Notion/Linear/Jira はチーム協働ツール群
- [idea/50_collab/cross_device/](../../50_collab/cross_device/) — 統合は別デバイス／別アプリへの橋
- [idea/00_meta/automation_obstacles/](../../00_meta/automation_obstacles/) — 「同期失敗」「ID衝突」「権限切れ」等の障害群
- [idea/00_topic_pool.md](../../00_topic_pool.md) — 元プール（H カテゴリ）
- MEMORY: `project_projection_vision` — 半年で科研費出力 → LaTeX/Zotero 統合と直結
- MEMORY: `policy_privacy` — 機微情報を外部 SaaS に流さない縛り
- MEMORY: `project_alglibmove_dogfood` — M3E 単独の認知層不足を統合で補える可能性
