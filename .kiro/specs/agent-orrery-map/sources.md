# agent node 表示と OT GUI 移行：要件と出典

収集日 2026-10-16。要件と、その出典（文書・会話セッション）だけを記す。設計・提案は含めない。

## 1. 要件

| ID | 要件 | 出典 |
|---|---|---|
| RQ1 | Agent Orrery は独立した画面・別アプリ・別 DB ではなく、M3E の map 上のデータとして扱う | [ADR_011](../../../docs/09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md)、[requirements.md](requirements.md) 要件1 |
| RQ2 | Role・Actor Instance・agent kind（AI agent / human）を分ける | requirements.md 要件2、[用語 steering](../../steering/agent_orrery_terminology.md) |
| RQ3 | lifecycle state は10種、観測できる事実だけで決める | requirements.md 要件3、ADR_011 DC11 |
| RQ4 | Agent Card の項目と順序：icon／Realm・Role・Name／Title／msg／model・time・state。agmsg team は出さない | requirements.md 要件4 |
| RQ5 | ズーム段階：遠景＝icon＋状態色、中景＝icon＋Name＋state、近景＝Agent Card 全体 | requirements.md 要件4-10 |
| RQ6 | 判断待ち（Attention）は明示的な要求の証拠があるときだけ前景化し、lifecycle state と分ける | requirements.md 要件11 |
| RQ7 | 未配置の観測の受け皿を持ち、cwd 等から機械的に project へ配置しない | requirements.md 要件8 |
| RQ8 | 初期接続は既存 snapshot の読み取り専用。M3E から session 原本を再収集せず、agmsg の既読位置を動かさない。観測更新で map 保存・undo・同期を発火させない | [PJ08 統合契約](../../../projects/PJ08_M3E_OT_Fusion/docs/2026-09-22_integration-contract.md)、requirements.md 要件14 |
| RQ9 | 観測表示は通常 Viewer の同じ canvas・viewport に出す | PJ08 統合契約、[NETWORK 統合記録](../../../projects/PJ08_M3E_OT_Fusion/docs/2026-09-22_network-integration.md) |
| RQ10 | Role / Contract は Authoring Map の永続正本、Actor Instance は runtime overlay、Telemetry は ephemeral で正本 map に混ぜない | ADR_011、用語 steering |
| RQ11 | 状態色は map 全体の7色規約に従う | [color_semantics.md](../../steering/color_semantics.md)、requirements.md 要件16 |
| RQ12 | OT の UI で M3E surface に無いもの（edge からメール履歴を見る、node ホバーで情報が出る 等）を劣化させない | 会話 S4 |
| RQ13 | node type ごとに見た目・スキーマ・ロジックを分け（node seam）、agent card・task 等をテンプレ化する | 会話 S5 |
| RQ14 | OT 実装から仕様を洗い出して文書化し、解体して M3E に取り込む。prototype をそのまま移植しない | 会話 S5、ADR_011 |
| RQ15 | GUI はデスクトップアプリ（Claude Code・Codex）と両立する。人は端末ではなく GUI で判断する | 会話 S8、S9 |
| RQ16 | 会話の正本は JSONL。GUI は JSONL から再構成する。agmsg は実行と配送の層 | 会話 S10、[A-sys ORRERY 概要](../../../../Akaghef-System/docs/14_ORRERY_Telemetry_Overview.md) |
| RQ17 | 既定表示に ID（UUID・session/thread ID・ハッシュ等）を出さない | `~/.claude/CLAUDE.md`「GUI shows no IDs」 |
| RQ18 | 当面はこの Mac で行う | 会話 S12 |

未決（出典に「未決」「後決め」と明記されているもの）：最終 UI の採否（PJ08 統合契約・NETWORK 統合記録「UI 最終採否は akaghef が確認」）、Orrery データの物理的な置き場と Telemetry の保持期間（ADR_011 DC8、requirements.md の範囲外指定）。

## 2. 会話セッションの出典

