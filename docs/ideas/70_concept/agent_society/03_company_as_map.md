# As3: 会社 = クラスター群のマップ、edge = 約束（commitment）

## 命題

> 会社の正本は組織図(誰が誰の下にいるか)ではなく、
> **実際に交わされた約束の graph** である。組織図はその graph の一射影に過ぎない。

## なぜ組織図ではなく約束グラフか

組織図は「権限の静的構造」を表す。しかし実際に会社が動く単位は「誰が何を
いつまでに誰に約束したか」であり、これは権限構造と一致しないことの方が多い
（横の direct な依頼、上司を介さない現場合意、期限付きの一時的な協業）。

M3E の一貫した立場（[philosophical/01_unfinished_principle](../philosophical/01_unfinished_principle.md)、
Q1: 完成した構造より生成過程を正本にする）をそのまま組織に適用すると、
「完成された組織図」より「生成され続ける約束の履歴」を正本にする方が一貫している。

これは Track U の board が既に体現している構造でもある: Goal/Task/Gate の DAG は
「誰の下に誰がいるか」ではなく「何が何を分解し、誰が引き受け、何にブロックされて
いるか」を描いている。**会社マップは Track U の board を、1 案件から全社規模へ
スケールしたものと同型になる。**

## Node/Edge 語彙の組織スケールへの昇格

Track U で凍結した語彙(schema v0)は、実は会社スケールでも変える必要がない候補:

| 現行語彙(projection schema v0) | 会社スケールでの意味 |
|---|---|
| `goal` node | 部門・プロジェクトの目標 |
| `task` node | 具体的な作業単位 |
| `agent` node | **クラスター（= 人 + その agent 組織）**。As2 のカプセル化により、
  クラスター内部の agent 個体は project されない |
| `gate` node | 承認・依存・ブロッキング要因 |
| `DECOMPOSES` | 目標の分解構造 |
| `ASSIGNED_TO` | クラスターへの割当（= 誰が約束したか） |
| `BLOCKED_BY` | 依存関係・停滞理由 |
| `REFS` | 参照関係 |

新しく要る可能性がある語彙は 1 つだけ: **クラスター間の直接の約束**
（Goal/Task を介さない、横の commitment）。これは As4 の scoped channel が
記録すべき edge 種別の候補になる。

## スケールの証拠: 今日の Track U 実装がすでに部分実証している

U1 board の実データには既に S16 PR 系譜・Track D pilot・Track U 自身・S2 Phase 2 が
同一グラフに載っており、`claude-director` / `codex-worker` という 2 agent クラスターが
`ASSIGNED_TO` で結ばれている。**これは 2 クラスターの会社マップの最小構成そのもの。**
akaghef を 3 クラスター目として明示的に載せれば(現状は暗黙の gate 承認者として存在)、
会社マップの最小 3 者構成が完成する。

## 対立案（トポロジーの選択肢）

| 案 | 構造 | 弱点 |
|---|---|---|
| **単一 flat graph（採用候補）** | 全クラスターが 1 つの graph の node。部門境界は attribute（scope）で表現 | scope 設計を誤ると巨大 graph が unreadable になる（既存 viewer の PN/scope 機構が対策） |
| **部門ごとの独立 graph + federation** | ADR_008 の連邦モデルをそのまま組織に適用 | クラスター横断の約束を扱いにくい。部門を跨ぐ協業が正本を持てない |
| **hub-and-spoke（経営者を中心ノードに固定）** | 従来の組織図に近い | 群個体モデルの本質（水平協業）を潰す。当初の思想と矛盾する |

単一 flat graph + scope が最有力。理由: M3E の viewer は既に scope/PN 機構で
大規模グラフを読める形に折りたたむ実装を持っており、追加のアーキテクチャを
発明せずに済む（グローバル指示「自作しようとするな」に整合）。

## Track U/ADR_009 への接続

ADR_009 §2 で「実行平面の UI は Disperse 解釈」と決めたのは元々 agent network の
話だったが、As3 の帰結として **plan 平面(Goal/Task/Gate)と組織平面(クラスター間の
約束)は同じ Disperse graph の異なる projection** になり得る。renderer 統一の議論
（U1.5、要件確定待ちで現在 withdrawn）は、この会社マップの一般形にも
最終的に効いてくる決定だったことになる。
