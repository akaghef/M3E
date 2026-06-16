---
pj_id: PJ04
project: MermaidSystemLangGraph
title: PJ04 Parent Plan
status: canonical (parent-plan)
date: 2026-04-22
role: "PJ04 全体の母体計画。目的、境界、成功条件、文書階層、トラック構成を定義し、派生設計 doc の親になる。"
references:
  - docs/system_design.md
  - docs/global_strategy.md
  - tasks.yaml
  - resume-cheatsheet.md
---

# PJ04 — Parent Plan

> **一文要約**: PJ04 は、**M3E を LangGraph 系システムの協働 authoring 環境にする**ための sandbox であり、VSCode 拡張 (M3E) 内で **authoring → compile → run → inspect** を閉じるための母体計画である。

## 0. この文書の役割

この `plan.md` は、PJ04 における **最上位の親計画**である。

本書が決めるもの:

- PJ04 の目的
- スコープ境界
- 成功条件
- 文書階層
- 進行の大枠
- 派生 doc が従うべき固定ルール

本書が直接は持たないもの:

- 技術詳細の正本
- 実装タスクの細部
- 日々の進捗ログ
- 個別論点の長文議論

したがって、**詳細設計は派生 doc に委譲するが、派生 doc は本書の目的・境界・不変式を破ってはならない**。

---

## 1. PJ04 の目的

### 1.1 North Star

PJ04 の北極星は次である。

**M3E を、LangGraph 系システムの協働 authoring 環境にする。**

具体的には、

1. 人間が M3E 上で system の骨格を描く
2. AI が詳細を埋める
3. Claude supervisor が workflow に沿って subagent を回せる contract を持つ
4. map から compile する
5. 実行状態を M3E に inspect として戻す
6. Python LangGraph を subprocess で実行する
7. 同じ map 上で tune して次の run に繋ぐ

この 1 周を、**VSCode 拡張 (M3E) 内で閉じる**ことを目標とする。

### 1.2 Delivery

最終 delivery は次の状態である。

- `map` が authoring 正本である
- authoring は `Outer` と `Inner` に分かれる
- compile 先は LangGraph である
- runtime は独自実装せず、Python LangGraph を embed する
- trace / checkpoint は map を汚さず append-only で管理する
- Collaboration Stance
  `Sketch → Fill → Review → Tune → Run → Iterate`
  が 1 周回る

### 1.3 本体 repo との関係

PJ04 は beta 本体の主戦場 (`S2`, `S3`) を置き換えるものではない。
PJ04 は **sandbox として graph-first authoring / execution / inspection の成立条件を詰める探索 PJ** である。

---

## 2. 固定スコープ

### 2.1 何を作るか

PJ04 で作るのは次である。

- M3E 上の graph-first authoring 方式
- LangGraph 系 system diagram の表現
- map → GraphSpec → Bridge → LangGraph の接続
- 実行結果の inspection 導線
- それを支える最小限の viewer / contract / tooling

### 2.2 何を作らないか

PJ04 では次をやらない。

1. 独自 runtime を作る
2. Pregel を自前実装する
3. checkpoint fork を自前で丸ごと再実装する
4. LangGraph 全機能を TypeScript で再実装する
5. OpenAI / Gemini まで含む広い provider 一般化を最初からやる
6. 複数 map 対応や multi-root 一般化を先にやる
7. 完成 IDE を目指す

この非目標は、[docs/langgraph_feasibility.md](docs/langgraph_feasibility.md) と [docs/global_strategy.md](docs/global_strategy.md) によって裏づけられる。

### 2.3 借りるもの

PJ04 は次を **借りる**。

- LangGraph `1.1.8`
- Python subprocess
- npm / pip の標準取得経路
- 必要なら `elkjs` のような標準 layout engine

PJ04 は「借りるもの」と「自分で決めるもの」を混ぜない。

- **借りる**: runtime semantics, checkpoint machinery, Send/super-step, ToolNode
- **自分で決める**: authoring model, map contract, view model, bridge boundary, inspection UX

---

## 3. 母体となる固定原則

以下は派生 doc が共通で従うべき親ルールである。

### 3.1 正本

- `map` は authoring 正本
- `GraphSpec` は derived
- runtime state / trace / checkpoint は derived
- derived は map に書き戻さない

### 3.2 authoring depth

- `Outer` = 人間が扱う骨格
- `Inner` = AI が埋める詳細
- AI-fill は `Inner` 限定
- `Outer` を AI が勝手に確定しない

