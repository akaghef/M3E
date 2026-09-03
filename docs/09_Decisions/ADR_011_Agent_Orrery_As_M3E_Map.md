# ADR_011: Agent Orrery を M3E の map として実装する

- Status: accepted
- Date: 2026-08-26
- Deciders: akaghef
- Related: [ADR_009](./ADR_009_Orchestration_Fusion_Into_M3E.md) / [ADR_010](./ADR_010_Radial_Surface_View_Removal.md) / [Decision_Pool 2026-08-26-001](../06_Operations/Decision_Pool.md) / [ui_view_taxonomy_and_ports](../../.kiro/steering/ui_view_taxonomy_and_ports.md)
- 思想の出典: [260808_agent_mapping_plugin_boundary.md](../ideas/260808_agent_mapping_plugin_boundary.md) / [260824_node_plugin_and_layout_contract.md](../ideas/260824_node_plugin_and_layout_contract.md)
- Supersedes (partial): ADR_009 §2 の Agent = Session 1:1 を **node 粒度については** 更新。ADR_009 §4 の「live 観測 runtime は別 lane」を **本 ADR のスコープ内へ移す**。

## Context

ADR_009 は凝集先（M3E）・Disperse 解釈・out-of-process plugin・projection を決めたが、
**plugin 契約・runtime 観測契約・map 登録手続きは未確定**のまま残っていた。
`docs/protocols/contracts/` に plugin 契約は存在しない。

その状態で3つの入力が揃った。**時系列に注意が要る。ADR_009 は最も古い。**

| 日付 | 出典 | plugin の立場 |
|---|---|---|
| 2026-07-19 | ADR_009 §3 | out-of-process。viewer 内拡張点なし。汎用 plugin API は実需 query 3件まで凍結 |
| 2026-08-08 | [260808_agent_mapping_plugin_boundary.md](../ideas/260808_agent_mapping_plugin_boundary.md) | M3E core に plugin kernel（AC1〜AC5）を作る。Agent Mapping はその最初の consumer |
| 2026-08-24 | [260824_node_plugin_and_layout_contract.md](../ideas/260824_node_plugin_and_layout_contract.md) | node capability + `renderNode` |

後続2本の設計会話はいずれも「M3E 側に受け口を作る」方向を向いており、
ADR_009 の凍結をそのまま最新の意思として扱うことはできない。DC1 はこの3者の調停である。

**0. 設計会話（2026-08-08）— plugin 境界と PJ semantic graph**
`scope owns binding, plugin owns realization`。Role / Contract は永続、Actor Instance は runtime、
Telemetry は ephemeral に3分割する（AP2）。`Role CRUD` と `Actor CRUD` は別操作（前者は組織再編、後者はプロセス終了）。
M3E core に必要になるのは Surface / Schema / Command / Event / Adapter の5つの registration（AC1〜AC5）。
UX の中心は agent 一覧ではなく **attention routing**（AG4）。
Why / What / Who / Now / With-what を typed edge で接続し、Surface 側で edge-type 射影する（GV4）。
「同じ map に置く ≠ 同じ hierarchy に押し込む」。完成形の主語は Agent ではなく PJ。

**1. 引き継いだ設計会話（2026-08-24）**
node core を最小に保ち capability を積む、layout への契約は box size のみ、
WebGL = 空間 / HTML = node UI、GraphLink は route solver で解いて freeze、という整理。
ただしこの会話は **viewer 内 capability plugin（`plugin.register({renderNode})`）を前提**にしており、
ADR_009 §3 の「viewer への in-process 拡張点は作らない」と正面から衝突していた。
`plugin` という語が二義になっていた。

**2. 稼働中の prototype（`playground/agent-orrery`）**
mock ではなく実データで動いている。実測値: AGENTS 88 / 89 nodes / 163 links / 72.0h window / total 5781。
DECK と NETWORK の2表示、LIVE モード、MAP TIME による replay スライダを持つ。
既知の不具合として **Claude セッションが過剰にカウントされる**（Codex / Hermes は正常）。

prototype の実装を read-only で精査した結果（2026-08-26）:

