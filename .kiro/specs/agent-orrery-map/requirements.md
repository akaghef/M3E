# Requirements Document

## Project Description (Input)

**agent-orrery-map** — Agent Orrery を M3E の map data として扱う既存 requirements の改訂版

### 誰の課題か

M3E を使って複数の agent（AI agent と human の上位集合）、Role、Goal Graph、runtime observation を同じ文脈で理解する Akaghef / M3E Director / Codex worker の課題である。現在の prototype は一覧・状態・メッセージ・関係を一つの runtime projection として扱っているが、session の重複、source attribution、state の混同、Role 参照、field ownership、human の表現が未確定である。

### 現状

Agent Orrery は独立した Surface View ではなく、M3E map に載る data である。prototype で確認できる raw state は `starting`、`thinking`、`tool-running`、`awaiting-user`、`blocked`、`idle`、`completed`、`failed`、`disconnected` の9種であり、UI は別の state 語彙も持つ。この二重体系と、経過時間だけから `gone` 等を導出する挙動は引き継がない。

runtime の実データでは、Claude/Codex/Hermes の session records、Hermes の親子 session 情報、Codex の thread spawn edge、Claude の `isSidechain` / 親子情報、JSONL の cwd / gitBranch、Hermes message の session_id が観測可能である。agmsg の message DB は `session_id` を持たず、現行 message rows の `thread` / `message_id` も確定的な対応付けに使えない。したがって、agmsg message から session を推測してはならない。

### 変えたいこと

M3E の既存 map / scope / node / edge / GraphLink 契約上に、Role、Actor Instance、Telemetry を混同しない agent mapping requirements を定義する。初期製品は read-only とし、現在観測できる事実だけから一本化した lifecycle state、typed GraphLink、Attention Routing、day-1 provenance、field ownership、lineage-aware dedup を成立させる。Agent Card の語彙は generic viewer に埋め込まず、後に抽出可能な data-driven boundary として定義する。

## Boundary Context

- **In scope**: Agent Orrery map data の意味、Role と Actor Instance の分離、AI agent と human の扱い、Goal Graph の同居、static map presentation / live observation / historical runtime projection、観測可能な lifecycle state、Agent Card、agmsg/A-sys 境界、未配置観測の受け皿、provenance、field ownership、typed GraphLink、Attention Routing、lineage-aware dedup、vault round-trip、read-only の受け入れ条件。
- **Out of scope**: plugin kernel/API、runtime command や L1〜L4 intervention、trace の保存・保持期間、port / anchor、Surface View / layout / port 契約の変更、GOA 側の語彙定義、prototype code の移植、agmsg の配送・既読・監視 API の実行、M3E 外への map 配布・公開・共有経路。
- **Binding sources**:
  - `docs/09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md` — DC1〜DC22 / IS1〜IS16 の正本
  - `.kiro/steering/agent_orrery_terminology.md` — agent runtime observation の binding terminology
  - `.kiro/steering/color_semantics.md` — map 全体の binding color semantics
  - `docs/00_Home/Glossary.md`
  - `docs/09_Decisions/ADR_009_Orchestration_Fusion_Into_M3E.md`
  - `docs/09_Decisions/ADR_010_Radial_Surface_View_Removal.md`
  - `docs/protocols/repository-canon-values.md`
  - `.kiro/steering/ui_view_taxonomy_and_ports.md`
  - `docs/03_Spec/Data_Model.md`、`docs/03_Spec/Scope_and_Alias.md`
- **Surface contract rule**: Surface View は `Tree` / `Axial` / `Disperse` / `System` の4種を維持し、既定の見え方は `Disperse` force とする。この requirements は Surface View、layout、port、anchor を追加・変更しない。
- **Ownership rule**: durable な map semantics は M3E が所有する。runtime records、agmsg transport records、外部ログは observation evidence であり、connector が M3E data へ materialize する。node 内の mutation authority は Requirement 13 の field ownership に従う。
- **Read-only rule**: initial release は外部 runtime と観測元を操作しない。connector は宣言された connector-owned fields と新規 observation records だけを更新し、人が所有する fields は変更しない。

