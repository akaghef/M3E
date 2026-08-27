# Requirements Document

## Project Description (Input)

**agent-orrery-map** — Agent Orrery を M3E の map data として扱うための requirements draft

**(a) 誰の課題か**

M3E を使って複数の agent、Role/Contract、Goal Graph、runtime observation を同じ文脈で理解する Akaghef / M3E Director / Codex worker の課題である。現在の prototype は agent の一覧・状態・メッセージ・関係を一つの runtime projection として扱っているが、session の重複、source attribution、state の混同、個人情報境界、human-authored node の保護が未確定である。

**(b) 現状**

Agent Orrery は独立した Surface View ではなく、M3E map に投影される Agent-oriented data である。prototype で確認できる raw state は `starting`、`thinking`、`tool-running`、`awaiting-user`、`blocked`、`idle`、`completed`、`failed`、`disconnected` の9種であり、描画上は `actorName`、state ring、`sessionTitle` または task chip、`lastActiveAt` との差分、`avatarIndex` による画像選択を使っている。一方、prototype の UI state には別の語彙があり、経過時間から `gone` などを導出している。

runtime の実データでは、Claude/Codex/Hermes の session records、Hermes の親子 session 情報、Codex の thread spawn edge、Claude の `isSidechain` / 親子情報、JSONL の cwd / gitBranch、Hermes message の session_id が観測可能である。agmsg の message DB は `session_id` を持たず、現行の team DB の message rows でも `thread` / `message_id` は確定的な対応付けに使えない。したがって、agmsg message から session を推測してはならない。

**(c) 変えたいこと**

M3E の既存 map / scope / node / edge / GraphLink 契約上に、Role/Contract、Actor Instance、Telemetry を混同しない Agent mapping requirements を定義する。初期製品は read-only とし、現在観測できる事実だけから一本化した lifecycle state、typed edge、Attention Routing、day-1 provenance、lineage-aware dedup を成立させる。agent 固有の描画規則は generic viewer に埋め込まず、後に抽出可能な data-driven な境界として定義する。

## Boundary Context

- **In scope**: Agent Orrery map data の意味、Role/Contract と Actor Instance の分離、Goal Graph の同居、static / live / replay の扱い、観測可能な state、agent node の表示要素、agmsg/A-sys 境界、未配置観測の受け皿、provenance、typed edge、Attention Routing、lineage-aware dedup、human-authored node の保護、read-only の受け入れ条件。
- **Out of scope**: plugin kernel/API の実装、runtime command や L1〜L4 intervention、trace の保存・保持期間、ports / anchors、WebGL 前提の LOD、Surface View / layout / port 契約の変更、GOA 側の語彙定義、prototype code の移植、agmsg の配送・既読・監視 API の実行。
- **Binding sources**:
  - `ADR_011_Agent_Orrery_As_M3E_Map.md` — D1〜D16 と O1〜O14 の正本
  - `260808_agent_mapping_plugin_boundary.md` — scope と realization の境界思想
  - `ADR_009_Orchestration_Fusion_Into_M3E.md`
  - `ADR_010_Radial_Surface_View_Removal.md`
  - `docs/protocols/repository-canon-values.md`
  - `.kiro/steering/ui_view_taxonomy_and_ports.md`
  - `docs/03_Spec/Data_Model.md`、`docs/03_Spec/Scope_and_Alias.md`
  - `docs/03_Spec/Import_Export.md`、`docs/04_Architecture/Pipeline_UI_Reference.md`
- **Surface contract rule**: Surface View は `Tree` / `Axial` / `Disperse` / `System` の4種を維持し、既定の見え方は `Disperse` force とする。この requirements は Surface View、layout、port、anchor を追加・変更しない。
- **Ownership rule**: durable な map semantics は M3E が所有し、runtime records、agmsg transport records、外部ログは正本として複製しない。Agent mapping は external runtime の read-side projection である。
- **Read-only rule**: initial release は agent runtime を操作せず、観測元に書き込まず、human-authored map content を変更しない。observer-owned projection の新規観測記録だけは未配置受け皿に表現できるが、既存 node の mutation として扱わない。

## Product and Operations Context

