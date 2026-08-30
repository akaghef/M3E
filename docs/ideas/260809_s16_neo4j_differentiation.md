# S16 — Neo4jとの差別化からM3Eの存在理由を再定義する

最終更新: 2026-08-09  
status: idea（S16再定式化候補。Strategy / Spec / ADRへの採択前）

## Why

S16では、Neo4jをgraph substrateとして採用する理由、canonical ownerの連邦化、M3E-owned accepted Deep graphのcanonical runtime、Recovery Gateまで長い議論とpilotを進めた。一方で、Neo4j BrowserだけでなくNeo4j Bloomまで比較対象に含めると、次の問いを避けられない。

> Neo4j側のviewer / exploration surfaceが十分なら、M3Eは何のために独自アプリとして存在するのか。

この問いに「見た目」「dragできる」「自然言語検索」「graphを見渡せる」で答えることはできない。これらはNeo4j製品側が改善し続ける汎用領域であり、機能差は恒久的な製品境界にならない。

本メモは、Neo4jとの差分をfeature checklistではなく、**ユーザーが完了させたい意味仕事の閉ループ**として再定義する。

## 結論

> **Neo4jは、成立したgraphを保存・照会・探索する。M3Eは、未完成の意図を信頼できる構造へ育て、その構造から判断可能な有限作業面を切り出し、結果を正しいownerへ確定する。**

M3Eの存在理由はgraph visualizationではない。次の閉ループを一つの操作環境として成立させることにある。

```text
未完成の入力
→ 現在扱うscopeを切る
→ spine（理解・説明・作業の骨格）を作る
→ typed semanticsを提案・検証する
→ 人間が採否を判断する
→ Commandをcanonical ownerへrouteする
→ Deepから文書・計画・作業面へ射影する
→ 実行結果を次の判断へ戻す
```

Neo4jはこの中央にあるgraph runtimeを強く担う。しかし、ループ全体の目的、認知境界、説明順序、承認、owner routing、射影先は定義しない。

## 差別化の原則DAG

```text
M3Eを究極のアプリにする
├─ Neo4jへ委譲する
│  ├─ graph storage
│  ├─ ACID transaction
│  ├─ constraint / identity
│  ├─ traversal / openCypher
│  ├─ index / query execution
│  ├─ generic graph inspection
│  └─ database administration
│
└─ M3Eが所有する
   ├─ 未完成性を扱う
   │  ├─ Flash（断片）
   │  ├─ Rapid occurrence（局所表現）
   │  ├─ Deep entity（大域意味）
   │  └─ proposal / ambiguity / pending decision
   │
   ├─ 人間の有限性を扱う
   │  ├─ scope（認知・編集境界）
   │  ├─ spine（読む・考える・作業する順序）
   │  ├─ Progressive Navigation（次の意味操作）
   │  └─ Deepから有限作業面への射影
   │
   ├─ 判断の責任を扱う
   │  ├─ agent proposal
   │  ├─ evidence / provenance
   │  ├─ human approval
   │  └─ accepted / rejected / sealed state
   │
   └─ 正本への帰還を扱う
      ├─ canonical owner resolution
      ├─ write authority
      ├─ Semantic Command
      └─ Git / Obsidian / provider / Neo4jへのroute
```

## durableな差別化と、消える差別化

### 消える差別化

次はNeo4j Browser / Bloom、または将来の周辺製品が吸収できる。M3Eの中核にしない。

- force-directed graph表示
- node / relationshipのdrag、zoom、近傍展開
- label / property表示
- graph / table / rawの切替
- Cypher結果の可視化
- 色・サイズ・iconによるstyle
- filter、検索、Perspective、scene保存
- 汎用の自然言語graph search
- database schema / constraint / query historyの管理

これらが必要なら、まずNeo4jの標準surfaceを使う。独自実装は、M3E固有loopに不可欠な箇所だけに限定する。

### durableな差別化候補

1. **scopeはfilterではない**  
   filterは集合を減らす。scopeは、現在の意味世界、編集責任、認知負荷、次に許される操作を決める。