- **state は二重体系。** backend の raw state 9種と UI の10種が別物で、`projection.ts:20-38` が変換している。
  UI 側の `speaking` / `listening` / `negotiating` は**型と描画に存在するが、live projection が生成しない**。
  さらに `completed`（正常終了）と `idle` の時間経過が **どちらも `gone` に落ちる**。
  `disconnected` のみ `retired`。つまり「終了」と「観測不能」が既に同一バケットに潰れている。
- **描画要素の実体**: 名前 = `actorName` / 状態リング = raw state と経過時間から導出 /
  グラフ上のチップ = `sessionTitle` または `taskChip`（**`latestMessage` ではない**。直近発言は DetailCard のみ）/
  経過時間 = `lastActiveAt` との差 / avatar = `avatarIndex` から `public/agent-pets/` の16枚を選択。
- **帰属の手がかりは `cwd` のみ。** Claude JSONL は 75/75 で `cwd` を持ち、registry には 61件中58件。
  `gitBranch` は JSONL に全件あるが **registry に保存されず parser も未使用**。
  worktree path / repo 名 / team / `agent_name` は**いずれも取得されていない**。
  `cwd` の粒度は `dev/M3E` / `dev/M3E/beta` / worktree 配下が混在し、正規化されていない。
- **過剰カウントの原因（高確度）**: fork / clone lineage を session ID 単位で別登録している
  （7 family / 22 files が registry 上 19 ID、logical family 換算で12件の余剰）。
  加えて `visibleSessionIds()` が実装済みなのに live projection で使われておらず全 active record を描画、
  registry に unlink 検出も prune も無く legacy pseudo record が3件残留している。

ADR_009 が prototype を「mock データ」「参照実装に降格」と記述した時点から、実体は進んでいる。

## Decision

### DC1. plugin kernel は今回作らない。ただし後から抽出できる形にする

**今回の実装範囲では plugin registration API を作らない。**
agent node の管理は out-of-process のスクリプトが行い、M3E の背後にいるエージェント1体が総合的な判断を担う。
`CodexAppServer` による M3E 駆動は既に実装済みであり、この経路を使う。

ただし ADR_009 §3 をそのまま維持するのではなく、**段階的な立場を取る**。
`260808_agent_mapping_plugin_boundary.md` が挙げる5つの registration
（AC1 Surface / AC2 Schema / AC3 Command / AC4 Event subscription / AC5 Adapter）は、
**後から抽出できる形に実装する**ことを要件とする。
具体的には、agent 固有の語彙・状態・描画規則を viewer 本体に直接埋め込まない。

今回 kernel を作らない理由は、DC4 により初期が read-only であり、
AC3（Command）と AC5（Adapter）に実需が無いこと。
実需のない API を先に設計するのは、ADR_010 が禁じた「実装のない予約席」にあたる。
ADR_009 §3 の「実需 query 3件が揃うまで凍結」の精神は維持し、**解除条件を「抽出可能性の確保」に置き換える**。

引き継いだ設計会話の `renderNode` による viewer 内 capability plugin は、今回は採らない。
DC4 の read-only を解いて node 内に UI を持たせる段階では、viewer への直接の拡張点ではなく
`NodeDrawContent` の語彙拡張、または AC1/AC2 の抽出として入れる。

### DC2. Agent Orrery は map のデータであり、Surface View ではない

ADR_010 が確定した Surface View 4種（`Tree / Axial / Disperse / System`）は変えない。
**Orrery は map に載るデータ**であり、Tree でも Disperse でもいずれの view mode でも見られる。
既定の見え方は Disperse の force を使う。

「map のひとつを Orrery として稼働させる」とは、専用 view mode を作ることではなく、
**agent 観測によって node が生える map を1つ持つ**ことを指す。

### DC3. 粒度は3層。Role は永続、Actor は runtime、Telemetry は ephemeral

map 上の agent 表現は **役割単位**で project の配下に置く。
これにより「その project を誰が担当しているか」が可視化される。

`260808_agent_mapping_plugin_boundary.md` AP2 に従い、prototype の一体型 `AgentNode` を3層に割る。

| 層 | 寿命 | 置き場 |
|---|---|---|
| **Role / Contract** | 永続 | Authoring Map（正本） |
| **Actor Instance** | runtime | Runtime overlay。session / mailbox state / trace を持つ |
| **Telemetry** | ephemeral | 正本に混ぜない |

