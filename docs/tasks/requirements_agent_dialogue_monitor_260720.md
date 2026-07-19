# 要求定義: Agent 対話監視面（Akaghef-System 帰属 backend + M3E 表示面）

- 日付: 2026-07-20
- 起草: Claude Director（akaghef との要求対話の収束。仕様・実装はこの文書の承認後）
- 状態: akaghef 確定事項の記録。**実装 dispatch はまだ行わない**
- 関連: [ADR_009](../09_Decisions/ADR_009_Orchestration_Fusion_Into_M3E.md) /
  [agent_network_dashboard_reference_260707/](agent_network_dashboard_reference_260707/) /
  codex-agent-mapping スレ（Agent=Session 1:1、mailbox/semantic 二層 edge）

## 中核 use case（UC0）

Akaghef-System に居ながら、稼働中の全 agent（Claude / Codex / Hermes）を一覧し、
任意の agent を選ぶと**その対話（会話ログ）が読める**。監視の原子単位は metrics ではなく対話。

派生場面: UC1 俯瞰→焦点 / UC2 詰まり発見 / UC3 介入 / UC4 事後 replay / UC5 agent 間対話の追跡。

## 確定要求

### RQ1: Surface 情報密度は 3 段

- 常時: **session タイトルのみ**
- hover: **akaghef の手書きメモ**（概要欄。自動要約は当面しない）+ 必要なら直近発言
- 選択: 対話全文 stream

表面は軽く、読みに行く動作だけ深く（Progressive Navigation と同型）。

### RQ2: 介入は段階ラダー。到達目標は画面内完結、直近成果物は L0

| Level | できること |
|---|---|
| L0 | 読む（タイトル / hover メモ / 対話全文） |
| L1 | 飛ぶ（その session の実端末・実画面を開く） |
| L2 | 打つ（画面からメッセージ送信。agmsg / inko 経由、send gate 準拠） |
| L3 | 終える（graceful 終了。確認レイヤ必須 — reference 08 の safety boundary 準拠） |
| L4 | 引き継ぐ（handoff 作成まで画面内完結） |

要求はアーキテクチャがこのラダーを妨げないこと。介入操作自体も agmsg として graph に記録される（監視面の再帰性）。

### RQ3: 更新は file watch（push）。polling 禁止

session ログ（`~/.codex/sessions/**`、`~/.claude/projects/**`、Hermes state.db）への
OS ファイルイベント購読で即時更新。

### RQ4: 帰属境界 — backend は Akaghef-System、M3E は表示面のみ

- 監視 backend は akaghef 個人システムと密結合であり **A-sys に帰属**。M3E 製品としては出さない
- M3E（公開 repo）に入るのは表示面と projection 契約のみ。A-sys 側の私的 plugin が
  projection を produce する（ADR_009 §3 の out-of-process plugin 契約の適用。
  repository-canon「private は公開 repo の外」と整合）
- ADR_009 §4 の「別 lane」の宛先はこれで A-sys に確定

## 長期方向（akaghef 2026-07-20、要求ではなく方位）

チームの人間同士も inko が繋ぎ、下層は sync（状態複製）と agmsg（メッセージ搬送）が繋ぐ
構成が一般形になる。人間も同じ graph の node になり、agent で検証した監視・介入・引き継ぎの
構造が相似形でチーム（Swingby）へ写像される。mailbox 型（宛先不在でも送れる）は
人間の非同期性でこそ本領を発揮する。

## 次工程（未着手）

1. この要求の仕様分割: (a) A-sys 側 backend（観測 + projection 生成）/ (b) M3E 側表示面（契約消費）
2. 表示面は Track U seam / rendering tier policy（標準=SVG）に従う
3. L0 スライスの spec 起草 → akaghef 承認 → 実装 dispatch