- **Relevant product vision**: M3E は `workspace > map > scope > node` を共有 substrate として、human と AI の planning、handoff、review、runtime observation を同じ意味境界で扱う local-first knowledge base である。
- **Active development target**: `beta/`。
- **Active focus**: S2 Team Collaboration、S3 save/sync/recovery reliability、S13 local-first independence。Agent Orrery はこれらの data-safe な観測・handoff・attention 表示に接続するが、AI proposal や runtime intervention を追加しない。
- **Terms that bind this spec**:
  - `scope` は cognition / edit boundary であり、Role の意味そのものではない。
  - `edge` は親子構造、`GraphLink` は非木構造の typed relation である。
  - `Authoring Map` は永続的な map 正本、`Telemetry` は ephemeral observation、`Trace Store` は map node ではない。
  - `Contract Tree` は system node 内の契約表現であり、`callable-ref` は実行先の binding であって runtime 実装の記述ではない。
- **Evidence baseline**: prototype の registry では raw session record と logical lineage が分離されておらず、ADR-011 の実データ確認では7 family / 22 files が registry 上19 IDとなり、logical family 換算で12件の余剰が出ている。prototype の live HTTP endpoint はこの draft の確認時点では起動していなかったため、フィールド定義と状態・dedup の根拠は読み取り済みの source / registry / trace / runtime DB / agmsg DB と ADR の観測値に限定する。

## Requirements

### Requirement 1: Agent Orrery map の意味境界

**Objective:** Agent Orrery を新しい Surface View や独立した runtime database ではなく、M3E map 上の data projection として扱う。

#### Acceptance Criteria

1. The system shall represent Agent Orrery within an M3E map while preserving the four canonical Surface Views `Tree`, `Axial`, `Disperse`, and `System`.
2. When no explicit Surface View is selected, the system shall present the Agent Orrery projection through the existing `Disperse` force interpretation.
3. The system shall keep persistent Role/Contract and Goal Graph nodes in the Authoring Map, runtime Actor Instance information in a runtime projection, and Telemetry outside canonical map semantics.
4. When a map node has no corresponding agent, the system shall allow that node to remain as an inner Goal Graph node in the same map.
5. The system shall not require a plugin kernel, a new Surface View, a port/anchor contract, or WebGL LOD behavior for this requirements slice.

### Requirement 2: Role/Contract と Actor Instance の分離

**Objective:** Role/Contract、runtime agent、session を別の意味単位として扱い、Role の binding に runtime provider の実装知識を混ぜない。

#### Acceptance Criteria

1. The system shall represent a Role/Contract as an M3E entity node in the Authoring Map, not as a `scope`.
2. The system shall use `scope` only as the existing cognition / edit boundary and shall not use a Role name, team name, or project name as a scope by implication.
3. The system shall represent a Role binding through a callable reference such as `hermes://`, `codex://`, or `exec://` without requiring the Role to know the runtime implementation details.
4. The system shall keep Role CRUD and Actor CRUD as separate conceptual operations even while the initial release exposes neither as a mutation operation.
5. The system shall not treat an agmsg destination agent as a Role, a team as a project, or a runtime session as a Role.
6. If an Actor Instance cannot be mapped to a Role by an explicit M3E binding, the system shall retain the Actor Instance as an unbound runtime entity instead of creating an inferred Role.

### Requirement 3: M3E lifecycle state vocabulary

**Objective:** prototype の raw state を出発点に、観測できる事実だけで M3E の lifecycle state を一本化する。agmsg の delivery state と lifecycle state は混ぜない。