resume / fork / 並行実行で生じた複数 session は、Actor Instance 層でまとめ、Role の下に束ねる。

ADR_009 §2 の `Agent = Session 1:1 絶対` は **観測層の粒度**として維持し、
**map の Role 粒度には適用しない**。この分離が本 ADR の中心的な変更点である。

**`Role CRUD` と `Actor CRUD` は別操作**として扱う。
`Delete Role` は組織再編で Authoring Map の操作、`Delete Actor` はプロセス終了で Runtime 側の操作。
混同すると、プロセスが落ちただけで組織が消える。

map には **agent 機能を持つ node と、持たない普通の node が混在**する。

**scope owns binding, plugin owns realization.**
Role が保持するのは実行体そのものではなく `callable-ref`（`hermes://` / `codex://` / `exec://` 等）への binding とする。
Role の記述に Hermes / Codex / Claude の実装知識を入れない。
これにより runtime の差し替えが意味構造の変更にならない。
Role を M3E の node として持つか **scope** として持つかは **DC17 で解決した**
（実体は role 定義 scope 内の node、agent からは collapse された alias で参照する）。

### DC4. 初期は read-only

既に生えている会話セッションを観測し、M3E に node を生やす。現 orrery と同方式。
node は mutation の対象ではなく、**固定された node** として扱う。
node に対する操作は、役割配置 / メッセージ送信 / 確認 / セッションを開く、といった行為である。

### DC5. 「終了」と「観測不能」を別ステータスとし、どちらも node を残す

正常に終了した session と、観測できない（ファイルが読めない / backend 断）session を区別する。
read-only 段階では node を map から削除しない。数が増えた場合は畳む・絞り込むで対処する。

### DC6. Goal Graph を同じ map に同居させる

agent に対応しない node を inner node として配置することで、
同一 map 上に Goal Graph を併記できる。Goal Graph は本スコープに含む。

### DC7. 変更検知で観測する。polling はしない

定期ポーリングはノイズになるため、**agent セッションのファイル変更検知**で観測する。
ただし現行 prototype の Claude セッション過剰カウントは原因未特定であり、
**M3E へ移す前に精査する**。欠陥をそのまま引き継がない。

### DC8. provenance は day-1 で入れる

DC3 と DC6 により、同一 map に **script が生やす node** と **人が書く node** が混在する。
「誰がこの node を生やしたか」を示す1フィールドは、初回実装から入れる。
データの置き場そのものは後決めでよいが、この1点だけは後付けできない
（既存 map の移行が発生し、再走査が人の書いた node を壊す経路が残るため）。
ADR_009 §3 の provenance 必須とも一致する。

### DC10. project 配下への配置は、規則ではなくエージェントが判断する

connector は **未配置の受け皿に node を生やすだけ**にする。
project node 配下への配置は、M3E の背後にいるエージェントが `cwd` と `gitBranch` をヒントとして判断する。

機械的な帰属規則（`cwd` を repo root へ正規化して project に binding する等）は採らない。
理由は3つ。使える手がかりが `cwd` しか無く、その粒度が
`dev/M3E` / `dev/M3E/beta` / worktree 配下と混在していること。
repo と project が 1:1 とは限らないこと。
そして DC1 が「M3E の背後にエージェント1体が総合的な判断を持つ」と定めており、
**曖昧な帰属の解決はまさにその判断の仕事**であって、規則で解くべきものではないこと。

これにより DC4 が挙げた操作「役割配置」が実体を持つ。

### DC11. state 語彙は M3E 側で一本化して切り直す

prototype の backend 9種 / UI 10種という二重体系は引き継がない。
**観測できる事実だけを state として定義**し、変換層を持たない。

- 「正常終了」「観測不能」「切断」を**分離する**（DC5 の要求。prototype はこの3つを `gone` と `retired` に潰している）
- live projection が生成しない `speaking` / `listening` / `negotiating` は**採用しない**。
  ADR_010 が示したとおり、実装のない予約席は語彙を腐らせる

### DC12. コードの置き場: 観測プロセスは M3E repo 内の out-of-process プロセスとする

