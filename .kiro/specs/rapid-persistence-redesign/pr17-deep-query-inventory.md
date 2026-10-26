# PR17: Deep の問い合わせの実需の棚卸しと Demand Gate の判定

2026-10-26。akaghef の依頼で Claude が調査・判定した。brief の PR17 に当たる。DC39（移行先）を決めるための材料で、どの案を採るかは決めない。

## 結論

**Demand Gate は満たしていない。** 4 つの条件をすべて満たす問い合わせは 0 件だった（3 件以上が必要）。

- **実際の需要の中身**：akaghef と AI agent が実際に必要としたのは「探す」問いである（過去の session、用語の定義、決定の来歴）。どれも 1〜2 歩で、grep・file の読取り・LLM の読解で答えられていた。
- **見つからなかった問い**：文書をまたいで GraphLink を連鎖的に辿る問いと、別の map にある同じ entity を探す問いは、1 件も見つからなかった。
- **Deep の制約になっているもの**：問い合わせのエンジンではない。map をまたぐ関係と entity binding がデータとして存在しないことである。現在のデータには、map をまたぐ構造化された関係が 0 件しかない。

## 判定の条件

正本の文言をそのまま使った。調べる前に固定した。

| 条件 | 内容 | 出典 |
|---|---|---|
| source をまたぐ | 複数の canonical source（Git、Obsidian、M3E-local、外部 provider）にまたがる cross-source query であること | ADR 008 Decision 4、Federated_Semantic_Source |
| 実際の運用から出た | 日常の dogfooding から出た問いであること。設計文書の説明用の例は数えない | ADR 008 Decision 4、Decision_Pool（S16） |
| 固定されている | 入力、期待する結果、source の revision が書かれていること | Decision_Pool（S16） |
| Neo4j が要る理由がある | SQLite や file index だけでは足りない理由を説明できること | Strategy S16.15 |

M3E の中で map をまたぐだけの問い合わせ（Glossary の Deep。文書群）も集めた。これは cross-source とは別に数え、Gate の条件には数えていない。

## 調べたもの

3 つの系統を、それぞれ別の調査エージェントに読み取り専用で調べさせ、その結果を Director が照合した。個人の内容は引用せず、問いの形に言い換えて記録した。

| 系統 | 範囲 |
|---|---|
| 文書 | ADR 008・009、Decision_Pool、Strategy、Current_Status、Federated_Semantic_Source、Federated_Semantic_Graph、LLM_Graph_Conversation_Protocol、`docs/semantic/`、S16 と orchestration pilot の handoff と結果、`scripts/pilot/`、Neo4j・ontology・graph に関する `docs/ideas/` と `docs/research/`、`.kiro/` |
| 実データ | 3 つの workspace（Beta の個人用、Final の個人用、team）の全 51 map を、`mode=ro` で集計した。`docs/semantic/m3e-design.source.json` も含む |
| 利用履歴 | Claude Code の transcript 176 本（人間の発話 2,332 件、M3E MCP の呼出し 333 件）。Codex の session 1,152 本（user の発話 6,001 件）。M3E の audit と MCP feedback。Neo4j・Deep・数学についての ChatGPT の会話 9 本 |

## 条件ごとの件数

| 条件 | 満たした件数 | 内容 |
|---|---:|---|
| source をまたぎ、かつ実際の運用から出た | 3 | 次の 3 つの「探す」問い（下の表の 1〜3） |
| 上に加えて固定されている | 0 | 期待する結果を書いた問い合わせが 1 件もない |
| 上に加えて Neo4j が要る理由がある | 0 | 3 件とも 1〜2 歩。対応表があれば SQLite の全文検索や file index で答えられる |

## 問い合わせの一覧

### 実際の運用から出たもの