2. **spineはrelationship表示ではない**  
   property graphの関係網に対して、人間が理解・説明・実行する主骨格を与える。全関係を同格に露出しない。

3. **Progressive Navigationは近傍展開ではない**  
   選択nodeから「分解する・比較する・根拠を探す・scope化する・task化する・agentへ委譲する・射影する」など、次の意味操作を選ぶ。

4. **proposalはraw writeではない**  
   agent出力をcanonical graphへ直結せず、差分・根拠・影響範囲を人間が判断できる状態に置く。

5. **射影はquery resultではない**  
   要素を取得するだけでなく、目的に適合した説明順序・粒度・省略・責任を持つRapid文書、計画、handoff、作業面へcompileする。

6. **操作は現在のDBだけで完結しない**  
   一枚の作業面に見えても、確定先はGit、Obsidian、provider、M3E-local、Neo4jへ分かれる。M3Eは意図を正しいownerへ返す。

## 核心となる10の問いと暫定回答

### Q1. 最初の5分

**問い:** M3Eを開いたユーザーが最初の5分で行う、Neo4j Browser / Bloomでは完結しない行為は何か。

**暫定回答:** global graphの探索ではなく、現在扱う案件のscopeへ入り、未整理要素からspineを作り、次の意味操作を確定すること。

**棄却条件:** 実利用の最初の5分が検索・node展開・property閲覧だけなら、M3E viewerは不要である。

### Q2. 入力の未完成性

**問い:** M3Eが第一級に受け取るものは、完成済みgraphか、断片・曖昧さ・対立・保留を含む未完成入力か。

**暫定回答:** 後者。M3Eは完成データの閲覧より、構造化前後の状態遷移を所有する。

**棄却条件:** 未完成状態を外部editorで処理し、M3Eには完成graphしか来ないなら、M3Eはthin clientで足りる。

### Q3. 作業単位

**問い:** ユーザーはnodeを操作しているのか、それとも「理解する・分解する・比較する・決める・委譲する」という意味仕事を進めているのか。

**暫定回答:** nodeは対象であり、製品上の主語は意味仕事である。UI commandはCRUDよりintentを前面に出す。

**棄却条件:** M3E固有の操作語彙が最終的にcreate / update / delete / expandへ還元されるなら、Neo4j UIとの差は薄い。

### Q4. scopeの非代替性

**問い:** scopeはBloom Perspectiveやquery filterに対して何を追加するのか。

**暫定回答:** 表示集合だけでなく、spine、操作可能範囲、認知文脈、authority表示、射影規則を束ねる。

**棄却条件:** scopeが単なるsaved filterとして実装・運用されるなら、Perspectiveを再利用すべきである。

### Q5. spineの必要性

**問い:** semantic graphとは別に、親子spineを第一級で持つ必要があるか。

**暫定回答:** ある。semantic graphは関係の真理を表すが、spineは人間の理解・説明・作業順序を表す。同一Deep graphから複数spineを作れる。

**棄却条件:** 実際の利用で人間が自由graph探索だけで安定して理解・作業できるなら、spine中心設計を再検討する。

### Q6. Progressive Navigation

**問い:** node選択後に、近傍展開以外のどの「次の操作」をM3Eが提示すべきか。

**暫定回答:** 少なくとも分解、比較、根拠探索、scope化、relation提案、task化、agent委譲、射影。候補はnode type、state、scope、goalから絞る。

**棄却条件:** operation候補が文脈に応じて絞れず、巨大なcommand paletteになるなら差別化にならない。

### Q7. 人間判断

**問い:** agent proposalを、単なる自動生成やchat応答ではなく、責任ある判断へ変える最小UIは何か。

**暫定回答:** base state、提案差分、根拠、影響先、owner、棄却可能性を同一scopeで示し、部分採用できること。

**棄却条件:** 人間が実質的に全承認するだけ、または差分を理解できないなら「AIは提案、人間が確定」は形式化する。

### Q8. 射影