`playground/agent-orrery` の backend は**参照として引き継ぎ、ロジックは M3E に寄せる**。
DC1 のとおりプロセスとしては out-of-process のままだが、コードの canonical owner は M3E repo とする。
prototype は参照実装であり正本ではない（ADR_009 §1 の位置づけを維持）。

dedup / state 判定 / projection 生成は **M3E 側で書き直す**。
prototype の該当ロジックをそのまま移植しない（後述の欠陥リストを参照）。

### DC13. UX の中心は agent 一覧ではなく Attention Routing

この製品の目的は監視 dashboard ではなく **externalized executive function** である。
人間が頭と terminal タブで保持している orchestration state を空間構造へ外在化し、
**人間が「今判断すべき frontier」だけを見れば済む状態**を作る。

したがって既定の表示は次の規則に従う。

- 自走している agent は**薄く**する
- **人間への attention が立ったものだけを前景化**する（判断待ち / 承認待ち / 選択待ち）
- 人間と全 agent を常時 edge で結ばない。**今やり取りする意思がある edge だけ張る**

DC11 の state 語彙において、「人間の判断を待っている」は他と並列の一状態ではなく
**最上位の意味を持つ軸**として扱う。prototype の raw state では `awaiting-user` が対応する。

### DC14. edge に type を持たせ、edge-type 射影を初回から入れる

同一 map 上に Why / What / Who / Now / With-what の関係が共存する以上、
**全 edge を常時表示しない**。edge に type を持たせ、表示する edge 種を選べるようにする。

`260808_agent_mapping_plugin_boundary.md` GV4 の射影例:
`Intent`（GOA edge 中心）/ `Execution`（task dependency 中心）/
`Organization`（Role / Actor 中心）/ `Runtime`（session / state / attention 中心）。

$$G_{\mathrm{view}} = (V,\ E_{\mathrm{selected}}) \subseteq G_{\mathrm{PJ}}$$

これを後回しにしない理由は実測にある。prototype は既に **89 nodes に対し 163 links** であり、
edge 種を選べないまま Goal Graph（DC6）を同居させれば確実にスパゲッティ化する。

**「同じ map に置く」は「同じ hierarchy に押し込む」ではない。**
ownership の tree は正本として残し、Graph View は semantic projection として scope 境界を越えて接続する。

### DC15. 今回の主語は Agent。完成形の主語は PJ

今回の requirements は **agent 観測を主語**に書く。
ただし完成形の主語は Agent ではなく **PJ** であり、
最終的には `Why(GOA) → What(Work) → Who(Org) → Now(Runtime) → With what(Resource)` が
同一 graph 上に typed edge で接続され、任意の稼働 agent から
`Actor → Role → Task → Objective → Goal` を逆向きに辿れる状態を目指す。

DC14 の typed edge を初回から入れるのは、この昇格を後から可能にするためでもある。
GOA 側の語彙定義は今回は行わず、DC6 のとおり inner node として同居させるに留める。

### DC16. agmsg との境界

agmsg は既に稼働している agent 間通信層である。その思想を要約すると:

> agent を runtime 個体ではなく **team 内の名前付き logical identity 兼 destination** として扱い、
> `(realm, team, agent)` という明示 address に対して point-to-point message を配送する通信層。
> team は roster / storage / transport の境界であり、**意味上の組織でも project hierarchy でもない**。
> agmsg が所有するのは address / envelope / delivery・read・receipt・history / adapter であり、
> 会話意味 / session lineage / agent の semantic lifecycle / 人間の判断状態は**所有しない**。

ここから境界を6つ引く。

**DC16-1. agmsg の `agent` を M3E の Role と同一視しない。**
agmsg の agent name は destination であり、責任・目的・契約を表さない。
transport identity は `(realm, team, agent)` として DC3 の Role / Actor Instance とは**別層**に置く。

**DC16-2. agmsg の `team` を M3E の project と同一視しない。**
agmsg の project registration は endpoint 解決用の metadata であって、semantic な帰属ではない。
DC10 の配置判断は agmsg の registration を根拠にしてよいが、それを**規則として自動適用しない**。

**DC16-3. delivery state と lifecycle state を別体系にする。**
agmsg の `queued / delivered / read / handled / failed` は **message の状態**であり、
DC11 の agent lifecycle state ではない。混ぜない。