## Product and Operations Context

- **Relevant product vision**: M3E は `workspace > map > scope > node` を共有 substrate として、human と AI agent の planning、handoff、review、runtime observation を同じ意味境界で扱う local-first knowledge base である。
- **Active development target**: `beta/`。
- **Active focus**: S2 Team Collaboration、S3 save/sync/recovery reliability、S13 local-first independence。Agent Orrery は data-safe な観測・handoff・attention 表示に接続するが、AI proposal や runtime intervention を追加しない。
- **Canonical terms**: `Role` は role 定義 scope 内の実体 node、`Actor Instance` は runtime 単位、`session` は provider runtime の observation evidence、`agmsg agent` は transport destination、`connector` は session data と M3E data をつなぐ out-of-process script である。無修飾の `projection` / `射影` は使わない。
- **Evidence baseline**: ADR-011 fixture では7 logical families / 22 files / 19 raw registry IDs が確認され、12件の lineage duplicate が余剰表示されていた。`model` は実データで取得可能である。Claude JSONL は `message.model`、Codex rollout は session metadata/settings の `model`、Hermes DB は `sessions.model` を持ち、2026-08-29 の read-only 調査では Hermes 180/180 sessions で非空だった。

## Requirements

### Requirement 1: Agent Orrery map の意味境界

**Objective:** Agent Orrery を新しい Surface View や独立 runtime database ではなく、M3E map 上の data として扱う。

#### Acceptance Criteria

1. The system shall represent Agent Orrery within an M3E map while preserving the four canonical Surface Views `Tree`, `Axial`, `Disperse`, and `System`.
2. When no explicit Surface View is selected, the system shall present Agent Orrery data through the existing `Disperse` force interpretation.
3. The system shall keep persistent Role and Goal Graph nodes in the Authoring Map, Actor Instance information in a runtime projection, and Telemetry outside canonical map semantics.
4. When a map node has no corresponding agent, the system shall allow that node to remain as an inner Goal Graph node in the same map.
5. The system shall not require a plugin kernel, a new Surface View, a changed layout/port contract, or WebGL-specific behavior for this requirements slice.

### Requirement 2: Role、Actor Instance、agent kind の分離

**Objective:** Role、Actor Instance、session、AI agent / human の kind 軸を分け、Role binding に runtime provider の実装知識を混ぜない。

#### Acceptance Criteria

1. The system shall provide a role definition `scope` containing the canonical Role entity nodes.
2. The system shall represent each Role entity as one node in that role definition scope and shall keep its `callable-ref` binding on that entity.
3. The system shall represent an agent-to-Role reference as an attribute of the agent node and structurally as a child alias node that points directly to the Role entity.
4. The system shall normally present the Role alias collapsed into its parent agent node.
5. When multiple Actor Instances perform the same Role, the system shall retain one Role entity and create or retain multiple direct aliases; it shall not duplicate the Role entity.
6. The system shall preserve the existing alias rules: one canonical scope membership per entity, cross-scope reuse only through alias, read-only alias reference, and no alias-to-alias target.
7. The system shall keep Role CRUD and Actor CRUD as separate conceptual operations even while the initial release exposes neither as a runtime mutation operation.
8. The system shall not treat an agmsg agent as a Role, an agmsg team as a project, or a provider session as a Role or Actor Instance by identity alone.
9. If an Actor Instance cannot be mapped to a Role by an explicit M3E binding, the system shall retain it as an unbound runtime entity instead of creating an inferred Role.
10. The system shall apply the Actor Instance layer to both AI agent and human, but shall not require a human Actor Instance to have a provider runtime session.
11. A human Actor Instance shall be backed by an explicit human identity / Role / agmsg endpoint binding or explicit participation evidence and shall not be synthesized from an assumed provider session.

### Requirement 3: M3E lifecycle state vocabulary

**Objective:** prototype の raw state を出発点に、観測できる事実だけで M3E lifecycle state を一本化する。delivery state と混ぜず、human に適用不能な provider execution state を作らない。

