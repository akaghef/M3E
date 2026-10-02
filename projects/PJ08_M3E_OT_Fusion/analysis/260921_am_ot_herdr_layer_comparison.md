---
pj_id: PJ08
kind: analysis
date: 2026-09-21
status: stowed
source: ChatGPT export "AM OT herdr比較検討"（2026-09-07 作成 / 2026-09-21 持込）
verified_by: fugu (Hermes) 2026-09-21
related:
  - ../plan.md
  - ../../../docs/09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md
  - ../../../.kiro/steering/agent_orrery_terminology.md
  - ../../../.kiro/steering/farthest_goal.md
  - ../reviews/IS4_herdr_terminal_lane_candidate.md
  - ../reviews/IS5_ot_license_public_boundary.md
---

# AM × OT × herdr レイヤー比較 — 外部 doc の取り込み分析

> **これは分析メモであって決定ではない。** 決定の正本は ADR / steering。
> 本メモは外部 doc を canon と照合し、(1) 既存決定の裏付け、(2) 新規判断点、
> (3) Phase 割り当てを整理するだけ。canon は書き換えない。

## 入力は何か

akaghef が持ち込んだ ChatGPT export。M3E 側実装（doc 中の `AM`）・OT
（`gyroid-eth/orrery-telemetry`）・herdr（`herdrdev/herdr`）を **18 領域 × レイヤー**で
比較し、各領域の所有者を1つに決める統一構成を推奨している。doc の要旨:

- 意味・Role・表示・attention → **M3E / AM** に統一。
- 協調（mail / reservation / identity / receipt）と当面の spawn/resume → **OT**。
- 端末実行層（terminal / process / native session）→ **herdr** を適合試験後の移行候補。
- Codex の構造化 lane（App Server）は端末入力へ格下げせず維持。
- 統一前に直すべき非互換は **identity / state / command 完了**の3点。

doc 自身が「Akaghef の PC 上のインストール版を実行した結果ではない、公開ソース照合」と
断っている。したがって本メモの役割は、doc の具体コード主張を**現時点の上流ソースで実地照合**し、
canon との整合を確定すること。

## 上流ソース実地照合（fugu, 2026-09-21）

`gh api` で upstream を直接読み、doc の主張を検証した。照合 commit は
OT `a9260cc28f6bb39cc47b7aac706920fce560a6c6`、herdr
`95e97bff3ac090ffc71bf24174ccc2449e97bcc6`（いずれも 2026-09-21 時点の `master`）。

| doc の主張 | 照合結果 | 出所 |
|---|---|---|
| OT に project ID `1` へ落ちる degrade 経路がある | **正しい**。`PROJECT_ID = 1` フォールバック、`human_key` 不一致時に degrade | `gyroid-eth/orrery-telemetry@master:dashboard/graph_data.py:86-91,242-255` |
| OT graph 集計が内部 ID で集計後、表示名で再集約する | **正しい**。source comment と `GROUP BY sa.name, ra.name, p.kind` を確認 | 同 `graph_data.py:358-381` |
| herdr の prompt 成功はターン完了でなく入力送信完了 | **正しい**。`blocked` なら `agent_blocked` で拒否、成功は submission。`AGENT_PROMPT_SUBMIT_DELAY=300ms`、Windows は paste burst 分岐 | `herdrdev/herdr@master:src/app/api/agents.rs:13-27,111-214` |
| OT は PolyForm、herdr は Apache-2.0 | **正しい**。OT LICENSE = PolyForm Perimeter 1.0.1（GitHub 判定 `NOASSERTION` = source-available）、herdr LICENSE = Apache-2.0 | 両 repo `LICENSE`、OT `README.md:196` |
| OT 対応環境は Mac + WSL2、native Windows 未正式対応 | **正しい**。native Windows は community 実験（PowerShell helper / Codex launcher）のみ | OT `README.md:150-152` |
| OT Mail は loopback 境界（`127.0.0.1`） | **正しい**。既定 endpoint `http://127.0.0.1:18765/mcp`、data は `~/.agentstack/mail` | OT `docs/agentstack-mail.md:13,75`、`graph_data.py:26` |
| herdr の blocked→idle 誤分類が screen manifest 学習依存 | doc 引用の趣旨と一致（未知 prompt は学習まで idle 表示） | herdr docs/agents（web 検索確認） |

**結論: doc の実装レベルの技術主張は、確認できた範囲でいずれも上流ソースと一致する。**
架空の引用ではない。これは設計判断の入力として信頼してよい。

## 既存 canon との照合 — doc は大半が「既存決定の外部独立裏付け」

doc の中核主張は、M3E がすでに持っている決定と同型である。**新規決定を要しない。**

