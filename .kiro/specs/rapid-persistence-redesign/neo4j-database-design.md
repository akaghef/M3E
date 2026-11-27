# Neo4j を database にする設計

akaghef の決定（2026-11-27）: M3E の database は Neo4j（graph）である。永続は Neo4j が担い、journal は端末と remote のやりとりを担う。JSON の database と、Neo4j と別のファイルの snapshot は置かない。map の表示は Neo4j の問い合わせで出す。

本書は、その決定を実装する形を決める。基準パスはリポジトリの root である。

## 1. いまの実装との差

| 役割 | いまの実装 | 本書の形 |
|---|---|---|
| 状態の永続 | `store/snapshot.jsonl` と `store/journal.jsonl` | Neo4j |
| map の読み出し | jsonl から組み立てたメモリ上の record | Neo4j の問い合わせ |
| 確定の検査 | メモリ上の record と `CommitGuardIndex` | 確定の transaction の中で、Neo4j から読んだ record |
| 確定の記録（journal） | `journal.jsonl` | Neo4j の `Commit` node。pull で端末へ渡す |
| 再送の判定 | メモリと `commit-index.json`、`sync-rejections.jsonl` | Neo4j の `CommandResult` node |
| 削除した ID の再利用の禁止 | `commit-index.json` の `retired` | Neo4j の `Retired` node |

## 2. 配置

- 各端末に Neo4j を一つ置く（Community 版、database は一つ）。remote の端末（Mac mini）にも置く。
- 一つの Neo4j に、複数の store を置く。store は、remote の workspace、local の confirmed、local の working store のそれぞれである。全ての node に属性 `ws`（store の名前）を持たせて分ける。
- 一意の制約は `(ws, rk)` に置く。`rk` は record の key（`node|<id>` など）である。
- Neo4j は `127.0.0.1` だけで待ち受ける。同じ端末の process を信頼する（mini の remote と同じ扱い）。

## 3. graph の形

- record は、`neo4j_store/encoding.ts` の形のまま node にする（共通ラベル `Rec`、種別のラベル、`SOURCE`・`TARGET`・`IN_MAP` などの関係）。ここに `ws` を足す。
- store ごとに `Head` node を一つ置く: `{ws, seq, workspaceId, historyId, epoch, format}`。`seq` は最後に確定した通し番号である。
- 確定ごとに `Commit` node を一つ置く: `{ws, seq, issuer, committedAt, mapId, intent, commandId, ...}`。`ops` は、端末とのやりとりの書式（push と pull の本文と同じ）で持つ。`Commit` は journal の役割で、pull はここから log suffix を返す。
- `CommandResult` node: `{ws, commandId, hash, syncHash, mapIds, seq, result}`。再送の判定に使う（DB 仕様書 5.3）。
- `Retired` node: `{ws, id}`。削除した node の ID の再利用を禁じる。

## 4. 確定

- 1 Command を 1 回の Neo4j の write transaction で確定する。
  1. `Head` を lock し、`seq` を読む（workspace ごとの single-leader の直列化）。
  2. `CommandResult` を commandId で引き、再送なら最初の結果を返す。
  3. Command が触る record を、`rk` で Neo4j から読む。
  4. 検査に要る周りの record も、問い合わせで読む。対象の node の親への parent edge、node が属する scope、map の lock と grant、alias の参照先である。
  5. 既存の検査（`operations.ts` の `commitTimeRefusal` と、store の CAS・不変条件の判定）を、読んだ record に対して行う。
  6. 通れば、record の put と delete、`Commit` の作成、`Head.seq` の更新を、同じ transaction で書く。
  7. transaction が確定したら応答する。耐久性は Neo4j の transaction log が担う。
- 拒否も、確定的なもの（`CONFLICT`、`INVALID_STATE`、`INVALID_COMMAND`）は `CommandResult` に書いてから返す。
- 手間は、触る record と周りの record の数に比例させる。map 全体を読まない。ただし、map 全体を置き換える古い保存の経路（`saveWholeMap`）は、差分を作るために map 全体を読む。

## 5. 読み出し

- map の状態は、`(ws, mapId)` で record を問い合わせて組み立てる。
- 変更分の読み出し（`GET /api/maps/:id/records?since=`）は、`Commit` の seq と record の `rev` で絞る。
- pull は、指定した seq より後の `Commit` を順に返す。clone は、store の record と `Head` を Neo4j から読み出して渡す。

## 6. local モード

- confirmed と working store は、同じ Neo4j の別の `ws` である。
- pull で得た `Commit` を confirmed に適用する。working store の作り直しは、変わった record だけを confirmed から写し、まだ確定していない Command を replay する（変更に比例）。
- outbox（まだ remote へ送っていない Command）は、端末と remote のやりとりの待ち行列である。Neo4j の `Outbox` node に置く。

## 7. 一度きりの移行

- 各 store の現在の `snapshot.jsonl` と `journal.jsonl` を読み、Neo4j に入れる。`commit-index.json` と `sync-rejections.jsonl` の中身は `CommandResult` と `Retired` に入れる。
- 入れた後、record の数と内容の hash を、元のファイルから組み立てた状態と比べる。一致したら、元のファイルを `archive` へ移し、以後は書かない。一致しなければ移行を止め、元のファイルで動かし続ける。
- 移す順は、mini の remote、MacBook の local、Windows の local である。

## 8. 復旧

- 端末の Neo4j が壊れたら、remote から clone し直す。
- remote の Neo4j の控えは、定期的に database 全体を export して残す。export は運ぶ書式のファイルであり、database ではない。

## 9. API

- `RecordWorkspaceStore` の公開の関数を、Promise を返す形にする。呼び出し側（`start_viewer.ts`、`legacy_api.ts`、`mcp_service.ts`、`map_commit.ts`、`sync/`、`backup.ts`、`record_store_cli.ts`、`rapid_mvp.ts`）は await する。
- 意味の試験（確定、拒否、再送、conflict、同期）は、Neo4j の store に対して流す。

## 10. 無くすもの

- `snapshot.jsonl`、`journal.jsonl`、`commit-index.json`、`sync-rejections.jsonl` の読み書き。
- compaction と journal の archive。
- メモリ上の record の集合を、状態の置き場として使うこと。
- 確定を後から Neo4j へ写す queue（`record_store/engine.ts`）と、`ENGINE_BEHIND`（確定そのものが Neo4j への書き込みになるため、遅れは生じない）。