| M3E state | その state になる観測事実 |
|---|---|
| `starting` | session discovery または明示的な `session.started` / start state があり、実行開始後の turn / tool / terminal outcome がまだ観測されていない。 |
| `thinking` | 明示的な `turn.started`、reasoning-active event、または source が `state.changed` で thinking を報告している。 |
| `tool-running` | 明示的な `tool.started` があり、対応する `tool.completed` または terminal outcome がまだ観測されていない。 |
| `awaiting-user` | `approval.requested`、または human の入力・選択を要求する構造化イベントが未解決で観測されている。 |
| `blocked` | `task.blocked`、または runtime が dependency / operational block を明示的に報告している。ただし human の判断要求を含むことは別途 Attention として扱う。 |
| `idle` | `turn.completed` または runtime ready / waiting event があり、terminal outcome ではなく、source がなお観測可能である。 |
| `completed` | 成功した `session.ended`、`task.completed`、または成功終了 outcome が明示的に観測されている。 |
| `failed` | `session.failed`、失敗終了 outcome、または失敗を明示する terminal event が観測されている。 |
| `disconnected` | channel / runtime の disconnect が明示的に観測され、正常終了または失敗終了の確定 evidence がない。 |
| `unobservable` | source が unavailable、permission denied、corrupt、parse不能、または connector が読めず、正常終了・失敗終了・切断を確定できない。 |

#### Acceptance Criteria

1. The system shall expose exactly the ten M3E lifecycle states listed above as the initial vocabulary.
2. When a source-specific raw state is observed, the system shall map it to one M3E lifecycle state or retain the last explicit M3E state; it shall not create a second provider-specific lifecycle vocabulary.
3. While a source remains readable but produces no new event, the system shall retain the last explicit lifecycle state and shall not derive a new state from elapsed time alone.
4. The system shall keep `completed`, `unobservable`, and `disconnected` distinct, and shall retain the corresponding node or Actor Instance in the runtime projection in all three cases.
5. The system shall not use `speaking`, `listening`, `negotiating`, `standby`, `waiting`, `gone`, `retired`, or `error` as additional M3E lifecycle states.
6. The system shall keep agmsg transport states such as `queued`, `delivered`, `read`, `handled`, and `failed` in a transport namespace and shall not use them as lifecycle state.
7. If only an age, file mtime, unread flag, or missing event is observed, the system shall not claim `completed`, `failed`, `disconnected`, or `awaiting-user` without corresponding explicit evidence.
8. The system shall not apply `starting`, `thinking`, or `tool-running` to a human Actor Instance, because human has no provider runtime session.
9. The system shall leave lifecycle state absent for a human Actor Instance when no applicable explicit evidence exists; it shall not invent an eleventh `human` / `n/a` state and shall not call the human `unobservable` merely because no provider runtime session exists.
10. When human lifecycle state is absent, the presentation shall show no fabricated state text and shall use the color contract's unset presentation without asserting `unobservable`.

### Requirement 4: Agent Card

**Objective:** Role、identity、session context、lifecycle state、Attention を可読な一枚の card にし、generic viewer に provider 固有分岐を埋め込まない。

#### Acceptance Criteria

