# 保存エンジン候補 — 外部調査

2026-10-24。Director が委任した調査エージェントによる。npm registry、GitHub API、各ベンダー文書、ローカル計測。**F** は出典付きの確認事実、**I** は推論。採否の推奨は含めない。

## 1. SQLite（better-sqlite3、正規化テーブル）

- F: better-sqlite3 13.0.3（2026-08-05、MIT、SQLite 3.53.4 同梱）。v13.0.0 で N-API 化、prebuilt 同梱、Node >=22。<https://github.com/WiseLibs/better-sqlite3/releases>。beta は現在 `^12.8.0`。
- F: WAL は読み手と書き手が互いを妨げないが、書込み transaction は同時に 1 つ。同一ホストのみ（ネットワークファイルシステム不可）。読み手が重なり続けると checkpoint が進まず WAL が伸びる。<https://www.sqlite.org/wal.html>
- F: 木の再帰 CTE は `UNION ALL` が推奨。<https://www.sqlite.org/lang_with.html>。3.41.0 で非再帰 CTE の計画退行があり `AS MATERIALIZED` で回避。<https://sqlite.org/forum/forumpost/8f38fc9878>

ローカル計測（Apple M5、SQLite 3.53.4、Python `sqlite3`。better-sqlite3 ではない）。`node(id PK, parent_id, ord TEXT, text)`、`(parent_id, ord)` 索引、子数 2〜12、WAL + `synchronous=NORMAL`。5 回中の最良値。計測スクリプトは [bench/cte.py](./bench/cte.py)。

| 行数 | 木全体の CTE 読取り | 3k〜25k 行の部分木 | 126k 行の部分木 | 1 行の reparent（1 transaction） | 1000 更新を 1 transaction | ファイル |
|---|---|---|---|---|---|---|
| 20,150 | 13 ms | 2〜3 ms | – | 0.02 ms | 2 ms | 1.6 MB |
| 200k | 525 ms | 16〜34 ms | – | 0.02 ms | 11 ms | 15 MB |
| 1M | 1.37 s | 18〜19 ms | 107 ms | 0.01 ms | 11 ms | 77 MB |

- I: 部分木読取りは部分木の大きさに比例（1 行あたり約 1 µs）し、表全体の大きさには比例しない。
- I: reparent は 1 行更新と、循環検査のための祖先走査。`synchronous=FULL` では commit ごとに fsync が加わるので、上の値は下限。
- I: SQLite はファイルあたり書き手 1 つ。MCP やスクリプトが別プロセスで DB を直接開くと書込み lock を奪い合う。

## 2. Neo4j

- F: 最新は 2026.10.1（2026-10-23）。2025 年から暦年採番、LTS は 5.26。<https://neo4j.com/release-notes/>、<https://endoflife.date/neo4j>
- F: Community Edition は GPLv3、Enterprise は商用契約。<https://neo4j.com/licensing/>
- F: Enterprise 限定として文書本文にあるのは clustering、online backup / restore、role-based access control、LDAP。<https://neo4j.com/docs/operations-manual/current/introduction/>
- F: Community の dump は DBMS 停止中のみ。<https://neo4j.com/docs/operations-manual/current/backup-restore/offline-backup/>
- F: 2026.10 の要件は Java SE 21 / 25。macOS 13〜26 と Windows 11 は「個人利用と開発」用途のみの対応で、本番対応は Linux と Windows Server。開発機の RAM は最低 2 GB、推奨 16 GB。<https://neo4j.com/docs/operations-manual/current/installation/requirements/>
- F: 組込みモードは Java のみ。Node.js からは Bolt 経由で neo4j-driver 6.2.0（Apache-2.0）を使う。beta は既に `neo4j-driver ^6.2.0` を依存に持つ。<https://github.com/neo4j/neo4j-javascript-driver>
- F: Cypher 25 は ISO GQL に部分準拠（未実装の必須機能あり）。<https://neo4j.com/docs/cypher-manual/current/appendix/gql-conformance/>
- I: PC ごとに JVM サービス（起動・停止、heap と page cache の調整、port）を管理する必要がある。起動時間は未計測。
- I: M3E が Neo4j のバイナリを同梱配布すると GPLv3 の義務がかかる。Apache-2.0 の driver で Bolt 通信するだけなら、その義務は生じない。
- I: Community では online backup がないため、snapshot は「停止 → dump → 再起動」か、アプリ側の export になる。エンジン非依存の portable snapshot と journal があれば、この制約に依存しない。

## 3. Node.js に組み込めるグラフエンジン

