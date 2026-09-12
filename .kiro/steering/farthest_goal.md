# 最遠の目標（binding steering）

> M3E の spec・design・実装・Codex handoff は本書の `RQ1`〜`RQ6` に**照合必須**。
> 2026-09-13 に akaghef が「最遠の目標を立てて」と求め、同日確定した。
> 本書は**方向の正本**であり、個別決定の正本ではない。決定は ADR / Decision_Pool、
> 用語は `agent_orrery_terminology.md` と `docs/00_Home/Glossary.md` が正本。
> akaghef の判断により ADR は立てず、steering のみで運用する（2026-09-13）。

## Canonical 正本（参照先）

- **用語**: `.kiro/steering/agent_orrery_terminology.md`（`agent` / `Role` / `Actor Instance` / `Telemetry` / `attention` / `connector` / `Orrery` の意味はここが正本。本書で再定義しない）
- **決定**: `docs/09_Decisions/ADR_011_Agent_Orrery_As_M3E_Map.md`、`ADR_009`、`docs/06_Operations/Decision_Pool.md`
- **Surface View / port**: `.kiro/steering/ui_view_taxonomy_and_ports.md`
- **製品方向**: `.kiro/steering/product.md`（本書は product.md の上流にあたる方向を述べる）

## RQ1 — 最遠の目標

**作業が、それ自身を記述する単一のグラフの中で行われる状態。**

`agent`（= `AI agent` ∪ `human`）が同一種の参加者として、目標・知識・実行が同じ空間に同居する。実行は**報告ではなく観測によって**グラフに現れる。

**価値関数は「akaghef の注意1単位あたりに成立する仕事量」。** 可視化・Telemetry・Director 機構・plugin 契約は、すべてこの関数の下位手段である。手段が価値関数に反する場合、手段を捨てる。

## 成立に必要な不変条件

| ID | 不変条件 | 根拠・関連 |
|---|---|---|
| **RQ2** | `AI agent` と `human` の対称性が実装まで貫かれる。map に「人間の欄」と「AIの欄」を作らない。Role / attention は両者に同じ形で適用される | global rule（`agent` = `AI agent` ∪ `human`）、ADR_011 IS15、terminology 規則1 |
| **RQ3** | 真偽の源泉が自己申告でない。node が生えるのは観測したからであって、`agent` が status を書いたからではない | ADR_011 DC2（Orrery は観測で生える map のデータ）、terminology 規則8 |
| **RQ4** | 正本と runtime の分離が永続する。Role は正本、Actor Instance は runtime、Telemetry は ephemeral で正本 map に混ぜない | ADR_011 DC3、terminology 規則4 |
| **RQ5** | 指示と観測が同じ面で起きる。面を増やさない | ADR_009 §3（plugin 契約）、canvas-protocol |
| **RQ6** | `human` の注意が希少資源として明示的に配分される。map の仕事は「どこを見るべきか」を告げること | ADR_011 DC13（attention は最上位の射影軸） |

### RQ3 が最も侵食されやすい

観測は自己申告より常に高コストである。したがって利便性は永続的に RQ3 を侵食する方向に働き、侵食は毎回「今回だけ」の形で来る。

2026-08〜09 の agent 運用で「成功と報告されたが成立していなかった」事象が反復した。これは例外ではなく、**自己申告を真偽の源泉にした場合の定常状態**である。RQ3 は品質目標ではなく構造条件として扱う。

### RQ6 が支払いを生む

`AI agent` が N 体動くとき律速は `human` の注意である。attention routing は装飾ではなく RQ1 の本体であり、ここが未達なら他が全部揃っても価値は出ない。

## 最遠の目標でないもの

- **agent 実行の dashboard を作ること。** dashboard は注意を消費する。目標は節約すること。派手な可視化は価値関数に反し得る。
- **全自動化。** RQ6 は注意をゼロにするのではなく、注意が向くべき場所を正確にする。

## 拘束規則