1. The system shall present the near-view Agent Card in this information order: `icon`; `Realm`, `Role`, `Name`; `Title`; `msg`; `model`, derived `time`, lifecycle `state`.
2. The system shall source `icon` from the Role layer and shall not derive it from session identity, session lineage, or prototype `avatarIndex`.
3. The system shall show `Realm` and shall not show agmsg team in the Agent Card.
4. The system shall expose raw `Title` and `msg` text with enough readability to support Attention Routing; it shall not replace them with content-free presence, count, fingerprint, or connector-generated summary.
5. The system shall obtain `model` from source evidence when present: Claude `message.model`, Codex session metadata/settings `model`, and Hermes `sessions.model` are valid observed sources.
6. If an individual source record has no model value, the system shall show only the verified provider/runtime kind as the fallback and shall not infer a model name.
7. The system shall calculate `time` from the difference between display time and `lastActiveAt`; it shall not persist the derived age.
8. The system shall render lifecycle state as one of Requirement 3's ten text values when applicable and shall obtain its color from `.kiro/steering/color_semantics.md` without duplicating the mapping in this document.
9. The system shall use the outer frame to foreground active Attention and to express Actor Instance multiplicity with distinguishable non-text cues; Attention shall remain separate from lifecycle state.
10. The system shall provide LOD: far view = `icon` + semantic color; middle view = `icon` + `Name` + lifecycle `state`; near view = the complete Agent Card.
11. The system shall pass only the resulting `(w, h)` box size to layout and shall not require a Surface View, layout, port, or anchor contract change.
12. The system shall expose Agent Card content as typed, data-driven content that a generic viewer can render without branching on provider raw state, agmsg address shape, or a specific agent identity.

### Requirement 5: Static map presentation、live observation、historical runtime projection

**Objective:** prototype の MAP TIME 相当の時間操作を、Authoring Map、current observation、historical replay の意味が混ざらない製品機能として扱う。

#### Acceptance Criteria

1. The system shall treat the static map presentation as the stable presentation of Role, Goal Graph, explicit map relations, and provenance in the Authoring Map.
2. The system shall treat live observation as an ephemeral read-side overlay of currently observed Actor Instance, lifecycle state, Attention, and Telemetry freshness.
3. The system shall observe M3E-owned session sources through change detection and shall not use periodic polling as M3E's session observation mechanism; polling internal to agmsg remains outside this requirement.
4. When an event package is available, the system shall offer replay as a read-only historical runtime projection over that package and shall not rewrite the Authoring Map, current lifecycle state, or provenance.
5. If no replay event package is available, the system shall disable or clearly mark replay as unavailable instead of inventing historical state from current timestamps.
6. The system shall treat MAP TIME or an equivalent time cursor as a runtime projection control and shall not introduce it as a fifth Surface View.
7. The system shall not require trace persistence or retention policy as part of this requirements slice.

### Requirement 6: agmsg message から送信主体 session への解決

**Objective:** session_id を持たない agmsg message DB から、根拠のない session attribution を作らない。

#### Acceptance Criteria

1. The system shall treat an agmsg message as transport evidence with an `(realm, team, agent)` endpoint and shall not treat that endpoint as a provider runtime session.
2. If a runtime sidecar supplies an explicit, immutable correlation from an agmsg message identifier to a session identifier, the system shall use that correlation only when source and correlation evidence are both present.
3. If the sidecar supplies only an advisory latest-session association such as `(team, agent) -> latest session`, the system shall leave the message unassigned to a session and shall not guess from recency, thread, filename, or unread state.
4. The system shall treat the current agmsg message DB shape, which has no `session_id` and no complete message-to-session correlation, as insufficient for session resolution.
5. When session resolution is unavailable, the system shall preserve transport-level sender, recipient, agmsg team, thread value, delivery state, and observed time, but shall not create a session-specific `conversation` GraphLink, latest-message attribution, message count, lineage link, or session-specific Attention association.
6. The system shall make loss of session-level attribution explicit in observation quality or detail presentation instead of presenting the message as if it belonged to a session.

### Requirement 7: 自機内 map に載せる session text

**Objective:** Akaghef 自身の PC 上で attention を判断できるよう、session の文脈を読める状態にする。

#### Acceptance Criteria

1. The system shall allow raw `Title` and `msg` text from A-sys-observed sessions to be stored and displayed in the M3E map within this scope.
2. The system shall prioritize readable `msg` content because a content-free card cannot support Attention Routing decisions.
3. The system shall not apply A-sys `data-classes.md` fail-closed classification as a restriction on this self-observation context.
4. The system shall not require a connector-generated summary, redaction, allowlist classification, content-free presence, count, category, or fingerprint in place of `Title` or `msg` for this scope.
5. If a path to distribute, publish, or share the map outside M3E is introduced, the system shall require a new explicit data-boundary decision before enabling that path; no such path is part of this requirements slice.

