# Agent Orrery 用語（binding steering）

> agent / runtime observation に触る spec・実装は本書を **honor 必須**。
> 2026-08-26〜27 の discovery で、`role` `team` `agent` `session` `state` `projection` が
> **複数システムの同名異義**として混線した（akaghef 指摘: 「用語がブレてしまってる」）。
> 本書は M3E での唯一の意味を固定し、混同源を明示する。
> **定義の正本は ADR_011 と `docs/00_Home/Glossary.md`。本書は束ねと拘束規則。**

## Canonical 正本（参照先）

- **決定**: `docs/09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md`（DC1〜DC17）、`ADR_009` §2/§3。
- **既存用語**: `docs/00_Home/Glossary.md` — `scope` / `alias` / `edge` / `GraphLink` / `射影` / `facet` / `provenance` はここが正本。**再定義しない。**
- **Surface View / port**: `.kiro/steering/ui_view_taxonomy_and_ports.md`。
- **思想の出典**: `docs/ideas/260808_agent_mapping_plugin_boundary.md`（会話ログであって決定ではない）。

## 同名異義の分離表

各語について、**M3E での意味は左列ひとつだけ**。右列は混同源であり、M3E の語として使ってはならない。

| 語 | M3E での意味（唯一） | 混同源（M3E の語として使うな） |
|---|---|---|
| **Role** | 責任・目的・契約を表す永続 entity。`callable-ref` binding を持ち、runtime 実装を知らない。実体は **role 定義 scope 内の node** 1つ（DC17） | agmsg の `agent` 名（宛先）。prototype `AgentNode.role` フィールド。人間の職掌 |
| **Actor Instance** | 稼働中の実行主体。session / mailbox state / trace を抱える runtime 単位。寿命は短い（DC3） | Role。session そのもの。prototype の一体型 `AgentNode` |
| **session** | provider runtime の1会話単位（Claude/Codex/Hermes の JSONL・DB record）。**観測の証拠であって表示単位ではない** | Actor Instance。JSONL ファイル。agmsg の `role-session`（`(team, agent) → latest` の advisory record にすぎない） |
| **agent** | **`AI agent` ∪ `human`**（global rule）。両者を含む上位集合 | 「AI だけ」の意。`agent` の1語で**層**（Role / Actor Instance / agmsg destination）を指す用法 |
| **AI agent** | LLM 実行主体（Claude / Codex / Hermes / Fable 等）。`agent` の部分集合 | `agent`（上位集合なので human を含む） |
| **human** | 人間の参加者（Akaghef 等）。`agent` の部分集合 | user。owner。observer |
| **agmsg agent** | `(realm, team, agent)` の transport destination。identity 兼宛先であり、責任・目的・契約を表さない（DC16-1） | Role。`agent`（上位集合の方） |
| **team** | **M3E の語彙ではない。** agmsg の roster / storage / transport 境界を指すときのみ、`agmsg team` と修飾して使う（DC16-2） | project。組織。scope。facet |
| **project** | M3E map 上の意味的な帰属先 node | agmsg の project registration（endpoint 解決用 metadata）。cwd。repo。worktree |
| **lifecycle state** | agent の稼働状態。M3E 側で一本化した語彙のみ（DC11） | agmsg の delivery state（`queued/delivered/read/handled/failed`）。provider の raw state。prototype UI の10種 |
| **delivery state** | agmsg の message 配送状態。**transport namespace に隔離する**（DC16-3） | lifecycle state |
| **attention** | 人間の判断・入力・選択を要求する**未解決 request**。lifecycle state とは別軸で、最上位の射影軸（DC13） | agmsg の `unread` / inbox block（delivery control）。`awaiting-user` state 単独。`blocked` |
| **Telemetry** | 時系列の観測値（latency / token 等）。**ephemeral。正本 map に混ぜない**（DC3） | lifecycle state。node 属性 |
| **provenance** | 「誰がこの node を生やしたか」。`origin` / `source` / `sourceId` / `observedAt` を持つ（DC8） | 著者の個人識別。絶対パス。生の source locator |
| **plugin** | projection を materialize・供給する **out-of-process プロセス**（DC1、ADR_009 §3） | viewer 内の capability。`renderNode` 等の in-process 拡張点 |
| **connector** | **backend で session データと M3E データをつなぐスクリプト**（akaghef 命名 2026-08-29）。out-of-process。観測・dedup・M3E への書き込みを担う | plugin（より広い概念）。adapter（provider 個別の読み取り部は connector の内部）。agent。observer（曖昧語。使わない） |
| **Orrery** | agent 観測が載る **map のデータ**。Surface View ではない（DC2） | 新しい view mode。別アプリ。別 DB |

## 拘束規則