| # | 日時 (UTC) | 実行 | 要点（akaghef の発言） | ファイル |
|---|---|---|---|---|
| S1 | 2026-08-26 13:49 | Claude Code / M3E | agent mapping を M3E plugin 化。map のひとつを agent orrery として稼働。backend は引き継ぎ、ロジックを M3E に寄せる。node seam lab で agent 1体の描画要素を調整 | `~/.claude/projects/-Users-nisimoriyuuya-dev-M3E/672505e1-b0e5-4bde-b0cc-0b053cfe8986.jsonl` |
| S2 | 2026-08-26 14:12 | 同上 | 動いている agent orrery は参考に（バグあり）。最初は読み取り専用で既存の会話セッションを観測し、M3E に node を生やす | 同上 |
| S3 | 2026-08-28 13:01 | 同上 | M3E node としての表示データを考えたい。orrery が surface に何を表示していたか | 同上 |
| S4 | 2026-09-12 22:31 | Claude Code / M3E | 画面全体やパネルは良いが、OT より UI が劣化している部分が surface にある（edge からメール履歴、node ホバーで情報）。用例：自分の複数 PC 間でしりとり | `~/.claude/projects/-Users-nisimoriyuuya-dev-M3E/c37bb36e-421a-4733-a240-2f9f935508b0.jsonl` |
| S5 | 2026-09-13 03:48 / 04:05 | 同上 | OT 実装から仕様を洗い出し、解体して M3E に取り込む。node seam は node type 混在でも分離して実装するため。色使いは node type ごとに決まり global な意味は無い。front 寄りに集中 | 同上 |
| S6 | 2026-09-07 03:42 | Codex | OT が非公開だったので内製化を試みたが開発コストを割けなかった。M3E に goal graph などを含めたい思想に近づいた | `~/.codex/sessions/2026/09/07/rollout-2026-09-07T12-39-02-01a079f2-ae3f-7072-a007-02c1c9ba03f1.jsonl` |
| S7 | 2026-09-15 06:53 | Claude Code / M3E | M3E＋OT 融合を新 PJ で。論理は GPT と詰めるが、GUI が収束しないと目標がブレる。より難しいのは既存実装への組み込み | `~/.claude/projects/-Users-nisimoriyuuya-dev-M3E/b42b2149-877f-4255-b707-0135682679d0.jsonl` |
| S8 | 2026-10-13 07:24 | Claude Code / M3E | ゆくゆくは複雑なドメインのタスクは Obsidian・M3E GUI が自分の GUI のメイン。Orrery mail は他端末非対応なので agmsg をネットワークとする | `~/.claude/projects/-Users-akaghef-dev-M3E/8a18f506-c9a0-4399-9f12-575443d69ad9.jsonl`（同内容が他の分岐セッションにも残る） |
| S9 | 2026-10-14 00:09 | Claude Code / M3E | OT の操作部分はデスクトップアプリと相性が悪い（tmux 前提）。観測は hook 経由で両アプリで使える | `~/.claude/projects/-Users-akaghef-dev-M3E/05a031cf-8643-4379-89a3-af8aa6e055a2.jsonl` |
| S10 | 2026-10-14 01:57 | Claude Code / M3E | デスクトップアプリの会話履歴 JSONL を観測すれば、メールを読まずにエージェントのマッピングが可能。過去にそれで構築した | `~/.claude/projects/-Users-akaghef-dev-M3E/8a18f506-c9a0-4399-9f12-575443d69ad9.jsonl` |
| S11 | 2026-10-15 15:24 | 同上 | PR4：具体タスクは M3E での agent node の表示と OT GUI の移行 | 同上 |
| S12 | 2026-10-16 | 同上 | 過去の議論は Codex に収集させる。データの置き場の議論も既にある。当面この Mac。GUI は埋め込むと競合しうるので慎重に設計したい | 同上 |

## 3. 文書の出典

- [ADR_011 Agent Orrery As M3E Map](../../../docs/09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md)
- [requirements.md](requirements.md)（2026-09-13）
- [PJ08 統合契約 2026-09-22](../../../projects/PJ08_M3E_OT_Fusion/docs/2026-09-22_integration-contract.md)、[NETWORK 統合記録 2026-09-22](../../../projects/PJ08_M3E_OT_Fusion/docs/2026-09-22_network-integration.md)
- [agent_orrery_terminology.md](../../steering/agent_orrery_terminology.md)、[color_semantics.md](../../steering/color_semantics.md)
- [Data_Runtime_Layout.md](../../../docs/03_Spec/Data_Runtime_Layout.md)、[Storage_And_Collab_Overview.md](../../../docs/04_Architecture/Storage_And_Collab_Overview.md)、[Obsidian_Vault_Integration.md](../../../docs/03_Spec/Obsidian_Vault_Integration.md)
- [Current_Status.md](../../../docs/00_Home/Current_Status.md)
- A-sys：[14_ORRERY_Telemetry_Overview.md](../../../../Akaghef-System/docs/14_ORRERY_Telemetry_Overview.md)、`protocols/agmsg_routing.md`

## 4. 出典どうしの食い違い

- 色の意味：S5（2026-09-13「色使いは node type ごとに決まるのであって global に意味は無い」）と、color_semantics.md（2026-08-29 決定「map 全体の規約であり、agent 固有ではない」）。
- prototype の位置づけ：ADR_009 時点の「mock・参照のみ」と、ADR_011 の「実データで稼働していた」への訂正。

## 5. 収集していない範囲

- 会話ログは検索語（OT／Orrery／Telemetry／ダッシュボード／agent node と M3E の同時出現）で絞った。全発言の逐語確認ではない。
- ChatGPT 上の設計会話（S1 で参照された `ChatGPT-バックエンド接続設計-20260826-2246.md`、`ChatGPT-M3E Agent Mapping Plugin-20260827-0925.md`）と Hermes（S7 で参照）は開いていない。
- 現行 M3E の画面（実物）は確認していない。
