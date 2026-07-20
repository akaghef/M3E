# M3E Documents Index

This file is the content-oriented index for `docs/`. It is generated from the current file tree and maintained as the navigation layer described in `06_Operations/LLM_Wiki_Schema.md`.

- Regenerate: `node scripts/ops/check-docs-index.mjs --write`
- Check: `node scripts/ops/check-docs-index.mjs --check`
- Coverage: all files under `docs/`, excluding `docs/.obsidian/` and `.DS_Store`
- Indexed files: 584

## Reading Routes

- Session bootstrap: `00_Home/Agent_Brief.md`, `00_Home/Current_Status.md`, `00_Home/Glossary.md`
- Current product direction: `00_Home/Home.md`, `00_Home/Objective.md`, `01_Vision/Strategy.md`
- Feature meaning: `03_Spec/` first, then `04_Architecture/`
- Operations and handoff: `06_Operations/`, then `tasks/`
- Raw ideas and research: `ideas/`, `research/`, `competitive_research/`, `legacy/`

## Directory Catalog

### 00_Home - entry and current state

| File | Type | Title | Summary |
|---|---:|---|---|
| [00_Home/Agent_Brief.md](<./00_Home/Agent_Brief.md>) | Markdown | Agent Brief | 最終更新: 2026-04-20 |
| [00_Home/Current_Status.md](<./00_Home/Current_Status.md>) | Markdown | Current Status | 最終更新: 2026-07-19 |
| [00_Home/Glossary.md](<./00_Home/Glossary.md>) | Markdown | Glossary — M3E 用語辞書 | M3E プロジェクト固有の語、および揺れがちな語を正規化する辞書。 |
| [00_Home/Home.md](<./00_Home/Home.md>) | Markdown | M3E — Home | 最終更新: 2026-04-20 |
| [00_Home/Objective.md](<./00_Home/Objective.md>) | Markdown | Objective — Planning Hierarchy | 最終更新: 2026-04-20 |
| [00_Home/README.md](<./00_Home/README.md>) | Markdown | 00_Home/ | **役割**: LLM / 人間の入口。セッション開始時に最初に読む場所。 |

### 01_Vision - principles, vision, strategy

| File | Type | Title | Summary |
|---|---:|---|---|
| [01_Vision/Axes.md](<./01_Vision/Axes.md>) | Markdown | M3E の帯域軸（粒度・構造・操作の連動進化） | M3E は同じ基礎データを **単位（粒度）と構造の性質が連動して変化する帯域** で扱う。 |
| [01_Vision/Core_Principles.md](<./01_Vision/Core_Principles.md>) | Markdown | Core Principles | この文書の内容は [Principle.md](./Principle.md) に統合した。 |
| [01_Vision/Principle.md](<./01_Vision/Principle.md>) | Markdown | Principle | 最終更新: 2026-04-20 |
| [01_Vision/README.md](<./01_Vision/README.md>) | Markdown | 01_Vision/ | **役割**: M3E の `Planning Hierarchy` 上位層を置く場所。原則・未達ギャップ・攻略方針を階層ごとに分けて管理する。 |
| [01_Vision/Strategy.md](<./01_Vision/Strategy.md>) | Markdown | Strategy | 最終更新: 2026-07-18 |
| [01_Vision/Vision.md](<./01_Vision/Vision.md>) | Markdown | Vision | 最終更新: 2026-04-20 |
| [01_Vision/Weekly_Advance.md](<./01_Vision/Weekly_Advance.md>) | Markdown | Weekly Advance | 最終更新: 2026-04-20 |

### 03_Spec - functional specifications