| M3E state | その state になる観測事実 |
|---|---|
| `starting` | session discovery または明示的な `session.started` / start state があり、実行開始後の turn / tool / terminal outcome がまだ観測されていない。 |
| `thinking` | 明示的な `turn.started`、reasoning-active event、または source が `state.changed` で thinking を報告している。 |
| `tool-running` | 明示的な `tool.started` があり、対応する `tool.completed` または terminal outcome がまだ観測されていない。 |
| `awaiting-user` | `approval.requested`、または人間の入力・選択を要求する構造化イベントが未解決で観測されている。 |
| `blocked` | `task.blocked`、または runtime が dependency / operational block を明示的に報告している。ただし人間の判断要求を含むことは別途 Attention として扱う。 |
| `idle` | `turn.completed` または runtime ready / waiting event があり、terminal outcome ではなく、source がなお観測可能である。 |
| `completed` | 成功した `session.ended`、`task.completed`、または成功終了 outcome が明示的に観測されている。 |
| `failed` | `session.failed`、失敗終了 outcome、または失敗を明示する terminal event が観測されている。 |
| `disconnected` | channel / runtime の disconnect が明示的に観測され、正常終了または失敗終了の確定 evidence がない。 |
| `unobservable` | source が unavailable、permission denied、corrupt、parse不能、または observation backend が読めず、正常終了・失敗終了・切断を確定できない。 |

#### Acceptance Criteria

1. The system shall expose exactly the ten M3E lifecycle states listed above as the initial Agent Orrery state vocabulary.
2. When a source-specific raw state is observed, the system shall map it to one M3E lifecycle state or retain the last explicit M3E state; it shall not create a second provider-specific lifecycle vocabulary.
3. While a source remains readable but produces no new event, the system shall retain the last explicit lifecycle state and shall not derive a new state from elapsed time alone.
4. The system shall keep `completed`, `unobservable`, and `disconnected` distinct, and shall retain the corresponding node or Actor Instance in the map projection in all three cases.
5. The system shall not use `speaking`, `listening`, `negotiating`, `standby`, `waiting`, `gone`, `retired`, or `error` as additional M3E lifecycle states.
6. The system shall keep agmsg transport states such as `queued`, `delivered`, `read`, `handled`, and `failed` in a transport namespace and shall not use them as lifecycle state.
7. If only an age, file mtime, unread flag, or missing event is observed, the system shall not claim `completed`, `failed`, `disconnected`, or `awaiting-user` without the corresponding explicit evidence.

### Requirement 4: Agent node の data-driven な描画要素

**Objective:** prototype で実際に使われている情報を、Agent 固有語彙を viewer に埋め込まない node presentation として定義する。

#### Acceptance Criteria

1. The system shall provide an Agent node presentation containing a safe display form of `actorName`, the canonical M3E state, an elapsed-time indication derived from `lastActiveAt`, and one compact context label from `sessionTitle` or `taskChip` when the value is allowed by the data boundary.
2. The system shall select an avatar deterministically from `avatarIndex` or a stable identity fallback, and shall use a stable placeholder when no approved image is available.
3. When Attention is active for an Agent or its explicitly resolved owner, the system shall provide a visible attention indicator without converting Attention into a lifecycle state.
4. The system shall keep raw `latestMessage` and message body out of the compact Agent node presentation; approved detail inspection is governed by Requirement 7.
5. The system shall expose the Agent node presentation as typed, data-driven content that a generic viewer can render without branching on `actorName`, provider raw state, `avatarIndex`, or agent-specific attention vocabulary.
6. When the elapsed time since `lastActiveAt` increases, the system shall update the age indication without changing the lifecycle state unless new observation evidence changes that state.
7. The system shall not require changes to existing Surface View, layout, port, or anchor contracts to render these elements.

### Requirement 5: Static projection、live observation、replay

**Objective:** prototype の MAP TIME 相当の時間操作を、Authoring Map、current observation、historical replay の意味が混ざらない製品機能として扱う。

#### Acceptance Criteria

1. The system shall treat static projection as the stable view of Role/Contract, Goal Graph, explicit map relations, and provenance in the Authoring Map.
2. The system shall treat live observation as an ephemeral read-side overlay of currently observed Actor Instance, lifecycle state, attention, and telemetry freshness.
3. The system shall observe M3E-owned session sources through change detection and shall not use periodic polling as M3E's session observation mechanism; polling internal to agmsg remains outside this requirement.
4. When an event package is available, the system shall offer replay as a read-only historical projection over that package and shall not rewrite the Authoring Map, current lifecycle state, or provenance.
5. If no replay event package is available, the system shall disable or clearly mark replay as unavailable instead of inventing historical state from current timestamps.
6. The system shall treat MAP TIME or an equivalent time cursor as a projection control and shall not introduce it as a fifth Surface View.
7. The system shall not require trace persistence or retention policy as part of this requirements slice.