### 3.3 stack

技術 stack は **MLG stack (M3E-LangGraph)**。T1-T7 の正本は [docs/system_design.md §2](docs/system_design.md)。旧呼称との対応は下記。

1. `T1 Surface render` (旧 L1)
2. `T2 Map API + persistence` (旧 L2)
3. `T3 Compile` / `T4 Emit` (旧 L3)
4. `T5 Bridge IPC` (旧 L4)
5. `T6 Runtime (LangGraph)` / `T7 Checkpoint store` (旧 L5)

authoring 側は **A1 Diagram / A2 Contract** のみが編集対象。A3 Executable preview と A4 Runtime inspect は read-only (I27)。

### 3.4 abstract → concrete

`abstract → concrete` は VIEW 専用の軸ではなく、workflow 全体を貫く組織原理として扱う。

- Sketch は抽象寄り
- Fill / Protocol は中間
- Python / Run / Inspect は具象寄り

ただし、`abstract → concrete` と `Outer/Inner` と `L1-L5` は同一軸ではない。
派生 doc は軸を混同してはならない。

### 3.5 Hard Rule

- main lane は 1 本
- 座標正本を `x/y` に置かない
- auto layout は lane 内に閉じる
- `AppState.rootId` は単数固定

---

## 4. 成功条件

PJ04 の成功条件は 3 段で考える。

### 4.1 最小成功

- canonical system diagram を fixed map 上で graph-first に描ける
- notes と scope 構造が分離される
- M3E 上で system diagram を tree-first 誤読なしに扱える

### 4.2 中間成功

- map から GraphSpec を決定的に compile できる
- Python LangGraph subprocess を呼び出せる
- inspect 情報を map を汚さずに viewer に戻せる

### 4.3 最終成功

以下すべてを満たす。

1. Collaboration Stance が 1 周回る
2. G2 (Bridge MVP) を通過する
3. `LAY-1..4` が完了する
4. `T-E-1` が end-to-end で走る
5. `T-F-1` により最小 observability が成立する

詳細な exit gate は [docs/global_strategy.md](docs/global_strategy.md) を正本とする。

---

## 5. 文書階層

PJ04 の文書階層は次で固定する。

### 5.1 親

- `plan.md`
  PJ04 の母体計画。目的、境界、成功条件、文書階層、進行原則を定める

### 5.2 正本

- [docs/system_design.md](docs/system_design.md)
  技術構造と不変式の正本
- [docs/global_strategy.md](docs/global_strategy.md)
  トラック、ゲート、週次順序、終了条件の正本
- [tasks.yaml](tasks.yaml)
  実作業単位の正本

### 5.3 派生 deep-dive

- `docs/layout_strategy.md`
- `docs/langgraph_integration_plan.md`
- `docs/state_and_channels.md`
- `docs/concreteness_axis.md`
- `docs/multi_root_scope_investigation.md`
- `docs/map_attribute_spec.md`
- その他個別論点 doc

### 5.4 補助

- `resume-cheatsheet.md`
  次セッション再開用
- `README.md`
  PJ04 の入口案内
- `idea/`
  保留案・棄却候補の隔離場所

### 5.5 権限の分担

文書ごとの責務を混ぜない。

- `plan.md`
  何をやる PJ かを定義する
- `system_design.md`
  どういう構造にするかを定義する
- `global_strategy.md`
  どの順番で攻めるかを定義する
- `tasks.yaml`
  次に何をやるかを定義する
- deep-dive doc
  特定軸の詳細を定義する

派生 doc が親文書を書き換えるのではなく、**親文書の下で局所問題を解く**のが原則である。

---

## 6. 進行の大枠

PJ04 は **4 トラック並走 + 2 ゲート直列**で進める。

### 6.1 トラック

1. `EXEC`
   compile / bridge / runtime / observability
2. `VIEW`
   concreteness, source, signature, live overlay
3. `LAY`
   lane-role, snapshot gate, multi-lane, engine 判定
4. `DATA`
   channels, reducers, validation, timeline
5. `TPL`
   System Block Template, template insert, PJv34 rebuild acceptance

### 6.2 ゲート

- `G1: Contract Freeze`
  compile contract が凍結し、決定性が示される
- `G2: Bridge MVP`
  Python bridge が round-trip で動く

### 6.3 進行原則