**問い:** Deep graphからRapid文書・計画・handoff・作業boardを作る行為は、Cypher query resultと何が違うか。

**暫定回答:** queryはselection、射影は目的別compileである。説明順序、粒度、省略、用語、読者、更新関係を持つ。

**棄却条件:** 出力がtableやnode listで十分なら、M3E独自の射影engineを作らずquery/viewを使う。

### Q9. canonへの帰還

**問い:** M3E上の編集が複数canonical ownerへ戻る複雑さは、ユーザー価値か、単なるintegration負債か。

**暫定回答:** ユーザーには一つの意味操作として見せつつ、正しい履歴・責任・復元先を維持する点に価値がある。ただし摩擦が高ければ私的複製とdual-canonを生む。

**棄却条件:** owner routingが日常操作を遅くし、利用者が迂回メモを常用するなら、owner境界か製品境界が誤っている。

### Q10. 究極性と撤退条件

**問い:** M3Eが究極のアプリであるとは、最高のgraph viewerであることか、それとも未完成の意図から信頼できる構造と次の行動までの距離が最短であることか。

**暫定回答:** 後者。全機能を持つことではなく、意味仕事の閉ループから道具間の変換・転記・責任断絶を除くこと。

**棄却条件:** 代表的なend-to-end scenarioで、Neo4j Bloom + Obsidian +既存task toolの組合せより短く、安全で、理解可能なloopを示せないなら、独立アプリの範囲を縮小する。

## 製品の三面分業

```text
Neo4j Browser
= databaseを調査・管理する開発者面

Neo4j Bloom
= 成立済みgraphを汎用探索・共有する分析面

M3E
= 未完成の意味を育て、有限scopeで判断し、正本と成果物へ戻す作業面
```

M3EはBrowser/Bloomを排除しない。同じNeo4j runtimeに対する別のconsumerとして共存する。汎用探索が必要ならBloomへdeep linkし、database監査はBrowserで行い、M3Eは固有loopだけに集中する設計が最も薄い。

## 最小の製品核

M3Eの独立viewerを正当化する最小核は、次の3 seamが一画面・一文脈で閉じることである。

```text
A. Intent → Model
   未完成入力をscope / spine / typed proposalへ変える

B. Model → Workbench
   Deep graphから現在判断できる有限作業面を切り出す

C. Workbench → Canon
   人間が承認した変更を正しいownerへ確定する
```

- AだけならAI mind-map generatorである。
- Bだけならgraph viewer / dashboardである。
- Cだけならintegration middlewareである。
- A+B+Cが閉じて初めてM3E固有の作業環境になる。

この三つを同時に証明する一つのscenarioが、機能一覧より重要である。

## 最初に実証すべきscenario案

### Scenario: 研究・開発案件を構造化し、判断し、実行へ送る

1. 会話、メモ、repo issue、既存文書から未整理の案件を取り込む。
2. ユーザーが現在のscopeを定める。
3. agentがGoal / claim / evidence / Task / Gate候補とspineを提案する。
4. ユーザーが差分と根拠を見て、部分採用・修正・棄却する。
5. accepted Deep graphをNeo4j transactionで確定する。
6. Git-owned spec変更はSemantic Commandとしてbranch / PRへrouteする。
7. 同じDeep graphから、人間用board、agent handoff、説明文書を射影する。
8. 実行結果とevidenceを取り込み、次に判断すべきnodeだけを提示する。

このscenarioをBloom単体では完結できないこと、かつ複数toolの寄せ集めより摩擦・誤確定・転記が少ないことを測る。

## 評価軸

| 軸 | 問い |
|---|---|
| time-to-next-decision | 入力から次の責任ある判断まで何分か |
| context compression | 全graphを見ずに必要十分なscopeを得られるか |
| proposal legibility | agent提案の差分・根拠・影響を説明できるか |
| canon fidelity | 採用結果が正しいownerへ一度だけ確定するか |
| projection usefulness | query結果ではなく、そのまま使える成果物・作業面になるか |
| recovery / audit | 判断と確定を復元・監査できるか |
| tool-switch cost | viewer・editor・task・chat間の転記をどれだけ除けたか |