| File | Type | Title | Summary |
|---|---:|---|---|
| [03_Spec/AI_Common_API.md](<./03_Spec/AI_Common_API.md>) | Markdown | AI 共通 API 仕様 | 最終更新: 2026-04-02 |
| [03_Spec/AI_Integration.md](<./03_Spec/AI_Integration.md>) | Markdown | AI連携仕様 | 最終更新: 2026-04-02 |
| [03_Spec/AI_Use_Cases.md](<./03_Spec/AI_Use_Cases.md>) | Markdown | AI 利用シナリオ集 | 最終更新: 2026-04-02 |
| [03_Spec/Band_Spec.md](<./03_Spec/Band_Spec.md>) | Markdown | Band Spec | M3E は同一の基礎構造を、思考密度の異なる 3 つの帯域で扱う。 |
| [03_Spec/Cloud_Sync_Conflict_Resolution.md](<./03_Spec/Cloud_Sync_Conflict_Resolution.md>) | Markdown | Cloud Sync Conflict Resolution — 仕様書 | Cloud Sync で競合が発生した際に、GitHub の merge conflict resolution に相当する |
| [03_Spec/Cloud_Sync.md](<./03_Spec/Cloud_Sync.md>) | Markdown | Cloud Sync | この文書は、Beta におけるクラウド同期の最小戦略を定義する。 |
| [03_Spec/Command_API_Reference.md](<./03_Spec/Command_API_Reference.md>) | Markdown | M3E Command API Reference | 書き平面の実装リファレンス。平面構造と語彙は [Command_Language.md](./Command_Language.md) が正であり、この文書は既存 beta UI / browser console の `window... |
| [03_Spec/Command_Language.md](<./03_Spec/Command_Language.md>) | Markdown | M3E コマンド言語仕様 | 最終更新: 2026-07-19 |
| [03_Spec/data_import_export.md](<./03_Spec/data_import_export.md>) | Markdown | Data & Import/Export 設計ドキュメント | 最終更新: 2026-04-09 |
| [03_Spec/Data_Model.md](<./03_Spec/Data_Model.md>) | Markdown | Data Model | この文書は、M3E の実体モデルに関する不変条件を定義する。 |
| [03_Spec/Data_Runtime_Layout.md](<./03_Spec/Data_Runtime_Layout.md>) | Markdown | Data Runtime Layout | 永続データ実体。`data.sqlite` だけでなく backup, audit, cloud-sync, conflict-backups を含むフォルダ単位 |
| [03_Spec/Federated_Semantic_Source.md](<./03_Spec/Federated_Semantic_Source.md>) | Markdown | Federated Semantic Source | 最終更新: 2026-07-19 |
| [03_Spec/home_scope_navigator.md](<./03_Spec/home_scope_navigator.md>) | Markdown | Home Screen / Scope Navigator -- Design Document | Date: 2025-04-09 |
| [03_Spec/Home_Screen.md](<./03_Spec/Home_Screen.md>) | Markdown | Home Screen 仕様書 | 作成日: 2026-04-14 |
| [03_Spec/Import_Export.md](<./03_Spec/Import_Export.md>) | Markdown | Import / Export 仕様 | > **MVP 対応状況を含む。** 未実装のものは「未実装」と明記する。 |
| [03_Spec/Joint_Integration_Hub.md](<./03_Spec/Joint_Integration_Hub.md>) | Markdown | Joint Integration Hub — リマインダー & 外部サービス共通連携層 | 最終更新: 2026-04-22 |
| [03_Spec/Linear_Tree_Conversion.md](<./03_Spec/Linear_Tree_Conversion.md>) | Markdown | Linear <-> Tree 変換仕様（Draft） | M3E の主構造（Tree）と線形表現（Linear）を相互に変換し、 |
| [03_Spec/local_file_integration.md](<./03_Spec/local_file_integration.md>) | Markdown | ローカルファイル連携設計 | 最終更新: 2026-04-15 |
| [03_Spec/map_layout_modes.md](<./03_Spec/map_layout_modes.md>) | Markdown | Map Layout Modes 設計ドキュメント | > **Status**: Draft (Surface View 正本更新済み、コード移行は別タスク) |
| [03_Spec/Map_Structure_Index.md](<./03_Spec/Map_Structure_Index.md>) | Markdown | Map Structure Index | このファイルは索引のみ。canonical rule の本文を重複させない。 |
| [03_Spec/Model_State_And_Schema_V2.md](<./03_Spec/Model_State_And_Schema_V2.md>) | Markdown | Model State 分離と Schema v2 仕様 | 本仕様は以下を明確化する。 |
| [03_Spec/Node_Path_Notation.md](<./03_Spec/Node_Path_Notation.md>) | Markdown | Node Path Notation | M3E マップ上のノードを、会話・ログ・スキル指示・Map Manager 指示で指し示すための公式表記法。 |
| [03_Spec/Obsidian_Vault_Integration.md](<./03_Spec/Obsidian_Vault_Integration.md>) | Markdown | Obsidian Vault 連携仕様（Import / Export / Live Mode） | 最終更新: 2026-04-15 |
| [03_Spec/README.md](<./03_Spec/README.md>) | Markdown | 03_Spec/ | **役割**: 機能仕様。**何を作るか**を記述する。 |
| [03_Spec/Resource_Design.md](<./03_Spec/Resource_Design.md>) | Markdown | Resource Design | この文書は M3E における「Resource（資源）」概念の設計仕様を定義する。 |
| [03_Spec/REST_API.md](<./03_Spec/REST_API.md>) | Markdown | REST API 仕様 | 最終更新: 2026-04-17 |
| [03_Spec/Scope_and_Alias.md](<./03_Spec/Scope_and_Alias.md>) | Markdown | Scope and Alias | この文書は、M3E の `scope` と `alias` を Beta 実装で扱える粒度まで定義する。 |
| [03_Spec/Scope_Binding.md](<./03_Spec/Scope_Binding.md>) | Markdown | Scope Binding | 最終更新: 2026-06-06 |
| [03_Spec/Scope_Routing_Shortcuts.md](<./03_Spec/Scope_Routing_Shortcuts.md>) | Markdown | Scope Routing Shortcuts | 最終更新: 2026-06-05 |
| [03_Spec/Scope_Transition.md](<./03_Spec/Scope_Transition.md>) | Markdown | Scope 遷移仕様 | 最終更新: 2026-04-01 |
| [03_Spec/supabase_migration_docs_to_maps.sql](<./03_Spec/supabase_migration_docs_to_maps.sql>) | SQL | supabase migration docs to maps | -- ========================================================================== |
| [03_Spec/supabase_schema.sql](<./03_Spec/supabase_schema.sql>) | SQL | supabase schema | -- ========================================================================== |
| [03_Spec/Team_Collaboration.md](<./03_Spec/Team_Collaboration.md>) | Markdown | Team Collaboration | 最終更新: 2026-04-08 |
| [03_Spec/UI_Seam_Integration_Contract_Evidence.md](<./03_Spec/UI_Seam_Integration_Contract_Evidence.md>) | Markdown | UI Seam Integration Contract — Evidence Appendix (Codex read-only investigati... | Line numbers are approximate as of dev-beta 43e8571. This file is the evidence base for |
| [03_Spec/UI_Seam_Integration_Contract.md](<./03_Spec/UI_Seam_Integration_Contract.md>) | Markdown | UI Seam Integration Contract | 最終更新: 2026-07-02 |
| [03_Spec/V4_Product_Experience_Blueprint.md](<./03_Spec/V4_Product_Experience_Blueprint.md>) | Markdown | V4 Product Experience Blueprint | 更新日: 2026-05-02 |
| [03_Spec/V4_Service_Equivalent_Design.md](<./03_Spec/V4_Service_Equivalent_Design.md>) | Markdown | V4 Service-Equivalent Design | 更新日: 2026-05-02 |
| [03_Spec/x_tech_radar.md](<./03_Spec/x_tech_radar.md>) | Markdown | X Tech Radar — Design Doc | *2026-04-14 — design only, no implementation* |

### 04_Architecture - implementation architecture

| File | Type | Title | Summary |
|---|---:|---|---|
| [04_Architecture/AI_Infrastructure.md](<./04_Architecture/AI_Infrastructure.md>) | Markdown | AI インフラ設計 | 最終更新: 2026-04-02 |
| [04_Architecture/Drag_and_Reparent.md](<./04_Architecture/Drag_and_Reparent.md>) | Markdown | Drag and Reparent | ノードのドラッグによる親付け替えを、Model を壊さずに扱うための操作設計を定義する。 |
| [04_Architecture/DragOperate.md](<./04_Architecture/DragOperate.md>) | Markdown | DragOperate | 以下は「ノードAをドラッグして、別の親P’の子に付け替える」一連操作を、MVC（＋Command）で忠実に流した場合の連携です。Konva等の有無に依存しない抽象形で書きます。 |
| [04_Architecture/Editing_Design.md](<./04_Architecture/Editing_Design.md>) | Markdown | Editing Design | この文書は、M3E の独自描画エンジン上で行う |
| [04_Architecture/Federated_Semantic_Graph.md](<./04_Architecture/Federated_Semantic_Graph.md>) | Markdown | Federated Semantic Graph Architecture | 最終更新: 2026-07-19 |
| [04_Architecture/Layout_Algorithm.md](<./04_Architecture/Layout_Algorithm.md>) | Markdown | Layout Algorithm | この文書は、M3E の独自描画エンジンにおける |
| [04_Architecture/LLM_Graph_Conversation_Protocol.md](<./04_Architecture/LLM_Graph_Conversation_Protocol.md>) | Markdown | LLM Graph Conversation Protocol | 最終更新: 2026-07-18 |
| [04_Architecture/Multi_Select.md](<./04_Architecture/Multi_Select.md>) | Markdown | Multi-Select（複数ノード選択） | 単一選択（`selectedNodeId: string`）だけでは実現できない以下の操作を可能にする： |
| [04_Architecture/MVC_and_Command.md](<./04_Architecture/MVC_and_Command.md>) | Markdown | MVC and Command | この文書は、M3E を独自実装する場合の責務分離の基本線を定義する。 |
| [04_Architecture/Pipeline_UI_Reference.md](<./04_Architecture/Pipeline_UI_Reference.md>) | Markdown | Pipeline UI Reference | この文書は、参照 UI を M3E にそのままコピーするための仕様ではない。 |
| [04_Architecture/README.md](<./04_Architecture/README.md>) | Markdown | 04_Architecture/ | **役割**: 実装アーキテクチャ。**どう作るか**を記述する。 |
| [04_Architecture/Storage_And_Collab_Overview.md](<./04_Architecture/Storage_And_Collab_Overview.md>) | Markdown | Storage & Collab — アーキテクチャ概観 | 最終更新: 2026-07-18 |
| [04_Architecture/Visual_Design_Guidelines.md](<./04_Architecture/Visual_Design_Guidelines.md>) | Markdown | Visual Design Guidelines | This document defines the visual design policy for the M3E MVP viewer/editor. |

### 06_Operations - operation rules and handoff

| File | Type | Title | Summary |
|---|---:|---|---|
| [06_Operations/Actions_Beta.md](<./06_Operations/Actions_Beta.md>) | Markdown | アクション定義（beta） | > アクション名 → 説明のリスト。アルファベット順。 |
| [06_Operations/Agent_Roles.md](<./06_Operations/Agent_Roles.md>) | Markdown | Agent Roles | 最終更新: 2026-06-14 |
| [06_Operations/AI_Instruction_Routing.md](<./06_Operations/AI_Instruction_Routing.md>) | Markdown | AI Instruction Routing | 最終更新: 2026-06-14 |
| [06_Operations/Codex_Task_Scope_Reference.md](<./06_Operations/Codex_Task_Scope_Reference.md>) | Markdown | Codex Task Scope Reference | 最終更新: 2026-06-14 |
| [06_Operations/Command_Panel_Security_Test_Cases.md](<./06_Operations/Command_Panel_Security_Test_Cases.md>) | Markdown | Command Panel Security Test Cases | `Command_Language.md` の Security Model 受け入れ条件を、実装前から検証可能なテストケースとして固定する。 |
| [06_Operations/Command_Reference.md](<./06_Operations/Command_Reference.md>) | Markdown | コマンド操作リファレンス（Rapid） | > **Rapid 用:** このリファレンスは current beta 実装に基づきます。 |
| [06_Operations/Commit_Message_Rules.md](<./06_Operations/Commit_Message_Rules.md>) | Markdown | Commit Message Rules | コミット履歴を見たときに、変更の種類と意図を短時間で判別できる状態を保つ。 |
| [06_Operations/Decision_Pool.md](<./06_Operations/Decision_Pool.md>) | Markdown | Decision Pool | 会話や作業中に出た判断を、正式文書に昇格する前にためる場所。 |
| [06_Operations/Development_System.md](<./06_Operations/Development_System.md>) | Markdown | Development System（開発体制） | 最終更新: 2026-06-25 |
| [06_Operations/Director_Playbook.md](<./06_Operations/Director_Playbook.md>) | Markdown | Director Playbook | The operating manual for Claude-as-Director driving Codex workers on M3E. |
| [06_Operations/Distribution_Validation_Balanced_Plan.md](<./06_Operations/Distribution_Validation_Balanced_Plan.md>) | Markdown | Distribution Validation Balanced Plan | 個人利用フェーズでの手元運用負担を最小化しつつ、将来の企業配布へ移行可能な配布・検証導線を先に設計する。 |
| [06_Operations/Documentation_Rules.md](<./06_Operations/Documentation_Rules.md>) | Markdown | Documentation Rules | 最終更新: 2026-06-27 |
| [06_Operations/gates/layout-lab-gui-check.md](<./06_Operations/gates/layout-lab-gui-check.md>) | Markdown | FAIL — layout-lab G-GUI independent check | Date: 2026-06-25 |
| [06_Operations/Integration_Handoff_260401_codex2.md](<./06_Operations/Integration_Handoff_260401_codex2.md>) | Markdown | Integration Handoff (codex2) - 2026-04-01 | This note fixes the minimum merge target from `dev-beta-data` into `dev-beta` for scope normalization and scope trans... |
| [06_Operations/Keybindings_Beta.md](<./06_Operations/Keybindings_Beta.md>) | Markdown | キーバインド（beta） | > キー → アクション名のマッピング。リマップ時はこのファイルを編集する。 |
| [06_Operations/Keyboard_Reference_Beta.md](<./06_Operations/Keyboard_Reference_Beta.md>) | Markdown | キーボード・操作リファレンス（beta） | このファイルは以下の2ファイルに分割されました。 |
| [06_Operations/LLM_Wiki_Schema.md](<./06_Operations/LLM_Wiki_Schema.md>) | Markdown | LLM Wiki Schema for M3E Documents | Status: working-agreement |
| [06_Operations/README.md](<./06_Operations/README.md>) | Markdown | Operations | このディレクトリは、会話や作業の中で発生した判断を、運用に耐える形で一時保存し、正式文書へ昇格させるための場所です。 |
| [06_Operations/Release_Notes_v260419-2.md](<./06_Operations/Release_Notes_v260419-2.md>) | Markdown | Release Notes v260419-2 | 日付: 2026-04-19 |
| [06_Operations/Rule_Backlog.md](<./06_Operations/Rule_Backlog.md>) | Markdown | Rule_Backlog | 正式ルール化する前の草案プール。思いつきを捨てずに貯める場所。 |
| [06_Operations/Test_and_CICD_Guide.md](<./06_Operations/Test_and_CICD_Guide.md>) | Markdown | Test and CI/CD Guide | Rapid 期間における品質担保を、次の 2 点で実装運用に落とす。 |
| [06_Operations/Todo_Collected_260407.md](<./06_Operations/Todo_Collected_260407.md>) | Markdown | MOVED | 全項目を [Todo_Pool.md](Todo_Pool.md) に統合済み（2026-04-15）。 |
| [06_Operations/Todo_Pool.md](<./06_Operations/Todo_Pool.md>) | Markdown | Todo Pool | 確定前の粗い TODO を一時プールし、正式タスク化前の取りこぼしを防ぐ。 |
| [06_Operations/TODO_today.md](<./06_Operations/TODO_today.md>) | Markdown | TODO_today — 2026-04-15 | > 今日処理する課題。正本は [Todo_Pool.md](Todo_Pool.md)。 |
| [06_Operations/Version_Registry.md](<./06_Operations/Version_Registry.md>) | Markdown | Version Registry | リリースタグとデータスキーマバージョンの対応表。 |
| [06_Operations/Worktree_Separation_Rules.md](<./06_Operations/Worktree_Separation_Rules.md>) | Markdown | Worktree Separation Rules | 最終更新: 2026-06-14 |

### 09_Decisions - ADR

| File | Type | Title | Summary |
|---|---:|---|---|
| [09_Decisions/ADR_001_Freeplane_First.md](<./09_Decisions/ADR_001_Freeplane_First.md>) | Markdown | ADR 001: Freeplane First | Superseded |
| [09_Decisions/ADR_002_React_UI_Basis.md](<./09_Decisions/ADR_002_React_UI_Basis.md>) | Markdown | ADR 002: React UI Basis | Accepted |
| [09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md](<./09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md>) | Markdown | ADR 003: Freeplane-Informed Custom Engine | Accepted |
| [09_Decisions/ADR_004_SQLite_For_Rapid_MVP.md](<./09_Decisions/ADR_004_SQLite_For_Rapid_MVP.md>) | Markdown | ADR 004: SQLite for Rapid MVP | Accepted |
| [09_Decisions/ADR_005_DataDir_Config.md](<./09_Decisions/ADR_005_DataDir_Config.md>) | Markdown | ADR 005: Data Directory Configuration per Environment | Accepted |
| [09_Decisions/ADR_006_Resource_Schema_Version.md](<./09_Decisions/ADR_006_Resource_Schema_Version.md>) | Markdown | ADR 006: Resource 追加時の Schema Version 方針 | Open (議論中) |
| [09_Decisions/ADR_007_Resource_Collab_Locking.md](<./09_Decisions/ADR_007_Resource_Collab_Locking.md>) | Markdown | ADR 007: Collab 環境での Resource 定義の排他制御 | Open (議論中) |
| [09_Decisions/ADR_008_Federated_Canonical_Sources.md](<./09_Decisions/ADR_008_Federated_Canonical_Sources.md>) | Markdown | ADR 008: Federated Canonical Sources and Rebuildable Semantic Graph | Accepted for Phase 0. Neo4j activation remains gated. |
| [09_Decisions/ADR_009_Orchestration_Fusion_Into_M3E.md](<./09_Decisions/ADR_009_Orchestration_Fusion_Into_M3E.md>) | Markdown | ADR 009: Agent Orchestration の M3E 融合と実行境界 | Accepted. |
| [09_Decisions/README.md](<./09_Decisions/README.md>) | Markdown | 09_Decisions/ | **役割**: Architecture Decision Record (ADR)。**なぜそう決めたか**の歴史記録。 |

### _generated - generated projections

| File | Type | Title | Summary |
|---|---:|---|---|
| [_generated/README.md](<./_generated/README.md>) | Markdown | _generated/ | 機械生成ドキュメント置き場。**人間は読まない。手編集禁止。** |
| [_generated/TheDesign.md](<./_generated/TheDesign.md>) | Markdown | TheDesign — docs 統合ドキュメント | > Auto-generated by `scripts/concat-docs.mjs` on 2026-07-18T17:21:22 UTC |

### competitive_research - external tool research

| File | Type | Title | Summary |
|---|---:|---|---|
| [competitive_research/freeplane/Freeplane_Data_Model_Mapping.md](<./competitive_research/freeplane/Freeplane_Data_Model_Mapping.md>) | Markdown | Freeplane Data Model Mapping | この文書は、Freeplane を土台に使うときに M3E の概念をどう写像するかを整理する。 |
| [competitive_research/freeplane/Repository_Structure_Summary.md](<./competitive_research/freeplane/Repository_Structure_Summary.md>) | Markdown | Freeplane Repository Structure Summary | Freeplane のリポジトリは、単一アプリの小さなコードベースではなく、Gradle のマルチプロジェクト構成で組まれたデスクトップアプリケーション群として整理されている。 |
| [competitive_research/mapify.md](<./competitive_research/mapify.md>) | Markdown | Mapify (mapify.so) 競合調査レポート | 調査日: 2026-04-10 |
| [competitive_research/mindmapsoftwares.md](<./competitive_research/mindmapsoftwares.md>) | Markdown | mindmapsoftwares | 前回の提案（MindMup、Freeplane）以外に、マインドマップツールをさらに調査しました。焦点はオープンソースで、オフライン対応、拡張性が高く、KGFの仕様（ツリー構造、スコープ/folder、alias参照、キャンバスUI、... |
| [competitive_research/README.md](<./competitive_research/README.md>) | Markdown | competitive_research/ | **役割**: 競合ツール・類似プロダクトの調査。M3E の差別化判断に使う。 |
| [competitive_research/use_freeplane.md](<./competitive_research/use_freeplane.md>) | Markdown | use freeplane | Freeplaneを土台にするなら、まず押さえるべき実装上の事実は3つです。 |
| [competitive_research/use_obsidian.md](<./competitive_research/use_obsidian.md>) | Markdown | use obsidian | 結論だけ言うと、ラップはできる。ただし、**M3Eの外側層として使うのは現実的**で、**M3Eの正本データをそのままObsidian Canvas側に置くのは厳しい**です。 |
| [competitive_research/use_WiseMapping.md](<./competitive_research/use_WiseMapping.md>) | Markdown | use WiseMapping | 結論だけ先に言うと、**WiseMappingは「そのままラップしてM3Eを成立させる」には弱いが、** |

### daily - chronological work logs

| File | Type | Title | Summary |
|---|---:|---|---|
| [daily/260330.md](<./daily/260330.md>) | Markdown | 2026-03-30 Daily | 2026-03-30 Daily |
| [daily/260331.md](<./daily/260331.md>) | Markdown | 2026-03-31 Daily | 2026-03-31 Daily |
| [daily/260401.md](<./daily/260401.md>) | Markdown | 2026-04-01 Daily | 2026-04-01 Daily |
| [daily/260402.md](<./daily/260402.md>) | Markdown | 2026-04-02 Daily | 2026-04-02 Daily |
| [daily/260403.md](<./daily/260403.md>) | Markdown | 2026-04-03 Daily | 2026-04-03 Daily |
| [daily/260408.md](<./daily/260408.md>) | Markdown | 2026-04-08 Daily | 2026-04-08 Daily |
| [daily/260409.md](<./daily/260409.md>) | Markdown | 2026-04-09 Daily | 2026-04-09 Daily |
| [daily/260412.md](<./daily/260412.md>) | Markdown | 2026-04-12 Daily | **概念:** ファイルシステムの `/`（ルートディレクトリ）と同じ。直接編集不可、システム操作のみ。 |
| [daily/260413.md](<./daily/260413.md>) | Markdown | 2026-04-13 Daily | 1. Vault path を設定 |
| [daily/260414.md](<./daily/260414.md>) | Markdown | 2026-04-14 | 2026-04-14 |
| [daily/260415.md](<./daily/260415.md>) | Markdown | 2026-04-15 | 2026-04-15 |
| [daily/260417.md](<./daily/260417.md>) | Markdown | 2026-04-17 | DAG 書き込み規約を文書化した。 |
| [daily/260418.md](<./daily/260418.md>) | Markdown | 2026-04-18 | 既定 abort と `--force-reset` の意味を明記した。 |
| [daily/260419.md](<./daily/260419.md>) | Markdown | 2026-04-19 | `M3E_CLOUD_SYNC=1`, `M3E_CLOUD_TRANSPORT=supabase`, `M3E_SUPABASE_*`, `workspace/map` が保存されることを確認 |
| [daily/260420.md](<./daily/260420.md>) | Markdown | 2026-04-20 | を明文化 |
| [daily/260422.md](<./daily/260422.md>) | Markdown | 2026-04-22 | 2026-04-22 |
| [daily/260429.md](<./daily/260429.md>) | Markdown | 260429 | 260429 |
| [daily/260430.md](<./daily/260430.md>) | Markdown | 260430 | 260430 |
| [daily/260502.md](<./daily/260502.md>) | Markdown | 260502 | 260502 |
| [daily/README.md](<./daily/README.md>) | Markdown | daily/ | **役割**: 日次作業ログ。**追記のみ・改変禁止**。 |

### for-akaghef - Akaghef-facing materials

| File | Type | Title | Summary |
|---|---:|---|---|
| [for-akaghef/260409_claude_managed_agents.md](<./for-akaghef/260409_claude_managed_agents.md>) | Markdown | Claude Managed Agents 調査レポート | 調査日: 2026-04-09 |
| [for-akaghef/260409_cloud_strategy.md](<./for-akaghef/260409_cloud_strategy.md>) | Markdown | Cloud Sync — Akaghef がやること・やらなくていいこと | 1. **初回**: `launch-full.bat` をダブルクリック（5秒） |
| [for-akaghef/260409_handoff.md](<./for-akaghef/260409_handoff.md>) | Markdown | セッション引き継ぎ書 — 2026-04-09 | 次のセッション（クラウド選定の議論等）に必要な文脈をまとめる。 |
| [for-akaghef/260409_session_summary.md](<./for-akaghef/260409_session_summary.md>) | Markdown | 2026-04-09 セッション サマリ | Cloud Sync の実装を進めるには、バックエンドのクラウドストレージが必要。 |
| [for-akaghef/260409_todo_next_week.md](<./for-akaghef/260409_todo_next_week.md>) | Markdown | Akaghef TODO — 次週（~2026-04-16） | 1. 25人が URL でマップを読める状態 |
| [for-akaghef/260414_obsidian_integration_trial.md](<./for-akaghef/260414_obsidian_integration_trial.md>) | Markdown | Obsidian 連携を実際に試す手順 | 2026-04-14 時点での「いま自分で触る」ための最短ガイド。 |
| [for-akaghef/260414_review_options_summary.md](<./for-akaghef/260414_review_options_summary.md>) | Markdown | 2026-04-14 レビュー選択肢まとめ | 今日の batch review で通った決定と、まだ未解決で残っている選択肢の一覧。 |
| [for-akaghef/260416_idea_to_satisfaction_pipeline.md](<./for-akaghef/260416_idea_to_satisfaction_pipeline.md>) | Markdown | アイデア → ユーザー満足までの導線（dump） | 2026-04-16 ダンプ。後で詰める前提。 |
| [for-akaghef/260416_workspace_map_inventory.md](<./for-akaghef/260416_workspace_map_inventory.md>) | Markdown | Workspace / Map 棚卸し (2026-04-16) | akaghef の個人データを機能別にどう分けているか、現状の実データから確認したもの。 |
| [for-akaghef/260502_m3e_progress_replay.html](<./for-akaghef/260502_m3e_progress_replay.html>) | HTML | 260502 m3e progress replay | HTML |
| [for-akaghef/260502_swingby_conflict_lab.md](<./for-akaghef/260502_swingby_conflict_lab.md>) | Markdown | Swingby conflict lab runbook | Date: 2026-05-02 |
| [for-akaghef/260502_swingby_monthly_meeting_public_link.md](<./for-akaghef/260502_swingby_monthly_meeting_public_link.md>) | Markdown | Swingby 定例会 公開リンク運用メモ | 日付: 2026-05-02 |
| [for-akaghef/260718_s16_federated_strategy_explainer/definition.yaml](<./for-akaghef/260718_s16_federated_strategy_explainer/definition.yaml>) | File | definition | File |
| [for-akaghef/260718_s16_federated_strategy_explainer/index.html](<./for-akaghef/260718_s16_federated_strategy_explainer/index.html>) | HTML | index | HTML |
| [for-akaghef/260718_s16_federated_strategy_explainer/presentation.yaml](<./for-akaghef/260718_s16_federated_strategy_explainer/presentation.yaml>) | File | presentation | File |
| [for-akaghef/260718_s16_federated_strategy_explainer/prompts.json](<./for-akaghef/260718_s16_federated_strategy_explainer/prompts.json>) | JSON | prompts | JSON |
| [for-akaghef/260718_s16_federated_strategy_explainer/views.json](<./for-akaghef/260718_s16_federated_strategy_explainer/views.json>) | JSON | views | JSON |
| [for-akaghef/260718_s16_federated_strategy_explainer/views/01-まずこれだけ.html](<./for-akaghef/260718_s16_federated_strategy_explainer/views/01-まずこれだけ.html>) | HTML | 01 まずこれだけ | HTML |
| [for-akaghef/assets/260502_m3e_conflict_lab_snapshot.png](<./for-akaghef/assets/260502_m3e_conflict_lab_snapshot.png>) | Image | 260502 m3e conflict lab snapshot | Image |
| [for-akaghef/assets/260606_pipeline_flow_ui_reference.jpg](<./for-akaghef/assets/260606_pipeline_flow_ui_reference.jpg>) | Image | 260606 pipeline flow ui reference | Image |
| [for-akaghef/db_tasks_checklist.md](<./for-akaghef/db_tasks_checklist.md>) | Markdown | Akaghef DB / Cloud Sync タスクチェックリスト | 最終更新: 2026-04-10 |
| [for-akaghef/distribution_test_flow.md](<./for-akaghef/distribution_test_flow.md>) | Markdown | 配布テストフロー | M3E のインストーラーが別環境で正常に動くかを検証するフロー。 |
| [for-akaghef/handoff_data_issue.md](<./for-akaghef/handoff_data_issue.md>) | Markdown | 引継ぎ: データ読み込み問題 | Downloads にある `M3E_dataV1.sqlite` の正しいデータ（`akaghef-beta` ドキュメント、350ノード）をbetaアプリで開きたいが、起動すると別のデータ（4ノードや9ノード）が表示される。 |
| [for-akaghef/pj05_presentation/260514_v4_embedded_presentation.html](<./for-akaghef/pj05_presentation/260514_v4_embedded_presentation.html>) | HTML | 260514 v4 embedded presentation | HTML |
| [for-akaghef/README.md](<./for-akaghef/README.md>) | Markdown | for-akaghef/ | akaghef 専用の読み物フォルダ。エージェントが作成した要約・判断依頼・進捗レポートをここに置く。 |
| [for-akaghef/v4_demo/260502_v4_service_slice_report.html](<./for-akaghef/v4_demo/260502_v4_service_slice_report.html>) | HTML | 260502 v4 service slice report | HTML |
| [for-akaghef/v4_demo/assets/v4_service_slice_m3e.png](<./for-akaghef/v4_demo/assets/v4_service_slice_m3e.png>) | Image | v4 service slice m3e | Image |
| [for-akaghef/v4_demo/obsidian_vault/V4 service-equivalent demo.md](<./for-akaghef/v4_demo/obsidian_vault/V4 service-equivalent demo.md>) | Markdown | V4 service-equivalent demo | This paragraph was edited in the exported vault and imported back to M3E. |
| [for-akaghef/v4_demo/v4_service_slice_summary.json](<./for-akaghef/v4_demo/v4_service_slice_summary.json>) | JSON | v4 service slice summary | JSON |
| [for-akaghef/video_script_intro_draft.md](<./for-akaghef/video_script_intro_draft.md>) | Markdown | M3E 解説動画ドラフト（約5分） | > 形式: マップのチュートリアル操作を画面録画しながらナレーション |
| [for-akaghef/WS早見.png](<./for-akaghef/WS早見.png>) | Image | WS早見 | Image |

### ideas - raw ideas and stowed notes

| File | Type | Title | Summary |
|---|---:|---|---|
| [ideas/00_meta/automation_obstacles/01_obstacles.md](<./ideas/00_meta/automation_obstacles/01_obstacles.md>) | Markdown | 01. 障害の網羅的分類 | 研究／業務自動化を阻む要因を10カテゴリ・約40項目に展開する。 |
| [ideas/00_meta/automation_obstacles/02_solution_patterns.md](<./ideas/00_meta/automation_obstacles/02_solution_patterns.md>) | Markdown | 02. 解決パターン | 個別障害ではなく、**繰り返し現れる解決アプローチ** を抽象化して並べる。 |
| [ideas/00_meta/automation_obstacles/03_obstacle_solution_pairs.md](<./ideas/00_meta/automation_obstacles/03_obstacle_solution_pairs.md>) | Markdown | 03. 障害 × 解決策のペアリング | 各障害に対して **複数の解法** を当てる。決めずに並べる。 |
| [ideas/00_meta/automation_obstacles/04_what_not_to_automate.md](<./ideas/00_meta/automation_obstacles/04_what_not_to_automate.md>) | Markdown | 04. 自動化してはいけない領域 | 「全部自動化すべき」という前提を疑う。 |
| [ideas/00_meta/automation_obstacles/05_m3e_strategy.md](<./ideas/00_meta/automation_obstacles/05_m3e_strategy.md>) | Markdown | 05. M3E の介入戦略 | 40+の障害と20の解決パターンの中で、**M3E が直接的に効ける領域** はどこか。 |
| [ideas/00_meta/automation_obstacles/README.md](<./ideas/00_meta/automation_obstacles/README.md>) | Markdown | 研究・ビジネス活動の自動化: 障害と解決のブレスト | 研究活動（広義のビジネス活動）を **自動化／半自動化** する上で立ちはだかる障害と、 |
| [ideas/00_meta/display_contracts/01_facet_type_contract_table.md](<./ideas/00_meta/display_contracts/01_facet_type_contract_table.md>) | Markdown | Facet Type 契約表 | `facet` は PJ ごとに設計するが、毎回ゼロから書く必要はない。 |
| [ideas/00_meta/display_contracts/02_flow_contract.md](<./ideas/00_meta/display_contracts/02_flow_contract.md>) | Markdown | 処理フロー facet の具体契約 | ここでは `facet type = 処理フロー` を最初の具体契約として固定する。 |
| [ideas/00_meta/display_contracts/03_reviews_contract.md](<./ideas/00_meta/display_contracts/03_reviews_contract.md>) | Markdown | reviews facet の具体契約 | ここでは `facet type = reviews` を具体契約として固定する。 |
| [ideas/00_meta/display_contracts/04_dependency_contract.md](<./ideas/00_meta/display_contracts/04_dependency_contract.md>) | Markdown | dependency facet の具体契約 | ここでは `facet type = dependency` を具体契約として固定する。 |
| [ideas/00_meta/display_contracts/05_implementation_contract.md](<./ideas/00_meta/display_contracts/05_implementation_contract.md>) | Markdown | implementation facet の具体契約 | ここでは `facet type = 実装構造` を、PJ02 の Lean declaration / Blueprint 連携にも使える具体契約として固定する。 |
| [ideas/00_meta/display_contracts/06_timeseries_contract.md](<./ideas/00_meta/display_contracts/06_timeseries_contract.md>) | Markdown | timeseries facet の具体契約 | ここでは `facet type = timeseries` を、処理フローとは分けて固定する。 |
| [ideas/00_meta/display_contracts/07_map_write_layout_rules/01_progressive_navigation.md](<./ideas/00_meta/display_contracts/07_map_write_layout_rules/01_progressive_navigation.md>) | Markdown | Progressive Navigation Layout | UI蒸留・UI再現 map のための layout rule。 |
| [ideas/00_meta/display_contracts/07_map_write_layout_rules/02_write_safety.md](<./ideas/00_meta/display_contracts/07_map_write_layout_rules/02_write_safety.md>) | Markdown | Write Safety | map 書き込みで最優先するのは、指示された操作以外への副作用を作らないこと。 |
| [ideas/00_meta/display_contracts/07_map_write_layout_rules/99_inbox.md](<./ideas/00_meta/display_contracts/07_map_write_layout_rules/99_inbox.md>) | Markdown | Inbox | 未整理の layout 指示を書き溜める場所。 |
| [ideas/00_meta/display_contracts/07_map_write_layout_rules/README.md](<./ideas/00_meta/display_contracts/07_map_write_layout_rules/README.md>) | Markdown | Map Write Layout Rules | このフォルダは、map 書き込み時の layout / display contract / 副作用禁止ルールを書き溜める場所。 |
| [ideas/00_meta/display_contracts/README.md](<./ideas/00_meta/display_contracts/README.md>) | Markdown | Display Contracts | M3E の map 書き込みで、AI が **人間にレビューしやすい表示** を作るための |
| [ideas/00_meta/meta_m3e/01_concept.md](<./ideas/00_meta/meta_m3e/01_concept.md>) | Markdown | 01. メタ機能とは何か — コンセプトとユースケース | M3E の **メタ機能** = 「M3E が M3E 自身を扱うための機能」。 |
| [ideas/00_meta/meta_m3e/02_dogfood_options.md](<./ideas/00_meta/meta_m3e/02_dogfood_options.md>) | Markdown | 02. ドッグフード深化と自己改善ループ | サブトピック O1 / O2 を担当。 |
| [ideas/00_meta/meta_m3e/03_feedback_telemetry.md](<./ideas/00_meta/meta_m3e/03_feedback_telemetry.md>) | Markdown | 03. ユーザフィードバック UI とテレメトリ | サブトピック O3 / O4 を担当。 |
| [ideas/00_meta/meta_m3e/04_plugin_fork.md](<./ideas/00_meta/meta_m3e/04_plugin_fork.md>) | Markdown | 04. プラグイン拡張と fork 容易化 | サブトピック O5 / O6 を担当。 |
| [ideas/00_meta/meta_m3e/05_meta_traps_and_strategy.md](<./ideas/00_meta/meta_m3e/05_meta_traps_and_strategy.md>) | Markdown | 05. メタ機能特有の罠 / MVP 道筋 / 未決質問 | 横断的観察と、akaghef フェーズで実際に動かすときの優先順を扱う。 |
| [ideas/00_meta/meta_m3e/README.md](<./ideas/00_meta/meta_m3e/README.md>) | Markdown | メタ機能 — M3E 自身のための M3E | M3E が **自分自身** を題材に扱うための機能群。 |
| [ideas/00_topic_pool.md](<./ideas/00_topic_pool.md>) | Markdown | 次にブレインストーミングすべきテーマ・プール | 「アイデアのアイデア」。 |
| [ideas/10_io/capture_ingest/01_concept.md](<./ideas/10_io/capture_ingest/01_concept.md>) | Markdown | 01. Concept — Capture / Ingest とは何か | ノードを M3E マップに「入れる」までの体験全体を設計対象とする。 |
| [ideas/10_io/capture_ingest/02_channels.md](<./ideas/10_io/capture_ingest/02_channels.md>) | Markdown | 02. Channels — 入力チャネル候補列挙 | 00_topic_pool の A1-A10 を起点に、A11-A20 を拡張して並べる。 |
| [ideas/10_io/capture_ingest/03_processing_pipeline.md](<./ideas/10_io/capture_ingest/03_processing_pipeline.md>) | Markdown | 03. Processing Pipeline — 取り込み後の処理 | チャネルを通って入ってきた raw データを、どう scratch ノードまで加工するか。 |
| [ideas/10_io/capture_ingest/04_runtime_ux.md](<./ideas/10_io/capture_ingest/04_runtime_ux.md>) | Markdown | 04. Runtime UX — 取り込み体験の UI / 操作系 | 「入れる瞬間」のユーザー体験。視覚・聴覚・触覚フィードバック、入力 UI のバリエーション。 |
| [ideas/10_io/capture_ingest/05_data_privacy.md](<./ideas/10_io/capture_ingest/05_data_privacy.md>) | Markdown | 05. Data & Privacy — データモデル・暗号化・互換性 | 取り込んだものをどこに、どんな形で、誰が読める形で残すか。 |
| [ideas/10_io/capture_ingest/06_mvp_path.md](<./ideas/10_io/capture_ingest/06_mvp_path.md>) | Markdown | 06. MVP Path — 最小実装案・横断観察・未決質問 | 5ファイルの選択肢を踏まえて、**どこから始めるのが筋がよいか** の最小経路。 |
| [ideas/10_io/capture_ingest/README.md](<./ideas/10_io/capture_ingest/README.md>) | Markdown | Capture / Ingest — 入力・取り込み体験設計 | ノードを M3E マップに「入れる」までの体験設計に関するブレインストーミング。 |
| [ideas/10_io/export_publish/01_concept.md](<./ideas/10_io/export_publish/01_concept.md>) | Markdown | 01. コンセプト — マップを「外に出す」とは何か | M3E マップに溜め込んだノード群（思考・知識・引用・意思決定ログ・図）を、 |
| [ideas/10_io/export_publish/02_output_targets.md](<./ideas/10_io/export_publish/02_output_targets.md>) | Markdown | 02. 出力先カタログ — B1〜B8 の比較 | 各出力先について、**何が出るか／読者は誰か／業界慣習／LLM 介入度／実装難度** を並べる。 |
| [ideas/10_io/export_publish/03_authoring_pipeline.md](<./ideas/10_io/export_publish/03_authoring_pipeline.md>) | Markdown | 03. 著作パイプライン — マップ → 中間ビュー → 出力物 | 「マップから直接出力」ではなく、**中間ビュー**を挟む二段階変換が現実的。 |
| [ideas/10_io/export_publish/04_publishing_workflow.md](<./ideas/10_io/export_publish/04_publishing_workflow.md>) | Markdown | 04. 出版ワークフロー — 草稿から DOI まで | 「書き出した後」の世界。学術出版業界の慣習（査読・引用・DOI・OA）を踏まえ、 |
| [ideas/10_io/export_publish/05_data_privacy.md](<./ideas/10_io/export_publish/05_data_privacy.md>) | Markdown | 05. データモデル・プライバシー・互換性 | 出力物の **永続化・バージョン管理・プライバシー境界・他形式互換** をブレストする。 |
| [ideas/10_io/export_publish/06_mvp_path.md](<./ideas/10_io/export_publish/06_mvp_path.md>) | Markdown | 06. MVP / 段階導入 / 未決質問 | 「採否は決めない」前提で、**仮に最小実装するならどう始めるか** の見取り図。 |
| [ideas/10_io/export_publish/README.md](<./ideas/10_io/export_publish/README.md>) | Markdown | 出力・公開（Export / Publish）— ブレインストーミング | M3E マップを「外に出す」体験設計のブレスト。 |
| [ideas/10_io/math_ontology_services/01_landscape.md](<./ideas/10_io/math_ontology_services/01_landscape.md>) | Markdown | 01. 領域全体の地図と分類軸 | 「数学 × オントロジー」が何を指すか、まず定義的に押さえる。 |
| [ideas/10_io/math_ontology_services/02_proof_libraries.md](<./ideas/10_io/math_ontology_services/02_proof_libraries.md>) | Markdown | 02. 形式証明ライブラリ（L1） | 定理と証明そのものを形式化し、証明検証機でコンパイルできる形で保持するサービス・ライブラリ群。 |
| [ideas/10_io/math_ontology_services/03_knowledge_bases.md](<./ideas/10_io/math_ontology_services/03_knowledge_bases.md>) | Markdown | 03. 数学知識ベース・百科事典（L2） | 形式度は低いが、**ID 付き・構造化・相互リンク** がある程度整備された数学知識リポジトリ。 |
| [ideas/10_io/math_ontology_services/04_ontology_formats.md](<./ideas/10_io/math_ontology_services/04_ontology_formats.md>) | Markdown | 04. 記述語彙・オントロジー標準（L3） | 数学表現（式・構造・概念）を **機械可読な共通フォーマット** として交換するための語彙・標準・ツール群。 |
| [ideas/10_io/math_ontology_services/05_semantic_scholarship.md](<./ideas/10_io/math_ontology_services/05_semantic_scholarship.md>) | Markdown | 05. 書誌・分類・論文意味付け（L4） | 論文・著者・分野コードを **構造化データ** として扱う層。 |
| [ideas/10_io/math_ontology_services/06_ai_math_bridges.md](<./ideas/10_io/math_ontology_services/06_ai_math_bridges.md>) | Markdown | 06. AI × 数学 × オントロジー橋渡し（L5） | LLM / 機械学習と形式数学・数学知識を繋ぐデータセット・モデル・プロトコル群。 |
| [ideas/10_io/math_ontology_services/07_m3e_connection.md](<./ideas/10_io/math_ontology_services/07_m3e_connection.md>) | Markdown | 07. M3E との接続候補と未決質問 | 02〜06 で並べたサービス群を、M3E 側からどう使うか / どう繋ぐか を俯瞰する。 |
| [ideas/10_io/math_ontology_services/08_implementation_feasibility.md](<./ideas/10_io/math_ontology_services/08_implementation_feasibility.md>) | Markdown | 08. 実装レベルでの取込可能性検討 | ブレスト全般は「採否を決めない」前提だが、**P8（Deep 帯域の GraphLink を多種エッジ化して育てる）** だけ |
| [ideas/10_io/math_ontology_services/09_blueprint_facets.md](<./ideas/10_io/math_ontology_services/09_blueprint_facets.md>) | Markdown | 09. Blueprint の facet 分離と相互参照 | Blueprint を M3E に取り込むとき、単なる dependency DAG として扱うだけでは情報を落とす。 |
| [ideas/10_io/math_ontology_services/10_anchoring.md](<./ideas/10_io/math_ontology_services/10_anchoring.md>) | Markdown | Anchoring という用語の整理 | `anchoring` を、知識グラフや facet 表示において **leaf を見やすくするために synthetic node を挿入して束ねる操作** として使う案を整理する。 |
| [ideas/10_io/math_ontology_services/README.md](<./ideas/10_io/math_ontology_services/README.md>) | Markdown | 数学 × オントロジー サービス大量収集ブレスト | 「数学的知識を **機械可読 / 意味付き / 構造化** された形で扱うサービス・プロジェクト・標準」を |
| [ideas/10_io/math_pdf_ocr.zip](<./ideas/10_io/math_pdf_ocr.zip>) | File | math pdf ocr | File |
| [ideas/10_io/math_pdf_ocr/01_axes.md](<./ideas/10_io/math_pdf_ocr/01_axes.md>) | Markdown | 01. 評価軸 | 数学 PDF OCR ツールを比較するための **軸** を並べる。個別ツールはこの軸で評価する（02〜04 で参照）。 |
| [ideas/10_io/math_pdf_ocr/02_oss_tools.md](<./ideas/10_io/math_pdf_ocr/02_oss_tools.md>) | Markdown | 02. OSS / ローカル実行系 OCR ツール候補 | 無料で自分のマシンで動かせる選択肢。数式・構造・図版の 3 軸で評価する。 |
| [ideas/10_io/math_pdf_ocr/03_commercial_tools.md](<./ideas/10_io/math_pdf_ocr/03_commercial_tools.md>) | Markdown | 03. 商用 / クラウド API 系 OCR ツール候補 | 従量課金・SaaS として提供されるもの。OSS より精度・運用面で勝ることが多いが、ランニングコストとデータ秘匿性が課題。 |
| [ideas/10_io/math_pdf_ocr/04_specialized_and_helpers.md](<./ideas/10_io/math_pdf_ocr/04_specialized_and_helpers.md>) | Markdown | 04. 数式特化 OCR と補助ツール | 本体パイプラインの脇で使う「数式だけ」「図抽出だけ」「PDF 低レベル処理だけ」のツール群。単体では完結しないが、組み合わせると総合精度が上がる。 |
| [ideas/10_io/math_pdf_ocr/05_strategy.md](<./ideas/10_io/math_pdf_ocr/05_strategy.md>) | Markdown | 05. M3E 取り込みパイプライン戦略 + MVP + 未決 | 02〜04 の候補を踏まえて、**M3E で数学書をオントロジー化するための** 取り込みパイプライン戦略を整理する。採用確定ではなく「こう組むと筋が良い」案を並べる。 |
| [ideas/10_io/math_pdf_ocr/06_layer_toolmap.md](<./ideas/10_io/math_pdf_ocr/06_layer_toolmap.md>) | Markdown | 06. 5 層パイプライン設計 × ツールマップ (2026-04 実調査) | `pdf→ontology_pipeline_design.md` で定義された L0〜L4 の 5 層設計に対して、**各層で使える library / software / app / repo** を 2026-04 時点の W... |
| [ideas/10_io/math_pdf_ocr/README.md](<./ideas/10_io/math_pdf_ocr/README.md>) | Markdown | 数学 PDF OCR ツール — 候補列挙と評価 | 数学書・論文 PDF を M3E のオントロジーノードに流し込むための **OCR / 構造化ツール候補** を網羅的に並べる。数式 (LaTeX) 保持・図版抽出・構造 (Definition/Theorem) 抽出の 3 軸で使え... |
| [ideas/10_io/tool_integration/01_concept.md](<./ideas/10_io/tool_integration/01_concept.md>) | Markdown | 01. コンセプト — なぜ既存ツール統合か | M3E が孤立した「もう一つの島」になる最大のリスクを **統合** で回避する。 |
| [ideas/10_io/tool_integration/02_dev_tools.md](<./ideas/10_io/tool_integration/02_dev_tools.md>) | Markdown | 02. 開発ツール統合 — Git/GitHub・VSCode（H1, H6） | 開発系ツール（コード履歴・エディタ・Issue）と M3E の接続選択肢を列挙。 |
| [ideas/10_io/tool_integration/03_knowledge_tools.md](<./ideas/10_io/tool_integration/03_knowledge_tools.md>) | Markdown | 03. 知識管理ツール統合 — Obsidian/Roam/Logseq・Zotero（H3, H4） | 研究者の **既存知識資産** を M3E に流し込む選択肢を列挙。 |
| [ideas/10_io/tool_integration/04_workflow_tools.md](<./ideas/10_io/tool_integration/04_workflow_tools.md>) | Markdown | 04. ワークフローツール統合 — Calendar・Notion/Linear/Jira（H2, H7） | 時間管理（Calendar）とタスク管理（Notion/Linear/Jira）の統合選択肢を列挙。 |
| [ideas/10_io/tool_integration/05_publishing_tools.md](<./ideas/10_io/tool_integration/05_publishing_tools.md>) | Markdown | 05. 出版ツール統合 — LaTeX / Overleaf / Markdown 出版（H5） | 論文・申請書執筆ツールへの export 統合。 |
| [ideas/10_io/tool_integration/06_integration_patterns.md](<./ideas/10_io/tool_integration/06_integration_patterns.md>) | Markdown | 06. 統合方式の共通パターン — 横断インフラ・プライバシー・コスト | H1〜H7 を個別に積むのではなく、**統合インフラとして共通化** できる部分を抽出。 |
| [ideas/10_io/tool_integration/07_mvp_path.md](<./ideas/10_io/tool_integration/07_mvp_path.md>) | Markdown | 07. MVP 路線・段階導入ロードマップ・未決質問 | ブレストの締め。ここで初めて「ボリューム感」と「順序」を語るが、**採否は決めない**。 |
| [ideas/10_io/tool_integration/260615_vision_v014_stack.md](<./ideas/10_io/tool_integration/260615_vision_v014_stack.md>) | Markdown | Vision v0.1.4 技術スタック分析と M3E 応用候補 | 作成日: 2026-06-15 |
| [ideas/10_io/tool_integration/README.md](<./ideas/10_io/tool_integration/README.md>) | Markdown | 既存ツール統合（Tool Integration）— ブレインストーミング | M3E を Git/Calendar/Obsidian/Zotero/LaTeX/VSCode/Notion/Linear/Jira などの |
| [ideas/20_ai/ai_agent_deep/01_global_design.md](<./ideas/20_ai/ai_agent_deep/01_global_design.md>) | Markdown | 01. 共通基盤 — 人格・自動化レベル・検閲・ベンダ切替 | 10 個のサブトピック（C1〜C10）すべてに横断する設計論点をまとめる。 |
| [ideas/20_ai/ai_agent_deep/02_sparring_agents.md](<./ideas/20_ai/ai_agent_deep/02_sparring_agents.md>) | Markdown | 02. 壁打ち系エージェント — C1 / C2 / C3 / C9 | 研究の質を上げる「対話型 AI」候補。 |
| [ideas/20_ai/ai_agent_deep/03_map_hygiene_insight.md](<./ideas/20_ai/ai_agent_deep/03_map_hygiene_insight.md>) | Markdown | 03. マップ衛生・気づき系 — C4 / C5 / C7 / C10 | マップが大きくなった時に AI に「整理」「気づき」「自走」を任せる候補。 |
| [ideas/20_ai/ai_agent_deep/04_research_query.md](<./ideas/20_ai/ai_agent_deep/04_research_query.md>) | Markdown | 04. 検索・取り込み系 — C6 / C8 | 「研究秘書」として AI が文献を取り込み、過去ノードを横断検索する候補。 |
| [ideas/20_ai/ai_agent_deep/05_mvp_and_open_questions.md](<./ideas/20_ai/ai_agent_deep/05_mvp_and_open_questions.md>) | Markdown | 05. MVP 候補・横断観察・未決質問 | 01〜04 を踏まえた **横断観察 / 最小実装案 / 未決質問**。 |
| [ideas/20_ai/ai_agent_deep/README.md](<./ideas/20_ai/ai_agent_deep/README.md>) | Markdown | AI / エージェント深化 — 思考パートナーとしての AI | 既存 `ai_subagent.ts` / `ai_infra.ts` は「topic 提案」「linear-transform」レベルに留まっている。 |
| [ideas/20_ai/cas_m3e_copilot/README.md](<./ideas/20_ai/cas_m3e_copilot/README.md>) | Markdown | M3E × Codex App Server — Scope-aware Copilot | 更新: 2026-07-12 |
| [ideas/20260330_dual_root_design_graph.md](<./ideas/20260330_dual_root_design_graph.md>) | Markdown | Dual Root Design Graph Idea (2026-03-30) | この二つのルートを持つ木がつながる過程は生物的だ なぜこういう構造なのか？自然か？すでに導入されているか？ |
| [ideas/260401_important_goal.md](<./ideas/260401_important_goal.md>) | Markdown | 260401 important goal | Linear<->Tree相互変換機能 |
| [ideas/260401_memo.md](<./ideas/260401_memo.md>) | Markdown | 260401 memo | 設計が不十分な箇所 |
| [ideas/260402subagent.md](<./ideas/260402subagent.md>) | Markdown | AI Subagent 連携仕様（DeepSeek 含む） | 最終更新: 2026-04-02 |
| [ideas/260407_latex_rendering.md](<./ideas/260407_latex_rendering.md>) | Markdown | LaTeX Rendering in Nodes | Math expressions in mind-map nodes are currently stored as raw LaTeX strings and displayed as plain text. Rendering t... |
| [ideas/260407organized_ideas.md](<./ideas/260407organized_ideas.md>) | Markdown | M3E アイデア整理（2026-04-07） | 最近追加されたアイデアを分類・整理したもの。 |
| [ideas/260409_edge_typed_attributes.md](<./ideas/260409_edge_typed_attributes.md>) | Markdown | 親子エッジに型/属性を持たせる設計案 | 現在の M3E では、親子エッジ（parentId / children[]）にはいかなるメタデータもない。 |
| [ideas/260409_typed_edges.md](<./ideas/260409_typed_edges.md>) | Markdown | 枝（エッジ）に型・属性を持たせる設計案 | Date: 2026-04-09 |
| [ideas/260410_ai_integration_architecture.md](<./ideas/260410_ai_integration_architecture.md>) | Markdown | AI Integration Architecture -- Claude API 直接利用方式 | 作成日: 2026-04-10 |
| [ideas/260410_confidence_testing_brainstorm.md](<./ideas/260410_confidence_testing_brainstorm.md>) | Markdown | AI Confidence テスト方法 ブレインストーミング整理 | > 作成日: 2026-04-10 |
| [ideas/260410_flash_data_model.md](<./ideas/260410_flash_data_model.md>) | Markdown | Flash バンド: データモデルと UX フロー設計 | 最終更新: 2026-04-10 |
| [ideas/260410_flash_input_pipeline.md](<./ideas/260410_flash_input_pipeline.md>) | Markdown | Flash 入力パイプライン設計 | 作成日: 2026-04-10 |
| [ideas/260410_layout_depth_offset.md](<./ideas/260410_layout_depth_offset.md>) | Markdown | Layout Depth Offset Design: Parent-Grouped Subtree Indentation | Date: 2026-04-10 |
| [ideas/260410_local_binding_design.md](<./ideas/260410_local_binding_design.md>) | Markdown | ローカルファイルとの強い結合方式 -- 設計比較と推奨案 | 最終更新: 2026-04-10 |
| [ideas/260410_node_styling_menu.md](<./ideas/260410_node_styling_menu.md>) | Markdown | Node Styling Menu -- UI Design | **Date:** 2026-04-10 |
| [ideas/260410_scalable_knowledge_base_vision.md](<./ideas/260410_scalable_knowledge_base_vision.md>) | Markdown | スケーラブル知識ベース — M3E の根本ビジョン | > 夢は出来たら人に語るようにしている。叶うので。 |
| [ideas/260420_m3e_vision_twitter_dump.md](<./ideas/260420_m3e_vision_twitter_dump.md>) | Markdown | M3E Vision — Twitter/X ダンプ（Grok 収集） | 収集日: 2026-04-20 |
| [ideas/260420_math_transition_vision.md](<./ideas/260420_math_transition_vision.md>) | Markdown | 数学学習から数学研究へ移るための M3E 構想 | 作成日: 2026-04-20 |
| [ideas/260420_math_transition_vision2.md](<./ideas/260420_math_transition_vision2.md>) | Markdown | 数学学習から数学研究へ移るための M3E 構想（拡張版） | 作成日: 2026-04-20 |
| [ideas/260627_llm_wiki_pattern.md](<./ideas/260627_llm_wiki_pattern.md>) | Markdown | LLM Wiki | A pattern for building personal knowledge bases using LLMs. |
| [ideas/260701_rapid_markdown_canon_mfh_and_obsidian_surface.md](<./ideas/260701_rapid_markdown_canon_mfh_and_obsidian_surface.md>) | Markdown | Rapid Markdown Canon / MF-H / Obsidian 内 M3E surface | 作成日: 2026-07-01 |
| [ideas/260702_arbor_mdd_experimental_search_tree.md](<./ideas/260702_arbor_mdd_experimental_search_tree.md>) | Markdown | Arbor と MDD の接点: Experimental Search Tree | 作成日: 2026-07-02 |
| [ideas/260704_graphics_showcase.html](<./ideas/260704_graphics_showcase.html>) | HTML | 260704 graphics showcase | HTML |
| [ideas/260718_llm_graph_protocol_directive_original.md](<./ideas/260718_llm_graph_protocol_directive_original.md>) | Markdown | LLM ↔ Property Graph Conversation Protocol | > **原文stow（2026-07-18、akaghef指針）。** PR #75 の [LLM_Graph_Conversation_Protocol.md](../04_Architecture/LLM_Graph_Conver... |
| [ideas/260719_math_ontology_graphdb_thesis.md](<./ideas/260719_math_ontology_graphdb_thesis.md>) | Markdown | 数学オントロジーが Neo4j 採用の真の駆動因である | 日付: 2026-07-19 |
| [ideas/260719_memforest_conversation_to_typed_graph.md](<./ideas/260719_memforest_conversation_to_typed_graph.md>) | Markdown | MemForest を接点に、AI対話を typed knowledge graph へ育てる | 作成日: 2026-07-19 |
| [ideas/260720_runtime_board_video_repro/README.md](<./ideas/260720_runtime_board_video_repro/README.md>) | Markdown | Runtime Board 動画再現 — 検証資料 | 参照動画から再現した Runtime Board の表示・操作要件を、実装用 worktree を削除した後も比較可能な形で残す。これは製品仕様ではなく、将来の viewer / Agent Status 表示を検討するための ide... |
| [ideas/260720_runtime_board_video_repro/runtime-board-implementation.patch](<./ideas/260720_runtime_board_video_repro/runtime-board-implementation.patch>) | File | runtime board implementation | File |
| [ideas/260720_runtime_board_video_repro/runtime-board.png](<./ideas/260720_runtime_board_video_repro/runtime-board.png>) | Image | runtime board | Image |
| [ideas/260720_runtime_board_video_repro/verification.md](<./ideas/260720_runtime_board_video_repro/verification.md>) | Markdown | 検証記録 | 実行日: 2026-07-20 |
| [ideas/260720_viewer_neon_experiment/implementation-notes.md](<./ideas/260720_viewer_neon_experiment/implementation-notes.md>) | Markdown | 実装差分の責任範囲 | 実装差分の責任範囲 |
| [ideas/260720_viewer_neon_experiment/README.md](<./ideas/260720_viewer_neon_experiment/README.md>) | Markdown | Viewer Neon 表現実験 | viewerのNeon調表現を製品コードから切り離し、将来のデザイン比較に使える自己完結したidea bundleとして保存する。現在のUI方針への採用を意味しない。 |
| [ideas/260720_viewer_neon_experiment/viewer-neon-implementation.patch](<./ideas/260720_viewer_neon_experiment/viewer-neon-implementation.patch>) | File | viewer neon implementation | File |
| [ideas/260720_viewer_neon_experiment/viewer-neon.png](<./ideas/260720_viewer_neon_experiment/viewer-neon.png>) | Image | viewer neon | Image |
| [ideas/30_ux/gamification/01_concept.md](<./ideas/30_ux/gamification/01_concept.md>) | Markdown | 01. コンセプト — なぜ M3E にゲーミフィケーションか | M3E は研究思考支援ツールである。 |
| [ideas/30_ux/gamification/02_streak_and_badge.md](<./ideas/30_ux/gamification/02_streak_and_badge.md>) | Markdown | 02. K1 ストリーク と K2 バッジの選択肢 | 「日課カウンタ」と「達成バッジ」を、研究者用途で副作用を抑える方向に複数案で並べる。 |
| [ideas/30_ux/gamification/03_quest_and_quiz.md](<./ideas/30_ux/gamification/03_quest_and_quiz.md>) | Markdown | 03. K3 クエストシステム と K5 デイリークイズ | 「やるべきことを冒険化」と「過去ノードからランダム出題」を選択肢で並べる。 |
| [ideas/30_ux/gamification/04_node_evolution.md](<./ideas/30_ux/gamification/04_node_evolution.md>) | Markdown | 04. K4 ノード進化（育てるとビジュアル変化） | K 系の中で最も「研究行為そのもの」と親和性が高い候補。 |
| [ideas/30_ux/gamification/05_balance_and_antipattern.md](<./ideas/30_ux/gamification/05_balance_and_antipattern.md>) | Markdown | 05. K6 メタ視点 と K7 アンチパターン | K1〜K5 の個別案を超えて、ゲーム化の **方針論** と **やってはいけない設計** を整理する。 |
| [ideas/30_ux/gamification/06_mvp_and_open_questions.md](<./ideas/30_ux/gamification/06_mvp_and_open_questions.md>) | Markdown | 06. MVP 候補 / 組み合わせ評価 / 未決質問 / 横断観察 | 各論点（K1〜K7）を組み合わせ、最小実装の候補・未決事項・横断的気づきをまとめる。 |
| [ideas/30_ux/gamification/README.md](<./ideas/30_ux/gamification/README.md>) | Markdown | ゲーミフィケーション（K）ブレスト | M3E に「楽しさ・継続性・遊びごころ」を持ち込む際の論点プール。 |
| [ideas/30_ux/keyboard_modes/01_modes_global_design.md](<./ideas/30_ux/keyboard_modes/01_modes_global_design.md>) | Markdown | 01. モード共通設計の論点 | 各モード固有の操作とは別に、「モードという仕組み」自体に検討すべき共通論点がある。 |
| [ideas/30_ux/keyboard_modes/02_inbox_modes.md](<./ideas/30_ux/keyboard_modes/02_inbox_modes.md>) | Markdown | 02. Inbox 系モード | 「外から入ってきたもの」を1つずつ捌くモード群。 |
| [ideas/30_ux/keyboard_modes/03_attribute_modes.md](<./ideas/30_ux/keyboard_modes/03_attribute_modes.md>) | Markdown | 03. 属性更新系モード | ノードを動かさず、属性だけを高速に書き換えるモード群。 |
| [ideas/30_ux/keyboard_modes/04_structure_modes.md](<./ideas/30_ux/keyboard_modes/04_structure_modes.md>) | Markdown | 04. 構造変更系モード | ツリー構造そのものを変えるモード群。 |
| [ideas/30_ux/keyboard_modes/05_capture_navigation.md](<./ideas/30_ux/keyboard_modes/05_capture_navigation.md>) | Markdown | 05. 入力・移動系モード | 「打ち込む」「探して飛ぶ」のスループットを上げるモード群。 |
| [ideas/30_ux/keyboard_modes/06_view_present_compare.md](<./ideas/30_ux/keyboard_modes/06_view_present_compare.md>) | Markdown | 06. 閲覧・プレゼン・比較系モード | 書き換えではなく「見る」ことに最適化したモード群。 |
| [ideas/30_ux/keyboard_modes/07_experimental_modes.md](<./ideas/30_ux/keyboard_modes/07_experimental_modes.md>) | Markdown | 07. 実験的・小規模モード | ニッチだが特定状況で爆発的に効くモード群。 |
| [ideas/30_ux/keyboard_modes/08_queue_mode_pattern.md](<./ideas/30_ux/keyboard_modes/08_queue_mode_pattern.md>) | Markdown | 08. 共通パターン: 「キュー → 1件処理 → 次」 | 複数モードを横断して観察すると、過半が同じ骨格をしている。 |
| [ideas/30_ux/keyboard_modes/09_numpad_quick_input.md](<./ideas/30_ux/keyboard_modes/09_numpad_quick_input.md>) | Markdown | 09. テンキー（Numpad）による属性高速入力 | 「カラーリング・緊急度・ステータスを一括でテンキーから入れたい」を起点に、 |
| [ideas/30_ux/keyboard_modes/README.md](<./ideas/30_ux/keyboard_modes/README.md>) | Markdown | Keyboard Modes for M3E | 「特定モードに入ると、そのモード専用の単一キー操作が大量に効く」設計の |
| [ideas/30_ux/map_views/01_2d_matrices.md](<./ideas/30_ux/map_views/01_2d_matrices.md>) | Markdown | 01. 2D マトリクス系ビュー | ノードを2軸平面に配置するビュー。Eisenhower が代表だが、軸の組み合わせは膨大。 |
| [ideas/30_ux/map_views/02_linear_temporal.md](<./ideas/30_ux/map_views/02_linear_temporal.md>) | Markdown | 02. 線形・時系列ビュー | ノードを1次元に並べるビュー。時間軸 or 段階軸が代表。 |
| [ideas/30_ux/map_views/03_radial_network.md](<./ideas/30_ux/map_views/03_radial_network.md>) | Markdown | 03. 放射・同心円・ネットワーク系ビュー | 中心や関係性を主軸にする配置。M3E の素のビュー（mind map）はここに近い。 |
| [ideas/30_ux/map_views/04_process_lifecycle.md](<./ideas/30_ux/map_views/04_process_lifecycle.md>) | Markdown | 04. プロセス・ライフサイクル系ビュー | 「ノードがどういう流れの中にいるか」を構造そのものに埋め込むビュー。 |
| [ideas/30_ux/map_views/05_research_knowledge.md](<./ideas/30_ux/map_views/05_research_knowledge.md>) | Markdown | 05. 研究・知識整理に特化したビュー | M3E が研究思考支援ツールであることを踏まえ、研究固有のフレームワークと |
| [ideas/30_ux/map_views/06_implementation_thoughts.md](<./ideas/30_ux/map_views/06_implementation_thoughts.md>) | Markdown | 06. ビュー実装・横断設計の論点 | 100以上のビュー候補を「実際にどう M3E に組み込むか」の横断的考察。 |
| [ideas/30_ux/map_views/07_business_folder_spine.md](<./ideas/30_ux/map_views/07_business_folder_spine.md>) | Markdown | 07. 業務フォルダを Scatter 作業面 + spine 正本として扱う | 業務フォルダの中身は、実際にはきれいな単一ツリーではない。 |
| [ideas/30_ux/map_views/README.md](<./ideas/30_ux/map_views/README.md>) | Markdown | Map View Frameworks for M3E | M3E マップを **そのままのツリー/グラフ表示ではなく、特定のフレームワークの軸に |
| [ideas/30_ux/slideshow/01_concept.md](<./ideas/30_ux/slideshow/01_concept.md>) | Markdown | 01. コンセプト | M3E マップ上のノードを **作者が指定した順序で1つずつフォーカス** し、 |
| [ideas/30_ux/slideshow/02_authoring.md](<./ideas/30_ux/slideshow/02_authoring.md>) | Markdown | 02. オーサリング（ツアーの定義方法） | 「どのノードを、どの順番で見せるか」をどこに、どう書くか。 |
| [ideas/30_ux/slideshow/03_runtime_ui.md](<./ideas/30_ux/slideshow/03_runtime_ui.md>) | Markdown | 03. 再生時の UI とカメラ挙動 | ツアー再生中の見た目・操作・演出。 |
| [ideas/30_ux/slideshow/04_data_model.md](<./ideas/30_ux/slideshow/04_data_model.md>) | Markdown | 04. データモデルと永続化・エクスポート | 最小モデル: |
| [ideas/30_ux/slideshow/05_mvp_path.md](<./ideas/30_ux/slideshow/05_mvp_path.md>) | Markdown | 05. MVP 設計案と未決の質問 | レビューが入る前の **デフォルト案**（暫定）。 |
| [ideas/30_ux/slideshow/06_viewer_presentation_html_export.md](<./ideas/30_ux/slideshow/06_viewer_presentation_html_export.md>) | Markdown | Viewer Presentation View と HTML Export | DaveJ 型の architecture-flow UI を参考に、M3E の通常ビューを壊さず「presentation view」と「standalone HTML export」を増やす案。 |
| [ideas/30_ux/slideshow/README.md](<./ideas/30_ux/slideshow/README.md>) | Markdown | Slideshow / Guided Tour for M3E | M3E マップ内で「順番に決定事項やノードをガイドツアー」する機能の設計ブレインストーミング。 |
| [ideas/40_data/maintenance_hygiene/01_global_design.md](<./ideas/40_data/maintenance_hygiene/01_global_design.md>) | Markdown | 01. 共通設計（Global Design） | 検出系・アクション系を扱う前に、**両者を貫く共通論点** をまとめる。 |
| [ideas/40_data/maintenance_hygiene/02_detectors.md](<./ideas/40_data/maintenance_hygiene/02_detectors.md>) | Markdown | 02. 検出系（Detectors） | 「**汚れているノード**」を見つける検出器の候補列挙。 |
| [ideas/40_data/maintenance_hygiene/03_actions.md](<./ideas/40_data/maintenance_hygiene/03_actions.md>) | Markdown | 03. アクション系（Actions） | 検出器（02）が見つけた「汚れ候補」に対して **何をするか** の選択肢列挙。 |
| [ideas/40_data/maintenance_hygiene/04_safety_irreversibility.md](<./ideas/40_data/maintenance_hygiene/04_safety_irreversibility.md>) | Markdown | 04. 安全装置・不可逆性（Safety / Irreversibility） | メンテナンス・衛生は **削除・統合・移動** など破壊的操作を含む。 |
| [ideas/40_data/maintenance_hygiene/05_mvp_and_open_questions.md](<./ideas/40_data/maintenance_hygiene/05_mvp_and_open_questions.md>) | Markdown | 05. MVP / 横断観察 / 未決質問 | 検出器（02）× アクション（03）× 安全装置（04）を踏まえ、 |
| [ideas/40_data/maintenance_hygiene/README.md](<./ideas/40_data/maintenance_hygiene/README.md>) | Markdown | メンテナンス・衛生（Hygiene） | マップが大きくなった時の **腐敗防止** を扱うブレスト。 |
| [ideas/40_data/memory_architecture/01_three_tier_model.md](<./ideas/40_data/memory_architecture/01_three_tier_model.md>) | Markdown | 01. 三層モデル — Hermes 比較から M3E memory を再構成 | Hermes Agent (Nous Research) の memory 仕組みを読み解くと、要点は 4 つ： |
| [ideas/40_data/memory_architecture/02_hermes_integration_options.md](<./ideas/40_data/memory_architecture/02_hermes_integration_options.md>) | Markdown | 02. Hermes 統合オプション — 揮発の外部委譲 | M3E が Deep 正本に専念するため、Flash/Rapid 揮発レイヤを Hermes に委譲する 3 パターン。 |
| [ideas/40_data/memory_architecture/03_deep_canonicality_rules.md](<./ideas/40_data/memory_architecture/03_deep_canonicality_rules.md>) | Markdown | 03. Deep Canonicality — Deep を M3E 正本に固定する 7 ルール | 帯域軸 Deep × {Syntax, Semantic} を M3E 側に置き続けるための運用ルール。 |
| [ideas/40_data/memory_architecture/04_sticky_notes_layer.md](<./ideas/40_data/memory_architecture/04_sticky_notes_layer.md>) | Markdown | 04. 付箋層 — 本/付箋メタファ、コンテンツとコメントの物理分離 | 「本に付箋を貼るように、本のコンテンツと区別可能でなければならない」が出発点。 |
| [ideas/40_data/memory_architecture/05_mvp_and_open_questions.md](<./ideas/40_data/memory_architecture/05_mvp_and_open_questions.md>) | Markdown | 05. MVP と未決質問 | ROI 順で 4 段： |
| [ideas/40_data/memory_architecture/README.md](<./ideas/40_data/memory_architecture/README.md>) | Markdown | Memory Architecture — Deep canonicality と揮発の外部化 | Hermes Agent (Nous Research) のインストールを契機に、M3E の "memory" 層を |
| [ideas/40_data/performance_scale/01_concept.md](<./ideas/40_data/performance_scale/01_concept.md>) | Markdown | 01. Concept — なぜ「性能/スケール」を今ブレストするか | M3E は「個人の研究思考世界モデル」を目指す。 |
| [ideas/40_data/performance_scale/02_rendering_strategies.md](<./ideas/40_data/performance_scale/02_rendering_strategies.md>) | Markdown | 02. Rendering Strategies — 10k+ ノード描画の選択肢 | M1「巨大マップ対応」の **描画方式** を網羅的に並べる。 |
| [ideas/40_data/performance_scale/03_cross_map_search.md](<./ideas/40_data/performance_scale/03_cross_map_search.md>) | Markdown | 03. Cross-Map Search & History Index — 横断検索と履歴インデックス | M2「複数マップ間リンク・統合検索」と M4「検索インデックス」を統合してブレスト。 |
| [ideas/40_data/performance_scale/04_workspace_navigation.md](<./ideas/40_data/performance_scale/04_workspace_navigation.md>) | Markdown | 04. Workspace Navigation — 横断ナビゲーション UX | M3「workspace 切替 UX」の選択肢を網羅。 |
| [ideas/40_data/performance_scale/05_cache_offline.md](<./ideas/40_data/performance_scale/05_cache_offline.md>) | Markdown | 05. Cache / Offline — キャッシュ・オフライン優先・IndexedDB 戦略 | M5「キャッシュ／オフライン優先」を網羅。 |
| [ideas/40_data/performance_scale/06_mvp_path.md](<./ideas/40_data/performance_scale/06_mvp_path.md>) | Markdown | 06. MVP Path — 最小実装案・段階導入・横断観察・未決質問 | 01-05 の論点を踏まえて **どこから始めるか** の候補と、 |
| [ideas/40_data/performance_scale/README.md](<./ideas/40_data/performance_scale/README.md>) | Markdown | Performance / Scale — 巨大マップ・横断検索・オフライン優先 | M3E が「個人の長期世界モデル」になっていく過程で避けられない |
| [ideas/40_data/time_history/01_concept.md](<./ideas/40_data/time_history/01_concept.md>) | Markdown | 01 — コンセプト：時間軸／履歴とは何を指すか | 5 つのサブトピック（I1〜I5）の **共通の問い** と **それぞれの違い** を整理。 |
| [ideas/40_data/time_history/02_timetravel_whatif.md](<./ideas/40_data/time_history/02_timetravel_whatif.md>) | Markdown | 02 — I1 タイムトラベル と I2 What-if 分岐 | 「過去に戻る」と「もしも別の選択をしていたら」。 |
| [ideas/40_data/time_history/03_diff_animation.md](<./ideas/40_data/time_history/03_diff_animation.md>) | Markdown | 03 — I3 Diff アニメーション（マップの変化を可視化） | 「先月から今月でマップがどう動いたか」を **再生** する機能。 |
| [ideas/40_data/time_history/04_forget_summary.md](<./ideas/40_data/time_history/04_forget_summary.md>) | Markdown | 04 — I4 忘却機能 と I5 履歴 AI 要約 | 時間軸を **「操作する側」** の機能。 |
| [ideas/40_data/time_history/05_data_model.md](<./ideas/40_data/time_history/05_data_model.md>) | Markdown | 05 — データモデル / 履歴ストア / 既存資産接続 | I1〜I5 を支える **履歴ストア** の設計論点。 |
| [ideas/40_data/time_history/06_mvp_and_open_questions.md](<./ideas/40_data/time_history/06_mvp_and_open_questions.md>) | Markdown | 06 — MVP / 横断観察 / 組み合わせ / 未決質問 | 5 機能（I1〜I5）を **どこから掘ると効くか**、**何が組み合わせで強いか**、 |
| [ideas/40_data/time_history/README.md](<./ideas/40_data/time_history/README.md>) | Markdown | 時間軸／履歴（Time & History） | M3E マップを「時間方向にも探索可能」にするためのブレスト。 |
| [ideas/40_data/view_state_api/01_problem.md](<./ideas/40_data/view_state_api/01_problem.md>) | Markdown | 問題: 表現状態が map state に混ざっている | 現在の M3E API は、node の本文・親子構造・リンクなどの semantic state と、viewer 上の見え方に近い状態が同じ保存単位に混ざっている。 |
| [ideas/40_data/view_state_api/02_api_design.md](<./ideas/40_data/view_state_api/02_api_design.md>) | Markdown | View State API 案 | API を semantic state と view state に分ける。 |
| [ideas/40_data/view_state_api/README.md](<./ideas/40_data/view_state_api/README.md>) | Markdown | View State API | M3E の map 本体と viewer の表現状態を分離するための設計メモ。 |
| [ideas/50_collab/collaboration/01_concept.md](<./ideas/50_collab/collaboration/01_concept.md>) | Markdown | 01. Concept — なぜ協調機能が必要か、何を作るか | M3E に「協調・コラボレーション」を入れる意義と、入れる範囲・入れない範囲を |
| [ideas/50_collab/collaboration/02_axes_and_modes.md](<./ideas/50_collab/collaboration/02_axes_and_modes.md>) | Markdown | 02. 3軸 × 同期/非同期 のモード列挙 | 協調を「人 ↔ 人」「人 ↔ AI」「AI ↔ AI」の **3軸** で整理し、 |
| [ideas/50_collab/collaboration/03_runtime_ux.md](<./ideas/50_collab/collaboration/03_runtime_ux.md>) | Markdown | 03. Runtime UX — UI / 操作系のバリエーション | 協調の各モードを具体的にどう **見せる・触らせる** かを並べる。 |
| [ideas/50_collab/collaboration/04_data_permission.md](<./ideas/50_collab/collaboration/04_data_permission.md>) | Markdown | 04. データモデル / 権限モデル / ACL / プロビナンス | 協調を支えるデータと権限の設計選択肢。 |
| [ideas/50_collab/collaboration/05_mvp_and_strategy.md](<./ideas/50_collab/collaboration/05_mvp_and_strategy.md>) | Markdown | 05. MVP・戦略・横断観察・未決質問 | 協調機能の **戦略選択肢**、**MVP 候補**、**横断観察**、**未決質問** を集約する。 |
| [ideas/50_collab/collaboration/README.md](<./ideas/50_collab/collaboration/README.md>) | Markdown | Collaboration — 協調・コラボレーション体験設計 | 複数人 / 複数エージェントで M3E マップを使う体験のブレインストーミング。 |
| [ideas/50_collab/cross_device/01_concept.md](<./ideas/50_collab/cross_device/01_concept.md>) | Markdown | 01 Concept — なぜクロスデバイス・モバイルか | M3E を **PC 以外でも触る** ことの意味と前提を整理する。 |
| [ideas/50_collab/cross_device/02_platform_options.md](<./ideas/50_collab/cross_device/02_platform_options.md>) | Markdown | 02 Platform Options — 配布形態の選択肢 | 「どの技術スタックで、どう配るか」を決めずに並べる。 |
| [ideas/50_collab/cross_device/03_runtime_modes.md](<./ideas/50_collab/cross_device/03_runtime_modes.md>) | Markdown | 03 Runtime Modes — モバイル体験モードの列挙 | 「モバイルで何をするか」のモード（体験パターン）を網羅。 |
| [ideas/50_collab/cross_device/04_sync_offline.md](<./ideas/50_collab/cross_device/04_sync_offline.md>) | Markdown | 04 Sync / Offline — オフライン同期と競合解決 | クロスデバイスの本丸。 |
| [ideas/50_collab/cross_device/05_mvp_path.md](<./ideas/50_collab/cross_device/05_mvp_path.md>) | Markdown | 05 MVP Path — 最小実装案・横断観察・未決質問 | これまでの 4 ファイルを横断し、「最小投資で最大価値」の MVP 候補を絞る。 |
| [ideas/50_collab/cross_device/README.md](<./ideas/50_collab/cross_device/README.md>) | Markdown | Cross Device / Mobile — PC 以外での M3E 体験 | スマホ・タブレット・スマートウォッチなど PC 以外のデバイスで |
| [ideas/50_collab/privacy_security/01_concept.md](<./ideas/50_collab/privacy_security/01_concept.md>) | Markdown | 01. コンセプト — 何を守り、誰のために、どう違うか | M3E のプライバシー / セキュリティ機能は **「研究者の思考母艦に機微情報を同居させる」** ための設計。 |
| [ideas/50_collab/privacy_security/02_threat_model.md](<./ideas/50_collab/privacy_security/02_threat_model.md>) | Markdown | 02. 脅威モデル — 何から守るか、どこまで諦めるか | 防御は脅威モデルなしには設計できない。 |
| [ideas/50_collab/privacy_security/03_encryption_options.md](<./ideas/50_collab/privacy_security/03_encryption_options.md>) | Markdown | 03. 暗号化オプション — 何を、どの粒度で、どう暗号化するか | policy_privacy は **同期データの E2E 暗号化**（AES-256-GCM、`~/.m3e/sync.key` 1本）を既決。 |
| [ideas/50_collab/privacy_security/04_masking_detection.md](<./ideas/50_collab/privacy_security/04_masking_detection.md>) | Markdown | 04. マスキング・検出 — AI 送信前の機微情報フィルタ | policy_privacy が扱っていない **Layer 3（AI Pipeline）** の防御を扱う。 |
| [ideas/50_collab/privacy_security/05_vault_separation.md](<./ideas/50_collab/privacy_security/05_vault_separation.md>) | Markdown | 05. Vault 分離 — 公開 / 私用 / 機密のレーンをどう作るか | 00_topic_pool L4「マルチ Vault 切替」を深掘り。 |
| [ideas/50_collab/privacy_security/06_ux_data.md](<./ideas/50_collab/privacy_security/06_ux_data.md>) | Markdown | 06. UX・データモデル — 体験設計と永続化の選択肢 | 技術的に暗号化されていても、UI で見えなければ研究者は確信を持てない。 |
| [ideas/50_collab/privacy_security/07_mvp_path.md](<./ideas/50_collab/privacy_security/07_mvp_path.md>) | Markdown | 07. MVP パス・横断観察・未決質問 | 01-06 で並べた選択肢から「最小限どこから始めるか」「横断的気づき」「未決の重要質問」を整理。 |
| [ideas/50_collab/privacy_security/README.md](<./ideas/50_collab/privacy_security/README.md>) | Markdown | Privacy / Security — プライバシー・セキュリティ体験設計 | 研究者 akaghef が **科研費・実験データ・人物情報・パスワード・未公開仮説** を |
| [ideas/60_workflow/cognitive_science/01_srs_integration.md](<./ideas/60_workflow/cognitive_science/01_srs_integration.md>) | Markdown | J1. SRS（間隔反復）統合 | 「重要だが触らないと忘れるノード」を **間隔反復** スケジュールで再露出させる。 |
| [ideas/60_workflow/cognitive_science/02_forgetting_curve.md](<./ideas/60_workflow/cognitive_science/02_forgetting_curve.md>) | Markdown | J2. 忘却曲線可視化（このノード忘れそう警告） | ノードを **触っていない時間 × 重要度** から「鮮度」を算出し、視覚的に提示する。 |
| [ideas/60_workflow/cognitive_science/03_compounding_knowledge.md](<./ideas/60_workflow/cognitive_science/03_compounding_knowledge.md>) | Markdown | J3. 複利的知識構築（前提→応用の自動推薦） | ノードを **「前提（prerequisite）→ 応用（application）」** の DAG として扱い、 |
| [ideas/60_workflow/cognitive_science/04_question_driven.md](<./ideas/60_workflow/cognitive_science/04_question_driven.md>) | Markdown | J4. 質問駆動学習（マップ全体を「答えるべき問い」で再構成） | ノードを **「答え」ではなく「問い」** として記述するモードを設計する。 |
| [ideas/60_workflow/cognitive_science/05_metacognition.md](<./ideas/60_workflow/cognitive_science/05_metacognition.md>) | Markdown | J5. メタ認知支援（自分の思考パターンを可視化） | J1〜J4 が **学習行動を変える** のに対し、J5 は **学習している自分自身を観察する** レイヤー。 |
| [ideas/60_workflow/cognitive_science/06_cross_cutting_mvp.md](<./ideas/60_workflow/cognitive_science/06_cross_cutting_mvp.md>) | Markdown | 横断観察・組み合わせ・MVP・未決質問 | J1〜J5 を **個別機能** ではなく **認知サポート層** として一体運用したときに見えてくる |
| [ideas/60_workflow/cognitive_science/README.md](<./ideas/60_workflow/cognitive_science/README.md>) | Markdown | 認知科学・学習科学応用（Category J） | M3E の「ノード = 知識単位」を **覚え続ける／忘れる／問い直す／メタ認知する** 学習科学的視点で展開するブレインストーミング。 |
| [ideas/60_workflow/dev_evolution/01_weekly_paradigm_shift.md](<./ideas/60_workflow/dev_evolution/01_weekly_paradigm_shift.md>) | Markdown | 開発スタイルの週次脱皮と、残る希少スキル | 2026-04-17 の対話ダンプ。 |
| [ideas/60_workflow/dev_evolution/02_agent_m3e_latency.md](<./ideas/60_workflow/dev_evolution/02_agent_m3e_latency.md>) | Markdown | Agent × M3E 操作レイテンシの実測と下限 | 2026-04-19 の対話ダンプ。 |
| [ideas/60_workflow/education/01_concept.md](<./ideas/60_workflow/education/01_concept.md>) | Markdown | 01. 教育用途のコンセプト全体像 | M3E を教育コンテキストに転用したとき、何が嬉しく、何が既存と違うのか。 |
| [ideas/60_workflow/education/02_textbook_mapping.md](<./ideas/60_workflow/education/02_textbook_mapping.md>) | Markdown | 02. N1: 教科書のマップ化 | 教科書（PDF / EPUB / 紙→OCR / Web 教科書）を M3E のマップに変換する。 |
| [ideas/60_workflow/education/03_quiz_generation.md](<./ideas/60_workflow/education/03_quiz_generation.md>) | Markdown | 03. N2: 学生用クイズ生成 | マップ上のノード内容から自動的にクイズを生成する。 |
| [ideas/60_workflow/education/04_teacher_dashboard.md](<./ideas/60_workflow/education/04_teacher_dashboard.md>) | Markdown | 04. N3: 教師向け「学生のマップ」一覧 | 複数の学習者マップを教員が横断俯瞰する。 |
| [ideas/60_workflow/education/05_slide_to_map.md](<./ideas/60_workflow/education/05_slide_to_map.md>) | Markdown | 05. N4: 講義スライド→マップ自動変換 | PowerPoint / Keynote / PDF / Reveal.js 等の講義スライドを M3E マップに自動変換。 |
| [ideas/60_workflow/education/06_progress_tracking.md](<./ideas/60_workflow/education/06_progress_tracking.md>) | Markdown | 06. N5: 学習進度トラッキング | 学習者の進度を可視化し、適切な介入タイミングを見つける。 |
| [ideas/60_workflow/education/07_mvp_and_strategy.md](<./ideas/60_workflow/education/07_mvp_and_strategy.md>) | Markdown | 07. MVP 案・横断観察・戦略・未決質問 | ここまで N1〜N5 を個別に並べた。最後に **横断的気づき** と **MVP 案**、 |
| [ideas/60_workflow/education/README.md](<./ideas/60_workflow/education/README.md>) | Markdown | Education / 教育用途 ブレスト | M3E を **教育コンテキスト**（教科書・講義・学生指導・自習）に転用する切り口の網羅。 |
| [ideas/60_workflow/personal_productivity/01_concept.md](<./ideas/60_workflow/personal_productivity/01_concept.md>) | Markdown | 01. コンセプト: なぜ M3E を生活の中心にするのか | 「研究思考支援ツール」を週1回の道具で終わらせるか、毎日の足場にするか。 |
| [ideas/60_workflow/personal_productivity/02_ritual_options.md](<./ideas/60_workflow/personal_productivity/02_ritual_options.md>) | Markdown | 02. 儀式テンプレ群: デイリー & 週次の選択肢 | G1 デイリー儀式 / G2 週次レビューの **複数案** を採否決めずに並べる。 |
| [ideas/60_workflow/personal_productivity/03_tracking_options.md](<./ideas/60_workflow/personal_productivity/03_tracking_options.md>) | Markdown | 03. トラッキング系: 目標・習慣・時間・エネルギー | G3 OKR/KPI / G4 習慣 / G5 時間記録 / G8 エネルギーログ の選択肢。 |
| [ideas/60_workflow/personal_productivity/04_focus_modes.md](<./ideas/60_workflow/personal_productivity/04_focus_modes.md>) | Markdown | 04. 集中モード: Pomodoro / Focus / 通知制御 | G6 Pomodoro / G7 集中モード の UX バリエーション。 |
| [ideas/60_workflow/personal_productivity/05_mvp_path.md](<./ideas/60_workflow/personal_productivity/05_mvp_path.md>) | Markdown | 05. 横断観察 / MVP / 未決質問 | 01〜04 を横断する観察と、最小実装の素描、未決の質問を集める。 |
| [ideas/60_workflow/personal_productivity/README.md](<./ideas/60_workflow/personal_productivity/README.md>) | Markdown | 個人生産性ワークフロー: M3E を生活の中心に据える体験設計 | 研究者 akaghef が **毎日 M3E を開く理由** を作るための体験パターンを並べる。 |
| [ideas/60_workflow/structure_snippets/01_concept.md](<./ideas/60_workflow/structure_snippets/01_concept.md>) | Markdown | 01. コンセプト — 構造スニペットとは何か | **構造スニペット** = M3E のノードに対して、**子ノード構造を一発展開する小さなテンプレート**。 |
| [ideas/60_workflow/structure_snippets/02_catalog_classic.md](<./ideas/60_workflow/structure_snippets/02_catalog_classic.md>) | Markdown | 02. カタログ — ビジネス・分析系の定番 | 「調べ物・分析」で使う古典的フレームワークを網羅。 |
| [ideas/60_workflow/structure_snippets/03_catalog_thinking.md](<./ideas/60_workflow/structure_snippets/03_catalog_thinking.md>) | Markdown | 03. カタログ — 思考・論理系 | 「考えを整理する・深掘りする」系のフレームワーク群。 |
| [ideas/60_workflow/structure_snippets/04_catalog_research.md](<./ideas/60_workflow/structure_snippets/04_catalog_research.md>) | Markdown | 04. カタログ — 研究・学術系 | 研究者向け。akaghef の project_projection_vision（世界モデル→射影）との直接接続点。 |
| [ideas/60_workflow/structure_snippets/05_catalog_creative_decision.md](<./ideas/60_workflow/structure_snippets/05_catalog_creative_decision.md>) | Markdown | 05. カタログ — 創造・意思決定系 | 発散（アイデア出し）と収束（選択・意思決定）の両側。 |
| [ideas/60_workflow/structure_snippets/06_invocation_ui.md](<./ideas/60_workflow/structure_snippets/06_invocation_ui.md>) | Markdown | 06. 呼び出し UI — パッと出す方法のバリエーション | 「種類をとにかくたくさん用意したい」と「パッと出したい」は両立が難しい。 |
| [ideas/60_workflow/structure_snippets/07_data_mvp.md](<./ideas/60_workflow/structure_snippets/07_data_mvp.md>) | Markdown | 07. データモデル・MVP・戦略 | スニペットをデータとして表現し、最初に何を作るかを整理。 |
| [ideas/60_workflow/structure_snippets/README.md](<./ideas/60_workflow/structure_snippets/README.md>) | Markdown | 構造スニペット — 思考フレームワークをパッと呼び出す | 研究・思考・分析で使う構造化フレームワーク（5W1H、SWOT、MECE、PICO ...）を |
| [ideas/70_concept/agent_society/01_layer_stack.md](<./ideas/70_concept/agent_society/01_layer_stack.md>) | Markdown | As1: 3 層プロトコルスタックの一般化（inko / agmsg / sync） | > 通信・状態複製・意味伝達を 1 枚のチャットに潰すのが今の組織の標準形であり、 |
| [ideas/70_concept/agent_society/02_person_as_interface.md](<./ideas/70_concept/agent_society/02_person_as_interface.md>) | Markdown | As2: 人 = クラスターのインターフェース、agent 組織 = カプセル化された private 実装 | > 「人間が上流化する」とは、人間が偉くなることではなく、 |
| [ideas/70_concept/agent_society/03_company_as_map.md](<./ideas/70_concept/agent_society/03_company_as_map.md>) | Markdown | As3: 会社 = クラスター群のマップ、edge = 約束（commitment） | > 会社の正本は組織図(誰が誰の下にいるか)ではなく、 |
| [ideas/70_concept/agent_society/04_boundary_and_scoped_channel.md](<./ideas/70_concept/agent_society/04_boundary_and_scoped_channel.md>) | Markdown | As4: projection を「境界壁」として一般化、クラスター横断直結という未決問題 | > projection 契約は単なる技術的なデータ形式ではなく、 |
| [ideas/70_concept/agent_society/05_cross_cutting_and_roadmap.md](<./ideas/70_concept/agent_society/05_cross_cutting_and_roadmap.md>) | Markdown | 横断観察・接続表・ロードマップ・未決質問 | **1. この思想は「予言」ではなく「今日すでに部分実装されている」。** 他の |
| [ideas/70_concept/agent_society/README.md](<./ideas/70_concept/agent_society/README.md>) | Markdown | エージェント社会論（Agent Society） — 「会社」が群個体のマップになる | 2026-07-19〜20、Track U orchestration board の設計・実装・akaghef レビューを通じて |
| [ideas/70_concept/philosophical/01_unfinished_principle.md](<./ideas/70_concept/philosophical/01_unfinished_principle.md>) | Markdown | Q1. 「マップは未完成であるべき」原則のシステム化 | 「完成したマップは死んだマップ」という命題を、UX・データ・運用の各層で |
| [ideas/70_concept/philosophical/02_intentional_forgetting.md](<./ideas/70_concept/philosophical/02_intentional_forgetting.md>) | Markdown | Q2. 「忘れる」ことの設計（古い情報の意図的減衰） | 「アーカイブ＝完全保存」「削除＝完全消去」の二択に縛られず、 |
| [ideas/70_concept/philosophical/03_time_axes.md](<./ideas/70_concept/philosophical/03_time_axes.md>) | Markdown | Q3. 複数の時間軸（線形 vs 円環 vs 結晶） | 研究者の体感時間は単一の線形タイムラインで表現できない。 |
| [ideas/70_concept/philosophical/04_self_discovery.md](<./ideas/70_concept/philosophical/04_self_discovery.md>) | Markdown | Q4. 「マップで自分を発見する」体験設計 | マップを **作業台** ではなく **鏡** として使う体験を設計する。 |
| [ideas/70_concept/philosophical/05_node_death_rebirth.md](<./ideas/70_concept/philosophical/05_node_death_rebirth.md>) | Markdown | Q5. ノードの「死」と「再生」 | ノードを **永遠に保存する vs 削除する** の二択ではなく、 |
| [ideas/70_concept/philosophical/06_cross_cutting.md](<./ideas/70_concept/philosophical/06_cross_cutting.md>) | Markdown | 06. 横断観察・組み合わせ・実装可能性ロードマップ・未決質問 | Q1〜Q5 を横断して見えてきた **共通パターン**・**組み合わせ効果**・ |
| [ideas/70_concept/philosophical/README.md](<./ideas/70_concept/philosophical/README.md>) | Markdown | 哲学的・実験的テーマ（Philosophical / Experimental） | 00_topic_pool.md カテゴリ Q（横断的・哲学的テーマ）を素材に、 |
| [ideas/70_concept/thought_physics/01_concept.md](<./ideas/70_concept/thought_physics/01_concept.md>) | Markdown | 01. 概念 — なぜ思考に物理を与えるのか | ノードは "テキストの塊" である以上に、**生き物・物体としての性質** を持ち得る。 |
| [ideas/70_concept/thought_physics/02_node_physics.md](<./ideas/70_concept/thought_physics/02_node_physics.md>) | Markdown | 02. ノード物性の選択肢 | ノードに持たせる **物理量** の候補を網羅的に並べる。 |
| [ideas/70_concept/thought_physics/03_dynamics.md](<./ideas/70_concept/thought_physics/03_dynamics.md>) | Markdown | 03. 動的挙動 — 引力・反発・冷却・流体 | 物性（02）を持ったノードが **時間とともにどう動くか**。 |
| [ideas/70_concept/thought_physics/04_phenomena.md](<./ideas/70_concept/thought_physics/04_phenomena.md>) | Markdown | 04. 創発現象 — 気象予報・地震・季節・生態系 | 物性（02）と挙動（03）の上に立ち上がる **集団的・時間的現象**。 |
| [ideas/70_concept/thought_physics/05_mvp_path.md](<./ideas/70_concept/thought_physics/05_mvp_path.md>) | Markdown | 05. MVP・横断観察・未決質問 | 物理隠喩は **広大** だが、最小実装で価値検証できる切り口を絞る。 |
| [ideas/70_concept/thought_physics/README.md](<./ideas/70_concept/thought_physics/README.md>) | Markdown | 思考の物理学メタファー（Thought Physics） | ノードに「重力」「磁力」「温度」「鮮度」などの **物性** を持たせ、 |
| [ideas/ChatGPT-M3Eのコンテンツ販売.md](<./ideas/ChatGPT-M3Eのコンテンツ販売.md>) | Markdown | M3Eのコンテンツ販売 | **User:** Anonymous (kawami.s.aa@m.titech.ac.jp) |
| [ideas/ChatGPT-Map Logic Limitations.md](<./ideas/ChatGPT-Map Logic Limitations.md>) | Markdown | Map Logic Limitations | **User:** Anonymous (kawami.s.aa@m.titech.ac.jp) |
| [ideas/ChatGPT-ハードコピーとソフトコピー.md](<./ideas/ChatGPT-ハードコピーとソフトコピー.md>) | Markdown | ハードコピーとソフトコピー | **User:** Anonymous (kawami.s.aa@m.titech.ac.jp) |
| [ideas/ChatGPT-固定費と戦略.md](<./ideas/ChatGPT-固定費と戦略.md>) | Markdown | 固定費と戦略 | **User:** Anonymous (kawami.s.aa@m.titech.ac.jp) |
| [ideas/ChatGPT-温度とグラフ構造.md](<./ideas/ChatGPT-温度とグラフ構造.md>) | Markdown | 温度とグラフ構造 | **User:** Anonymous (kawami.s.aa@m.titech.ac.jp) |
| [ideas/description_example.md](<./ideas/description_example.md>) | Markdown | M3E 機能紹介 — 開発プロジェクト活用ガイド | M3E（Model, Map, Meaning Engine）は、科学研究者の構造的思考を支援するツールです。ツリー構造のデータモデルを中核に、論文分解・仮説比較・前提整理・設計判断といった知的作業を扱います。本ドキュメントでは、開発... |
| [ideas/Home_page.md](<./ideas/Home_page.md>) | Markdown | Home page | 回のセッションで実装した差分を自然言語でまとめます。 |
| [ideas/memo_ideas.md](<./ideas/memo_ideas.md>) | Markdown | M3EのAI協働に関する知見整理 | 会話の中で得られた知見を整理すると、M3Eは単なるマインドマップではなく、人間と複数のAIが同じ構造を共有しながら仕事を進めるための共同作業基盤として捉えるのが適切である。ユーザーは技術スタックそのものを把握する必要はなく、可視化され... |
| [ideas/README.md](<./ideas/README.md>) | Markdown | Ideas | このフォルダは M3E repo 内の idea の唯一の正規配置。旧 root `idea/` は使用しない。 |
| [ideas/security.md](<./ideas/security.md>) | Markdown | security | https://x.com/nobel_824/status/2038416059167121507 |
| [ideas/tree_compatible_language.md](<./ideas/tree_compatible_language.md>) | Markdown | Tree-Compatible Language (TCL) 仕様 | Tree-Compatible Language（TCL）は、マインドマップ（木構造）と自然言語文章の間の**準同型変換**を実現するための制約付き記述言語である。自由な自然言語ではなく、可逆性を持たせたシリアライズ形式として機能する。 |
| [ideas/tree_structure_rapid_deep.md](<./ideas/tree_structure_rapid_deep.md>) | Markdown | tree structure rapid deep | we consider about pdf->mind map. |
| [ideas/UrgentImportanceView.mlx](<./ideas/UrgentImportanceView.mlx>) | MATLAB Live Script | UrgentImportanceView | MATLAB Live Script |
| [ideas/定例会バックアップ.json](<./ideas/定例会バックアップ.json>) | JSON | 定例会バックアップ | JSON |

### legacy - historical designs

| File | Type | Title | Summary |
|---|---:|---|---|
| [legacy/Canvas_Centric_Architecture.md](<./legacy/Canvas_Centric_Architecture.md>) | Markdown | Canvas-Centric Architecture | Legacy |
| [legacy/Current_Pivot_Freeplane_First.md](<./legacy/Current_Pivot_Freeplane_First.md>) | Markdown | Current Pivot: Freeplane-Informed Custom Engine | 当面の M3E は、Freeplane をそのまま土台 UI として使うのではなく、 |
| [legacy/M3E仕様2.md](<./legacy/M3E仕様2.md>) | Markdown | M3E仕様2 | 現時点であなたが置いている前提を整理すると、次のようになります。 |
| [legacy/M3E仕様設計書.md](<./legacy/M3E仕様設計書.md>) | Markdown | Mind Map Model Engine (M3E) 仕様設計書（会話ログ統合） | 本書は、これまでの会話で合意された世界観・制約・設計意図を、実装詳細に過度に踏み込まずに「仕様」として再構成したものである。特に、個人オフライン・スコープ境界・親子主構造・帯域（Flash/Rapid/Deep）・AIは提案で承認が確... |
| [legacy/mvp-cleanup-plan.md](<./legacy/mvp-cleanup-plan.md>) | Markdown | mvp 痕跡の削除計画 | mvp/ を「バージョン履歴だけのもの」として扱い、実行可能な参照をすべて消す。 |
| [legacy/README.md](<./legacy/README.md>) | Markdown | Legacy | このディレクトリには、現行方針では採用しない旧設計要件を置く。 |

### research - source research and extracts

| File | Type | Title | Summary |
|---|---:|---|---|
| [research/Claude_Code_Skills_Research.md](<./research/Claude_Code_Skills_Research.md>) | Markdown | Claude Code Skills & Subagents — M3E 適用調査 | **Author**: team agent (research branch `research/claude-code-skills`) |
| [research/m3e_data_structure_conversations/00_README.md](<./research/m3e_data_structure_conversations/00_README.md>) | Markdown | M3E Data Structure Conversation Corpus | ChatGPT export内の M3E 関連会話から、データ構造・通信形式・正本境界・属性表現に関係する材料を M3E repo 側へコピーした作業パッケージ。 |
| [research/m3e_data_structure_conversations/01_pure_brief.md](<./research/m3e_data_structure_conversations/01_pure_brief.md>) | Markdown | M3E Data Structure Pure Brief | このノートは会話ログから抽出した設計判断の高純度版。正式仕様ではなく、次に `docs/03_Spec/` へ昇格させるための種。 |
| [research/m3e_data_structure_conversations/02_transport_schema_seed.md](<./research/m3e_data_structure_conversations/02_transport_schema_seed.md>) | Markdown | M3E Transport Schema Seed | 通信側だけを先に固めるための seed。正本 schema ではなく、LLM / agent と M3E runtime の境界 DTO として扱う。 |
| [research/m3e_data_structure_conversations/03_core_i64_seed.md](<./research/m3e_data_structure_conversations/03_core_i64_seed.md>) | Markdown | core_i64 Seed | SQLiteの1列を固定フォーマット領域として使う案の seed。目的は、頻出する小さな semantic fields を JSON/attrs の文字列ノイズから逃がすこと。 |
| [research/m3e_data_structure_conversations/04_open_questions.md](<./research/m3e_data_structure_conversations/04_open_questions.md>) | Markdown | Open Questions | 会話ログから見て、まだ固める必要がある点。 |
| [research/m3e_data_structure_conversations/extracts/curated_core_evidence.md](<./research/m3e_data_structure_conversations/extracts/curated_core_evidence.md>) | Markdown | Curated Core Evidence | M3Eデータ構造・通信形式を仕様化するとき、まず見るべき証跡だけを手で選んだもの。 |
| [research/m3e_data_structure_conversations/extracts/high_purity_evidence.md](<./research/m3e_data_structure_conversations/extracts/high_purity_evidence.md>) | Markdown | High Purity Evidence | TOON / MIOS / Command Patch / JSON正本 / 可変属性 / packed core に直接触れている証跡だけを抽出した版。 |
| [research/m3e_data_structure_conversations/extracts/high_value_evidence.md](<./research/m3e_data_structure_conversations/extracts/high_value_evidence.md>) | Markdown | Extracted Evidence | M3E data-structure / communication-design conversationsから、設計判断に近い行だけを抜いた証跡。 |
| [research/m3e_data_structure_conversations/raw_conversations/260304_KGFとフレームワーク.md](<./research/m3e_data_structure_conversations/raw_conversations/260304_KGFとフレームワーク.md>) | Markdown | KGFとフレームワーク | <sub>2026-03-04</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260304_KGFのOS構造.md](<./research/m3e_data_structure_conversations/raw_conversations/260304_KGFのOS構造.md>) | Markdown | KGFのOS構造 | <sub>2026-03-04</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260304_Manusでプロトタイプ作成.md](<./research/m3e_data_structure_conversations/raw_conversations/260304_Manusでプロトタイプ作成.md>) | Markdown | Manusでプロトタイプ作成 | <sub>2026-03-04</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260304_Miro_Mind_Map_API.md](<./research/m3e_data_structure_conversations/raw_conversations/260304_Miro_Mind_Map_API.md>) | Markdown | Miro Mind Map API | <sub>2026-03-04</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260304_MVC通信形式_Rapid.md](<./research/m3e_data_structure_conversations/raw_conversations/260304_MVC通信形式_Rapid.md>) | Markdown | MVC通信形式 Rapid | <sub>2026-03-04</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260304_タイムボクシング連携.md](<./research/m3e_data_structure_conversations/raw_conversations/260304_タイムボクシング連携.md>) | Markdown | タイムボクシング連携 | <sub>2026-03-04</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260304_構造と文章の相互変換.md](<./research/m3e_data_structure_conversations/raw_conversations/260304_構造と文章の相互変換.md>) | Markdown | 構造と文章の相互変換 | <sub>2026-03-04</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260304_開発言語選定.md](<./research/m3e_data_structure_conversations/raw_conversations/260304_開発言語選定.md>) | Markdown | 開発言語選定 | <sub>2026-03-04</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260305_アプリ仕様とフレームワーク.md](<./research/m3e_data_structure_conversations/raw_conversations/260305_アプリ仕様とフレームワーク.md>) | Markdown | アプリ仕様とフレームワーク | <sub>2026-03-05</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260308_AIと研究のギャップ.md](<./research/m3e_data_structure_conversations/raw_conversations/260308_AIと研究のギャップ.md>) | Markdown | AIと研究のギャップ | <sub>2026-03-08</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260310_意思決定の高速化.md](<./research/m3e_data_structure_conversations/raw_conversations/260310_意思決定の高速化.md>) | Markdown | 意思決定の高速化 | <sub>2026-03-10</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260311_Agent開発の基本.md](<./research/m3e_data_structure_conversations/raw_conversations/260311_Agent開発の基本.md>) | Markdown | Agent開発の基本 | <sub>2026-03-11</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260311_アプリ名の略称提案.md](<./research/m3e_data_structure_conversations/raw_conversations/260311_アプリ名の略称提案.md>) | Markdown | アプリ名の略称提案 | <sub>2026-03-11</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260311_外部ツール利用可否.md](<./research/m3e_data_structure_conversations/raw_conversations/260311_外部ツール利用可否.md>) | Markdown | 外部ツール利用可否 | <sub>2026-03-11</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260312_EdrawMindラッピング検討.md](<./research/m3e_data_structure_conversations/raw_conversations/260312_EdrawMindラッピング検討.md>) | Markdown | EdrawMindラッピング検討 | <sub>2026-03-12</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260312_Freeplane_実装とデータ構造.md](<./research/m3e_data_structure_conversations/raw_conversations/260312_Freeplane_実装とデータ構造.md>) | Markdown | Freeplane 実装とデータ構造 | <sub>2026-03-12</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260312_Obsidian_Canvas_ラッピング.md](<./research/m3e_data_structure_conversations/raw_conversations/260312_Obsidian_Canvas_ラッピング.md>) | Markdown | Obsidian Canvas ラッピング | <sub>2026-03-12</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260312_Wisemapping_ラップ検証.md](<./research/m3e_data_structure_conversations/raw_conversations/260312_Wisemapping_ラップ検証.md>) | Markdown | Wisemapping ラップ検証 | <sub>2026-03-12</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260312_ライセンスと公開障害.md](<./research/m3e_data_structure_conversations/raw_conversations/260312_ライセンスと公開障害.md>) | Markdown | ライセンスと公開障害 | <sub>2026-03-12</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260313_M3E_Obsidianファイル構造.md](<./research/m3e_data_structure_conversations/raw_conversations/260313_M3E_Obsidianファイル構造.md>) | Markdown | M3E Obsidianファイル構造 | <sub>2026-03-13</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260313_ReactとCanvasの実装方針.md](<./research/m3e_data_structure_conversations/raw_conversations/260313_ReactとCanvasの実装方針.md>) | Markdown | ReactとCanvasの実装方針 | <sub>2026-03-13</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260313_Xiaomiセンサー表示機実装.md](<./research/m3e_data_structure_conversations/raw_conversations/260313_Xiaomiセンサー表示機実装.md>) | Markdown | Xiaomiセンサー表示機実装 | <sub>2026-03-13</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260313_雑多.md](<./research/m3e_data_structure_conversations/raw_conversations/260313_雑多.md>) | Markdown | 雑多 | <sub>2026-03-13</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260325_温度とグラフ構造.md](<./research/m3e_data_structure_conversations/raw_conversations/260325_温度とグラフ構造.md>) | Markdown | 温度とグラフ構造 | <sub>2026-03-25</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260327_Freeplane_フォークの現実性.md](<./research/m3e_data_structure_conversations/raw_conversations/260327_Freeplane_フォークの現実性.md>) | Markdown | Freeplane フォークの現実性 | <sub>2026-03-27</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260330_GUI操作の自動化方法.md](<./research/m3e_data_structure_conversations/raw_conversations/260330_GUI操作の自動化方法.md>) | Markdown | GUI操作の自動化方法 | <sub>2026-03-30</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260330_Industry_E4_clarification.md](<./research/m3e_data_structure_conversations/raw_conversations/260330_Industry_E4_clarification.md>) | Markdown | Industry E4 clarification | <sub>2026-03-30</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260330_LLMの不足判定設計.md](<./research/m3e_data_structure_conversations/raw_conversations/260330_LLMの不足判定設計.md>) | Markdown | LLMの不足判定設計 | <sub>2026-03-30</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260330_Map_Logic_Limitations.md](<./research/m3e_data_structure_conversations/raw_conversations/260330_Map_Logic_Limitations.md>) | Markdown | Map Logic Limitations | <sub>2026-03-30</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260330_ハードコピーとソフトコピー.md](<./research/m3e_data_structure_conversations/raw_conversations/260330_ハードコピーとソフトコピー.md>) | Markdown | ハードコピーとソフトコピー | <sub>2026-03-30</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260330_メールボックス分類フロー.md](<./research/m3e_data_structure_conversations/raw_conversations/260330_メールボックス分類フロー.md>) | Markdown | メールボックス分類フロー | <sub>2026-03-30</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260330_役割分離の方法.md](<./research/m3e_data_structure_conversations/raw_conversations/260330_役割分離の方法.md>) | Markdown | 役割分離の方法 | <sub>2026-03-30</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260331_BitwardenとPowerShell設定.md](<./research/m3e_data_structure_conversations/raw_conversations/260331_BitwardenとPowerShell設定.md>) | Markdown | BitwardenとPowerShell設定 | <sub>2026-03-31</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260331_CodexCLI使用方法.md](<./research/m3e_data_structure_conversations/raw_conversations/260331_CodexCLI使用方法.md>) | Markdown | CodexCLI使用方法 | <sub>2026-03-31</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260402_UIマトリクス視覚化.md](<./research/m3e_data_structure_conversations/raw_conversations/260402_UIマトリクス視覚化.md>) | Markdown | U&Iマトリクス視覚化 | <sub>2026-04-02</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260402_ノードメタデータ設計.md](<./research/m3e_data_structure_conversations/raw_conversations/260402_ノードメタデータ設計.md>) | Markdown | ノードメタデータ設計 | <sub>2026-04-02</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260402_軸の定義と整理.md](<./research/m3e_data_structure_conversations/raw_conversations/260402_軸の定義と整理.md>) | Markdown | 軸の定義と整理 | <sub>2026-04-02</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260403_AI_Infra_Design_for_M3E.md](<./research/m3e_data_structure_conversations/raw_conversations/260403_AI_Infra_Design_for_M3E.md>) | Markdown | AI Infra Design for M3E | <sub>2026-04-03</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260403_Worktreeによるディレクトリ管理.md](<./research/m3e_data_structure_conversations/raw_conversations/260403_Worktreeによるディレクトリ管理.md>) | Markdown | Worktreeによるディレクトリ管理 | <sub>2026-04-03</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260403_アイコン設計方針.md](<./research/m3e_data_structure_conversations/raw_conversations/260403_アイコン設計方針.md>) | Markdown | アイコン設計方針 | <sub>2026-04-03</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260403_キーコンフィグ相談.md](<./research/m3e_data_structure_conversations/raw_conversations/260403_キーコンフィグ相談.md>) | Markdown | キーコンフィグ相談 | <sub>2026-04-03</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260403_クラウド同期マージ問題.md](<./research/m3e_data_structure_conversations/raw_conversations/260403_クラウド同期マージ問題.md>) | Markdown | クラウド同期マージ問題 | <sub>2026-04-03</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260403_データマイグレーションの実際.md](<./research/m3e_data_structure_conversations/raw_conversations/260403_データマイグレーションの実際.md>) | Markdown | データマイグレーションの実際 | <sub>2026-04-03</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260403_固定費と戦略.md](<./research/m3e_data_structure_conversations/raw_conversations/260403_固定費と戦略.md>) | Markdown | 固定費と戦略 | <sub>2026-04-03</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260404_Give_push_permission.md](<./research/m3e_data_structure_conversations/raw_conversations/260404_Give_push_permission.md>) | Markdown | Give push permission | <sub>2026-04-04</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260404_HTML要素と設計.md](<./research/m3e_data_structure_conversations/raw_conversations/260404_HTML要素と設計.md>) | Markdown | HTML要素と設計 | <sub>2026-04-04</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260404_M3EとAgent_Workflow.md](<./research/m3e_data_structure_conversations/raw_conversations/260404_M3EとAgent_Workflow.md>) | Markdown | M3EとAgent Workflow | <sub>2026-04-04</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260404_M3Eのコンテンツ販売.md](<./research/m3e_data_structure_conversations/raw_conversations/260404_M3Eのコンテンツ販売.md>) | Markdown | M3Eのコンテンツ販売 | <sub>2026-04-04</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260404_ScopeとNodeの設定.md](<./research/m3e_data_structure_conversations/raw_conversations/260404_ScopeとNodeの設定.md>) | Markdown | ScopeとNodeの設定 | <sub>2026-04-04</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260404_ハイブリッド検索の重要性.md](<./research/m3e_data_structure_conversations/raw_conversations/260404_ハイブリッド検索の重要性.md>) | Markdown | ハイブリッド検索の重要性 | <sub>2026-04-04</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260404_評価と比較の分離.md](<./research/m3e_data_structure_conversations/raw_conversations/260404_評価と比較の分離.md>) | Markdown | 評価と比較の分離 | <sub>2026-04-04</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260405_M3E_vs_M3E.md](<./research/m3e_data_structure_conversations/raw_conversations/260405_M3E_vs_M3E.md>) | Markdown | M3E vs M^3E | <sub>2026-04-05</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260405_Obsidianのビジネスモデル.md](<./research/m3e_data_structure_conversations/raw_conversations/260405_Obsidianのビジネスモデル.md>) | Markdown | Obsidianのビジネスモデル | <sub>2026-04-05</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260406_AI_memory_reflection.md](<./research/m3e_data_structure_conversations/raw_conversations/260406_AI_memory_reflection.md>) | Markdown | AI memory reflection | <sub>2026-04-06</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260406_AI_orchestration_in_M3E.md](<./research/m3e_data_structure_conversations/raw_conversations/260406_AI_orchestration_in_M3E.md>) | Markdown | AI orchestration in M3E | <sub>2026-04-06</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260406_位相空間_定義.md](<./research/m3e_data_structure_conversations/raw_conversations/260406_位相空間_定義.md>) | Markdown | 位相空間 定義 | <sub>2026-04-06</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260407_Claude_Git自動承認設定.md](<./research/m3e_data_structure_conversations/raw_conversations/260407_Claude_Git自動承認設定.md>) | Markdown | Claude Git自動承認設定 | <sub>2026-04-07</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260408_数学書の構造化.md](<./research/m3e_data_structure_conversations/raw_conversations/260408_数学書の構造化.md>) | Markdown | 数学書の構造化 | <sub>2026-04-08</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260409_ローンチ前の自動テスト.md](<./research/m3e_data_structure_conversations/raw_conversations/260409_ローンチ前の自動テスト.md>) | Markdown | ローンチ前の自動テスト | <sub>2026-04-09</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260410_LLMの知識境界.md](<./research/m3e_data_structure_conversations/raw_conversations/260410_LLMの知識境界.md>) | Markdown | LLMの知識境界 | <sub>2026-04-10</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260410_Structural_Reasoning_Stack.md](<./research/m3e_data_structure_conversations/raw_conversations/260410_Structural_Reasoning_Stack.md>) | Markdown | Structural Reasoning Stack | <sub>2026-04-10</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260410_TCLの意味.md](<./research/m3e_data_structure_conversations/raw_conversations/260410_TCLの意味.md>) | Markdown | TCLの意味 | <sub>2026-04-10</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260410_線形からグラフ構造.md](<./research/m3e_data_structure_conversations/raw_conversations/260410_線形からグラフ構造.md>) | Markdown | 線形からグラフ構造 | <sub>2026-04-10</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260410_重要LLMとM3E構造比較.md](<./research/m3e_data_structure_conversations/raw_conversations/260410_重要LLMとM3E構造比較.md>) | Markdown | 【重要】LLMとM3E 構造比較 | <sub>2026-04-10</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260411_CodexとLLMの違い.md](<./research/m3e_data_structure_conversations/raw_conversations/260411_CodexとLLMの違い.md>) | Markdown | CodexとLLMの違い | <sub>2026-04-11</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260411_Entity_Party_Org_関係.md](<./research/m3e_data_structure_conversations/raw_conversations/260411_Entity_Party_Org_関係.md>) | Markdown | Entity Party Org 関係 | <sub>2026-04-11</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260411_GitHubインストーラ警告対策.md](<./research/m3e_data_structure_conversations/raw_conversations/260411_GitHubインストーラ警告対策.md>) | Markdown | GitHubインストーラ警告対策 | <sub>2026-04-11</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260411_セキュリティとスコープ設計.md](<./research/m3e_data_structure_conversations/raw_conversations/260411_セキュリティとスコープ設計.md>) | Markdown | セキュリティとスコープ設計 | <sub>2026-04-11</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260412_Codex_Git操作方法.md](<./research/m3e_data_structure_conversations/raw_conversations/260412_Codex_Git操作方法.md>) | Markdown | Codex Git操作方法 | <sub>2026-04-12</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260412_Party_experience_summary.md](<./research/m3e_data_structure_conversations/raw_conversations/260412_Party_experience_summary.md>) | Markdown | Party experience summary | <sub>2026-04-12</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260413_M3_Server_Online_Access.md](<./research/m3e_data_structure_conversations/raw_conversations/260413_M3_Server_Online_Access.md>) | Markdown | M3 Server Online Access | <sub>2026-04-13</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260413_Miro_API_Mind_Map_Editing.md](<./research/m3e_data_structure_conversations/raw_conversations/260413_Miro_API_Mind_Map_Editing.md>) | Markdown | Miro API Mind Map Editing | <sub>2026-04-13</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260413_Offline_XMind_Integration.md](<./research/m3e_data_structure_conversations/raw_conversations/260413_Offline_XMind_Integration.md>) | Markdown | Offline XMind Integration | <sub>2026-04-13</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260415_CI通知と失敗対策.md](<./research/m3e_data_structure_conversations/raw_conversations/260415_CI通知と失敗対策.md>) | Markdown | CI通知と失敗対策 | <sub>2026-04-15</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260415_scopen_descopen改善提案.md](<./research/m3e_data_structure_conversations/raw_conversations/260415_scopen_descopen改善提案.md>) | Markdown | scopen descopen改善提案 | <sub>2026-04-15</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260417_LLMの抽象度評価.md](<./research/m3e_data_structure_conversations/raw_conversations/260417_LLMの抽象度評価.md>) | Markdown | LLMの抽象度評価 | <sub>2026-04-17</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260417_ハーネスエンジニアリングとは.md](<./research/m3e_data_structure_conversations/raw_conversations/260417_ハーネスエンジニアリングとは.md>) | Markdown | ハーネスエンジニアリングとは | <sub>2026-04-17</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260417_重要Resource管理のアプローチ.md](<./research/m3e_data_structure_conversations/raw_conversations/260417_重要Resource管理のアプローチ.md>) | Markdown | 【重要】Resource管理のアプローチ | <sub>2026-04-17</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260419_Cloud_Code_Agent_SDK.md](<./research/m3e_data_structure_conversations/raw_conversations/260419_Cloud_Code_Agent_SDK.md>) | Markdown | Cloud Code Agent SDK | <sub>2026-04-19</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260419_PJ遂行の仕組み.md](<./research/m3e_data_structure_conversations/raw_conversations/260419_PJ遂行の仕組み.md>) | Markdown | PJ遂行の仕組み | <sub>2026-04-19</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260419_数学書の解析と構造化.md](<./research/m3e_data_structure_conversations/raw_conversations/260419_数学書の解析と構造化.md>) | Markdown | 数学書の解析と構造化 | <sub>2026-04-19</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260420_ネットワーク同期とセキュリティ.md](<./research/m3e_data_structure_conversations/raw_conversations/260420_ネットワーク同期とセキュリティ.md>) | Markdown | ネットワーク同期とセキュリティ | <sub>2026-04-20</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260420_位相と埋め込みアルゴリズム.md](<./research/m3e_data_structure_conversations/raw_conversations/260420_位相と埋め込みアルゴリズム.md>) | Markdown | 位相と埋め込みアルゴリズム | <sub>2026-04-20</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260420_戦略立案の改善.md](<./research/m3e_data_structure_conversations/raw_conversations/260420_戦略立案の改善.md>) | Markdown | 戦略立案の改善 | <sub>2026-04-20</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260420_目標整理と最小化.md](<./research/m3e_data_structure_conversations/raw_conversations/260420_目標整理と最小化.md>) | Markdown | 目標整理と最小化 | <sub>2026-04-20</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260421_M3E威力の伝え方.md](<./research/m3e_data_structure_conversations/raw_conversations/260421_M3E威力の伝え方.md>) | Markdown | M3E威力の伝え方 | <sub>2026-04-21</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260421_PDFメタデータ分類法.md](<./research/m3e_data_structure_conversations/raw_conversations/260421_PDFメタデータ分類法.md>) | Markdown | PDFメタデータ分類法 | <sub>2026-04-21</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260421_SPReADとARiSEの違い.md](<./research/m3e_data_structure_conversations/raw_conversations/260421_SPReADとARiSEの違い.md>) | Markdown | SPReADとARiSEの違い | <sub>2026-04-21</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260421_オンボーディングワークフロー.md](<./research/m3e_data_structure_conversations/raw_conversations/260421_オンボーディングワークフロー.md>) | Markdown | オンボーディングワークフロー | <sub>2026-04-21</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260421_フラクタル性と物理現象.md](<./research/m3e_data_structure_conversations/raw_conversations/260421_フラクタル性と物理現象.md>) | Markdown | フラクタル性と物理現象 | <sub>2026-04-21</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260421_情報欠落検出問題.md](<./research/m3e_data_structure_conversations/raw_conversations/260421_情報欠落検出問題.md>) | Markdown | 情報欠落検出問題 | <sub>2026-04-21</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260422_GUI自動化_Playwright.md](<./research/m3e_data_structure_conversations/raw_conversations/260422_GUI自動化_Playwright.md>) | Markdown | GUI自動化 Playwright | <sub>2026-04-22</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260422_M3Eと数学的発見.md](<./research/m3e_data_structure_conversations/raw_conversations/260422_M3Eと数学的発見.md>) | Markdown | M3Eと数学的発見 | <sub>2026-04-22</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260422_数学研究と著作権.md](<./research/m3e_data_structure_conversations/raw_conversations/260422_数学研究と著作権.md>) | Markdown | 数学研究と著作権 | <sub>2026-04-22</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260422_研究計画とコスト分析.md](<./research/m3e_data_structure_conversations/raw_conversations/260422_研究計画とコスト分析.md>) | Markdown | 研究計画とコスト分析 | <sub>2026-04-22</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260423_M3Eによる数学書の読解.md](<./research/m3e_data_structure_conversations/raw_conversations/260423_M3Eによる数学書の読解.md>) | Markdown | M3Eによる数学書の読解 | <sub>2026-04-23</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260423_ハードウェアデータ基盤設計.md](<./research/m3e_data_structure_conversations/raw_conversations/260423_ハードウェアデータ基盤設計.md>) | Markdown | ハードウェアデータ基盤設計 | <sub>2026-04-23</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260424_認知資源の効率化と物理.md](<./research/m3e_data_structure_conversations/raw_conversations/260424_認知資源の効率化と物理.md>) | Markdown | 認知資源の効率化と物理 | <sub>2026-04-24</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260425_LLMマインドマップトポロジ.md](<./research/m3e_data_structure_conversations/raw_conversations/260425_LLMマインドマップトポロジ.md>) | Markdown | LLMマインドマップトポロジ | <sub>2026-04-25</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260425_MIOSMindmap_IO_Stack.md](<./research/m3e_data_structure_conversations/raw_conversations/260425_MIOSMindmap_IO_Stack.md>) | Markdown | MIOS（Mindmap I/O Stack) | <sub>2026-04-25</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260425_分類木自動生成手法.md](<./research/m3e_data_structure_conversations/raw_conversations/260425_分類木自動生成手法.md>) | Markdown | 分類木自動生成手法 | <sub>2026-04-25</sub> |
| [research/m3e_data_structure_conversations/raw_conversations/260425_動的粒度制御能力.md](<./research/m3e_data_structure_conversations/raw_conversations/260425_動的粒度制御能力.md>) | Markdown | 動的粒度制御能力 | <sub>2026-04-25</sub> |
| [research/m3e_data_structure_conversations/source_manifest.csv](<./research/m3e_data_structure_conversations/source_manifest.csv>) | CSV | source manifest | file,score,high_confidence,categories,hits,line_count,bytes,source_path,raw_copy |
| [research/m3e_data_structure_conversations/source_manifest.md](<./research/m3e_data_structure_conversations/source_manifest.md>) | Markdown | Source Manifest | Source Manifest |
| [research/ontology_data_structure.md](<./research/ontology_data_structure.md>) | Markdown | オントロジーとデータ構造 -- NTT Data 解説からの知見 | オントロジーとは「対象世界をどのように捉えた（概念化した）かを記述するもの」であり、 |
| [research/ontology_scientific_research.md](<./research/ontology_scientific_research.md>) | Markdown | オントロジー x 科学研究 — 競合調査 & M3E 差別化設計 | 作成日: 2026-04-09 |
| [research/README.md](<./research/README.md>) | Markdown | research/ | **役割**: M3E の基礎研究。データモデル・思考構造の理論的背景。 |

### tasks - handoffs and task notes

| File | Type | Title | Summary |
|---|---:|---|---|
| [tasks/handoff_20260604_1411_mapify-io-possibilities.md](<./tasks/handoff_20260604_1411_mapify-io-possibilities.md>) | Markdown | Handoff: Mapify I/O 機能の可能性 | 作成日時: 2026-06-04 14:11 JST |
| [tasks/handoff_cloud_sync_conflict_resolution.md](<./tasks/handoff_cloud_sync_conflict_resolution.md>) | Markdown | Handoff: Cloud Sync 競合解決 — Merge Mode 実装 | Cloud Sync 競合時に GitHub-like な diff 表示 + node 単位マージ選択を実装する。 |
| [tasks/handoff_cloud_sync_conflict_ui.md](<./tasks/handoff_cloud_sync_conflict_ui.md>) | Markdown | Handoff: Cloud Sync 競合UI改善 | Cloud Sync で競合 (conflict) が発生した際の UI を改善する。 |
| [tasks/handoff_layout_refactor_pn_integration.md](<./tasks/handoff_layout_refactor_pn_integration.md>) | Markdown | Handoff: layout() 純関数化 + PN layout設定統合 | **日付**: 2026-06-16 |
| [tasks/handoff_orchestration_map_pilot_260719.md](<./tasks/handoff_orchestration_map_pilot_260719.md>) | Markdown | Handoff: Orchestration Map Pilot — Neo4j + policy 上乗せ | > **Plan Hierarchy（Principle / Vision / Strategy / Goal / Task）の DAG と、各案件に対応する agent・gate・status を単一の信頼できる model に載せ... |
| [tasks/handoff_resource_design.md](<./tasks/handoff_resource_design.md>) | Markdown | Handoff: Resource 概念の設計 | M3E に「Resource」概念を導入する。 |
| [tasks/handoff_s16_neo4j_federation_define_260718.md](<./tasks/handoff_s16_neo4j_federation_define_260718.md>) | Markdown | Handoff: S16 連邦化 Strategy レビュー結論と Phase 0 define 指示 | Handoff: S16 連邦化 Strategy レビュー結論と Phase 0 define 指示 |
| [tasks/handoff_template.md](<./tasks/handoff_template.md>) | Markdown | Handoff: {TOPIC} | {タスクの説明。何を実装/修正/調査するか。} |
| [tasks/handoff_track_u_orchestration_seam_260719.md](<./tasks/handoff_track_u_orchestration_seam_260719.md>) | Markdown | Handoff: Track U — Orchestration Board Seam（別スレ実行用） | Handoff: Track U — Orchestration Board Seam（別スレ実行用） |
| [tasks/handoff_u1_5_board_renderer_svg_260720.md](<./tasks/handoff_u1_5_board_renderer_svg_260720.md>) | Markdown | Handoff: U1.5 — Board Renderer SVG 化（OP2 移行） | akaghef の指摘により停止。renderer 技術方針（OP2=SVG）自体は有効だが、board の製品要件を |
| [tasks/orchestration_map_pilot_result_260719.md](<./tasks/orchestration_map_pilot_result_260719.md>) | Markdown | Orchestration Map Pilot Result 260719 | All scripts are under `scripts/pilot/` and emit one JSON object per run. |
| [tasks/README.md](<./tasks/README.md>) | Markdown | tasks/ | **役割**: 具体 task と handoff の置き場。ロール間・セッション間の引き継ぎ場所。 |
| [tasks/requirements_agent_dialogue_monitor_260720.md](<./tasks/requirements_agent_dialogue_monitor_260720.md>) | Markdown | 要求定義: Agent 対話監視面（Akaghef-System 帰属 backend + M3E 表示面） | [agent_network_dashboard_reference_260707/](agent_network_dashboard_reference_260707/) / |
| [tasks/todo_by_role.md](<./tasks/todo_by_role.md>) | Markdown | MOVED | ロール別タスクは [../06_Operations/Todo_Pool.md](../06_Operations/Todo_Pool.md) の Owner フィールドに統合済み（2026-04-15）。 |

### root - top-level docs files

| File | Type | Title | Summary |
|---|---:|---|---|
| [freeplane利用について.txt](<./freeplane利用について.txt>) | Text | freeplane利用について | 当面の M3E は、独自エディタの開発を主目的としない。 |
| [index.md](<./index.md>) | Markdown | M3E Documents Index | Generated content-oriented index for docs/. |
| [log.md](<./log.md>) | Markdown | M3E Documents Log | このファイルは `docs/` の LLM Wiki 型運用ログである。ingest / organize / lint / query を時系列で追記する。 |
| [README.md](<./README.md>) | Markdown | M3E Software Docs | このディレクトリは、M3E の思想・戦略・仕様・アーキテクチャ・運用・判断記録を置く場所である。 |
| [無題のファイル.base](<./無題のファイル.base>) | Obsidian Bases | 無題のファイル | Obsidian Bases |
| [無題のファイル.canvas](<./無題のファイル.canvas>) | Obsidian Canvas | 無題のファイル | Obsidian Canvas |

### dev-docs

| File | Type | Title | Summary |
|---|---:|---|---|
| [dev-docs/README.md](<./dev-docs/README.md>) | Markdown | Development Notes | 開発中の横断的な技術メモを置く。製品仕様は `docs/03_Spec/`、運用規則は `docs/06_Operations/`、agent protocol は `docs/protocols/` を正本とする。 |

### operations

| File | Type | Title | Summary |
|---|---:|---|---|
| [operations/README.md](<./operations/README.md>) | Markdown | Operations Workspace | Obsidian TaskNotes など、docs vault 上で使う操作面の設定を置く。 |
| [operations/TaskNotes/Views/agenda-default.base](<./operations/TaskNotes/Views/agenda-default.base>) | Obsidian Bases | agenda default | Obsidian Bases |
| [operations/TaskNotes/Views/calendar-default.base](<./operations/TaskNotes/Views/calendar-default.base>) | Obsidian Bases | calendar default | Obsidian Bases |
| [operations/TaskNotes/Views/kanban-default.base](<./operations/TaskNotes/Views/kanban-default.base>) | Obsidian Bases | kanban default | Obsidian Bases |
| [operations/TaskNotes/Views/mini-calendar-default.base](<./operations/TaskNotes/Views/mini-calendar-default.base>) | Obsidian Bases | mini calendar default | Obsidian Bases |
| [operations/TaskNotes/Views/pomodoro-stats.base](<./operations/TaskNotes/Views/pomodoro-stats.base>) | Obsidian Bases | pomodoro stats | Obsidian Bases |
| [operations/TaskNotes/Views/relationships.base](<./operations/TaskNotes/Views/relationships.base>) | Obsidian Bases | relationships | Obsidian Bases |
| [operations/TaskNotes/Views/tasks-default.base](<./operations/TaskNotes/Views/tasks-default.base>) | Obsidian Bases | tasks default | Obsidian Bases |

### protocols

| File | Type | Title | Summary |
|---|---:|---|---|
| [protocols/AGENTS.md](<./protocols/AGENTS.md>) | Markdown | Protocols Agent Guide | `docs/protocols/` contains AI operating contracts. Treat these files as canonical for agent behavior. |
| [protocols/codex-claude-sync.md](<./protocols/codex-claude-sync.md>) | Markdown | Codex / Claude Instruction Sync Protocol | Codex and Claude must see compatible M3E rules while preserving their different roles: |
| [protocols/contracts/map_manager_contract.yaml](<./protocols/contracts/map_manager_contract.yaml>) | File | map manager contract | File |
| [protocols/contracts/persistent_rule_change_contract.yaml](<./protocols/contracts/persistent_rule_change_contract.yaml>) | File | persistent rule change contract | File |
| [protocols/contracts/scope_contract.yaml](<./protocols/contracts/scope_contract.yaml>) | File | scope contract | File |
| [protocols/contracts/write_contract.yaml](<./protocols/contracts/write_contract.yaml>) | File | write contract | File |
| [protocols/handoff-packet-protocol.md](<./protocols/handoff-packet-protocol.md>) | Markdown | Handoff Packet Protocol | A handoff packet gives Codex enough context to execute a scoped task without re-reading the entire history. |
| [protocols/layouting-protocol.md](<./protocols/layouting-protocol.md>) | Markdown | Layouting Protocol | See `docs/03_Spec/map_layout_modes.md` for layout modes. |
| [protocols/map-manager.md](<./protocols/map-manager.md>) | Markdown | Map Manager Protocol | This file is a compatibility entry point. |
| [protocols/map-manager/gates.md](<./protocols/map-manager/gates.md>) | Markdown | Map Manager Gates | These gates apply before mutation, projection, or worker delegation. |
| [protocols/map-manager/projection-rule.md](<./protocols/map-manager/projection-rule.md>) | Markdown | Projection Rule | M3E storage is not MF, WMF, Mermaid, Markdown, or any other exchange syntax. |
| [protocols/map-manager/README.md](<./protocols/map-manager/README.md>) | Markdown | Map Manager Protocol Package | Map Manager prevents repeated AI confusion when reading, writing, laying out, |
| [protocols/map-write-protocol.md](<./protocols/map-write-protocol.md>) | Markdown | Map Write Protocol | Define how AI writes M3E maps without corrupting structure or confusing semantic structure with display decisions. |
| [protocols/persistent-rule-change-protocol.md](<./protocols/persistent-rule-change-protocol.md>) | Markdown | Persistent Rule Change Protocol | This protocol governs agent behavior when a user asks for broad recurrence prevention or uses `!!!` / `！！！`. |
| [protocols/README.md](<./protocols/README.md>) | Markdown | Protocols | This directory is the canonical home for AI operating protocols in M3E / Akaghef-System. |
| [protocols/repository-canon-values.md](<./protocols/repository-canon-values.md>) | Markdown | Repository Canon Values | This protocol is the canonical statement of repository-level values for M3E agents. |
| [protocols/scope-operation-protocol.md](<./protocols/scope-operation-protocol.md>) | Markdown | Scope Operation Protocol | See `docs/03_Spec/Scope_and_Alias.md` for product meaning. |
| [protocols/worker-minimal-instruction.md](<./protocols/worker-minimal-instruction.md>) | Markdown | Worker Minimal Instruction | You are Codex running as a scoped worker. Do only the assigned task inside the assigned path/scope. |

### semantic

| File | Type | Title | Summary |
|---|---:|---|---|
| [semantic/m3e-design.source.json](<./semantic/m3e-design.source.json>) | JSON | m3e design.source | JSON |
| [semantic/README.md](<./semantic/README.md>) | Markdown | M3E Design Semantic Source | この directory は、M3E repository の設計 corpus を Phase 1 の `specimen-v1` |
