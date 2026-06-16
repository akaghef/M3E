---
title: "M3E Obsidianファイル構造"
created: 2026-03-13 20:49:19
updated: 2026-03-13 21:04:24
tags:
  - chatgpt
  - conversation
---
# M3E Obsidianファイル構造

<sub>2026-03-13</sub>

---

**User**: <sub>2026-03-13 20:49</sub>

M3E開発PJのobsidianのmdファイル構造を考えて

> [!info] Reasoning Summary
> <sub>2026-03-13 20:49</sub>
> 
> 思考時間: 7s

**ChatGPT**: <sub>2026-03-13 20:49</sub>

こう置くのがよいです。  
理由は、今のM3Eには

- 元の中核仕様（帯域、スコープ、alias、オフライン前提）があること fileciteturn0file2
- 一方で当面は Freeplane を土台にした外側の思考支援層へ方針転換していること fileciteturn0file4
- 実装面では MVC + Command + Model中心という技術前提があること fileciteturn0file3turn0file0

の3層が混在しているからです。  
したがって、Obsidianでも「理念」「現行方針」「実装」を分離した構造にするのがよいです。

まずはこうです。

```text
M3E/
├── 00_Home/
│   ├── Home.md
│   ├── Current_Status.md
│   ├── Roadmap.md
│   └── Glossary.md
│
├── 01_Vision/
│   ├── Why_M3E.md
│   ├── Core_Principles.md
│   ├── Differentiation_vs_Miro_Obsidian_Freeplane.md
│   └── Band_Model_Flash_Rapid_Deep.md
│
├── 02_Strategy/
│   ├── Product_Strategy.md
│   ├── Current_Pivot_Freeplane_First.md
│   ├── MVP_Definition.md
│   ├── Validation_Criteria.md
│   └── Risks_and_NonGoals.md
│
├── 03_Spec/
│   ├── Overview.md
│   ├── Data_Model.md
│   ├── Scope_and_Alias.md
│   ├── Band_Spec.md
│   ├── UI_UX.md
│   ├── Persistence.md
│   ├── Undo_Redo.md
│   ├── AI_Integration.md
│   ├── Export_and_Interop.md
│   └── Nonfunctional_Requirements.md
│
├── 04_Architecture/
│   ├── Architecture_Overview.md
│   ├── MVC_and_Command.md
│   ├── Model_Design.md
│   ├── Controller_Design.md
│   ├── View_and_ViewState.md
│   ├── HitTest_and_InputFlow.md
│   ├── Drag_and_Reparent.md
│   └── Schema_and_Migration.md
│
├── 05_Freeplane_Integration/
│   ├── Freeplane_Positioning.md
│   ├── Freeplane_Data_Model_Mapping.md
│   ├── Import_Export_Policy.md
│   ├── External_Agent_Workflow.md
│   ├── Proposal_and_Approval_Flow.md
│   └── Limits_and_Future_Replacement.md
│
├── 06_AI/
│   ├── AI_Usecases.md
│   ├── Context_Packaging.md
│   ├── Structure_to_Text.md
│   ├── Text_to_Structure.md
│   ├── Suggestion_Patterns.md
│   └── Privacy_and_LocalFirst.md
│
├── 07_Implementation/
│   ├── Tech_Stack.md
│   ├── Storage_IndexedDB.md
│   ├── Canvas_Options.md
│   ├── Performance_Targets.md
│   ├── Testing_Strategy.md
│   └── Dev_Environment.md
│
├── 08_Research/
│   ├── Tool_Survey.md
│   ├── Obsidian_Study.md
│   ├── Freeplane_Study.md
│   ├── WiseMapping_Study.md
│   ├── EdrawMind_Study.md
│   └── License_and_Publication.md
│
├── 09_Decisions/
│   ├── ADR_000_Template.md
│   ├── ADR_001_Freeplane_First.md
│   ├── ADR_002_Model_Centric_MVC.md
│   ├── ADR_003_Scope_Boundary.md
│   └── ADR_004_Alias_Rule.md
│
├── 10_Backlog/
│   ├── Ideas.md
│   ├── Tasks.md
│   ├── Experiments.md
│   ├── Bugs.md
│   └── Deferred.md
│
├── 11_Meetings/
│   ├── Daily_Logs/
│   ├── Design_Reviews/
│   └── Retrospectives/
│
├── 12_Archive/
│   ├── Old_Specs/
│   ├── Deprecated_Strategies/
│   └── Historical_Notes/
│
└── Assets/
    ├── images/
    ├── diagrams/
    └── attachments/
```

