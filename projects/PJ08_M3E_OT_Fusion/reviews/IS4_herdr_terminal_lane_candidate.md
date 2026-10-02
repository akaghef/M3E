# IS4 — herdr を「端末実行層」の第3統一候補として PJ08 に採るか

- status: open
- raised: 2026-09-21
- raised_by: fugu (Hermes)
- decided_by: akaghef
- source: `analysis/260921_am_ot_herdr_layer_comparison.md` IS4
- blocks: なし（Phase 1 は影響を受けない）。将来 Phase の方向にのみ関わる

## 何が問われているか

現在の canon（`ADR_011` / `.kiro/steering/farthest_goal.md`）は、observation / coordination の
上流として **OT（`gyroid-eth/orrery-telemetry`）**のみを想定している。持ち込まれた外部 doc は、
第3の層として **herdr（`herdrdev/herdr`, Apache-2.0）**を「端末実行層（terminal / process /
native session）の統一先候補」として提案する。

doc の主張の骨子:

- OT は launcher / identity / session 名一致 / `PARENT_AGENT` / mail signal 配達 / terminal
  capture / jump / 存続確認まで **tmux に結合**している。
- herdr は跨 OS の terminal / process / PTY 操作 API が強く、**native Windows** に対応する
  （OT は Mac + WSL2 のみ、native Windows は community 実験）。
- したがって「OT + tmux を維持しつつ、新規 terminal Actor だけ herdr adapter で一体だけ稼働させ、
  認証・通知・再開・終了を適合試験 → 合格後に terminal lane を herdr へ収束」。
- ただし **herdr は協調機構（mail / receipt / reservation の正本）を代替しない**。tmux 文字列を
  置換して完成する話ではない。同一 session を再開する controller は必ず1つにする
  （OT cold wake と herdr native session restore と M3E resume を同時に有効化すると二重起動）。

## 上流照合（fugu, 2026-09-21、確認済み）

- herdr = Apache-2.0（OSI open source）。OT = PolyForm Perimeter 1.0.1（source-available）。
- herdr の `agent.prompt` 成功はターン完了でなく **入力送信完了**。`blocked` state では
  `agent_blocked` で拒否。→ M3E の command 完了判定に流用するなら observed-finished を別に取る必要がある
  （`analysis/...` 上流ソース実地照合 / Phase 3 契約素案）。

## 選択肢

| ID | 案 | 帰結 |
|---|---|---|
| **OP1** | **候補として記録するに留める。** 現 Phase では OT のみ。Phase 5（multi-PC / native Windows Actor が実需化）で再評価 | canon 不変。native Windows 作業（MATLAB / CAD 等）の実需が出るまで判断を遅らせる。最小コミット |
| **OP2** | **herdr を farthest_goal の観測/実行層候補として明記する。** RQ に「端末実行層は OT tmux → herdr へ段階移行しうる」を追記 | 方向が canon 化する。RQ 追加は akaghef 判断（farthest_goal 適用ルール）。早すぎると「実装のない予約席」化のリスク |
| **OP3** | **不採用。** OT + tmux に固定し herdr を検討対象から外す | native Windows 端末の共通化を諦める。doc の指摘（OT の native Windows 未対応）が残る |

## Director（fugu）の見立て

**OP1 を推す。** 理由:

- farthest_goal の現在地スナップショットは「connector 未実装、observation → M3E が 0 件」。
  端末層の移行先を今決めても消費者がいない（ADR_010 が禁じた「実装のない予約席」に近づく）。
- herdr 採用の実需は「native Windows で実作業する Actor」だが、それは Phase 5（multi-PC）の話。
  Phase 1（GUI 収束）・Phase 3（connector seam）はどちらも herdr を必要としない。
- ただし doc の技術照合は正しく、候補として**記録する価値はある**。撤退可能性（RQ 撤退線）の観点でも
  Apache-2.0 の herdr を控えとして持つのは健全。

## akaghef の回答

<!-- ここに記入 -->
