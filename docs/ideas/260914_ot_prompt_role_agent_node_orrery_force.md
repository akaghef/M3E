# OT prompt-roleとAgent nodeを先行吸収する実行設計

> Status: idea / implementation-direction memo。Role canonの完成仕様ではない。
> Date: 2026-09-14
> Target: 外部OT [`gyroid-eth/orrery-telemetry`](https://github.com/gyroid-eth/orrery-telemetry)。Akaghef自作のprototypeは対象外。

## Why

M3Eは長期的に、`Role / Contract = canon`、`Actor Instance = runtime`、`Telemetry = ephemeral`という三層を目指す。一方、現時点ではRoleに紐づく厳密なskill bundle、capability、authority、input/output contract、version管理を実行へ反映する仕組みが未整備である。

この不足を先に独自実装すると、実運転に先行して抽象的なRole systemを作り込むことになる。外部OTはすでに、delegation時の短い`role`、具体的な`task`、関連Agentの`group`を分離し、`## Role: <role>`を起動promptへ埋め込み、同じrole labelをdashboard annotationとして表示する経路を持つ。

したがって最初のvertical sliceでは、OTのprompt-level roleを**execution adapter**として利用する。これはOT role labelをM3Eの意味canonへ昇格させる判断ではない。現在ある機構でAgentの挙動を調整し、実需から将来のRole / Contractに必要なfieldを発見するための暫定実装である。

この方針は、外部OTの完成したAgent運転を再発明せず利用するS17と、Akaghefの注意をUI破綻の修復へ費やさないという制約に従う。

## Decisions

### DA1. `agent`をM3EのNodeTypeへ追加する

現行のnode typeは次である。

```ts
NodeType = "text" | "image" | "folder" | "alias";
```

ここへ`"agent"`を追加する。`agent`は意味の型であり、特定viewやlayout engineの名前ではない。

```ts
NodeType = "text" | "image" | "folder" | "alias" | "agent";
```

本memoの最初のmockは外部OTが観測した**AI AgentのActor Instance**を丸い`agent` nodeとして扱う。M3E全体における`agent = AI agent ∪ human`という不変条件は維持する。human対応を否定するものではなく、OT connectorから得られる最初の観測対象を限定するだけである。

### DA2. `agent` nodeの初期描画はOT由来の丸いvisual grammarを使う

最初の描画は、円、Agent名、短いrole chip、最小限のruntime stateとする。丸は`agent`というnode typeの形状識別に使う。

ただしOT dashboardのSVG DOM、CSS、portrait、comet、font計測、animation、z-order処理をM3Eへ移植しない。M3Eのnode seam / rendererの語彙で、OTの丸いvisual grammarを再表現する。

初回に含めるもの:

- 円形node
- Agent名
- prompt-level roleのchip
- 稼働・待機・介入要求を示す最小状態
- hover / selectedの境界

初回に含めないもの:

- portrait asset
- context残量arc
- provider logo
- mail comet
- murmur吹き出し
- OT dashboard themeの再現

### DA3. `Disperse / Force / Orrery`を追加する

`agent` node typeとlayoutは別軸である。Agentだけでなく、text、folder、alias、Task、Goal、Resource等が混在する同一graphへOrrery由来の力学を適用できるようにする。

ユーザーに見える選択名は次とする。

```text
Disperse / Force / Orrery
```

内部契約は、現行の`scatter | cluster | force`を壊さないよう、`force` subtypeのprofile / engineとして`orrery`を分離できる形を優先する。

```text
view: Disperse
subtype: Force
force profile: Orrery
```

Orrery profileが借りるもの:

- node間斥力
- relation別spring（communicationとspawnを同一にしない）
- 中心引力
- dampingと速度制限
- graph変更時だけのreheating
- 同一Actor Instanceの位置継承

M3Eが所有し続けるもの:

- node type別の実測box / footprint
- 矩形collision
- scope / group containment
- collapsed node footprint
- pinned position
- `LayoutResult`
- M3E rendererとviewport transform

OTのviewport端へのclamp、SVG描画、dashboard固有animationは取り込まない。

### DA4. OT roleは当面prompt-level execution adapterとして使う

外部OTの`role`は、`review`、`tests`、`api-migrate`等の短いtask-local labelである。`task`本文と分離され、launcherが次の形でpromptへ埋め込む。

```markdown
## Role: <role>
## Task summary: <task summary>
```

この機構をM3E側から選択・表示できるようにする。最初の段階で独自skill bundle systemは作らない。

暫定fieldは意味canonではなくexecution input / runtime observationとして隔離する。

```text
promptRoleLabel       OTへ渡す短いrole label
promptRoleInstructions 任意のprompt断片
observedRoleLabel     OTから観測したannotation
observedTaskSummary   OTから観測したtask summary
runtimeAgentId        OTのruntime identity
```

同じ文字列だから同じRole entityである、という判定はしない。`review`等の文字列をauthorization、capability判定、色のglobal意味、Role identityに使用しない。

### DA5. M3E Role / Contract canonは廃止せず、後から昇格可能にする

将来は次へ拡張できる。

```text
Role node / Contract canon
        │ assigned-role
        ▼
Agent node / Actor Instance
        │ runtime binding
        ▼
OT runtime identity
```

昇格時には`roleRef`を追加し、prompt-level roleからcanonical Roleへのbindingを人間が確認する。connectorは候補を提案できるが、確定済みRole canonを上書きしない。

当面のOT roleは、Role canonの代替正本ではなく、その実行面を先行させるadapterである。

### DA6. field ownershipを分離する

| Field | Owner | 性質 |
|---|---|---|
| `promptRoleLabel` | M3E command / human | OT起動時のexecution input |
| `promptRoleInstructions` | M3E command / human | 任意のprompt-level調整 |
| `runtimeAgentId` | OT connector | runtime identity |
| `observedRoleLabel` | OT connector | runtime annotation |
| `observedTaskSummary` | OT connector | runtime observation |
| lifecycle / last activity | OT connector | runtime observation |
| `roleRef`（将来） | M3E / human | canonical Role参照 |
| Roleの責任・契約（将来） | M3E / human | canon |

Telemetryをcanonical node fieldへ固定せず、runtime overlayとして更新する。prompt inputと観測結果も同じfieldへ混ぜない。

## Mock strategy

### MA1. 本体viewerへ直接追加しない

最初のmockは既存Node Lab / Layout Lab相当の隔離環境で作る。M3E本体のDisperse、renderer selection、production viewer state、live user dataには接続しない。

### MA2. fixtureだけを使う

live OT APIへ直接接続せず、sanitized fixtureで次を表す。

- AI Agent Actor Instance
- text / folder / alias / imageとの混在
- prompt-level role chip
- working / waiting / attention / finished
- communication / spawn relation
- `Disperse / Force / Orrery`選択表示

これにより、adapter問題と描画問題を分離する。

### MA3. 最初のmockは静的な座標でもよい

第一段階はnode type境界の確認を目的とする。Orrery forceの完全実装やlive animationを先に入れない。

証明するもの:

- `agent`が丸として他node typeと明確に区別できる
- Agent名とrole chipが破綻しない
- 通常nodeの既存描画へ影響しない
- role、task、runtime stateを一つの意味へ潰さない
- `Disperse / Force / Orrery`がnode typeとは別軸だと画面上で理解できる

### MA4. 本体への昇格gate

mockからproductionへ進める条件:

- `agent`がないmapの描画差分がない
- rendererがOT raw payloadを直接知らない
- layoutがnode typeの見た目を直接描かない
- node seamが返すfootprintをlayoutが利用できる
- OT切断時も通常mapが動作する
- pollごとに全nodeを作り直さない
- node / edge / panel / temporal overlayの責任が分離される

## Alignment with the farthest goal

- **RQ1**: Agentを別dashboardへ隔離せず、仕事を記述する同一graphへ載せる。
- **RQ2**: 最初はOT観測可能なAI Agentに限定するが、`agent` node typeはhumanを排除しない。
- **RQ3**: Actor Instanceとruntime stateはOT connectorの観測を根拠にする。prompt roleを観測事実と混ぜない。
- **RQ4**: OT role / Actor Instance / TelemetryをRole canonへ昇格させない。
- **RQ5**: 最終的には通常のM3E map / Disperse上で指示と観測を扱う。labは昇格前の隔離試験であり新しいproduction面ではない。
- **RQ6**: 目的はdashboardの装飾ではなく、Agent・Task・attentionを一枚で判断できること。UI修復負債を増やす機能は初回から除外する。

## Open questions

### Q1. prompt roleの入力面

M3EのどのCommandが`promptRoleLabel`と`promptRoleInstructions`を持ち、OTの`/delegate` / launcherへ渡すか。

### Q2. Role昇格の契機

同じprompt roleが何度再利用されたらcanonical Role候補を提案するか。頻度だけでなく、責任・capability・acceptance contractの安定性をどう判定するか。

### Q3. Orrery forceの適用対象

全nodeへ同じforceを適用するか、AgentとTaskを主に動かし、Goal / Resource / Scopeはanchor性を高めるか。

### Q4. runtime overlayの寿命

OT Actor Instance終了後、Agent nodeを即時非表示にするか、finished状態として一定期間残すか。history projectionとの境界をどうするか。

## Next action

既存Node Labを壊さない独立mockを作る。最小fixtureで、`text / image / folder / alias / agent`の区別、丸いAgent node、role chip、runtime state、`Disperse / Force / Orrery`の別軸を表示する。

mockではOT dashboard codeを移植せず、M3E nativeのHTML / SVG / CSSでvisual grammarだけを表現する。実装後にbuild、型検査、隔離したbrowser testを通し、production viewerへはまだ接続しない。

## Related

- [一枚絵としてのM3E](./260914_unified_work_graph_multi_pc_resource_ot.md)
- [最遠の目標](../../.kiro/steering/farthest_goal.md)
- [Agent Orrery用語](../../.kiro/steering/agent_orrery_terminology.md)
- [ADR_011: Agent OrreryをM3Eのmapとして実装する](../09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md)
- [ADR_012: Radial Surface Viewを復元し、Disperseを散在配置として分離する](../09_Decisions/ADR_012_Radial_Surface_View_Restoration.md)
- [gyroid-eth/orrery-telemetry](https://github.com/gyroid-eth/orrery-telemetry)
- `V2` 人間とAIが構造的に対話できる作業場
- `V3` 世界モデルから成果物へ射影するcycle
- `V5` Map-Driven Development
- `S17` OT合併吸収を主戦場にする