運用上の要点は次です。

`00_Home` は入口です。  
`Home.md` に「今何が正なのか」を集約します。Obsidianは文書が増えると古い議論が残りやすいので、`Current_Status.md` を別で置いて、現時点の正式方針だけを書くのが重要です。

`01_Vision` と `02_Strategy` は分けます。  
理念と現行戦略は別物です。  
たとえば、Flash/Rapid/Deep、スコープ境界、alias、オフライン前提は理念・仕様側です fileciteturn0file2。  
一方、当面は独自エディタを主目的にせず、Freeplane を土台にする、というのは戦略側です fileciteturn0file4。  
ここを混ぜると後で破綻します。

`03_Spec` は「将来も残る仕様」だけに絞ります。  
実装都合や暫定判断を書きすぎない方がよいです。  
M3E仕様設計書の章立てをほぼそのまま分解すればよいです。特に Data Model, Scope/Alias, Band, Persistence, Undo/Redo は核です fileciteturn0file2。

`04_Architecture` は技術設計専用です。  
MVC、Command、Model中心、ViewState分離、drag中はModelを書き換えない、drop確定時だけCommand発行、などの実装原則をここに集めます fileciteturn0file3turn0file0。  
仕様書に混ぜず、設計として隔離した方が見通しがよいです。

`05_Freeplane_Integration` は今のPJでかなり重要です。  
今のM3Eは「Freeplaneを置き換える製品」ではなく「外側で働く思考支援層」として再定義されています fileciteturn0file4。  
だからこのディレクトリを独立させ、  
Freeplaneの何を正本にするか、どこまで読み書きするか、提案と確定の境界をどうするか、を明文化した方がよいです。

`08_Research` は調査メモ置き場です。  
Freeplane、Wisemapping、EdrawMind、Obsidian などの比較や、ラップ可能性、ライセンス論点はここに置きます。  
ここは「決定」ではなく「材料」です。  
たとえば追加ツール調査のような内容はここに置くのが自然です fileciteturn0file1。

`09_Decisions` は必須です。  
M3Eは方針転換が多いので、決定ログがないと後で何が現行なのか分からなくなります。  
1件1ファイルで、以下だけ書けば十分です。

- 決定内容
- 理由
- 捨てた案
- 影響範囲
- 見直し条件

ファイル粒度も決めた方がよいです。  
おすすめは次です。

- 1テーマ1ファイル
- 1ファイルは原則 300〜1200字
- 重い総合文書は `Overview.md` にして、各論へリンク
- 調査メモは荒くてよい
- 正式仕様は結論先頭

Obsidianらしいリンク設計も決めておくとよいです。  
最低限これです。

- すべての正式文書に `Status: Draft / Active / Deprecated`
- すべての正式文書に `Related:` セクション
- `Home.md` から全正式文書へリンク
- 廃止文書は削除せず `12_Archive` に移す

最初に作るべき最低限の12ファイルだけ挙げると、これです。

```text
00_Home/Home.md
00_Home/Current_Status.md
01_Vision/Core_Principles.md
02_Strategy/Current_Pivot_Freeplane_First.md
02_Strategy/MVP_Definition.md
03_Spec/Data_Model.md
03_Spec/Scope_and_Alias.md
03_Spec/Band_Spec.md
04_Architecture/MVC_and_Command.md
04_Architecture/Drag_and_Reparent.md
05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md
09_Decisions/ADR_001_Freeplane_First.md
```

必要なら次に、これをそのまま Obsidian 用の実ファイル雛形として md本文まで書きます。

**User**: <sub>2026-03-13 20:51</sub>

そもそもmdって小分けにしたほうがよいの？

**ChatGPT**: <sub>2026-03-13 20:51</sub>

結論は次です。  
**小分けにした方がよい。ただし細かすぎる分割は避ける。**

理由は3つあります。

**1. Obsidianはリンク前提の設計**  
Obsidianはファイル単位でリンクする構造である。  
そのため

- 1ファイル = 1トピック  

にすると、リンク・バックリンク・Graph View が機能する。  
長い1ファイルにすると、内部リンクが使えず構造が見えなくなる。

**2. AI・検索との相性**  
LLMや全文検索は「短い文書の集合」の方が扱いやすい。  
1つの巨大仕様書だと

- コンテキストが膨れる
- 更新差分が追いにくい
- 要約や抽出が難しい

小さい文書の集合だと