## 反証可能な存在判定

次の条件なら、M3E独自viewerの開発を縮小・停止する。

1. M3Eで最も多い操作がsearch / expand / drag / property viewである。
2. scopeがsaved query / Perspectiveを超える意味を実利用で持たない。
3. spineが人間の理解・実行を改善しない。
4. proposal reviewがchat承認より安全・高速にならない。
5. Deep→Rapid射影が既存template/queryで十分である。
6. owner routingの摩擦がdual-canon回避の便益を上回る。
7. A+B+Cを閉じる代表scenarioで既存tool組合せに勝てない。

反対に、このうち一つのUI gimmickではなく、A+B+Cの閉ループ全体で明確な配当が出れば、M3Eの独立製品性は成立する。

## 設計への帰結（未採択）

1. Neo4j Browser / Bloomと競合する汎用viewer機能をroadmapの中心にしない。
2. Neo4jへの接続を隠すだけのthin visualization layerをM3Eと呼ばない。
3. M3E UIの中心objectを「全graph」ではなく、目的・scope・spine・pending decisionを持つ有限作業面に置く。
4. UI operationはgraph CRUDではなく、意味intentとして定義する。
5. proposal reviewとowner-routed Commandを同じ操作loopに置く。
6. 最初のacceptanceはnode数や描画性能ではなく、代表scenarioのend-to-end completionで測る。
7. 汎用探索・管理が必要な時はBloom / Browserへのdeep linkや併用を優先する。

## Open Questions

1. A+B+Cを同時に示す最初の実データは、S2 team collaboration、S16 orchestration map、数学ontologyのどれが適切か。
2. M3Eの主画面を永続mapと呼び続けるか、taskごとにcompileされる有限作業面として再定義するか。
3. scopeが束ねるべき契約を、表示・編集・authority・projectionのどこまでにするか。
4. spineはDeep側のcanonical relationか、目的別Rapid側のcanonical occurrence structureか。
5. Neo4j Bloomへのdeep link / Perspective共存を製品導線として正式採用するか。
6. 「最初の5分」と「一つの代表scenario」をどう計測するか。

## Next Action

- [ ] 本メモのQ1〜Q10をS16 define対話で回答し、`accepted / rejected / unresolved`に分類する。
- [ ] 一つの代表scenarioを選び、Neo4j Bloom +既存tool組合せを対照群としてtask completionを比較する。
- [ ] 差別化が確認できるまで汎用viewer機能を増やさない。
- [ ] 採択した境界だけをStrategy / Spec / ADRへ昇格し、本idea本文はsource layerに留める。

## Related

- [Knowledge Workbench Slice — 不可視多次元グラフと人間作業台](./260809_knowledge_workbench_slice.md)
- [数学オントロジーが Neo4j 採用の真の駆動因である](./260719_math_ontology_graphdb_thesis.md)
- [Strategy.md — S16](../01_Vision/Strategy.md)
- [Principle.md](../01_Vision/Principle.md)
- [Federated Semantic Source](../03_Spec/Federated_Semantic_Source.md)
- [ADR 008](../09_Decisions/ADR_008_Federated_Canonical_Sources.md)
- [Neo4j Browser](https://neo4j.com/docs/browser/)
- [Neo4j Browser Visual tour](https://neo4j.com/docs/browser/visual-tour/)
- [Neo4j Bloom](https://neo4j.com/product/bloom/)
- [Neo4j Bloom Visual tour](https://neo4j.com/docs/bloom-user-guide/current/bloom-visual-tour/)

## Source note

- 起点: S16継続対話。「neo4jとの差別化で考えよう。M3Eを究極のアプリにしたいが、neo4jのviewerが十分ならそれでいいじゃんってなるよね」および後続の核心問い10件。
- 本文の結論はdiscussion用仮説であり、既存S16 canonを自動的に変更しない。
- Neo4j製品能力は2026-08-09時点の公式Browser / Bloom文書を参照した。
