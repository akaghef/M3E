# PR16: 同じ Command 列を SQLite と Neo4j に適用した比較

2026-10-25。akaghef の依頼で Claude が計測した。brief の PR16 に当たる。DC39（移行先）を決めるための材料で、どの案を採るかは決めない。

- 計測器: [bench/pr16_bench.cjs](./bench/pr16_bench.cjs)
- 結果の生データ: [bench/pr16-results/](./bench/pr16-results/)（集計値と件数だけ。node の本文や ID は含まない）

## 判定の条件（計測の前に固定した）

- 有効性: 同じ Command 列を適用した後、各方式の最終状態が参照モデルと一致すること。一致しない計測は無効とする。
  - 構造の比較: node、親子、兄弟の並び、attribute、GraphLink、linear-text。
  - レコードの比較: 兄弟順キーまで含めて一致すること。全 JSON 方式にはキーがないので、構造の比較だけを行う。
- 移行の可逆性: 実データを草案のレコードに変換した直後の構造が、元の全 JSON の構造と一致すること。一致しなければ、計測の前に止める。
- 合否の閾値は置かない。比較の材料として、数値をそのまま記録する。

結果: 3 回の実行すべてで、全方式が有効だった。変換直後の一致も確認した。

## 比べた方式

| 方式 | 内容 |
|---|---|
| 全 JSON（現行） | Command ごとに `maps.state_json` を読み、変更して全置換する。MCP の経路と同じ形。journal は書かない |
| SQLite・DELETE | 草案 9.1 節の表（node、edge、attribute、graph_link、linear_text、map、journal）。`journal_mode=DELETE`、`synchronous=FULL`（現行と同じ設定）。レコードと journal を 1 transaction で確定する（OP43） |
| SQLite・WAL | 同じ表を `journal_mode=WAL`、`synchronous=NORMAL` で使う。Syncthing で同期している今の運用では使えない（草案 9.1 節） |
| Neo4j | 草案 9.2 節の形。node は `:N`、edge は `CHILD_OF` の relationship（兄弟順キーを持つ）、attribute は `:A`、linear-text は `:L`。確定ごとに `:M` の通し番号を進める。journal は別の SQLite ファイルに、確定の後に追記する（OP44 の別 failure domain を単純化した形） |

兄弟順キーは `fractional-indexing` 4.0.0 で作った。キーを作るのは確定する側で、journal には作った結果のキーを残す。

## Command 列と規模

- Command 列の構成（2,000 件）は次のとおり。
  - rename 30%、set-attribute 15%、unset-attribute 5%
  - 子の追加 15%、兄弟の追加 10%、reorder 5%、reparent 8%（部分木は 200 node 以下）
  - 部分木の delete 5%（30 node 以下。端点の GraphLink、attribute、linear-text も同時に消す）
  - GraphLink の作成 4%、linear-text の更新 2%（約 20 KB）、25 node の部分木の取り込み 1%
- Command 列は固定の seed から作る。どの方式にも同じ順で 1 件ずつ、1 つの書き手から適用した。
- 規模は 2 つ。
  - 研究 map の実データの複製（20,150 node、attribute 19,712、linear-text 15。GraphLink は 0）
  - その 10 倍の合成（201,491 node）。root の子の部分木を複製した。
- 全 JSON 方式は、10 倍の規模では先頭 100 件だけを適用した。1 件に約 0.8 秒かかるため。照合も、その 100 件分の参照モデルと行った。

## 環境

- MacBook Air（Apple M5、メモリ 32 GB）
- Node v26.0.0、better-sqlite3 12.11.1（SQLite 3.53.2）、neo4j-driver 6.2.0
- Neo4j Community 2026.10.1、Temurin JDK 21.0.13、heap 1 GB、page cache 1 GB
- Neo4j は 127.0.0.1 だけで待ち受け、認証は無効にした。実行のたびにストアを空にして起動し直した。

## 結果

### 確定 1 件の時間（ms）