- `LAY` は先行できる
- `VIEW` の L2 は bridge なしで先行できる
- `DATA` の panel / validation の一部は bridge なしで先行できる
- `TPL` は G1 の前に catalog を作り、G1 で GraphSpec contract と接続し、G2 後に PJv34 rebuild Run の acceptance へ進む
- `EXEC` の本格化は G1 通過後
- `VIEW L3+` と `DATA` の runtime 側は G2 通過後

この順序の正本は [docs/global_strategy.md](docs/global_strategy.md) である。

---

## 7. 現在の優先順位

現在の優先は **Phase 2 LAY** である。

初期 queue は次で固定する。

1. `T-LAY-1`
   制約語彙 (`lane-role`, `anchor`, `edge-kind`) を定義
2. `T-LAY-3`
   canonical snapshot gate を作る
3. `T-LAY-2`
   breadth lane band を viewer に描く
4. `T-LAY-4`
   canonical map を multi-lane に開放する

その後に G1 (`T-A-1`) へ進む。

並行して `TPL-0` を開始する。
PJ04 の実用検証は **Template-first PJv34 Rebuild** とし、System Block Template 実装後に AI が template から PJv34 Weekly Review system を再構築して Run することを acceptance とする。

重要なのは、**layout が落ち着く前に execution 契約を凍結しすぎない**ことである。
逆に、**G1 を通す段階になったら runtime 論点を持ち込まず contract に集中する**こと。

---

## 8. 仕様段階で詰めるべき問い

派生 doc は次の問いを順に潰すこと。

### 8.1 軸の整理

- `abstract → concrete`
- `Outer / Inner`
- `L1-L5`
- `L0-L5`

この 4 つの関係を明示し、混線させないこと。

### 8.2 authoring 権限

- AI がどこまで書いてよいか
- 人間修正をどう保護するか
- provenance をどう持つか

### 8.3 compile 契約

- entry semantics
- conditional default
- subgraph channel inheritance
- warning / error taxonomy

### 8.4 runtime 境界

- callable-ref の安全境界
- registry / venv 配置
- map snapshot と thread の関係
- resume / interrupt / time travel の意味

### 8.5 data UX

- channels-def の構造
- reducer 語彙
- validation の surface/panel 分担
- timeline bar と live overlay の切り分け

### 8.6 layout 境界

- lane-role の hard/soft rule
- multi-entry と multi-lane の分離
- manual position と auto layout の関係

---

## 9. 派生 doc の書き方

今後 PJ04 の設計 doc を増やすときは、次のフォーマットに従う。

### 9.1 必須項目

各 doc は最低限次を持つ。

1. この doc が扱う問い
2. 親文書との関係
3. 非目標
4. 不変式との接続
5. 未決論点
6. 入口条件
7. 出口条件

### 9.2 書いてよいこと / いけないこと

書いてよいこと:

- 局所戦略
- 局所 contract
- 局所 OQ
- 局所 task の依存

書いてはいけないこと:

- PJ04 全体目標の再定義
- `map` 正本原則の否定
- 「やはり TS 再実装する」のような上位方針の反転
- 親文書の前提を黙って変更すること

### 9.3 参照の向き

派生 doc は、必要に応じて次を明示する。

- この doc が依拠する親文書
- この doc が影響を与える sibling doc
- この doc の決定を `tasks.yaml` のどの task に反映するか

---

## 10. セッション運用

各セッションでは次の順で参照する。

1. `plan.md`
   PJ04 全体の目的と今の優先を確認
2. `docs/system_design.md`
   構造・不変式を確認
3. `docs/global_strategy.md`
   現在のトラックとゲート位置を確認
4. `tasks.yaml`
   次の 1 本を取る
5. 対応する deep-dive doc
   局所判断を詰める

`resume-cheatsheet.md` は再開補助だが、親文書の代わりにはしない。

---

## 11. 終了条件

PJ04 は、単に code が増えたら終わりではない。
次を満たしてはじめて終了とみなす。

1. authoring の正本が map に固定されている
2. compile 先が LangGraph に繋がっている
3. inspect が map 非破壊で戻る
4. Outer / Inner の役割分担が崩れていない
5. Collaboration Stance が 1 周回る
6. merge 可能な粒度で docs / model / viewer に分解できる

merge 順序は **docs first → model second → viewer third** とする。

---

## 12. 現時点の 1 文まとめ

> PJ04 は、`map` を authoring 正本にしたまま、M3E 内で LangGraph 系 system を **描き、詳細化し、compile し、実行し、inspect する**ための母体計画であり、詳細設計はすべてこの plan の下で枝分かれする。