1. **spec / design は RQ1〜RQ6 のどれに寄与するかを書く。** 寄与しない変更があってよいが、その場合「最遠に近づいた」と書いてはならない。
2. **観測由来の値と自己申告由来の値を同じ field に流さない（RQ3）。** field 単位所有権（ADR_011 DC21、根拠は DC8 provenance）を守る。両者が混ざった時点でグラフの真偽値は落ちる。
3. **新しい表示を提案するときは「akaghef の注意を節約するか、消費するか」を書く（RQ6 / RK4）。** 節約の根拠が書けないものは保留する。
4. **`human` を非対称に扱う設計を既定にしない（RQ2）。** `human` が provider runtime session を持たないことは実装上の差であって、語彙・構造を分ける理由にはならない。
5. **Telemetry を正本 map に書かない（RQ4）。** terminology 規則4 と同一だが、本書では最遠目標側からの理由を与える — 正本が runtime で汚れると、グラフは年単位の蓄積ではなくリセットされる dashboard に退化する。
6. **「試験成功」を「統合成功」と読み替えない。** seam 通過・test 通過は前提条件の充足であり、価値の実現ではない。2026-09-08 に独立 renderer の 8 試験成功を統合成功として提出し、akaghef が却下した前例がある。
7. **面を増やす提案には、既存 map 面に載せられない理由を書く（RQ5）。** 新しい dashboard / 別アプリ / 別 DB は、理由が書けない限り採らない。

## 最遠からの距離（2026-09-13 時点のスナップショット）

> 本節は状態の正本ではない。参照時に再導出すること。

| 構成 | 位置 |
|---|---|
| 意味層（map / Goal Graph / Disperse / plugin 契約） | 存在する。構造的負債は `viewer.ts` の単一ファイル共有 state |
| 観測層（ORRERY Telemetry / AgentStack） | 収集は稼働。履歴なし、`agent_id` 全 null、終了理由が payload に無い |
| connector（観測層 → M3E） | **未実装。** M3E 内に上流参照コード 0 件 |
| RQ2 対称性 | ADR_011 で決定済み、実装なし |
| RQ3 非自己申告 | 観測層は原理的に満たす。M3E 側は現在も `agent` の書き込みに依存 |
| RQ6 注意配分 | requirements に記載のみ、未着手 |
| 外部利用 | Swingby チーム知識マップが最初の実戦。`human` が他人になる初の試験 |

**要約: 最終物の左半分と右半分が両方できていて、触れていない。支払いを生む RQ6 は未着手。**

### connector seam について（2026-09-13 の判断）

上流に ORRERY Telemetry という**稼働中の正解**があるため、通常 seam で最も高価な「契約の発見」が済んでいる。`snapshot.json` schema_version 1 は片側が動かせない契約であり、これは制約ではなく seam を本物の境界にする利点である。

ADR_011 DC2 が Orrery を「map のデータ、Surface View ではない」と決めているため、**connector seam の consumer 境界は view 層ではなく map データ層**にある。したがって UI の構造的負債は seam の経路上にほぼ無い。

リスクは producer 側から consumer 側へ移動した。layout seam の**部分 seam 化**が本番破綻（PN / scatter / edge）を起こした前例があるため、**seam は exclusive にする**。

## リスク

| ID | リスク | 対処 |
|---|---|---|
| **RK1** | 統合の劣加算。100回の統合を越えて生き残る必要がある | seam contract / resource claim gate / CI 憲法。実験 seam を1本ずつ通す |
| **RK2** | RQ3 への自己申告の再侵入 | 拘束規則2。field 単位所有権 |
| **RK3** | 上流契約の非制御。ORRERY Telemetry は外部 OSS で、payload に終了理由が無い問題を M3E 側では直せない可能性がある | **未決分岐**: 観測層を自前化するか、上流に寄与するか。今決めないが、分岐の存在を記録する |
| **RK4** | 目標が dashboard へ縮退する。最も可能性が高い失敗形 | 拘束規則3。「見える化禁止 → 可視化」の用語規律はこの縮退への抵抗として読む |

## 適用

- 非自明な spec / design / handoff は RQ1〜RQ6 への照合を1行以上含めること。**本書制定（2026-09-13）より前に書かれた spec に遡及適用しない。** 新規作成分、および実質改訂を受ける分から適用する（`agent_orrery_terminology.md` 規則1の適用方針と同じ）。
- 本書と ADR が食い違った場合は **ADR が正**。本書を直す。
- 本書と個別 spec が食い違った場合は **本書が正**。spec を直す。
- RQ の追加・改訂は akaghef の判断を要する。Director は単独で RQ を増やさない。

---
_方向の正本。状態・決定・用語はここに書かない。_