| 方式 | 20,150 node の p50 | p95 | p99 | 201,491 node の p50 | p95 | p99 |
|---|---:|---:|---:|---:|---:|---:|
| 全 JSON（現行） | 51.9 | 64.5 | 86.0 | 769.1 | 1,065.4 | 1,171.5 |
| SQLite・DELETE | 0.32 | 0.47 | 0.71 | 0.38 | 0.59 | 0.82 |
| SQLite・WAL | 0.03 | 0.08 | 0.20 | 0.04 | 0.11 | 0.24 |
| Neo4j | 5.85 | 9.32 | 18.2 | 7.11 | 11.4 | 30.5 |

- seed 2 で 20,150 node をやり直した p50 は次のとおり。どの方式も 1 回目と同じ桁だった。
  - 全 JSON 50.2、SQLite・DELETE 0.40、SQLite・WAL 0.04、Neo4j 5.99
- Neo4j には、上の表とは別に journal の追記がかかる。p50 は 0.47 ms（20,150 node）と 0.67 ms（201,491 node）。
- 最大値は、SQLite・DELETE が 29 ms と 35 ms、Neo4j が 293 ms と 457 ms。Neo4j の大きな外れ値は、部分木の取り込みと delete に集中している（それぞれの p95 は 55 ms と 40 ms、20,150 node の場合）。
- intent ごとの値は [bench/pr16-results/](./bench/pr16-results/) の `byIntent` にある。SQLite と Neo4j では、どの intent も p50 がほぼ同じ水準だった。

### 読取りの時間（ms、5 回の中央値）

| 読取り | 全 JSON 20k / 200k | SQLite・DELETE 20k / 200k | Neo4j 20k / 200k |
|---|---|---|---|
| map 全体の読込み | 33 / 290 | 19 / 297 | 79 / 1,262 |
| 16,400 node の部分木 | 31 / 304 | 10.0 / 12.6 | 8.9 / 13.1 |
| 231 node の部分木 | 29 / 293 | 0.13 / 0.15 | 0.52 / 0.63 |
| 646 個の子の順序付き一覧 | 27 / 551 | 0.09 / 0.09 | 0.93 / 1.37 |
| 深さ 7 の node の祖先 | 27 / 478 | 0.008 / 0.009 | 0.39 / 0.57 |
| 3 歩先までの近傍（親子と GraphLink、5,189 node） | 34 / 501 | 8.6 / 9.9 | 3.8 / 4.3 |

SQLite・WAL の読取りは、SQLite・DELETE と同じ水準だった。

### 移行（投入）の時間と保存容量

| 方式 | 投入 20k / 200k | 2,000 件適用後の容量 20k / 200k |
|---|---|---|
| 全 JSON | 0.03 s / 0.38 s | 16.6 MB / 159 MB |
| SQLite・DELETE | 0.09 s / 1.45 s | 13.1 MB / 111 MB |
| SQLite・WAL | 0.10 s / 1.65 s | 23.8 MB / 219 MB（未 checkpoint の `-wal` を含む） |
| Neo4j | 2.2 s / 11.6 s | 28.1 MB / 231 MB（transaction log を含む） |

- SQLite と Neo4j の容量には、journal も含む。journal には、各 Command による変更の前と後の値が入っている。
- 内訳では、linear-text の 20 KB の更新（約 40 件）が journal を大きくしている。

## 分かったこと

1. **1 回の編集にかかる量**
   - 現行の全 JSON 方式は、map の大きさにほぼ比例して重くなる。node を 10 倍にすると、確定の p50 は 51.9 → 769 ms（14.8 倍）になった。
   - 草案のレコードモデルでは、どちらのエンジンもほぼ横ばいだった。
     - SQLite・DELETE: 0.32 → 0.38 ms
     - Neo4j: 5.85 → 7.11 ms
   - したがって RQ20 は、エンジンを問わずレコードモデルで満たせる。