| 問いの形 | またぐもの | 答え方 | 辿る形 | 判定 |
|---|---|---|---|---|
| 1. ある概念について、map の scope にある定義、spec と Glossary の定義、実装、議論した session を突き合わせる（例: LinkPort、Surface View の分岐） | M3E の map、Git の spec とコード、session の記録 | agent が都度読んで突き合わせた。同じ不具合が再発し、後に steering を追加した。5 日以上で繰り返し出た | 概念から各定義箇所へ 2 歩。要は対応付けで、深く辿る必要はない | source をまたぐ。未固定。対応表がないことが原因 |
| 2. ある議題について、既存の決定・未決・却下案を出典付きで集め、置き換えの連鎖と矛盾を示す | ADR、Decision_Pool、spec、2 つの repo、session の記録 | LLM が file を読んで報告した。3 回以上出た | 置き換えと矛盾の関係を 2〜3 歩。ただし関係はデータとして存在せず、都度抜き出している | source をまたぐ。未固定 |
| 3. ある語が Glossary や repo で定義されているかを確かめる。用語を変えたときは、全文書から旧名を消す | Git（Glossary、spec、docs）、MCP の出力 | grep で答え、おおむね解決した。5 日以上出て、CLAUDE.md の常設規則になった | 文字列の一致と同義語の 1 歩 | source をまたぐ。graph は要らない |
| 4. 以前の会話を探す（「〜したはず」「〜はどうなった」） | Codex と Claude の session の記録 | 専用の skill と LLM で答えた。38 日・101 発話で、最も多い | 話題から session への 1 歩の全文検索 | Deep の問いではない |
| 5. Plan Hierarchy（Principle から Strategy まで）の文書間の参照 DAG を、edge の種類で絞って層ごとに見る | Git の docs（Obsidian vault） | Obsidian の graph view で部分的に満足した | 参照と分解の多段 | 1 つの source の中。`docs/semantic` と file の読取りで答えられる |
| 6. orchestration pilot の Q1〜Q3（Goal から未完了の Task と待ちの Gate、agent が持つ案件、S16 の判断待ちの提案と根拠文書） | Q3 だけが M3E-owned と Git の文書をまたぐ | 2026-07-19 に pilot で 1 回だけ実行した。要約は残っているが、結果の行と期待する結果は残っていない。2026-09-18 に、Q1 が完了した Task を除外しない誤りの指摘がある | 固定の 2〜3 歩。join で足りる | 数えない。pilot 自身を手書きした seed への問いで、日常の運用から出たものではない |
| 7. `projects/deps.json` の task の DAG から、実行順・並列にできる集合・クリティカルパスを出す | Git の JSON | sort-task の script で処理している | 推移的な多段（101 task、65 依存） | 1 つの source の中。script で足りている |
| 8. MCP の search による名前での node・scope の探索と、repo をまたぐ規則・設定の所在の確認 | 1 つか複数の map、M3E と A-sys | search と grep で解決した。継続している | 位置の特定、0〜1 歩 | Deep の問いではない |

### 計画中の project に向けて構想されたもの（実需はまだない）

| 問いの形 | またぐもの | 辿る形 | データ |
|---|---|---|---|
| 稼働中の agent から Actor・Role・Task・Objective・Goal を逆に辿る（Agent Orrery、S17） | ORRERY Telemetry と M3E の map | 型付きの固定 4 歩 | connector がまだなく、Goal 側の語彙も未定義。2026-09-12 に Claude が提案したもので、akaghef の実需ではない |
| Resource（お金・機械）と agent・Task・Goal の関係、支出から判断を経て成果へ（S17.5） | 会計などの provider、ORRERY Telemetry、M3E | 1〜3 歩と集計 | Resource の node と edge の種類が未決で、データはない |
| 定義・定理・証明の依存網を辿る | 数学の map 群。文献を入れれば source をまたぐ | 可変長の推移閉包 | PFR Blueprint の map に `uses` の GraphLink が 9 本だけ。数学の map の取込みは 2026-10-21 に始まった |
| 一般化・双対・類比・特殊化の関係を多段で探す | 数学の map 群 | relationType を指定した多段の型付き辿り。graph DB が本当に有利な形 | relationType の語彙が未確定で、データはない |
| 複数の文献をまたいで同じ概念の同一性を解決し、文書間の同型を見分ける | 文献ごとの source | 同一性の解決（sameAs）と同型判定 | entity binding がない（下の「実データ」を参照） |

### 説明用の例（数えない）

- 販売の map と返品分析の map が、同じ GraphLink を参照する。
- Deep の各概念が、Rapid の文書のどこに現れるか。
- 「先週決めたことを教えて」。
- S16 実装後の世界で想定した場面。たとえば、dispatch の前に、ある task が触る不変条件に依存する他の task を引く。

## 実データで分かったこと

- **GraphLink**：675 本（48 種類の relationType）あり、**すべて 1 つの map の中にある**。
  - 35% は親子の edge と重なっている。
  - GraphLink だけで数えた最大の連結成分は 53 node。
  - 辿れる経路の長さは、最長で計画の map が 7、workflow の map が 11（循環あり）。
- **alias**：993 件あり、すべて同じ map の中を指す。現行の形式では、map をまたぐ alias は表現できない。MCP も `CROSS_MAP_ALIAS` と `CROSS_MAP_MOVE` で拒否する（`beta/src/node/mcp_service.ts:403`、`:467`）。
- **型付きの関係の最大の置き場**：親子の edge の label（`m3e:edge-label`）で、15,966 件ある。その 99% は数学の map にあり、連鎖の深さは最大 3。
- **map や source をまたぐ参照**：構造化されたものは、他の map の node ID を値に持つ attribute が 34 件だけ。
  - `m3e://` の URI は 0 件。
  - map ID の文字列は 390 件あるが、大半は agent の記録の本文で、参照ではない。
  - Vault との構造化された結び付きは約 3 件。
  - scope bind の保存表は、稼働中の DB には存在しない。
