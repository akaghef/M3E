# Handoff: Orchestration Map Pilot — Neo4j + policy 上乗せ

- 日付: 2026-07-19
- 起草: Claude Director（akaghef との S16 再考対話の収束）
- 状態: **draft — akaghef の scope 確認後に dispatch**
- 前提タスク: T1（Command Language 3 平面整列）、T2（M3E 設計データ semantic source 化）— 両方 dispatch 済み
- 関連: [handoff_s16_neo4j_federation_define_260718.md](handoff_s16_neo4j_federation_define_260718.md) / [ADR_008](../09_Decisions/ADR_008_Federated_Canonical_Sources.md) / [Federated_Semantic_Source.md](../03_Spec/Federated_Semantic_Source.md)

## 1. Use case（akaghef 確定 2026-07-19）

> **Plan Hierarchy（Principle / Vision / Strategy / Goal / Task）の DAG と、各案件に対応する agent・gate・status を単一の信頼できる model に載せ、案件処理を一枚絵で俯瞰する。**

- V5（MDD）の具体形。Director→Codex の運用（handoff、検証、gate、承認）自体が model の最初の住人になる（dogfooding）
- playground の可視化群（neural-org-map 等）はこの base の上の view に降格する。base を ad-hoc に作ると上が積み上がらない — **信頼性は Neo4j の力学（ACID・制約・Cypher）に委譲し、M3E 意味論は policy として上乗せする**
- 監査根拠: 現行 beta model 層は direct mutation 594 箇所・process-local lock・保存前検査の寄せ集めであり、graph transaction runtime ではない（2026-07-19 監査）

## 2. Demand Gate 充足（実需 query 3 件）

| ID | Query | 性質 |
|---|---|---|
| Q1 | この Goal に紐づく未完了 Task と blocking Gate は何か | 多段 traversal（Goal→Task→Gate） |
| Q2 | agent X が現在保有する案件と待ち状態は何か | 横断集約（Agent→ASSIGNED_TO→Task→status） |
| Q3 | S16 配下の判断待ち proposal と根拠文書は何か | role 混在 query（M3E-owned proposal + source-materialized doc） |

## 3. Record role 配置（ADR_008 準拠）

| 層 | record role | canonical owner |
|---|---|---|
| P / V / S / ADR / spec | source-materialized | docs/（Git）。T2 の semantic source package から import |
| Goal / Task / Agent / Gate / status / assignment | **M3E-owned accepted** | Neo4j canonical runtime（ADR_008 Decision 3 の初適用） |
| agent 提案 | :Proposal ラベルの node/relation | graph 内 data パターン（承認で promote。P5 準拠） |

## 4. Policy 上乗せの形（graph 操作エンジンは作らない）

1. **label / property 規約**: 全 node に `id`（unique 制約）、`provenance`、`refinementLevel`。relation は大文字動詞（REFS / DECOMPOSES / ASSIGNED_TO / BLOCKED_BY / SUPERSEDES / PROPOSES）。語彙は T1 の対応表に従い ad-hoc 語禁止
2. **lint query**: CE の制約不足（存在制約は Enterprise）を違反検出 Cypher で補完し、CI / agent が定期実行
3. **:Proposal パターン**: agent 書き込みは Proposal として入り、人間の承認操作で accepted へ promote
4. **Recovery Gate**: 定期 dump ＋ logical export（JSON/Cypher script）→ 復元 drill を 1 回実証。backup は補助であり、gate 根拠は portable export + 再投入
5. **agent 接続**: Neo4j 公式 MCP server（読み = RQ11 の read-only Cypher）。接続コード自作ゼロ

## 5. 非目標

- 既存 Rapid viewer / SQLite レーンの移行（direct mutation 594 箇所は command seam 整備後の別戦線）
- indexer 常駐・federation 自動化（import は当面 CLI 一発の再実行で足りる）
- 一枚絵 UI の作り込み（既存 playground view の接続確認まで。UI 洗練は後続）
- Neo4j Enterprise 機能への依存

## 6. Acceptance

1. Neo4j CE がローカルで起動し、T2 package の import と全削除→再 import（rebuild）が再現可能
2. Goal / Task / Agent / Gate の M3E-owned 層に、現在進行中の実案件（S16 系タスク群）が入っている
3. Q1〜Q3 が Cypher で答えを返し、結果に revision / provenance が含まれる
4. Claude / Codex が MCP 経由で Q1〜Q3 を実行できる
5. lint query が違反 0 を示し、故意の違反注入を検出できる
6. dump + logical export からの復元 drill 成功（Recovery Gate）
7. 既存 M3E beta の動作に一切影響がない