2. **確定の速さ**
   - SQLite・DELETE は、Neo4j より p50 で約 18 倍速かった。
   - ただし、人の操作として遅延を感じる水準になる方式はどちらでもない。1 秒あたりの確定数は、SQLite・DELETE が約 2,800、Neo4j が約 150 だった。
   - Neo4j の値には、Command 1 件あたり 2〜5 回の Bolt の往復と JVM の外れ値が含まれる。intent ごとに Cypher を 1 文にまとめれば、もっと下がる余地がある。
3. **読取り**
   - 部分木はほぼ同じだった。
   - 3 歩先までの近傍は Neo4j が約 2 倍速かった（3.8 対 8.6 ms）。
   - 1 点の読取り（子の一覧、祖先）は SQLite が µs 単位で、Neo4j は往復の分だけ遅い。
   - map 全体の読込みは Neo4j が約 4 倍遅い。
4. **移行**
   - 実データの投入は、SQLite が 0.09 秒、Neo4j が 2.2 秒だった（20,150 node の場合）。
   - どちらの方式も、変換直後の構造が元の全 JSON の構造と一致した。
5. **エンジン中立性の確認**
   - 同じ Command 列を適用すると、SQLite の 2 方式と Neo4j の最終状態は、兄弟順キーまで一致した。
   - 草案が言う「確定する側がキーを作り、その結果を journal に残せば、replay の結果はエンジンによらない」は、この範囲では成り立った。
6. **問い合わせの書き方による落とし穴（どちらのエンジンにもあった）**
   - SQLite の再帰 CTE は、planner が edge 表を外側のループにしてしまい、16,400 node の部分木に約 9 秒かかった。`CROSS JOIN` で結合の順序を固定すると 10 ms になった（SQLite 3.41 以降の planner の性質。research-engines.md 1 節）。
   - Neo4j の可変長の pattern は、始点を先に固定しないと全 node から展開を始め、DB を 1,300 万回読んで 2.6 秒かかった。始点を固定した書き方では 4 ms になった。
   - どちらのエンジンを選んでも、adapter の問い合わせは実行計画を確かめる試験で固定する必要がある（IS147）。

## この計測が示さないこと

- **GraphLink の多い map**：研究 map には GraphLink がない。GraphLink の多い map や、文書をまたぐ Deep の問い合わせは代表していない。それには PR17（実際に必要な Deep の問い合わせの棚卸し）の結果が要る。
- **同時書込み**：書き手は 1 つで、Command を順に適用しただけ。複数の書き手が同時に書く場合や、offline からの合流は測っていない。
- **Neo4j の adapter**：素直な書き方で、往復の回数を減らす最適化はしていない。journal の順序は、OP44 の「journal を先に書く」を「確定の後に追記する」に単純化した。時間への影響は小さいが、障害時の意味は違う。
- **10 倍の規模**：既存の部分木の複製で作ったので、部分木の大きさの分布は実データと同じ。
- **測っていない費用**：PC ごとに JVM を常駐させる費用、起動時間、backup の取り方。Community には online backup がない。
- **計測の範囲**：1 台の Mac で 1 回ずつの計測（20,150 node だけは 2 回）。

## 再現

前提を揃えたうえで、次のコマンドを実行する。

前提:

- 研究 map を含む workspace の SQLite の複製。読み取り専用の `.backup` で作る。
- `fractional-indexing@4.0.0` を入れたディレクトリ（`--deps`）。
- 127.0.0.1:17687 で動く Neo4j Community 2026.10.1。認証は無効にする。

```bash
node .kiro/specs/rapid-persistence-redesign/bench/pr16_bench.cjs --source <workspace の複製> --map <研究 map の ID> --work <作業ディレクトリ> --beta beta --deps <fractional-indexing のディレクトリ> --scale 1 --commands 2000 --seed 1
```

10 倍の規模では、`--scale 10 --whole-json-commands 100` を付ける。

## Next Action

- DC39 の判断に、この結果と PR17 の棚卸しを合わせて使う。
- この計測で使った Neo4j と JDK は、セッションの一時ディレクトリに置いたものである。Neo4j は計測の後に停止した。