### Requirement 6: agmsg message から送信主体 session への解決

**Objective:** session_id を持たない agmsg message DB から、根拠のない session attribution を作らない。

#### Acceptance Criteria

1. The system shall treat an agmsg message as transport evidence with an agmsg realm/team/agent endpoint and shall not treat that endpoint as a runtime session.
2. If a runtime sidecar supplies an explicit, immutable correlation from an agmsg message identifier to a session identifier, the system shall use that correlation only when the source and correlation evidence are both present.
3. If the sidecar supplies only an advisory latest-session association such as `(team, agent) -> latest session`, the system shall leave the message unassigned to a session and shall not guess from recency, thread, filename, or unread state.
4. The system shall treat the current agmsg message DB shape, which has no `session_id` and does not provide a complete message-to-session correlation, as insufficient for session resolution.
5. When session resolution is unavailable, the system shall preserve transport-level sender, recipient, team, thread value, delivery state, and observed time where allowed, but shall not create a session-specific conversation edge, latest-message attribution, message count, lineage link, or session-specific Attention association.
6. The system shall make the loss of session-level attribution explicit in the observation quality or detail view instead of presenting the unassigned message as if it belonged to a session.

### Requirement 7: A-sys から M3E へ公開する対話・メモ・状態属性

**Objective:** A-sys の `private.raw` / `private.derived` を M3E map に漏らさず、公開可能な contract と redacted administration の allowlist だけを投影する。

#### Acceptance Criteria

1. The system shall accept only fields explicitly classified as `public.contract` or `admin.redacted` for the initial A-sys-to-M3E projection.
2. The system shall allow opaque stable identifiers, runtime kind, canonical M3E lifecycle state, observation quality, observed time, aggregate counts, transport metadata, provenance, and categorical Attention reason when each value passes the applicable allowlist.
3. The system shall not expose raw dialogue body, raw memo/note body, unredacted title, unredacted snippet, email address, absolute personal path, filename, source URL, channel name, credential pattern, or other private raw content in the initial M3E map projection.
4. The system shall not expose prototype `latestMessage` as a public map field; a future text projection shall require a separate explicit public contract and is not part of this requirements slice.
5. When a redacted summary is not explicitly supplied by an approved contract, the system shall expose a content-free presence, count, category, or fingerprint rather than deriving a summary from raw content.
6. The system shall keep A-sys administrative state content-free in the same way as its fixed admin manifest and shall not mirror A-sys inbox, note, or personal identity data into M3E.
7. The system shall namespace any agmsg delivery attribute as transport metadata and shall not present `read` or `handled` as proof of lifecycle completion or human Attention resolution.

### Requirement 8: 未配置観測の受け皿と project placement

**Objective:** D10 の未配置受け皿を明示し、cwd / gitBranch などの手がかりを機械的 project placement に昇格させない。

#### Acceptance Criteria

1. The system shall provide one dedicated, visible, system-managed `Unplaced Observations` folder/scope as the receiver for an observed Actor Instance whose project placement is unresolved.
2. The system shall keep each unresolved Actor Instance under that receiver and shall not attach it directly to the map root, an arbitrary project node, a Role node, or a Goal node.
3. The system shall preserve cwd, gitBranch, worktree, or similar hints as observation evidence only and shall not use any one hint as an automatic placement rule.
4. When an Agent or a human explicitly decides the project placement, the system shall represent that decision as an explicit M3E map fact or relation and shall preserve the original observation provenance.
5. If the dedicated receiver is unavailable, the system shall keep the observation unplaced and visibly unresolved rather than silently placing it elsewhere.
6. The system shall not use the receiver folder/scope as a Role, project, team, or lifecycle state.

### Requirement 9: day-1 provenance

**Objective:** human-authored node と observer-owned node が混在しても creator と source を判別できるようにする。

#### Acceptance Criteria