| doc の主張 | 対応する M3E canon | 判定 |
|---|---|---|
| 名前（表示名）で identity を結合するな。Role / Actor / NativeSession / MailPrincipal / Runtime を別物として保持 | `ADR_011 DC3`（Role永続 / Actor runtime / Telemetry ephemeral）+ terminology 分離表（Role / Actor Instance / session / agmsg agent） | **一致**。doc の binding 台帳は terminology 規則6-7 の具体化 |
| resume は会話継続でありプロセス継続ではない。fork は別会話。過去 message は当時の binding から復元 | `ADR_011 DC3` の「resume/fork/並行で生じた複数 session を Actor 層でまとめる」+ 引き継ぎ禁止欠陥「1ファイル内 session ID 切替を最初のIDだけで処理」 | **一致** |
| 観測結果と意味的状態を分ける（lifecycle/activity/observability/attention の4軸 + source/evidenceKind/observedAt） | `ADR_011 DC11`（state 一本化）+ `DC13`（attention は最上位軸）+ `DC5`（終了と観測不能を分離）+ terminology 規則4-5 | **一致**。doc の4軸は DC11/DC13 の再表現 |
| paneが消えた→完了 等の推測禁止。画面由来 blocked を承認 gate に直結しない | `RQ3`（真偽の源泉が自己申告でない）+ terminology 規則5（attention を state に畳まない） | **一致** |
| command 完了 state（requested→accepted→submitted→observed-finished→verified）、通信断は unknown-outcome、無条件再送しない | M3E 側に**明示 canon なし**（近いのは Glossary の `Command` intent 定義）。ADR_011 は DC4 で初期 read-only、control は Open 扱い | **新規**（下記「Phase 3 契約素案」へ） |
| App Server 経路を端末入力へ格下げしない | `ADR_011 DC1`（`CodexAppServer` 経由で M3E 駆動、この経路を使う） | **一致** |
| field 単位所有権で観測由来と人記述を混ぜない | `ADR_011 DC21` + `farthest_goal RQ3`/拘束規則2 | **一致** |

## doc が新しく持ち込むもの — akaghef 判断が要る3点

canon に無い、または canon を触る主張だけを抽出した。

### IS4. herdr を「端末実行層」の第3統一候補として PJ08 に採るか → `reviews/IS4_herdr_terminal_lane_candidate.md`

現 canon（ADR_011 / farthest_goal）は observation 層として **OT（ORRERY Telemetry）**しか
想定していない。doc は「OT の tmux 依存部分を、適合試験後に herdr へ段階移行し、native Windows
端末を共通化する」第3候補を提案する。これは方向の追加であり、Director が単独で採れない
（farthest_goal 適用ルール: RQ の追加改訂は akaghef 判断）。**現段階では候補として記録するのみ。**

### IS5. 公開 M3E における OT の PolyForm ライセンス境界 → `reviews/IS5_ot_license_public_boundary.md`

OT = PolyForm Perimeter 1.0.1（source-available, 非 OSI）。doc は「個人 A-sys への採用」と
「公開 M3E への同梱・必須依存化」を分けるべきと指摘。`farthest_goal` の外部利用線（Swingby チーム、
将来の公開研究 DB）と直接ぶつかる論点。ADR_011 DC18 も「map を外部配布する経路を作る時点で再判断」と
既に留保している。**法的断定はしない。判断点として起票。**

### Phase 3 契約素案: binding 台帳 + command 完了 state machine

doc が提示する最小 binding 台帳:

```text
actorId / hostId / backend / incarnation /
nativeSessionRef / mailPrincipalRef / roleIds / validFrom / validTo
```

および command 完了 state machine（`requested → accepted → submitted → observed-finished →
verified`、通信断 = `unknown-outcome`、冪等性が無ければ commandId 付与だけで再送しない）。

これは ADR_011 の Open（IS5: agmsg endpoint を session に解決、IS13: edge type 語彙、
IS14: attention 検出/解除条件）に対する具体素案として**有用**。ただし Phase 3（connector seam 契約）
の入力であり、Phase 1 では採らない。**Phase 3 起動時に T-3-1 の設計材料として再読する。**

## Phase 割り当て（PJ08 plan.md の Phase 設計に対応）

| doc の要素 | PJ08 Phase | 扱い |
|---|---|---|
| 意味・Role・表示・attention を M3E に統一 | 既定（ADR_011 で決定済み） | 追加決定不要 |
| identity 3分離 / state 4軸 / field 所有権 | Phase 2–3 の設計前提 | 既存 canon で充足。doc は裏付け |
| binding 台帳スキーマ | Phase 3（T-3-1 connector seam） | 素案として保持（Phase 3 契約素案） |
| command 完了 state machine | Phase 3+ / Phase 5（control 一本化） | 素案として保持（Phase 3 契約素案） |
| herdr terminal lane | 新 Phase 候補（未定） | 判断待ち（IS4） |
| OT ライセンス公開境界 | 全 Phase 横断の制約 | 判断待ち（IS5） |
| read-only 観測 → binding → Card 射影を最初の単位に | Phase 3 の最初の thin slice | doc と ADR_011 DC4 が一致。順序の裏付け |

## 拘束チェック（farthest_goal 適用）

- 本メモは新しい面（dashboard / 別アプリ / 別 DB）を提案しない（RQ5 / 拘束規則7 を満たす）。
- 観測由来と自己申告由来を混ぜない doc の主張は RQ3 を強化する（RQ3 寄与）。
- Phase 1 の DC1（DB/runtime を作らない）を破らない。実装は一切行っていない。
- 「試験成功 = 統合成功」と読み替えていない（拘束規則6）。doc の照合は前提条件の確認に留まる。

## 次アクション

1. akaghef へ IS4（herdr 候補）と IS5（OT ライセンス公開境界）を問う。
2. Phase 3 起動時に上記の binding 台帳 / command state machine を T-3-1 の設計材料として再読する。
3. Phase 1 の残（T-1-1〜T-1-5）は本メモの影響を受けない。GUI 収束を先に閉じる。
