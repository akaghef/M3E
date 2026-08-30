# Knowledge Workbench Slice — 不可視多次元グラフと人間作業台

最終更新: 2026-08-09  
status: idea（Vision 再定式化候補。実装 task ではない）

## Why

- second brain / 情報商材系の「graph view 驚き屋」は明確なビジョンが薄く、全ノード力技配置の鑑賞に寄りやすい。
- 本職の DB / データ基盤側は、本質が多次元・多層・高次元表現（不可視）にあると批判する。正しさはあるが、人間の作業台としては止まる。
- M3E は両者の妥協ではなく、**層分離**で立つ: 計算層は不可視な多次元 semantic graph、人間面は有限軸の操作可能スライス。

外部で確認した近い批判軸（逐語正本ではない。候補 URL）:

- グラフは可視だから流行る / 高次元ベクトルは見えない — [@legoboku 2082084482849661010](https://x.com/legoboku/status/2082084482849661010)
- LLM→KG→絵で終わり、目的適合の評価がない — [@legoboku 2081734134528180497](https://x.com/legoboku/status/2081734134528180497)
- オントロジーを推論機械ではなく契約として — [@legoboku 2071390672213692774](https://x.com/legoboku/status/2071390672213692774)
- 用途によっては lineage 程度で十分 / God KG を避ける — [@legoboku 2082404010200556009](https://x.com/legoboku/status/2082404010200556009) / [2061091831706743275](https://x.com/legoboku/status/2061091831706743275)
- node-link は最悪の可視化の一つ / typed edges — 例: [@_ketan0](https://x.com/_ketan0/status/2071401460433334469), [PenfieldLabs typed wikilinks](https://x.com/PenfieldLabs/status/2057135120427950394)

## Idea

### 一文

> M3E は Knowledge Graph Viewer ではない。  
> 不可視な多次元構造から、人間が判断し変更できる作業面を切り出す **Knowledge Workbench** である。

### 三項対立

| 立場 | 何を見ているか | 失敗モード |
|------|----------------|------------|
| second brain / 驚き屋 | 全ノードを力学配置した 2D（観賞） | 制御軸ゼロ、hairball、繋がってる感 |
| DB / 基盤屋 | 多次元グラフ・vector・契約空間（不可視） | honest but inoperable、人間が握れない |
| **M3E** | 目的に応じた **~5 操作軸の有限スライス** | 軸選択を誤ると PA1 か PA2 へ転落 |

### 核心クレーム

1. **Deep / 世界モデル / semantic graph は原則として不可視の計算資産**である（全露出の global graph は非目標に近い）。
2. 人間に出すのは「全部」ではなく、**同時に握れる少数の操作軸で固定したスライス**である。
3. 「5次元」は 5D 空間表示ではない。**同時露出する操作ハンドル数が認知可能な少数（目安 5 前後）**という意味。画面自体は 2D でよい。
4. 軸の中身は固定 5 種に決め打ちしない。目的ごとに scope / relation type / time・semantic cut / authority / state / provenance 等から選ぶ。固定すべきは **少数軸へ切り出す規律**。
5. スライスは read-only 観賞ではなく **作業台**: typed relation・scope・identity・contract を保ち、操作は **Command / write authority** 経由で正本へ戻る seam を持つ。
6. 全体探索・候補生成・評価ループは agent/script、人間は有限スライス上で意味と意図を確定する（P5 / S10 / S11 と整合）。
7. 価値指標は「絵の豪華さ」ではなく、**そのスライスが現在の判断・更新・検証に適合しているか**（fitness-for-purpose）。

### 既存 canon への写像（新規語彙を増やさない）

| 本メモの言い方 | Glossary / Strategy 正規語 |
|----------------|----------------------------|
| 不可視な全体 | Deep, semantic graph, 世界モデル, M3E Semantic Source |
| 認知境界 | scope, facet |
| 切り出し | 射影 (Deep→Rapid), context projection, materialization（用途で使い分け） |
| 型付き関係 | GraphLink / relationType（tree `edge` と混同しない） |
| 同一性・同期 | alias, scope bind, entity binding |
| 書き戻し seam | Command, Semantic Command, write authority, authority root |
| 骨格 | spine（鑑賞用 force graph ではない） |

候補の操作軸プール（例。固定セットではない）:

- identity / node 属性
- typed relation（GraphLink）
- scope / facet 境界
- layout / 投影選択（表示配置）
- version / semantic cut / freshness
- authority / approval state
- provenance / referential state

### 層分離としての位置づけ

- second brain 側へ: 人間が触る操作面（有限スライス）
- DB 側へ: 不可視計算層・契約・評価・materialization
- M3E の製品境界: **スライス選択規律 + 作業台 UX + 正本への Command 経路**  
  （Neo4j Browser/Bloom 等の runtime 面との差分は S16 / neo4j boundary 議論と接続）

### 非目標

- 常時すべてを露出する global graph view を主戦場にすること
- 「5D 可視化エンジン」として売る・実装すること
- God knowledge graph で外部 SaaS / 全データを置換すること
- untyped hairball を製品の顔にすること
- view だけで write seam を持たない鑑賞ツールで止まること

## Open Questions

1. プロダクトコピー上、`Knowledge Workbench` / `有限スライス` / 既存の `射影` のどれを表看板にするか。
2. 「目安 5 軸」を UI のハード上限にするか、運用ガイドラインに留めるか。
3. スライス定義自体を第一級オブジェクト（保存・共有・評価）にするか、その場の window 状態に留めるか。
4. fitness-for-purpose の機械評価（query fitness, reachability, specificity, freshness）をいつ S16 / RAG 評価軸と接続するか。
5. S2 チーム作業面は、本クレームの「最初の人間向けスライス実証」としてどう語るか。

## Next Action

- [ ] 本 idea を `Vision.md` / `Principle` 反対側リストの補強候補としてレビュー（昇格は Director 判断）
- [ ] 必要なら `Deferred Strategy` に 1 項目として束ねる（例: 「不可視 Deep を有限作業台へ compile する規律を正典化する」）
- [ ] 仕様本文の複製はしない。語彙が揺れたら `Glossary.md` のみ更新
- [ ] 実装着手はしない（現行主戦場は S2 / S3。S16 は収穫モード）

## Related

- Principle: scope 認知境界 / 単一実体複数見え方 / AI 提案・人間確定 / Flash·Rapid·Deep 進化軸 / **常時すべてを露出するグローバル可視化を反対側に置く** — [../01_Vision/Principle.md](../01_Vision/Principle.md)
- Strategy: S6 世界モデル正本, S7 射影の片道化防止, S8 scope, S10–S11 人間 judge, S14 寄せ集め否定, S16 連邦 semantic graph — [../01_Vision/Strategy.md](../01_Vision/Strategy.md)
- Glossary: 射影 / Deep / scope / GraphLink / Command / materialization / context projection — [../00_Home/Glossary.md](../00_Home/Glossary.md)
- 近傍 idea: [260719_math_ontology_graphdb_thesis.md](./260719_math_ontology_graphdb_thesis.md), [260420_m3e_vision_twitter_dump.md](./260420_m3e_vision_twitter_dump.md)
- Skill 参照: neo4j runtime と製品境界 — `m3e-project` → `references/neo4j-runtime-and-product-boundary.md`

## Session note

- 会話で合意: Vision としてはクリア。実装仕様確定ではない。
- 「5次元」誤解防止と write-back seam の有無が、view vs workbench の分水嶺。