1. The system shall store day-1 provenance in `TreeNode.attributes["m3e:provenance"]`, using the existing attribute namespace and string-valued node attribute contract.
2. The system shall encode the provenance value as a versioned record with the following fields and controlled values:

   ```text
   version: 1
   origin: human-authored | observed-runtime | observed-transport | derived-projection
   source: manual | claude-jsonl | codex-rollout | hermes-session | agmsg-read | a-sys-contract | m3e-projection
   sourceId: opaque stable identifier | null
   observedAt: ISO-8601 timestamp | null
   ```

3. The system shall require `origin = human-authored` and `source = manual` for newly authored human nodes, `observedAt = null` unless an observation time is intentionally recorded, and shall not require a personal author identity.
4. The system shall require a non-null `sourceId` and `observedAt` for observed runtime or transport records unless the source contract explicitly declares the value unavailable; such unavailability shall be visible as reduced observation quality.
5. The system shall store `sourceId` as an opaque stable identifier and shall not store an absolute path, raw message body, credential, or other private source locator in provenance.
6. When the observer encounters a human-authored node, the system shall preserve its provenance, text, details, note, attributes, parent, children, and relations without overwriting or normalizing them into runtime fields.
7. The system shall preserve provenance across static, live, and replay projections and shall not claim that replay-created display state was authored by a human.
8. If a pre-existing node lacks provenance, the system shall preserve it as-is and mark provenance as unresolved for review rather than guessing that the node was observed or human-authored.

### Requirement 10: 初期 typed edge 語彙と projection

**Objective:** D14 に従って edge type を day-1 から持たせ、実際に evidence がある最小集合だけを projection する。

| edge type | 作成を許す evidence |
|---|---|
| `conversation` | message observation が source と target endpoint を確定できる。session-level は Requirement 6 の session correlation がある場合だけ許す。 |
| `attention` | 人間の判断・入力・選択を求める未解決 request と、対象 endpoint または owner が明示されている。 |
| `assignment` | M3E map 上で明示的に受理された Role/Actor と project または Goal の binding がある。cwd、gitBranch、team membership、message delivery から推測しない。 |

#### Acceptance Criteria

1. The system shall represent the three initial semantic edge types `conversation`, `attention`, and `assignment` through the existing non-tree `GraphLink.relationType` concept.
2. The system shall keep parent-child ownership as the existing tree `edge` and shall not encode it as one of the three semantic GraphLink types.
3. When no evidence satisfies an edge type's condition, the system shall omit that edge rather than create a speculative relation.
4. The system shall not include `handoff`, `spawn`, `depends-on`, `reviewing`, `conflicts-with`, or a provider-specific relation in the initial vocabulary unless a separately accepted evidence contract is supplied.
5. The system shall allow a projection to select one edge type or a declared subset and shall not display all semantic edges by default.
6. The system shall keep typed-edge projection independent of port and anchor selection and shall not require any port contract change.
7. The system shall not treat agmsg delivery state, unread state, or `handled_at` as a semantic edge type.

### Requirement 11: Attention Routing

**Objective:** agent list を中心にせず、人間の判断が必要な未解決 request だけを前景化する。

#### Acceptance Criteria

1. The system shall mark Attention active only when an explicit evidence record requests human approval, input, choice, or a human decision and the request remains unresolved.
2. The system shall accept `approval.requested`, an explicit human-input/choice request, or a `task.blocked` record with an explicit human-decision reason as Attention evidence.
3. The system shall not mark Attention active from `unread`, `read_at` absence, `handled_at` absence, `queued`, `delivered`, elapsed age, generic `blocked`, or generic `awaiting-user` without human-request evidence.
4. When a matching approval, rejection, input, choice, cancellation, request-completed event, or explicit runtime resolution is observed, the system shall clear the corresponding Attention.
5. The system shall not clear Attention merely because a message was read, marked handled, or delivered.
6. If the request-to-session correlation is unavailable, the system shall attach Attention to the best explicitly identified Role, Agent endpoint, or unassigned receiver and shall not invent a session owner.
7. The system shall expose active Attention as the highest-priority projection axis for foreground routing while keeping it separate from lifecycle state and delivery state.
8. The system shall keep self-running agents visually subordinate to active human Attention unless the user explicitly focuses another projection.

### Requirement 12: observation layer の lineage-aware dedup