**DC16-4. unread は attention ではない。**
agmsg の unread / inbox block は delivery control である。
DC13 の attention（人間の判断待ち・承認待ち・選択待ち）は M3E 側の semantic state として持つ。
agmsg にこの概念は存在しない（該当 field 0）。

**DC16-5. read-only 観測は agmsg の DB を直接読む。配送 API を使わない。**
`inbox` / `watch` / `check-inbox` は read cursor / `message_read` / `read_at` を**変更する**。
これを観測に使うと DC4 の read-only が壊れる。SQLite を read-only で読む経路に限定する。

**DC16-6. agmsg が既に持つものを Orrery 側で作り直さない。**
destination identity、team roster と membership、agent name の identity history、
inbox / history、read cursor、delivery state、watcher / actas lock / 受信 owner、spawn / despawn。
これらは agmsg から取得する。二重化すると正本が2つになる。

逆に agmsg に**存在せず Orrery が持つ必要があるもの**は、
semantic Role / Actor Instance（session lineage と grouping）/ Telemetry /
agent lifecycle state / project への semantic placement / human attention state /
provenance / typed semantic edge / Role と Actor の CRUD 分離。
これは DC3・DC11・DC13・DC14 が担う。

**DC7 の適用範囲を限定する。**
DC7 の「polling しない」は **M3E 自身が agent セッションのファイルを観測する経路**に対する規定である。
agmsg は内部に5秒 polling（local monitor / remote sync とも）を持つが、これは agmsg の実装であり
DC7 の対象外とする。M3E は agmsg の DB 変更を検知する側に立つ。

**agmsg message には provenance が無いことを前提にする。**
実データで確認: message row 35件に対し `session_id` column なし、
`thread` 有効値 0/35、`message_id` 有効値 0/35、`kind` は `message` が 35/35。
process / cwd / project / log との対応も message には無い。
session との対応手がかりは message ではなく runtime sidecar（`watch.<instance>.pid` /
`role-session.*` 等）にあり、`role-session` は `(team, agent) -> latest bare session id` の
advisory record にすぎず message ID との対応を持たない。
**message DB 単体から送信 session を確定することはできない**（IS5 はこの制約下で解く）。

### DC17. Role は node / scope の二択ではない。実体は node、定義域は scope、参照は alias

IS11 は「node か scope か」の二択で立てたが、**正しい答えは二択ではなかった**。
M3E の既存 alias 機構でそのまま表現できる。

| 側面 | 表現 |
|---|---|
| Role の**定義域** | **role 定義 scope**。ここに role 一覧が存在する |
| Role の**実体** | その scope 内の node。`callable-ref` binding（DC3）はここが持つ |
| agent から Role への**参照** | agent node が持つ**属性**。構造上は agent node 配下の **alias node** が Role 実体を指す |
| 通常の**見え方** | その alias は agent node に **collapse** されている |
| Role 単位の**集計** | Role ごとに個別のネットワークが集計・射影される |

これは既存の scope / alias 仕様（`03_Spec/Scope_and_Alias.md`、Decision_Pool 2026-04-01-001）を
そのまま使う形になっている。実体ノードは単一 scope 所属、他 scope からの再利用は alias 経由のみ、
alias は read-only 参照ノード — Role 実体が role 定義 scope に1つあり、
各 agent node からは alias で参照する構造は、この規定の素直な適用である。

帰結:

- Codex draft の R2-1「Role を node とし scope ではない」/ R2-2「Role 名を scope として使わない」は
  **修正が要る**。Role 実体は node で正しいが、**role 定義 scope は存在する**。
- collapse された alias の表示は node seam lab の調整対象になる（IS4 と接続）。
- 「Role ごとに集計されたネットワーク」は DC14 の edge-type 射影の一つとして扱う。
- 同一 Role を複数 agent が担う場合も、Role 実体は1つで、alias が増えるだけになる。

### DC18. session 本文の公開制限を緩和する。前提は「akaghef 自身の PC 上の集約」

これは **akaghef の目が行き届いている PC 全体の情報を集約するツール**である。
その前提のもとでは、session の `Title` / `msg` の生テキストを M3E map に出してよい。