### Requirement 8: 未配置観測の受け皿と project placement

**Objective:** DC10 の未配置受け皿を明示し、cwd / gitBranch などの hints を機械的 project placement に昇格させない。

#### Acceptance Criteria

1. The system shall provide one dedicated, visible, system-managed `Unplaced Observations` folder/scope as the receiver for an Actor Instance whose project placement is unresolved.
2. The system shall keep each unresolved Actor Instance under that receiver and shall not attach it directly to the map root, an arbitrary project node, a Role node, or a Goal node.
3. The system shall preserve cwd, gitBranch, worktree, or similar hints as observation evidence only and shall not use any one hint as an automatic placement rule.
4. When an AI agent or human explicitly decides project placement, the system shall represent that decision as an explicit M3E map fact or relation and shall preserve original observation provenance.
5. If the dedicated receiver is unavailable, the system shall keep the observation unplaced and visibly unresolved rather than silently placing it elsewhere.
6. The system shall not use the receiver folder/scope as a Role, project, agmsg team, or lifecycle state.

### Requirement 9: day-1 provenance と vault round-trip

**Objective:** provenance を field ownership の根拠として保存し、vault 往復後も同じ map の同じ node として維持する。

#### Acceptance Criteria

1. The system shall store day-1 provenance in `TreeNode.attributes["m3e:provenance"]` using the existing string-valued node attribute contract.
2. The system shall encode provenance as a versioned record containing `version`, `origin`, `source`, opaque `sourceId`, and `observedAt`.
3. The system shall distinguish manual authorship, connector observation, transport observation, and derived observation materialization without storing an absolute source path, credential, or other unsafe locator as `sourceId`.
4. The system shall preserve an existing provenance record and shall mark missing provenance unresolved rather than guessing origin or author.
5. The system shall use provenance as evidence for Requirement 13's field-level ownership and shall not treat provenance as node-wide mutation authority.
6. A vault export/edit/import round-trip shall update the same map and same node, identified by persisted `m3e.nodeId`, rather than creating a replacement map or newly numbered node.
7. After a vault round-trip, the system shall preserve `m3e:provenance`, connector-owned fields, human-owned fields, Role aliases, parent/child identity, and GraphLinks according to their declared ownership and identity semantics.
8. The system shall reject the round-trip as conforming if node identity changes, provenance is dropped, or a connector-owned / human-owned field crosses the ownership boundary.

### Requirement 10: 初期 typed GraphLink 語彙と edge-type projection

**Objective:** DC14 に従って `relationType` を day-1 から持たせ、evidence がある最小集合だけを edge-type projection に含める。

| `relationType` | 作成を許す evidence |
|---|---|
| `conversation` | message observation が source と target endpoint を確定できる。session-level は Requirement 6 の明示 correlation がある場合だけ許す。 |
| `attention` | 判断・入力・選択を求める未解決 request と、対象 endpoint または owner が明示されている。 |
| `assignment` | M3E map 上で明示的に受理された Role / Actor Instance と project または Goal の binding がある。cwd、gitBranch、agmsg team membership、delivery state から推測しない。 |

#### Acceptance Criteria

1. The system shall represent `conversation`, `attention`, and `assignment` through the existing non-tree `GraphLink.relationType` string field.
2. The system shall recognize that `GraphLink.relationType` is a free string and that the current `validate()` checks link endpoints and self-links but does not validate a value set.
3. The system shall treat `conversation`, `attention`, and `assignment` as new Agent Orrery relation values, not as values protected by a TypeScript union or the generic map validator.
4. The Agent Orrery data contract and connector write boundary shall enforce an explicit allowlist for these three values before writing a GraphLink; an unsupported value shall be rejected or surfaced as invalid rather than silently accepted as Agent Orrery data.
5. Validation of the Agent Orrery `relationType` allowlist shall be independently testable from the generic viewer and shall coexist with existing repository values such as `reference`, `uses`, `uses_in_proof`, `cond:*`, and `related` without redefining the generic GraphLink contract.
6. The system shall keep parent-child ownership as the tree `edge` and shall not encode it as one of the three semantic GraphLink types.
7. When no evidence satisfies a relation condition, the system shall omit that GraphLink rather than create a speculative relation.
8. The system shall not include `handoff`, `spawn`, `depends-on`, `reviewing`, `conflicts-with`, or a provider-specific relation in the initial vocabulary without a separately accepted evidence contract.
9. The system shall allow an edge-type projection to select one relation type or a declared subset and shall not display all semantic GraphLinks by default.
10. The system shall keep edge-type projection independent of port and anchor selection and shall not require a port contract change.