1. **`agent` は `AI agent` ∪ `human` の上位集合として使う（global rule）。** AI に限定するなら `AI agent`、人間に限定するなら `human` と明示する。禁じるのは、`agent` の1語で**層**を指すこと — 層を指すときは `Role` / `Actor Instance` / `agmsg agent` を書く。この2軸は直交する: **kind 軸**（AI agent / human）と **layer 軸**（Role / Actor Instance / Telemetry）は別物であり、1語で両方を担わせない。

2. **無修飾の `projection` / `射影` を使わない。** Glossary は無修飾の「射影」を **Deep → Rapid** に予約している。agent 文脈では必ず修飾する: `runtime projection` / `observation projection` / `edge-type projection`。storage・index 側の derived read model は Glossary どおり `materialization` と呼ぶ。

3. **`edge` の三義を分離する。** 親子構造は tree `edge`、非木の typed relation は `GraphLink`（`relationType` を持つ）、agmsg の message は **transport evidence** であって M3E の edge ではない。message から `GraphLink` を作るのは、evidence が endpoint を確定できる場合に限る（DC14 / DC16）。

4. **state を混ぜない。** lifecycle / delivery / raw の3系統は別 namespace に置く。provider の raw state は M3E lifecycle state へ写像するのみで、**第二の lifecycle 語彙を作らない**。観測できない state を語彙に入れない（実装が生成しない語は ADR_010 の「実装のない予約席」に当たる）。

5. **attention を state に畳まない。** attention は「未解決の human request」であり、`unread` / `read_at` の不在 / 経過時間 / generic `blocked` から立ててはならない。解除も、既読・handled・delivered では起きない。

6. **Role の参照は alias で行う（DC17）。** Role 実体は role 定義 scope に1つ。agent node からは alias node が Role を指し、通常は collapse されて見える。Glossary の `alias→alias は禁止` を守る — alias は Role **実体**を指すこと。同一 Role を複数 Actor が担う場合も実体は増えず alias が増える。この構造は既存 `facet` の規則（実体は1箇所、他からは alias 参照）と同型である。

7. **agmsg が既に持つ概念を再実装しない（DC16-6）。** destination identity / roster / membership / inbox・history / read cursor / delivery state / watcher・actas lock / spawn・despawn は agmsg から取得する。二重化は正本を2つにする。

8. **read-only 観測では agmsg の配送 API を呼ばない（DC16-5）。** `inbox` / `watch` / `check-inbox` は read cursor と `read_at` を変更する。SQLite を read-only で読む経路に限定する。

9. **色は `.kiro/steering/color_semantics.md` に従う。** 状態を色で示すとき、7色（青 / 黄 / オレンジ / 緑 / 赤 / 灰 / 白）以外を使わない。色数を増やす代わりに文字・形・線種で区別する。

10. **session 本文の扱いは「akaghef 自身の PC 上の集約」を前提にする（DC18）。** `Title` / `msg` の生テキストは M3E map に出してよい。A-sys の `data-classes.md` の fail-closed 分類は、A-sys が個人のメール・ノートを抱える文脈のものであり、自分の agent の session を自分で観測する文脈にそのまま適用しない。**ただし map を M3E の外へ配布・公開する経路を作るときは、その時点で改めて判断する。**

## 既知ギャップ（reconcile 対象）

- `docs/00_Home/Glossary.md` に `Role` / `Actor Instance` / `Telemetry` / `attention` / `lifecycle state` の項が無い。本書で暫定固定しているが、**Glossary へ昇格させるのが正しい**。
- prototype（`playground/agent-orrery`）は backend 9種 / UI 10種の二重 state 体系を持ち、規則4に違反している。参照実装であり正本ではない。移植しない（DC12）。
- ADR_011 本文および `.kiro/specs/agent-orrery-map/requirements.md` に無修飾 `projection` が残る。規則2に沿って修飾語を補う reconcile が要る。
- `agent` を無修飾で使っている既存 handoff / spec が残存する可能性がある。新規作成分から規則1を適用する。
- **kind 軸（`AI agent` / `human`）が仕様に反映されていない。** global rule により map には human agent も載るが、human は provider runtime session を持たないため、`Actor Instance` 層と lifecycle state（`thinking` / `tool-running` 等）の適用が AI agent と異なる。ADR_011 IS15 で扱う。

## 適用

- agent / runtime observation に触る spec・lab・実装・Codex handoff は本書の規則1〜8を満たすこと。
- 新しい語を足すときは、まず本書の分離表に「M3E での意味」と「混同源」の2列で追加できるか確かめる。混同源が書けない語は、まだ定義が足りていない。
- 本書と ADR_011 が食い違った場合は **ADR_011 が正**。本書を直す。
