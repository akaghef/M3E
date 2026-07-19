# M3E Documents Index

This file is the content-oriented index for `docs/`. It is generated from the current file tree and maintained as the navigation layer described in `06_Operations/LLM_Wiki_Schema.md`.

- Regenerate: `node scripts/ops/check-docs-index.mjs --write`
- Check: `node scripts/ops/check-docs-index.mjs --check`
- Coverage: all files under `docs/`, excluding `docs/.obsidian/` and `.DS_Store`
- Indexed files: 335

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
| [00_Home/Current_Status.md](<./00_Home/Current_Status.md>) | Markdown | Current Status | 最終更新: 2026-06-12 |
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
| [ideas/260718_llm_graph_protocol_directive_original.md](<./ideas/260718_llm_graph_protocol_directive_original.md>) | Markdown | LLM ↔ Property Graph Conversation Protocol | > **原文stow（2026-07-18、akaghef指針）。** PR #75 の [LLM_Graph_Conversation_Protocol.md](../04_Architecture/LLM_Graph_Conver... |
| [ideas/260719_math_ontology_graphdb_thesis.md](<./ideas/260719_math_ontology_graphdb_thesis.md>) | Markdown | 数学オントロジーが Neo4j 採用の真の駆動因である | 日付: 2026-07-19 |
| [ideas/ChatGPT-M3Eのコンテンツ販売.md](<./ideas/ChatGPT-M3Eのコンテンツ販売.md>) | Markdown | M3Eのコンテンツ販売 | **User:** Anonymous (kawami.s.aa@m.titech.ac.jp) |
| [ideas/ChatGPT-Map Logic Limitations.md](<./ideas/ChatGPT-Map Logic Limitations.md>) | Markdown | Map Logic Limitations | **User:** Anonymous (kawami.s.aa@m.titech.ac.jp) |
| [ideas/ChatGPT-ハードコピーとソフトコピー.md](<./ideas/ChatGPT-ハードコピーとソフトコピー.md>) | Markdown | ハードコピーとソフトコピー | **User:** Anonymous (kawami.s.aa@m.titech.ac.jp) |
| [ideas/ChatGPT-固定費と戦略.md](<./ideas/ChatGPT-固定費と戦略.md>) | Markdown | 固定費と戦略 | **User:** Anonymous (kawami.s.aa@m.titech.ac.jp) |
| [ideas/ChatGPT-温度とグラフ構造.md](<./ideas/ChatGPT-温度とグラフ構造.md>) | Markdown | 温度とグラフ構造 | **User:** Anonymous (kawami.s.aa@m.titech.ac.jp) |
| [ideas/description_example.md](<./ideas/description_example.md>) | Markdown | M3E 機能紹介 — 開発プロジェクト活用ガイド | M3E（Model, Map, Meaning Engine）は、科学研究者の構造的思考を支援するツールです。ツリー構造のデータモデルを中核に、論文分解・仮説比較・前提整理・設計判断といった知的作業を扱います。本ドキュメントでは、開発... |
| [ideas/Home_page.md](<./ideas/Home_page.md>) | Markdown | Home page | 回のセッションで実装した差分を自然言語でまとめます。 |
| [ideas/memo_ideas.md](<./ideas/memo_ideas.md>) | Markdown | M3EのAI協働に関する知見整理 | 会話の中で得られた知見を整理すると、M3Eは単なるマインドマップではなく、人間と複数のAIが同じ構造を共有しながら仕事を進めるための共同作業基盤として捉えるのが適切である。ユーザーは技術スタックそのものを把握する必要はなく、可視化され... |
| [ideas/README.md](<./ideas/README.md>) | Markdown | Ideas Folder | このフォルダは、実装前のアイデアを自由に追記するための場所です。 |
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
| [tasks/handoff_resource_design.md](<./tasks/handoff_resource_design.md>) | Markdown | Handoff: Resource 概念の設計 | M3E に「Resource」概念を導入する。 |
| [tasks/handoff_s16_neo4j_federation_define_260718.md](<./tasks/handoff_s16_neo4j_federation_define_260718.md>) | Markdown | Handoff: S16 連邦化 Strategy レビュー結論と Phase 0 define 指示 | Handoff: S16 連邦化 Strategy レビュー結論と Phase 0 define 指示 |
| [tasks/handoff_template.md](<./tasks/handoff_template.md>) | Markdown | Handoff: {TOPIC} | {タスクの説明。何を実装/修正/調査するか。} |
| [tasks/README.md](<./tasks/README.md>) | Markdown | tasks/ | **役割**: 具体 task と handoff の置き場。ロール間・セッション間の引き継ぎ場所。 |
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