### Requirement 11: Attention Routing

**Objective:** agent list を中心にせず、判断が必要な未解決 request だけを前景化する。

#### Acceptance Criteria

1. The system shall mark Attention active only when an explicit evidence record requests approval, input, choice, or a decision and the request remains unresolved.
2. The system shall accept `approval.requested`, an explicit input/choice request, or a `task.blocked` record with an explicit decision reason as Attention evidence.
3. The system shall not mark Attention active from `unread`, missing `read_at`, missing `handled_at`, `queued`, `delivered`, elapsed age, generic `blocked`, or generic `awaiting-user` without request evidence.
4. When a matching approval, rejection, input, choice, cancellation, request-completed event, or explicit runtime resolution is observed, the system shall clear corresponding Attention.
5. The system shall not clear Attention merely because a message was read, marked handled, or delivered.
6. If request-to-session correlation is unavailable, the system shall attach Attention to the best explicitly identified Role, agmsg agent, human, or unassigned receiver and shall not invent a session owner.
7. The system shall allow Attention to target either human or AI agent; human-directed Attention is not the only valid direction.
8. The system shall expose active Attention as the highest-priority observation projection axis while keeping it separate from lifecycle state and delivery state.
9. The system shall keep self-running AI agents visually subordinate to active Attention unless the user explicitly focuses another observation projection.

### Requirement 12: observation layer の lineage-aware dedup

**Objective:** prototype の file-count overcount、first-ID-only parse、lineage 無視、unlink/prune 不在を再発させず、session evidence と logical Actor Instance を分ける。

#### Acceptance Criteria

1. The system shall treat a file, database row group, or sidecar artifact as an observation source and shall not count the artifact itself as a session or Actor Instance.
2. When one JSONL file contains multiple session IDs over time, the system shall process each observed session segment and shall not use only the first session ID for the entire file.
3. The system shall keep raw session identity, logical lineage identity, and displayed Actor Instance identity as separate concepts.
4. When fork/clone/resume lineage evidence is present, the system shall deduplicate records into the corresponding logical Actor Instance while retaining raw session evidence as provenance.
5. The system shall use available `agentId`, `isSidechain` / sidechain, parent session/thread, child session/thread, and spawn-edge evidence when determining lineage; when evidence is absent, it shall preserve the relation as unknown and shall not fabricate a parent or merge.
6. For the ADR-011 fixture of 7 logical families across 22 files and 19 raw registry IDs, the system shall produce 7 logical Actor Instance representations, retain the 19 raw IDs as observation evidence, and shall not draw the 12 lineage duplicates as 12 additional logical actors.
7. When a source file or source record disappears, the system shall unlink it from the active observation index without deleting the logical Actor Instance, and shall mark the remaining node `unobservable` or `disconnected` only when corresponding evidence exists.
8. The system shall not leave a stale file identity, legacy pseudo-record, or duplicate visible node after an unlink/prune operation has been observed.
9. When the same source event is read again, the system shall produce an idempotent observation and shall not increment session, message, or logical Actor counts twice.
10. The system shall use a stable event identity that distinguishes source and raw identifier namespaces and shall not merge unrelated providers merely because raw IDs have the same text.
11. The system shall apply visibility or focus filters to an observation projection only after identity and lineage deduplication, so filtering cannot hide a duplicate as if it were a distinct Actor Instance.

### Requirement 13: field-level ownership

