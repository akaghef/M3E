# Neo4j を database にする実装の手順

設計は [Neo4j を database にする設計](neo4j-database-design.md)。本書は実装の順と、各段の確認の方法を書く。基準パスはリポジトリの root である。

## 段 1: Neo4j を永続の置き場にする

1. 一つの Neo4j に複数の store を置けるようにする。record の node に store のラベル（`S_<store 名>`）を付け、一意の制約と索引を store ごとに置く（`beta/src/node/neo4j_store/apply.ts`、`store.ts`）。
2. 確定ごとの Neo4j の書き込みを、一回の transaction にまとめる。中身は、record の put と delete、`Commit` の record、snapshot の見出し、journal の行（`JournalEntry`）、再送の結果（`CommandResult`）、削除した ID（`Retired`）、map ごとの最終確定番号である。
3. 確定の応答は、Neo4j の transaction が済んでから返す。HTTP と MCP の入口は、確定の後に store の `durable()` を待つ。Neo4j に書けない間は、応答を「database に書けない」として返し、確定済みとは扱わない。
4. 起動時の状態は Neo4j から読む（`RecordWorkspaceStore.openFromNeo4j`）。jsonl の snapshot、journal、commit index、拒否の記録のファイルは、本番では読まず、書かない。
5. map の表示に使う読み出し（`GET /api/maps/:id`）は、Neo4j の問い合わせで組み立てる。
6. pull（log suffix）と過去の確定の読み出しは、Neo4j の `JournalEntry` から読む。
7. compaction と archive は無くす。journal の行の保持期間は、別の段で決める。
8. 起動の入口（`beta/src/node/record_store/active.ts`）は、Neo4j の接続先が無ければ起動しない。jsonl のファイルで動く道を残さない。

確認: 単体試験を Neo4j に対して流す（store ごとに名前を分ける）。通常 Beta で、マップを開き、編集し、server を起動し直して、編集が Neo4j から戻ることを確かめる。Neo4j の中を Cypher で直接見て、編集した node があることを確かめる。

## 段 2: 一度きりの移行

1. 既存の store のファイルを読んで Neo4j に入れる道具を作る（`beta/src/node/record_store_cli.ts`）。
2. 入れた後、record の数と内容を、元のファイルから組み立てた状態と比べる。一致したときだけ、元のファイルを archive へ移す。
3. 順は、mini の remote、MacBook の local（confirmed と working store）、Windows の local。

## 段 3: local モード

1. confirmed と working store を、同じ Neo4j の別の store にする。
2. clone は、remote の Neo4j から読み出した record を、端末の Neo4j に入れる。
3. outbox を Neo4j に置く。

## 段 4: 試験と CI

1. CI に Neo4j の service を足し、Neo4j に対する試験を毎回流す。
2. preflight は、手元の Neo4j に対して流す。

## 段 5: 検査と問い合わせを Neo4j へ

1. 確定の検査に要る周りの record（親への parent edge、scope、lock、grant、alias の参照先）を、Neo4j の問い合わせで読む形にする。
2. MCP の検索と取得を、Neo4j の問い合わせにする。

## 未対応（2026-11-27 時点）

- 古い時点の状態: projection の書き戻しが古い `baseSeq` を使うときの状態（`stateAt`）と、namedSnapshot の時点の状態は、Neo4j に別に持っていない。いまは、古い base の書き戻しを拒否し、namedSnapshot の record だけを持つ。projection を作った時点と namedSnapshot の時点の record を、Neo4j に別の store として残す形を決めて実装する。
- 起動時の読み込み: store を開くと、その store の全 record を Neo4j から読む（`dump`）。研究 map を含む workspace（約 10 万 record）で何秒かかるかを測る。
- 確定ごとの往復: 1 回の確定は、Neo4j への 1 回の transaction で、その中で十数回の問い合わせを送る。連続した入力で応答が遅れないかを測る。
- journal の行の保持: `JournalEntry` は消さずに増える。保持期間（90 日）と、全端末が pull した範囲より古い行の扱いを決める。
- 一度きりの移行の道具は、製品のコードに入れない。ファイルで動いていた最後の版（commit b763168）を固定した作業ツリーに置き、移行が済んだら作業ツリーごと捨てる。