- 必要部分だけ読み込める
- 差分管理が容易
- 再利用できる

**3. 設計変更に強い**  
開発中は構造が頻繁に変わる。  

巨大ファイルだと

- 章構造の変更
- セクション移動

が発生する。

小ファイルだと

- ファイル移動
- リンク変更

だけで済む。

---

ただし、**細かすぎる分割は逆効果**になる。

悪い例

```
Data_Model.md
Node.md
Edge.md
Node_ID.md
Node_Color.md
Node_Metadata.md
```

これは分散しすぎで読む側が崩壊する。

---

実務で安定する粒度はこれです。

**1ファイル = 1概念 / 1設計テーマ**

例

```
Data_Model.md
Scope_and_Alias.md
Band_Model.md
Undo_Redo.md
AI_Integration.md
Freeplane_Interop.md
```

このくらいが最も扱いやすい。

---

目安のサイズは次。

- 300〜1200字  
- 長くても2000字程度

それ以上なら分割する。

---

さらに実用的なルールが1つあります。

**結論 → 詳細**

```
Overview.md
  ├ Data_Model.md
  ├ Scope.md
  └ Persistence.md
```

Overviewは短くする。

```
# Data Model

M3EはNode中心のグラフ構造を採用する。

詳細
→ [[Node Structure]]
→ [[Edge Structure]]
```

この形がObsidianでは最も読みやすい。

---

まとめ

mdは

- **巨大仕様書：悪い**
- **極小分割：悪い**
- **1概念1ファイル：最適**

である。

---

M3Eの場合は特に

- 思想
- 戦略
- 仕様
- 実装
- Freeplane連携

が混ざりやすいので、  
**「1設計テーマ1md」構造にしておくと破綻しない。**

**User**: <sub>2026-03-13 20:51</sub>

ドキュメントのルールってobsidianのどこで指定する？AI向けでもある

**ChatGPT**: <sub>2026-03-13 20:51</sub>

Obsidianには「ドキュメント規約を設定する専用機能」はない。  
そのため、**規約用の md をリポジトリの上位に置く方式**にする。

一般的に使われるのは次の3つである。

---

**1. `README.md`（入口）**

Vault のトップに置く。

役割

- プロジェクト概要
- ディレクトリ構造
- どの文書が正本か
- 規約へのリンク

例

```
M3E Vault

Start here:
- [[Home]]
- [[Current_Status]]

Rules:
- [[Doc_Writing_Rules]]
- [[Naming_Convention]]
- [[ADR_Process]]
```

人間向けの入口として機能する。

---

**2. `Doc_Writing_Rules.md`（執筆規約）**

AIにも読ませるファイル。

ここに書く内容

- mdの粒度
- ファイル命名
- 文書構造
- ステータス
- リンクルール

例

```
# Documentation Rules

1 file = 1 concept

Recommended length
300–1200 words

Every spec must include

Status: Draft / Active / Deprecated
Owner:
Last updated:

Structure

Conclusion
Design
Details
Related
```

AIに読ませるなら  
**機械的に守れるルールを書く。**

---

**3. `ADR/`（設計決定ログ）**

設計ルールはここに残す。

```
ADR/
ADR_001_Freeplane_First.md
ADR_002_Model_Centric.md
ADR_003_Command_Pattern.md
```

構造

```
Decision
Context
Alternatives
Consequences
```

---

実務的に一番よい構成はこれ。

```
M3E/

README.md

Docs/
Home.md
Current_Status.md

Rules/
Doc_Writing_Rules.md
Naming_Convention.md
ADR_Process.md

ADR/
ADR_001_*.md
ADR_002_*.md
```

---

**AI向けのポイント**

AIに守らせるなら

1. ルールは1ファイルに集約する  
2. 箇条書きで書く  
3. 例を書く  
4. 曖昧語を使わない  

例えば

```
Bad
長すぎる文書は避ける

Good
If a document exceeds 1500 words, split it.
```

---

もう一つ重要なのは、  
**AIが最初に読むファイルを決めること。**

おすすめ

```
00_AI_CONTEXT.md
```

ここに

- プロジェクト概要
- 文書ルール
- 用語

を書く。

AIにとっては  
**ここが system prompt になる。**

---

M3EのようなAI併用プロジェクトなら  
実際には次の4つを作ると安定する。

```
00_AI_CONTEXT.md
README.md
Rules/Doc_Writing_Rules.md
ADR/
```

これで

- 人間
- AI
- 将来の自分

すべてが迷わなくなる。