**Objective:** prototype の file-count overcount、first-ID-only parse、lineage 無視、unlink/prune 不在を再発させず、session evidence と logical Actor Instance を分ける。

#### Acceptance Criteria

1. The system shall treat a file, database row group, or sidecar artifact as an observation source and shall not count the artifact itself as a session or Actor Instance.
2. When one JSONL file contains multiple session IDs over time, the system shall process each observed session segment and shall not use only the first session ID for the entire file.
3. The system shall keep raw session identity, logical lineage identity, and displayed Actor Instance identity as separate concepts.
4. When fork/clone/resume lineage evidence is present, the system shall deduplicate records into the corresponding logical Actor Instance while retaining the raw session evidence as provenance.
5. The system shall use available `agentId`, `isSidechain` / sidechain, parent session/thread, child session/thread, and spawn-edge evidence when determining lineage; when such evidence is absent, the system shall preserve the relation as unknown and shall not fabricate a parent or merge.
6. For the ADR-011 fixture of 7 logical families across 22 files and 19 raw registry IDs, the system shall produce 7 logical Actor Instance representations, retain the 19 raw IDs as observation evidence, and shall not draw the 12 lineage duplicates as 12 additional logical actors.
7. When a source file or source record disappears, the system shall unlink it from the active observation index without deleting the logical Actor Instance, and shall mark the remaining node `unobservable` or `disconnected` only when the corresponding evidence exists.
8. The system shall not leave a stale file identity, legacy pseudo-record, or duplicate visible node after an unlink/prune operation has been observed.
9. When the same source event is read again, the system shall produce an idempotent observation and shall not increment session, message, or logical Actor counts twice.
10. The system shall use a stable event identity that distinguishes source and raw identifier namespaces and shall not merge unrelated providers merely because their raw IDs have the same text.
11. The system shall apply visibility or focus filters to the projection only after identity and lineage deduplication, so that filtering cannot hide a duplicate as if it were a distinct Actor.

### Requirement 13: human-authored node の保護

**Objective:** observer が人の書いた map structure/content を壊さず、provenance による所有境界を実際に検証可能にする。

#### Acceptance Criteria

1. The system shall treat a node with `origin = human-authored` as outside the observer's mutation authority.
2. The system shall not overwrite, delete, reparent, rename, prune, or replace a human-authored node while observing runtime or transport sources.
3. When an observed identifier collides with a human-authored node identifier, the system shall allocate or retain a separate observer-owned identity and shall not merge the records by label, title, cwd, or raw source ID.
4. The system shall preserve the human node's `text`, `details`, `note`, user attributes, parent/children order, and existing GraphLinks byte-for-byte or semantically equivalently when an observation pass runs.
5. The system shall create observer-owned records with non-human provenance and shall make the owner distinction inspectable in the node data or detail view.
6. When a human node has incomplete provenance, the system shall protect it from observer mutation and shall surface the missing provenance as an unresolved data-quality condition.

### Requirement 14: read-only observation and agmsg boundary

**Objective:** initial Agent Orrery を観測専用にし、D16-5 の read-side effect を含めて検証可能にする。

#### Acceptance Criteria

1. The system shall read agmsg state through a read-only database boundary and shall not use the agmsg `inbox`, `watch`, or `check-inbox` commands or equivalent delivery/read APIs.
2. The system shall not write agmsg messages, delivery status, `read_at`, `handled_at`, read cursors, `message_read` events, roster, membership, address, watcher, lock, spawn, or despawn state.
3. The system shall not send, interrupt, terminate, resume, approve, or otherwise control an external runtime from the initial Agent Orrery projection.
4. The system shall not write to Claude/Codex/Hermes source logs or databases; any private observation cursor shall be M3E-owned metadata and shall not alter the source record.
5. The system shall not use a map command to mutate Role, Actor, human-authored node, or Goal Graph content during live observation or replay.
6. When an observation pass ends, the system shall show unchanged agmsg message rows, delivery/read fields, cursor/read-event records, and source runtime records when compared with the pre-observation read-only snapshot.
7. When an observation pass ends, the system shall show unchanged human-authored node fields and relations, with any newly visible observer-owned projection isolated under the declared provenance and receiver rules.
8. The system shall make the absence of write/control operations auditable without relying on a successful delivery API call or a GUI claim.
9. The system shall distinguish local submission, receipt, processing start, and completion evidence when such delivery concepts are displayed, and shall not label local observation as completed work.