A-sys の `systems/work-os/dict/data-classes.md` は `private.raw` / `private.derived` を fail closed と定めているが、
あれは **A-sys が個人のメール・ノート・連絡先を抱える文脈**の分類である。
自分の agent の session を自分で観測する文脈にそのまま適用したのは過剰であり、
それを適用した Codex draft（R7）と、それを増幅した Director の判断が誤っていた。

`msg` が読めないカードは attention routing の判断に使えない。**可読性を優先する。**

境界は1つだけ残す。**map を M3E の外へ配布・公開・共有する経路を作るときは、その時点で改めて判断する。**
今回のスコープ（read-only 観測 + 自機内の vault 往復）では制限しない。

### DC19. 色は7色の統一規約に従う

正本は [`.kiro/steering/color_semantics.md`](../../.kiro/steering/color_semantics.md)。
**map 全体の規約であり、agent 固有ではない。**

青 = 正常稼働 / 黄 = 判断待ち / オレンジ = 停滞・要注意 / 緑 = 完了 / 赤 = 異常 / 灰 = アーカイブ / 白 = 未配色。

DC11 の lifecycle state 10種はこの7色へ写像する（対応表は色規約側）。
色数は増やさない。7色で表せない区別は文字・形・線種で表す。

`unobservable` に**白（未配色）**が当たるのが意味的に一致する — 観測できないから色を決められない。
DC5 が分けた「正常終了 / 観測不能 / 切断」は **緑 / 白 / 赤** に分かれる。

### DC20. vault 往復は「同じ map を保つ」（A 案）

vault export → 編集 → import は、**同じ map の同じ node を更新する**。新しい map を作るのではない。

したがって `vault_exporter` / `vault_importer` は node identity を保存しなければならない。
実現手段は発明しない — **`md_writer` / `md_reader` が既に実装している `m3e.nodeId` 方式を vault 経路へ適用する**
（`md_writer.ts:68,71` / `md_reader.ts:247,272`。`md_reader.ts:26,39` が `m3e` を "M3E-specific frontmatter" と定義済み）。

現行実装は B（毎回新規採番）であり、これは Orrery に限らず
**vault 往復するすべての map で node 同一性が失われている**状態である。
Agent Orrery とは独立のデータ整合性の欠陥として扱い、本 ADR のスコープ内で直す。

akaghef 指示（2026-08-29）: 「A 側に決定する。ある程度大胆な変更を加えて良い」。

### DC21. 所有権は node 単位ではなく field 単位

同じ node の中でフィールドごとに持ち主が違う。
node 全体に持ち主を1つ割り当てる設計では、「connector が生やした node に人が書き足す」が解けない
（上書きすれば人の追記が消え、触らなければ state が更新されない）。

| 領域 | 持ち主 | 挙動 |
|---|---|---|
| **body（本文）** | 人 | connector は読みも書きもしない |
| `m3e:actor.*`（Title / msg / model / state / lastActiveAt） | connector | 毎観測で上書きする。人が編集しても次の観測で戻る（**そう明示する**） |
| `m3e:role.*`（Role / icon） | 人（connector は初回のみ提案） | 一度人が確定したら connector は触らない |
| Realm / Name | connector | identity。人は変えない |
| prefix なしの attribute（`tags` / `aliases` 等） | 人 | connector は触らない |

**Agent Card に出るものは全部 connector のもの、カードに出ない本文が人のもの。**
これにより `1概念=1md` の中で所有者が分かれ、両者が同じ md を安全に共有できる。

DC8 の provenance は、この field 単位所有権の**根拠**として機能する。

### DC22. Agent Card の表示要素

akaghef の設計（2026-08-29）を採用する。

