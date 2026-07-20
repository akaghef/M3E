# Memory Architecture — Deep canonicality と揮発の外部化

Hermes Agent (Nous Research) のインストールを契機に、M3E の "memory" 層を
帯域軸（Flash/Rapid/Deep）で再設計するブレスト。

外部 agent（Hermes）に **揮発レイヤを委譲し**、M3E は **Deep の正本** として
振る舞う運用を抽出する。付箋（コメント層）はその副産物。

## 方針

- **採否は決めない**。Deep canonicality を守る選択肢を並べて並列に置く
- **実装詳細は決めない**。MVP ファイルだけ最小スケッチを置く
- 既存ブレスト `privacy_security/` `maintenance_hygiene/` `ai_agent_deep/` と cross-link
- Hermes 比較は出発点であって、結論は M3E 固有

## ファイル構成

- [README.md](README.md) — 本索引、論点一覧、cross-link
- [01_three_tier_model.md](01_three_tier_model.md) — 帯域軸 × M3E vs Hermes 対応表、3層モデル
- [02_hermes_integration_options.md](02_hermes_integration_options.md) — 揮発委譲の3パターン（gateway / cron / heavy worker）
- [03_deep_canonicality_rules.md](03_deep_canonicality_rules.md) — Deep を M3E 正本に固定する 7 ルール
- [04_sticky_notes_layer.md](04_sticky_notes_layer.md) — コメント層（付箋）の物理分離と運用 8 属性 / 7 ルール
- [05_mvp_and_open_questions.md](05_mvp_and_open_questions.md) — MVP 候補、未決質問

## 全体俯瞰 / 論点マップ

帯域軸×関係軸で M3E の memory を 4×2 マスに展開：

| | Syntax（構造） | Semantic（意味） |
|---|---|---|
| Flash | Hermes session buffer / gateway 入電 | Hermes MEMORY.md（嗜好・口調） |
| Rapid | scratch 生テキスト / .remember/now.md | reviews/Qn 未決 / backlog 議論中 |
| **Deep** | **map グラフ構造（親子・facet・ID）** | **map ノード本文（axes, glossary, vision, 確定 PJ 仕様）** |

太字 2 マスが M3E 正本ゾーン。それ以外は外部委譲対象。

## 論点一覧

### T. 三層モデル（01_three_tier_model.md）
- T1. Hermes 設計の本質（ハード予算 / frozen snapshot / 二系統 / nudge & flush）
- T2. M3E 三層（Tier A 注入 / Tier B 構造化検索 / Tier C アーカイブ）
- T3. M3E 固有の Tier B（map）が Hermes に存在しない優位
- T4. Tier A の予算・consolidation 規律の不在（現状の病理）
- T5. scratch / backlog / Qn の tier 帰属の混乱

### I. Hermes 統合（02_hermes_integration_options.md）
- I1. Gateway scratch 入口（Discord/Telegram 経由で外出先から map に投入）
- I2. Cron janitor（夜間に sort-task / scratch 整理 / dead-link 検出）
- I3. Heavy worker（pdf-raw-process 等を Hermes 側で実行、結果をサブツリー化）
- I4. 二重正本リスクと "M3E = canonical, Hermes = 揮発ワーカー" の原則
- I5. sensitive cone を Hermes に流さない線引き

### D. Deep canonicality（03_deep_canonicality_rules.md）
- D1. Promote 一方向（Flash/Rapid → Deep）
- D2. Settling Gate（昇格条件 3 つ）
- D3. Mirror-but-not-source（Hermes は read-only キャッシュ）
- D4. Demotion は archive、Rapid に戻さない
- D5. Read-path 優先順位（map → ~/.claude/memory → Hermes）
- D6. Write-path は Qn settling を必ず通す
- D7. Privacy 境界 = Deep 境界

### N. 付箋層（04_sticky_notes_layer.md）
- N1. 付箋の正体（局所化された暫定）vs Qn/scratch（未局所化）
- N2. 物理分離の実装オプション 4 案、A 案推し（kind: "comment" + comments_on）
- N3. 必要属性 8 つ（author / ts / target / kind / status / promotion_target / bandwidth / encrypted）
- N4. 運用ルール 7 つ（昇格しない / projection 除外 / toggle / 寿命 / 2 段制限 / 区別表示 / trace）
- N5. scratch / Qn / backlog との役割再分担

### M. MVP / 未決（05_mvp_and_open_questions.md）
- M1. 最初に効く着手（D5 read-path 文書化、D2 Gate 条件化）
- M2. 付箋 MVP（B 案 attribute → A 案 別 kind の進化順）
- M3. Tier A 予算ルール（char/ノード制限の実装）
- M4. 主要な未決質問

## Cross-link

`privacy_security/`：
- 03_encryption_options.md：D7（Privacy=Deep 境界）の実装基盤
- 05_vault_separation.md：sensitive cone の構造化
- 02_threat_model.md：Hermes gateway 経由の prompt injection 面（I1）

`maintenance_hygiene/`：
- 02_detectors.md：scratch overflow / Deep 腐敗の検出器
- 03_actions.md：consolidation / promote / archive アクション

`ai_agent_deep/`：
- G3 送信前検閲（L5）：Hermes に流す前のフィルタ
- G10 AI 出力痕跡：付箋の author 属性と整合
- C10 自走 AI：Hermes cron janitor（I2）の前身

`automation_obstacles/`：
- P9 痕跡保存：D4 demotion-to-archive
- P15 アンドゥ：付箋 resolve trace
- N1 思考の核心：Deep 正本そのもの

## キーメッセージ（暫定）

- 揮発（Flash/Rapid）は外に出してよい、**Deep だけは絶対に M3E が持つ**
- Hermes の memory は flat で 800 token 上限。M3E の Tier B（map）はそれを構造的に超える
- ハード予算と consolidate 強制は **注入される層だけにかける**（Tier A のみ）
- Deep は **昇格に Qn ゲートを通し、降格は archive のみ**。Rapid に戻さない
- 付箋は本/付箋メタファ通り **物理層を分け、projection から除外、toggle で隠せる**
- Privacy 境界 = Deep 境界、で encrypt 対象が機械的に決まる