### Requirement 15: generic viewer boundary and future extraction seam

**Objective:** D1 の AC1〜AC5 を後から抽出できるようにしつつ、今回 plugin kernel を作らない。

#### Acceptance Criteria

1. The system shall express Agent-specific node content, state presentation, attention marker, provenance detail, and typed-edge projection as separable data contracts rather than viewer literals.
2. The system shall keep the generic viewer responsible for existing map primitives and Surface View rendering, while Agent mapping supplies data that conforms to those primitives.
3. The system shall not require the viewer to import, know, or interpret agmsg addresses, runtime provider raw states, sidecar file names, A-sys private fields, or lineage parser details.
4. The system shall preserve a separable boundary for future extraction of Agent mapping realization without introducing a plugin registration kernel or generalized plugin lifecycle in this slice.
5. The system shall reject an implementation claim as requirements-complete if Agent semantics are only present as hard-coded branches in the generic viewer or if the required data boundary cannot be tested independently.

## Unresolved Items

The following items are intentionally not converted into implementation requirements because the current evidence or the frozen contracts do not settle them:

- **O5**: runtime sidecar が message identifier と session identifier を明示的に相関させる将来 contract の形式。現時点の advisory latest-session 情報だけでは解決しない方針を採る。
- **O6**: 将来、明示的な public contract を承認した上で redacted dialogue excerpt / memo summary を公開するかどうか。初期要求は raw body / raw memo を公開しない。
- **O8 / D9**: replay 用 trace の durable storage、保持期間、履歴の完全性。replay は event package が存在する場合の read-only projection に限定する。
- **O9 / D10**: `Unplaced Observations` receiver の永続 ID、表示名のローカライズ、agent または人間が placement decision を確定する UX。機械的 placement rule は作らない。
- **O10**: 既存 node の provenance 欠落を埋める migration と、既存 import/export 形式で `m3e:provenance` をどこまで往復させるか。day-1 の保存位置と語彙だけを確定した。
- **O11**: Role と project / Goal の明示的 assignment fact を、既存 map 上で誰がいつ承認するか。Role 自体は node として確定し、scope ではない。
- **O13**: `assignment` を作る M3E-side evidence contract の詳細、および `handoff`、`spawn`、`depends-on`、`reviewing`、`conflicts-with` を追加する将来の evidence 契約。初期の runtime relation data には evidence がないため要求しない。
- **O14**: attention request の correlation key と、解消を示す provider-independent structured event の最終 schema。read/handled だけでは解除しない。
- **D1**: plugin kernel を将来抽出する際の登録 API、package boundary、versioning。今回の要求は data-driven seam の存在だけを求める。
- **Surface / layout / port**: Agent node の具体的な画面密度、edge routing、port/anchor 表現は既存契約に委ねる。変更が必要になった場合はこの spec の要件ではなく別の未解決事項として扱う。

## Traceability Notes

この draft は ADR-011 の D1〜D16 を次の requirements に対応づける。

| ADR-011 | 対応 requirements |
|---|---|
| D1 | R1-5、R4-5、R15 |
| D2 | R1-1〜5、R4-7、R10-6 |
| D3 | R1-3、R2、R5-1〜3、R9 |
| D4 | Boundary Read-only rule、R2-4、R13、R14 |
| D5 | R3-4、R12-7、R14-6 |
| D6 | R1-4、R8 |
| D7 | R5-3、R14-4 |
| D8 | R9、R13 |
| D9 | Boundary Out of scope、R5-4〜7、Unresolved O8/D9 |
| D10 | R8、Unresolved O9/D10 |
| D11 | R3 |
| D12 | Boundary Ownership rule、R1、R5、R14、R15 |
| D13 | R4-3、R11 |
| D14 | R10 |
| D15 | R1-4、R2、Unresolved O13 |
| D16 | R2-5、R3-6、R6、R7、R10-7、R11-3/5、R14 |
