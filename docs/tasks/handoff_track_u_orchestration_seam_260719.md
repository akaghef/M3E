# Handoff: Track U — Orchestration Board Seam（別スレ実行用）

- 日付: 2026-07-19
- 起草: Claude Director（本スレ = S16/Track D 継続スレ。Track U は本 handoff を正本として別スレで実行する）
- 宛先: 別スレの Claude Director（→ Codex worker へ分解 dispatch）
- 状態: ready to start
- 関連正本: [handoff_orchestration_map_pilot_260719.md](handoff_orchestration_map_pilot_260719.md)（Track D 側）/ [handoff_s16_neo4j_federation_define_260718.md](handoff_s16_neo4j_federation_define_260718.md)（S16 define 全体）

---

## 1. 背景と戦略判断（akaghef 確定事項）

- **Use case**: Plan Hierarchy（Goal / Task）DAG と担当 agent・gate・status を一枚絵で俯瞰し、案件処理を追える状態を作る（V5 MDD の具体形）
- **勝負どころ判定（2026-07-19）**: M3E の差別化は **Miro 的操作感と Progressive Navigation** にある。DB 等の非機能側は hygiene であり差別化ではない。infra 系タスクへの偏り（仕様化・検証しやすいタスクに dispatch が引き寄せられる legibility bias）を自覚し、**UX 線は akaghef の GUI 判断を loop に入れて回す**
- **進め方**: 最小 use case から徐々にスケールアップし、各スライスで UX を確かめる
- **二本立て**:
  - **Track U（本 handoff・主戦線）**: orchestration seam を最小構成で作り、UX 検証しながら拡張
  - **Track D（別スレ＝元スレで継続）**: Neo4j pilot（薄皮の委譲作業）。**Track U は Track D の完了を待たない・依存しない**

## 2. 合流契約（両 Track を絶縁する境界。変更には両スレの合意が必要）

> **seam は「orchestration projection（JSON）」だけを読む。書き込みは graph operation 形式で出す。substrate（今: M3E-local / 将来: Neo4j materialization）を seam は知らない。**

### 2.1 orchestration projection schema v0

```jsonc
{
  "schema": "m3e.orchestration-projection.v0",
  "provenance": { "generatedAt": "...", "sourceRevision": "...", "generator": "..." },
  "nodes": [
    { "id": "goal:...", "kind": "goal|task|agent|gate",
      "label": "...", "status": "pending|in_progress|blocked|done",
      "refs": ["S16", "docs/..."] }
  ],
  "links": [
    { "from": "goal:...", "to": "task:...", "type": "DECOMPOSES|ASSIGNED_TO|BLOCKED_BY|REFS" }
  ]
}
```

- relation type は大文字動詞（[Command_Language.md](../03_Spec/Command_Language.md) 3 平面・Glossary §1.1 対応表に従う）。**ad-hoc 語の導入禁止**、新語は Glossary 登録必須
- projection は派生物（materialization）。正本にしない・手編集しない・`provenance` 必須
- 書き平面: U2 以降の編集は `ops{op,target,key,value}` の graph operation 形式で発行し、適用先 adapter（今は M3E-local API、将来 Neo4j policy 層）を差し替え可能にする

## 3. U1 スコープ（最初のスライス・読み取り専用）

- **成果物**: beta viewer に orchestration board（読み取り専用の一枚絵）を seam として追加
  - Goal→Task DAG を status 色付きで表示。agent 割当（ASSIGNED_TO）を可視化
  - データは静的 projection JSON 1 ファイル（schema v0）。**内容は実案件**（S16 系 PR 系譜、Track D pilot、本 Track U 自身、S2 Phase 2 の Goal/Task、agent = claude-director / codex-worker）
- **遵守（BINDING）**:
  - [UI_Seam_Integration_Contract.md](../03_Spec/UI_Seam_Integration_Contract.md) と resource claim gate に従う。**seam は exclusive**（部分 seam 化が過去に PN / scatter / edge 本番破綻を起こした）
  - viewer への表示面追加は `.kiro/steering/ui_view_taxonomy_and_ports.md` と [map_layout_modes.md](../03_Spec/map_layout_modes.md)（Surface View 正本）を honor すること（新 spec がこれを無視しがちなので明示）
  - viewer.ts の共有 state を seam API 外から直接触らない（direct mutation 594 箇所問題を増やさない）
- **UX 検証**: 実装後は launch-beta で起動し、**akaghef に確認依頼を出す**（agent の screenshot 自己判定で完了扱いにしない。機能 smoke test は可）
- **非目標**: 書き込み、Neo4j 接続、PN 深統合、初回からの UI 磨き込み、既存 view の改変

## 4. スライス計画（各段で akaghef の GUI 判定を経てから次へ）

| Slice | 内容 | 書き込み |
|---|---|---|
| U1 | 読み取り専用 board（本 handoff の主対象） | なし |
| U2 | status 編集（click/drag）。graph operation 形式で発行し M3E-local へ適用（fast lane） | あり |
| U3 | agent 報告の自動反映（agmsg / canvas-protocol 経由の status 更新が board に届く） | 間接 |
| U4 | **合流**: projection 生成元を Track D の Neo4j materialization に切替（seam 側は原則無変更が成功条件） | — |

## 5. 運用

- worktree: `/Users/nisimoriyuuya/dev/M3E-worktrees/orchestration-board-seam`、branch `codex/orchestration-board-seam`、PR → `dev-beta`（Draft、Director review）
- **注意**: codex sandbox は worktree の git metadata（primary 側 `.git/worktrees/`）へ書けない。**commit / push / PR は Director が実行**する（本スレで確立した標準手順）
- codex dispatch は `scripts/codex.sh exec -m gpt-5.5`（グローバル config の gpt-5.6-sol は CLI v0.139.0 非対応）
- 参考資料: `docs/tasks/agent_network_dashboard_reference_260707/`（orchestration dashboard の参照物）

## 6. U1 Acceptance

1. seam contract / resource claim gate 準拠（契約文書へのエントリ追加含む）
2. projection JSON が schema v0 に適合し、実案件データで board が表示される
3. 既存 view・既存テストへの影響ゼロ（CI green）
4. **akaghef が GUI を見て操作感の初期判定を出せる状態**（URL / 起動手順 / 見るべき点を添えて確認依頼）
5. ad-hoc 用語ゼロ（語彙は Command_Language / Glossary 準拠）