```text
┌─────────────────────────────┐  ← 外枠: attention（色/太さ）+ Actor 多重度（重なり）
│ ┌─────────────────────────┐ │
│ │ icon  Realm , Role , Name│ │
│ │       Title ───────────  │ │
│ │       msg   ───────────  │ │
│ │       model  time  state │ │  ← state は DC19 の色
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

- `icon` は **Role 層**に付ける（現行 prototype は `avatarIndex` が session 由来のため resume で顔が変わる）
- `Realm` を出し `team` を出さないのは DC16-2 と整合する
- `time` は `lastActiveAt` との差を**表示時に計算**する。保存しない（Telemetry）
- `state` の文字は10種のまま、色は DC19 の7色
- layout へ渡す契約は `(w, h)` のみ。幅固定、高さは `msg` 行数と外枠の有無で変わる
- 遠景では読めないため LOD が要る（遠景 = icon + 色、中景 = icon + Name + state、近景 = カード全体）

外枠は akaghef が「未定」としていた。**attention を割り当てることを提案する** — DC13 が
「自走 agent は薄く、attention が立ったものだけ前景化」と定めており、外枠はカード全体を囲む
唯一の面なので前景化に適する。Actor 多重度（同一 Role に複数 Actor）はカードの重なり枚数で表す。
両方を外枠に載せると情報密度が最も高い。**最終決定は seam lab で目視してから。**

### DC9. 本スコープに含めないもの

| 除外 | 理由 |
|---|---|
| port / anchor の議論 | 見た目の問題であり本質ではない。既存 `selectPorts` に手を入れない |
| trace の保存・保持期間 | 重い。別途 |
| L1〜L4 の介入操作 | DC4 により初期は read-only。DC7 の node 内 UI ボタンは将来の課題 |
| WebGL 前提の LOD 設計 | 現行 node seam は SVG / DOM fragment 前提であり、まだコードに接地していない |

## Rationale

**なぜ Surface View を新造しないか（DC2）**
ADR_010 が示したとおり、固有の幾何を持たない Surface View 名は、実体を共有したまま語彙だけ分岐させ、
port 規則の誤流入のような不具合を生む。Orrery は「agent という種類の node が載った map」であって、
新しい配置規則ではない。名前を増やす理由がない。

**なぜ node 粒度を役割にするか（DC3）**
session 単位で node を生やすと、resume / fork / subagent による JSONL 分裂がそのまま node の増殖になる。
prototype の Claude 過剰カウントは、まさにこの層で症状として出ている。
役割 node を安定した器にすれば、観測層の分裂が map の構造を汚さない。
また DC6 の「project 配下に agent を配置して担当を可視化する」は、
担当が session の生成消滅で消えては成立しない。担当は役割に付く。

**なぜ provenance だけ後決めにしないか（DC8）**
他の項目は後から足せる。所有者マーカーだけは、無い状態で map が育つと
「消していい node」と「消してはいけない node」の区別が事後に復元できない。

## Consequences

- ADR_009 §4 の「live 観測 adapter は別 lane」は解消され、Claude jsonl / Codex rollout / Hermes db の観測が本線に入る。
- `playground/agent-orrery` は ADR_009 で「参照実装に降格」とされたが、実際には実データで稼働している唯一の実装である。**参照であって正本ではない**という位置づけは維持しつつ、状態語彙・描画要素・観測経路は参照する。
- plugin 契約（登録 / 発見 / 起動 / 停止 / health / version / 認証）は依然として未定だが、DC1 により **今回はその契約を作らずに進める**。out-of-process スクリプトが map に書くだけで成立する。汎用 plugin API の凍結（ADR_009 §3）を継続する。
- `NodeDrawContent` に agent 表示要素（avatar / 状態 / 直近発言 / 経過時間）の語彙が無い。node seam lab での調整対象はここになる。
- `drawNode()` に edge 生成・folder preview・component 描画が残っている（`beta/src/browser/viewer.ts:7551-7580`）ため、agent node の描画要素を触ると viewer 本体へ波及しうる。

## Open

本 ADR で決めていない、次に決める必要があるもの。

| ID | 未定 |
|---|---|
| IS1 | **解決 → DC10**（エージェントが配置を判断する） |
| IS2 | **解決 → DC12**（canonical owner は M3E repo、プロセスは out-of-process） |
| IS3 | **解決**: 原因は fork / clone lineage の別登録（Context 参照）。対処は DC12 により M3E 側で書き直す |
| IS4 | **解決 → DC22**（Agent Card）。`model` は3 provider とも取得可能と確認済み（Claude `message.model` / Codex session metadata の `model` / Hermes `sessions.model` は 180/180 非空）。残るのは LOD 閾値・字送り・固定幅・attention と Actor 多重度の視覚的分離で、**seam lab で目視決定**する |
| IS5 | agmsg の送受信 endpoint を session に解決する方法。agmsg message は runtime session ID を持たない。prototype も `agent_name` / team を観測していない |
| IS6 | **解決 → DC18**（自機内集約が前提。生テキストを出してよい）。map を外部へ配布・公開する経路を作る時点で再判断する |
| IS7 | **解決 → DC11**（M3E 側で一本化して切り直す）。具体的な state 一覧の確定は spec 段階 |
| IS8 | static projection / live observation / replay の製品上の扱い（prototype は MAP TIME で replay を持つ） |
| IS9 | 「未配置の受け皿」（DC10）を map 上どう表現するか。専用の親 node か、親なしか、別 scope か |
| IS10 | **解決 → DC21**（field 単位所有権）。保存先は `TreeNode.attributes`、vault 往復は DC20 の `m3e.nodeId` 方式で保持 |
| IS11 | **解決 → DC17**（実体は node、定義域は role 定義 scope、agent からは collapse された alias で参照）|
| IS12 | **解決 → DC16**（agmsg との境界を6条で規定）|
| IS13 | DC14 の edge type 語彙。今回必要な最小集合（conversation / handoff / assignment / attention 等）を確定する |
| IS14 | DC13 の attention をどう観測するか。`awaiting-user` の検出条件と、人間側の応答による解除条件 |
| IS15 | **`agent` = `AI agent` ∪ `human`**（global rule、2026-08-27）。したがって map には human agent も載る（prototype も `Akaghef` / `owner` を node として持つ）。human は Role と agmsg endpoint を持つが provider runtime session を持たない。DC3 の Actor Instance 層、DC11 の lifecycle state（`thinking` / `tool-running` は human に適用できない）、DC13 の attention の向き（human 宛だけでなく AI agent 宛もありうる）を、この2種にどう適用するか |
| IS16 | **解決 → DC20 + DC21。** 以下は判断の根拠として残す。**vault 往復が node identity を保たない。** provenance 消失はその一症状。検証（2026-08-27, read-only）で判明した事実: (a) `vault_exporter` は node id を出力せず、ファイル名を `node.text` から生成する（`vault_exporter.ts:72-75`）。(b) `vault_importer` は毎回新規に id を採番する。(c) したがって **node id を鍵にした外部 index は vault 往復後に無効**。(d) 代替鍵も弱い — `vault:path` は rename / reparent で壊れ（`vault_importer.ts:100,180`）、title は `node.text` 由来、階層位置も不安定。(e) **一方 `md_writer` / `md_reader` 系統は既に `node.id` を `m3e.nodeId` として frontmatter に書き、復元している**（`md_writer.ts:68,71` / `md_reader.ts:247,272`）。`md_reader.ts:26,39` は `m3e` を "M3E-specific frontmatter" と定義しており、**機械要素チャネルは設計として既に存在する**。(f) vault 経路だけがそれを使わず、`parseMdContent` ではなく `parseFrontmatter` を用いて frontmatter トップレベルキー `m3e` を丸ごと除外している（`vault_importer.ts:8,119,373,380`）。(g) `vault:kind` / `vault:path` の除外は正当（importer が生成する内部管理属性で、往復で再生成される）。→ 解決の方向は発明ではなく、**既存 `md_writer` / `md_reader` の方式を vault 経路へ適用すること** |

### 引き継いではいけない実装上の欠陥

M3E へ移す際に、prototype から持ち込まないと決めたもの。

- JSONL ファイル数を session 数として扱い、fork / clone lineage を dedup しないこと
- session 終了を file mtime や inactivity だけで推定すること（DC5 に反する）
- unlink / 消滅 / prune を持たず registry を永続残留させること
- 実装済みの可視性フィルタを使わず全 active record を描画すること
- hook ID と log ID の namespace を統一せず二重登録を許すこと
- `cwd` を project 帰属キーとして機械的に扱うこと（DC10 により帰属はエージェント判断）
- `agentId` / sidechain / 親子関係を無視すること
- 1ファイル内で session ID が切り替わる場合に最初の ID だけで処理すること
- backend の state 体系と UI の state 体系を別のまま運用すること（IS7）