**Objective:** connector が生やした node に human が安全に追記でき、次の観測で上書きされる領域と保持される領域を明示する。

| 領域 | 持ち主 | 必須挙動 |
|---|---|---|
| body（本文） | human | connector は読みも書きもしない。 |
| `m3e:actor.*`（Title / msg / model / state / lastActiveAt） | connector | 毎観測で上書きする。human が編集しても次の観測で source evidence に戻る。 |
| `m3e:role.*`（Role / icon） | human | connector は初回だけ提案できる。human の確定後は変更しない。 |
| Realm / Name | connector | identity evidence から維持する。human edit を canonical value として採用しない。 |
| prefix なしの attribute | human | connector は読みも書きもしない。 |

#### Acceptance Criteria

1. The system shall enforce mutation authority per field according to the table above and shall not assign one owner to the whole node.
2. The connector shall preserve body, prefix-free attributes, and human-confirmed `m3e:role.*` fields across observation, dedup, replay, unlink/prune, and vault round-trip.
3. The connector shall overwrite `m3e:actor.*`, Realm, and Name from current source evidence on each observation; the UI and data contract shall make clear that human edits to connector-owned fields are temporary and revert on the next observation.
4. The connector shall not read body or prefix-free attributes to infer lifecycle state, Role, identity, placement, Attention, or deduplication.
5. When a connector-observed identifier collides with a pre-existing node without an explicit matching `m3e.nodeId` and source identity, the system shall retain a separate connector identity, preserve the pre-existing node, and shall not merge records by label, Title, cwd, or raw source ID alone.
6. A missing or unresolved provenance record shall reduce ownership confidence but shall not authorize the connector to overwrite a human-owned field.
7. The system shall make field ownership and current provenance inspectable without requiring access to provider source logs.

### Requirement 14: read-only observation and agmsg boundary

**Objective:** initial Agent Orrery を観測専用にし、DC16-5 の read-side effect を含めて検証可能にする。

#### Acceptance Criteria

1. The system shall read agmsg state through a read-only database boundary and shall not use the agmsg `inbox`, `watch`, or `check-inbox` commands or equivalent delivery/read APIs.
2. The system shall not write agmsg messages, delivery status, `read_at`, `handled_at`, read cursors, `message_read` events, roster, membership, address, watcher, lock, spawn, or despawn state.
3. The system shall not send, interrupt, terminate, resume, approve, or otherwise control an external runtime from the initial runtime projection.
4. The system shall not write to Claude/Codex/Hermes source logs or databases; any private observation cursor shall be M3E-owned metadata and shall not alter a source record.
5. The system shall not use a map command to mutate Role, Actor Instance, Goal Graph, or any human-owned field during live observation or replay.
6. When an observation pass ends, the system shall show unchanged agmsg message rows, delivery/read fields, cursor/read-event records, and source runtime records compared with a pre-observation read-only snapshot.
7. When an observation pass ends, the system shall show unchanged human-owned fields and relations, with connector-owned changes limited to the declared field ownership and receiver rules.
8. The system shall make absence of write/control operations auditable without relying on a successful delivery API call or GUI claim.
9. The system shall distinguish local submission, receipt, processing start, and completion evidence when delivery concepts are displayed, and shall not label local observation as completed work.

### Requirement 15: generic viewer boundary and future extraction seam

**Objective:** DC1 の AC1〜AC5 を後から抽出できるようにしつつ、今回 plugin kernel を作らない。

#### Acceptance Criteria

1. The system shall express Agent Card content, state presentation, Attention marker, provenance detail, and edge-type projection as separable data contracts rather than viewer literals.
2. The system shall keep the generic viewer responsible for existing map primitives and Surface View rendering, while agent mapping supplies data conforming to those primitives.
3. The system shall not require the viewer to import, know, or interpret agmsg address internals, provider raw states, sidecar filenames, source database schema, or lineage parser details.
4. The system shall preserve a separable boundary for future extraction of agent mapping realization without introducing a plugin registration kernel or generalized plugin lifecycle in this slice.
5. The system shall reject an implementation claim as requirements-complete if Agent Card semantics exist only as hard-coded branches in the generic viewer or if the required data boundary cannot be tested independently.