- Kùzu — F: 2025-10-10 に archive、最終版 0.11.3。Apple が Kùzu Inc. を買収（2025-10-09）。<https://github.com/kuzudb/kuzu>、<https://www.theregister.com/2025/10/14/kuzudb_abandoned/>
- LadybugDB（Kùzu の fork）— F: MIT、Cypher、serializable ACID。`@ladybugdb/core` 0.21.2（2026-10-01）、darwin-arm64 / win32-x64 の prebuilt あり。直近 90 日の commit は 100 件以上で、うち 89 件が 2 人による。v0.21.0（2026-09-29）では主キーの破損、checkpoint 失敗後の WAL 復元、CSR の rollback など保存層の修正が多数入った。READ_WRITE はプロセスをまたいで 1 ファイル 1 つ。<https://github.com/LadybugDB/ladybug>、<https://docs.ladybugdb.com/concurrency/>
- RyuGraph — F: MIT。2026-01 以降停滞、prebuilt なし。<https://github.com/predictable-labs/ryugraph>
- DuckDB + DuckPGQ — F: DuckDB 2.0.0（2026-10-21）、`@duckdb/node-api` 2.0.0-r.1。DuckPGQ は CWI の研究拡張（SQL/PGQ）で「開発中、未完成の機能あり」、リリースなし。書込みは楽観的並行制御で、書き手は 1 プロセス。<https://duckdb.org/community_extensions/extensions/duckpgq>、<https://duckdb.org/docs/2.0/connect/concurrency.html>。I: 分析向けで、編集ごとの記録の保存先ではなく、作り直せる問い合わせ用の複製に向く。
- CozoDB — F: 最終リリース 2023-12。I: 事実上保守停止。<https://github.com/cozodb/cozo>
- SurrealDB 組込み — F: core は BSL 1.1（2030-01-01 に Apache-2.0）。SurrealQL で Cypher ではない。<https://github.com/surrealdb/surrealdb/blob/main/LICENSE>
- 組込みできないサーバー型 — F: ArcadeDB（Apache-2.0、Java、Bolt 互換、openCypher の試験の 97.8% に通ると主張）、Memgraph、FalkorDB。<https://docs.arcadedb.com/arcadedb/how-to/connectivity/bolt-compatibility>

## 4. ライブラリ

- `fractional-indexing` — F: v4.0.0（2026-06-25、CC0）。同じ 2 つのキーの間へ同時に挿入すると同一キーが生じ得る（Figma はサーバー側で再割当てして解決）。<https://github.com/rocicorp/fractional-indexing>、<https://www.figma.com/blog/realtime-editing-of-ordered-sequences/>
- `fractional-indexing-jittered` — F: 1.1.0（2026-09-08、CC0）。同一キーになる確率は約 1/47,000 で、キーは約 3 文字長くなる。<https://github.com/TMeerhof/fractional-indexing-jittered>
- LexoRank — F: 保守が続いているのは `@dalet-oss/lexorank` 1.1.5（2026-05）だけ。
- I: どのライブラリでも、`(ord, id)` による決定的な順序付けと、衝突時のサーバー側再割当ては必要。同じ隙間へ挿入を繰り返すとキーが伸びるので、再配置の操作が要り、それも journal に記録する。
- IndexedDB の wrapper — F: idb 8.0.4（2026-10-06、ISC）と Dexie 4.4.7（2026-10-19、Apache-2.0）。どちらも保守が続いている。

## 比較

| 候補 | 最新 | ライセンス | Node 組込み | 問い合わせ言語 | 複数レコード ACID | 主な懸念 |
|---|---|---|---|---|---|---|
| better-sqlite3 | 13.0.3（2026-08） | MIT | 同一プロセス | SQL + 再帰 CTE | あり（書き手 1 つ） | グラフ問い合わせ言語なし |
| Neo4j Community | 2026.10.1 | GPLv3 | なし（Bolt） | Cypher 25 | あり | PC ごとの JVM、online backup なし、desktop は開発用途のみ対応 |
| Neo4j Enterprise | 2026.10.1 | 商用 | なし | Cypher 25 | あり | ライセンス費用 |
| LadybugDB | 0.21.2（2026-10） | MIT | あり | Cypher | serializable | 若い fork、保存層の修正が続く、中心開発者が少ない |
| DuckDB + DuckPGQ | 2.0.0 / 拡張はリリースなし | MIT | あり | SQL/PGQ | 楽観的 | 研究拡張、版の追従遅れ |
| SurrealDB 組込み | 3.2.6 | BSL 1.1 | あり | SurrealQL | あり | 2030 年までオープンソースでない |
| ArcadeDB | 26.10.2 | Apache-2.0 | なし（JVM） | Cypher / SQL / Gremlin | あり | PC ごとの JVM |

## 最大の懸念 3 点

1. **組込みの Cypher には安定した担い手がいない。** Kùzu は archive され、後継の LadybugDB は約 1 年の若さで、2026-09 にも保存層の破損修正を出している。組込み Cypher を正本にすると、一度きりの移行を不安定なファイル形式に結び付けることになる。
2. **desktop の Neo4j は運用とライセンスの費用が大きい。** PC ごとの JVM、macOS / Windows 11 は開発用途のみの対応、Community には online backup がない、同梱配布なら GPLv3。
3. **同時書込みと兄弟順。** SQLite・LadybugDB・DuckDB はいずれもファイルあたり書き手 1 つ。UI・MCP・import の全書き手を 1 プロセス経由にすることと、兄弟順キーの衝突解決規則を journal に記録することが、正しさの前提になる。
