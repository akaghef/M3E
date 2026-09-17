---
pj_id: PJ08
project: M3E_OT_Fusion
date: 2026-09-15
status: active
owner: akaghef
related:
  - plan.md
  - tasks.yaml
  - mocks/screen01.html
  - ../../docs/09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md
  - ../../.kiro/steering/farthest_goal.md
---

# PJ08 — M3E × OT 合併吸収

OT（[`gyroid-eth/orrery-telemetry`](https://github.com/gyroid-eth/orrery-telemetry)）を M3E の
一枚絵へ合併吸収する PJ。散在していた6本の worktree・停止した spec・未マージの Strategy を
1つの器に集約し、**GUI を先に収束させてから**論理と実装へ進む。

## Vision

### 何が痛いか

論理側（ADR_009 / ADR_011 / S17 / farthest_goal）はほぼ揃っているのに、**完成図の1画面が1枚も
出来上がっていない**。そのため:

- 実装が何に向かっているのか、akaghef が目で確認できない。
- GUI が曖昧なまま論理を進めると、目標定義が静かに書き換わる。
- 作業が6本の worktree に散り、判断が集積しない。

過去の失敗（2026-09-14, Fugu の RG1 Mock）は**受入契約が数量条件**（「6つの task card と
6つの agent card がある」）だったため、一般的な業務 dashboard へ退化した。視覚 QA も
「崩れていないか」しか見ていなかった。`farthest_goal.md` の **RK4「目標が dashboard へ縮退する」**
が事前に名指ししていたが、RK4 が散文の注意書きでゲートではなかったため機能しなかった。

### 完了像

`docs/01_Vision/Strategy.md` の **S17.8** をそのまま完了定義とする。

1. OT の observation contract が M3E connector seam を通り、実データで運転される。
2. OT 由来の Agent / Runtime が、M3E map 上の Goal / Task / Role へ typed edge で接続される。
3. `お金` を最初の Resource node として置き、canonical owner と semantic relation を混同せず俯瞰できる。
4. 複数 PC + 常駐 mac mini が同一 PJ / Task / agent state を矛盾なく共有する。
5. 指示と観測が同じ map 面で起きる（別 dashboard を併用しない）。
6. OT / 常駐 host が不適合でも portable source と adapter が残り、撤退できる。

ただし **PJ08 の Phase 1 の完了像は上記ではなく、「akaghef が1画面を見て採否を判断できる状態」**。
Phase 1 を閉じてから Phase 2 以降で S17.8 に向かう。

### 明示的な範囲外

`S17.6` に従う。

- 複数人 Team Collaboration の一般解（`S2` の当初範囲）。個人 multi-PC が成立してから再評価する。
- OT にない全自動化。`RQ6` は注意をゼロにするのではなく、向けるべき場所を正確にすること。
- OT 画面の忠実な移植。interaction grammar は抽出するが dashboard 化（`RK4`）へ縮退させない。

加えて PJ08 固有:

- **Phase 1 では DB と agent runtime を作らない。** 静的 mock に限る。
- **Surface View を新造しない**（`ADR_011 DC2`）。Orrery は map に載るデータであって新しい配置規則ではない。

## 主成果物

| 成果物 | 位置 | 状態 |
|---|---|---|
| 1枚目の1画面 mock | `mocks/screen01.html` | 初稿提出済（2026-09-15、akaghef「第一案としては優秀」） |
| 散在 worktree の吸収表 | `plan.md` | 作成済 |
| node type カタログ | `docs/`（未着手） | Phase 2 |
| connector seam 契約 | `.kiro/specs/`（未着手） | Phase 3 |

## ドキュメント構成

```text
projects/PJ08_M3E_OT_Fusion/
├── README.md              ← 本ファイル。Vision と運用ルール
├── plan.md                ← Phase 設計・吸収表・探索ログ
├── tasks.yaml             ← sprint contract
├── resume-cheatsheet.md   ← セッション再開用
├── retrospective.md       ← 振り返り
├── mocks/                 ← 静的 mock（DB / runtime なし）
├── reviews/               ← 未決論点 Qn
└── runtime/               ← Progress / Evaluation / Review board
```

## 正本との関係

PJ08 は**正本を持たない**。決定の正本は ADR、方向の正本は steering、用語の正本は
`agent_orrery_terminology.md`。PJ08 が持つのは**実行の器**だけ。

| 種類 | 正本 |
|---|---|
| 方向 | `.kiro/steering/farthest_goal.md`（RQ1–RQ6） |
| 決定 | `docs/09_Decisions/ADR_011`, `ADR_009`, `docs/06_Operations/Decision_Pool.md` |
| Strategy | `docs/01_Vision/Strategy.md` S17（**未マージ**: `codex/ot-absorption-strategy`） |
| 用語 | `.kiro/steering/agent_orrery_terminology.md` |
| Surface View / port | `.kiro/steering/ui_view_taxonomy_and_ports.md` |
| 色 | `.kiro/steering/color_semantics.md`（**PJ08 の Q1 で争点化中**） |

## 役割分担

| 役 | 担当 | 備考 |
|---|---|---|
| Phase 遷移判定 | **人間が◎、Claude は×** | akaghef のみが Gate を開ける |
| 方向・意図の確定 | akaghef | |
| Director（分解・handoff・レビュー・検証） | Claude | |
| 実装 | Codex | `scripts/codex.sh exec` 経由 |
| backend / observation contract | Fugu (Hermes) | akaghef 指示（2026-09-15） |
| front / GUI 収束 | Claude | akaghef 指示（2026-09-15）。**Phase 1 の例外として Claude が直接描く** |

`human outer loop / autonomous inner loop`。inner loop は Codex / Fugu が回し、
Phase 遷移と GUI 採否は outer loop（akaghef）が握る。

## 運用ルール要点

1. **GUI の受入契約に数量条件を使わない。** 「N個ある」は契約にならない。2026-09-14 の失敗の直接原因。
2. **Phase 1 は DB / agent runtime を作らない。** 静的 mock の採否を先に閉じる。
3. **新しい面を増やさない**（`RQ5` / 拘束規則7）。別 dashboard・別アプリ・別 DB は理由が書けない限り採らない。
4. **観測由来と自己申告由来を同じ field に流さない**（`RQ3` / `ADR_011 DC21` field 単位所有権）。
5. **「試験成功」を「統合成功」と読み替えない**（拘束規則6）。
6. spec / design / handoff は `RQ1`–`RQ6` のどれに寄与するかを1行以上書く。

## Future Work

- OT 上流（`gyroid-eth/orrery-telemetry`）への寄与 vs 観測層の自前化（`RK3` の未決分岐）。
- Swingby チーム知識マップ（`human` が他人になる初の試験）への一般化。
- 複数人 Team Collaboration（`S2` の当初範囲）の再開判断。

## 進捗ログ

| 日付 | 内容 |
|---|---|
| 2026-09-15 | PJ08 立ち上げ。`mocks/screen01.html` 初稿を提出、akaghef「第一案としては優秀」。器を stow |