- **source をまたいで唯一一致する場所**：計画の map の `m3e:stable-id` 付き 20 node は、`docs/semantic` の entity と 20/20 で一致する。その間の `planning-ref` の GraphLink 32 本も、`docs/semantic` の REFS と一致する。
  - 同じ関係が、Final の map、Beta の複写、`docs/semantic` の 3 か所に別々に保存されている（IS148）。
  - つなぐ鍵は命名規約の文字列だけである。
- **同一性の手がかりがない**：
  - 5 文字以上の固有ラベルのうち 1,852 種が、2 つ以上の map に出る。
  - 数学の map では、447 種のラベル（1,325 node）が複数の scope に繰り返し出るが、GraphLink は 0 本、alias は 1 件しかない。
  - map ID・node ID・GraphLink ID は、複写のたびに引き継がれるか振り直され、workspace をまたいで重複している（IS138）。
- **`docs/semantic`**：entity 50、assertion 47。すべて 1 つの source の中にあり、M3E の map は参照していない。使っているのは CI の validate と pilot だけで、M3E の runtime からの問い合わせはない。

## 分かったこと

1. **Gate は閉じている。**
   - 固定された実需の問い合わせは 0 件。
   - 実際の運用から出た source をまたぐ問いは 3 件あるが、期待する結果が書かれていない。どれも 1〜2 歩で、「SQLite や file index では足りない理由」を示せない。
   - PR16 では、3 歩先までの近傍が SQLite でも 8.6 ms だった。
2. **akaghef 自身の判断も同じ向きだった。**
   - 2026-04-03：「推論で問い合わせが多い用途なら graph DB に利点があるが、現行システムには不要」。
   - 2026-06-19：辞書の規模なら、検索は grep で足りる。
3. **Deep の制約は同一性と関係のデータの欠如である。**
   - map をまたぐ関係も entity binding もデータとして存在しない。
   - ID は map をまたぐと同一性の保証にならない。
   - エンジンを Neo4j にしても、この欠如は埋まらない。
4. **graph DB が本当に効く需要は、数学の領域だけで、まだ構想段階である。**
   - 可変長の型付きの辿りと、文献をまたぐ同一性の解決は、graph DB が有利な形である。
   - ただし具体的な問いはまだ出ておらず、数学の map の取込みは 2026-10-21 に始まったばかりである。
5. **正本の間で食い違いがある。**
   - `docs/tasks/handoff_orchestration_map_pilot_260719.md`（状態は draft）だけが「Demand Gate 充足」と書いている。
   - Current_Status、brief、pilot の seed 自身（`scripts/pilot/common.cjs`）は未開放としている。
   - 本判定は未開放とする。根拠は、pilot の問いが日常の運用から出たものではなく、期待する結果がないこと。

## DC39 への含意（材料であって決定ではない）

- **Rapid の正本を Neo4j に置く根拠（OP44）は、いまの問い合わせの需要からは出てこない。** OP43 では Neo4j を後から materialization として足せ、data migration も要らない。数学の需要が実際に出たときに、Demand Gate を改めて判定すればよい。
- **一度きりの移行（RQ19）に入れておくべきなのは、Deep が要る同一性の前提である。エンジンではない。** 具体的には次の 3 つ。
  - map や workspace を越えて一意な ID（IS138）
  - map をまたぐ参照の表現
  - entity binding の置き場（RQ28。草案では後から足せるレコード種別として予約済み）
  - このうち ID の一意性の範囲は後から変えると移行になるので、DC39 と一緒に決める必要がある。
- **計画の map と `docs/semantic` の関係の三重保存（IS148）は、ADR 008 の「canonical owner は一つ」に反している。** 移行で何を正本にするかを決める必要がある。

## この調査が示さないこと

- Windows 上の数学の repo と研究環境は調べていない。そちらに Deep の需要がある可能性は残る。
- 利用履歴から分かるのは、実際に尋ねた問いだけである。データがないために尋ねられなかった問いは数えられない。
- 利用履歴は語での検索を中心に読んだ。見落としはありうる。
- Swingby のチームでの利用は始まったばかりで、まだ問いの記録がない。

## 別件の発見

過去の会話を探す問いは、実需のなかで最も多い。それを支える `scripts/ops/codex-grep.sh` が、現行の Codex の記録形式（user の発話の記録形式が変わり、大半が zstd 圧縮）を読めず、どの語でも 0 件を返していた。この spec の範囲外の作業として、2026-10-26 に直した（dev-beta `8fb8b87`）。圧縮された記録と現行の形式を読めるようにし、Codex が user の入力として記録する注入された文脈（AGENTS.md の指示など）は除外した。

## Next Action

- DC39 は、PR16 とこの PR17 を材料にして判断できる。
- Gate を改めて開く判定は、次のどちらかの時点で行う。
  - 実際の運用から出た問い（上の 1〜3）を revision 固定の fixture にし、SQLite の全文検索や file index で実際に答えられないことが示せたとき。
  - 数学の map の運用から、可変長の型付きの辿りが要る具体的な問いが出たとき。