### Requirement 16: color semantics

**Objective:** lifecycle state と Attention の周辺視認性を map 全体の7色規約へ統一する。

#### Acceptance Criteria

1. The system shall use only the seven semantic colors defined by `.kiro/steering/color_semantics.md`: blue/normal, yellow/awaiting, orange/stalled, green/done, red/error, gray/archived, and white/unset.
2. The system shall consume the lifecycle-state mapping from the binding color steering and shall not duplicate or independently redefine that mapping in this requirements document or an Agent Card-specific contract.
3. The system shall not add an eighth state color; distinctions not represented by the seven colors shall use text, shape, position, or line style.
4. The system shall use yellow only when progress requires human input, approval, or choice and shall not use yellow for generic unread, age, visibility, or “worth watching” conditions.
5. The system shall never assign gray automatically from observation; gray shall result only from a human archive action.
6. The system shall not require color alone to identify lifecycle state, completion, failure, Attention, or archive status.

## Unresolved Items

The following items remain unresolved because current evidence or frozen contracts do not settle them:

- **IS4**: Agent Card content is fixed by DC22, but exact LOD thresholds, typography, fixed width, variable-height rules, and the final visual encoding that separates Attention from Actor Instance multiplicity require seam-lab visual acceptance.
- **IS5**: future contract shape for immutable agmsg message identifier → provider session identifier correlation. Advisory `(team, agent) -> latest session` remains insufficient.
- **IS8 / DC9**: durable replay trace storage, retention, and completeness. Replay remains read-only and conditional on an available event package.
- **IS9 / DC10**: persistent ID and localized display name of the `Unplaced Observations` receiver, plus the UX by which an AI agent or human confirms placement.
- **IS13**: evidence contracts for relation values beyond `conversation` / `attention` / `assignment`, and whether their validity should later enter a generic GraphLink schema rather than remain an Agent Orrery contract.
- **IS14**: final provider-independent correlation key and resolution-event schema for Attention. Read/handled/delivered remain insufficient.
- **DC1 extraction seam**: future plugin registration API, package boundary, versioning, discovery, lifecycle, and authentication. This slice requires only an independently testable data boundary.
- **Surface / layout / port**: LOD thresholds and card sizing may expose pressure on existing contracts, but this requirements revision does not change them. Any contract change requires a separate decision and spec.
- **External distribution boundary**: policy for redaction, publication, or sharing when a path outside M3E is actually proposed. DC18 intentionally does not decide it in advance.

## Traceability Notes

| ADR-011 decision | 対応 requirements |
|---|---|
| DC1 | R1-5、R15 |
| DC2 | R1-1〜2、R1-5 |
| DC3 | R1-3、R2、R5-1〜2、R9、R13 |
| DC4 | Boundary Read-only rule、R2-7、R14 |
| DC5 | R3-4、R12-7、R14-6 |
| DC6 | R1-3〜4、R8 |
| DC7 | R5-3、R14-4 |
| DC8 | R9、R13 |
| DC9 | Boundary Out of scope、R5-4〜7、Unresolved IS8/DC9 |
| DC10 | R8、Unresolved IS9/DC10 |
| DC11 | R3、R16-2 |
| DC12 | Boundary Ownership rule、R1、R5、R12、R14、R15 |
| DC13 | R4-4/9〜10、R11、R16-4 |
| DC14 | R10、R11-8 |
| DC15 | R1-4、R2、R10、Unresolved IS13 |
| DC16 | R2-8、R3-6、R4-3、R6、R10、R11、R14 |
| DC17 | R2-1〜6 |
| DC18 | R4-4、R7、Unresolved External distribution boundary |
| DC19 | R4-8/10、R16 |
| DC20 | R9-6〜8、R13-2 |
| DC21 | R9-5/7〜8、R13、R14-5/7 |
| DC22 | R4、Unresolved IS4 |
