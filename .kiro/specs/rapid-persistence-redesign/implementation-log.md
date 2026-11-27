# 実装ログ（保存・DB）

保存と DB の作業をする agent が、作業の中で得た気づきと見つけた問題を書き込む場所。言われたことをこなすだけでなく、作業で分かったことを仕様と次の作業に活かすために使う。

対象は [DB 仕様書](../../../docs/03_Spec/Database_Spec.md)と、この spec の文書（[record-schema](record-schema.md)、[snapshot-format](snapshot-format.md)、[post-migration-spec](post-migration-spec.md) など）、`beta/src/shared/record_model/`、`beta/src/node/record_store/`、`beta/src/node/neo4j_store/` である。

## 使い方

### いつ書くか

作業の中で、指示の外にあることに気づいたら書く。例を挙げる。

- 仕様と実装の食い違い
- 仕様の穴（決まっていないのに、実装が何かを前提にしている）
- 実データで分かった事実（件数、形の不揃い、大きさ）
- 性能の事実（どこが遅いか、何に比例するか）
- 危険（データが消える、戻せない、黙って壊れる）
- 次の作業を楽にする気づき（再利用できる関数、試験の作り方）

### どこに書くか

- **確かめた事実で、仕様の記述を正す・補うもの**: その仕様に直接書く。たとえば【実装済み】の状態、数値、ファイルの位置がこれに当たる。このログには 1 件立て、扱いを「仕様へ反映」として行き先を書く。
- **決定が要るもの、その作業では直さないもの**: このログにだけ書く。仕様の【決定】の中身を、実装者の判断で書き換えない。決定は akaghef が行う。
- **M3E の map の操作で得た教訓**: `m3e_feedback` に送る（AGENTS.md の規則）。このログには書かない。

### 書き方

- 新しいものを上に足す。1 件は次の形にする。

```
### YYYY-MM-DD 一行の題（何が起きているか）

- 種類: 問題 / 気づき
- 書いた agent: 役割や session の名前（ID は書かない）
- 対象: 仕様の節、file:line
- 中身: 何が分かったか。読んだ人が元を辿らずに分かるように書く
- 根拠: どう確かめたか（実行したコマンド、読んだコード、計測）。確かめていなければ「未確認」と書く
- 扱い: 未対応 / akaghef の判断待ち / 仕様へ反映（行き先） / 実装で解消（commit と、その意図） / 不要（理由）
```

- 解消しても消さない。扱いを書き換える。
- 定義語だけを使う（[Glossary](../../../docs/00_Home/Glossary.md)）。用語の変更の経緯や旧い呼び名は書かない。
- 会話の中の番号（DA1、IB3 など）は、そのまま書かない。中身を文で書く。

### 読む側

- 保存と DB の作業を始める agent は、扱いが「未対応」と「akaghef の判断待ち」の項目を先に読む。
- 自分の作業で解消した項目は、その場で扱いを更新する。

## 記録

### 2026-11-25 push の前に outbox の Command をまとめていない（作ってすぐ消した node も remote に残る）

- 種類: 問題
- 書いた agent: unscopen の競合パネルを直した Claude Code の session
- 対象: `beta/src/node/sync/local.ts` の `push()`、sync-requirements R8.1
- 中身: outbox の Command は、記録した順にそのまま remote へ送られる。push の前に node を作って消すと、作成と削除の 2 件がそれぞれ remote で確定し、journal に載る。続けて行った更新も 1 件ずつ確定する。打ち消されるのは、remote の journal が snapshot に畳み込まれるときだけになる。消した node の本文は一度 remote の journal に載り、畳み込み後も archive に 90 日残る。まとめ方の案は次のとおり。まだ一度も送っていない同じ issuer の連続した Command について、record ごとに作成と削除の組は両方とも落とし、連続する更新は最初の `before` と最後の `after` の 1 件にまとめる。まとめた Command には新しい `commandId` を振る（送信済みの ID で中身を変えると `SAME_ID_DIFFERENT_CONTENT` で拒否されるため）。map の作成・削除・改名をまたいではまとめない。
- 根拠: `push()` と `rebuild()` を読んだ。push と journal のどちらにも、まとめる処理はない。
- 扱い: akaghef が 2026-11-27 に、提案のとおりに決めた（「全部推奨で」）。実装で解消。push の前に、まだ一度も送っていない同じ issuer の連続した Command を、中身に書いた形でまとめる（`beta/src/node/sync/outbox_squash.ts`）。送ろうとした Command には送信前に印を付けて永続化し、まとめの対象から外す。outbox の書き換えは atomic rename で行う。手間はまだ送っていない Command の数に比例する。試験は `beta/tests/unit/outbox_squash.test.ts` と `local_sync_store.test.ts`（作成と削除の取り消し、更新の集約、応答を失った後の同じ ID の再送）。設計は [local mode の設計](local-mode-design.md) 4 節。

### 2026-11-25 何も変えない Command が outbox に入り、remote へも送られる

- 種類: 問題
- 書いた agent: Δ 比例の原則を入れた Claude Code の session
- 対象: MacBook の Beta workspace の outbox（2026-11-25 時点の 52 件目）、`beta/src/shared/map_changes.ts` の `diffState`
- 中身: intent が `rename` で、変更が 1 件だけの Command が outbox にあった。その 1 件は node の update で、`before` も `after` も `{}` だった。working store で commit し直すと no-op になり、journal に行を残さない。push すれば remote でも no-op になるが、outbox の 1 件、push の 1 件、当て直しの 1 回を無駄に使う。どの経路が空の update を作ったかは確かめていない（viewer の改名の保存と思われる）。local 側は、この no-op を飛ばして再開できるように直した（このログと同じ commit）。
- 根拠: `sync/outbox.jsonl` と working store の journal を突き合わせた。
- 扱い: 未対応（空の update を作る経路を特定し、Command に入れないようにする）

### 2026-11-25 書き込み・同期・表示更新の経路に、まだ全体に比例する処理がある

- 種類: 問題
- 書いた agent: Δ 比例の原則を入れた Claude Code の session
- 対象: [同期の思想](sync-principles.md)「手間は変化分に比例させる」、`beta/src/node/record_store/store.ts`、`beta/src/shared/map_changes.ts`、`beta/src/browser/viewer.ts`
- 中身: 原則（2026-11-25、絶対）に反する処理を、読んだ範囲で挙げる。
  - remote の `/api/sync/pull`: `linesAfter` が journal ファイル全体を読んで解析し、要求された範囲だけを返す（`store.ts` の `linesAfter`）。手間は journal の長さに比例し、届ける行数に依らない。
  - `committedCommand`: Command の結果を 1 件引くたびに journal ファイル全体を読む（`store.ts` の `committedCommand`）。
  - commit: `commitPlanned` が map の状態全体を複製し、全体の差分を取る（`jsonClone(warm.state)` と `diffState`）。`applyChanges` の `Draft` は、触った欄（`nodes` など）の辞書を丸ごと複製する（`map_changes.ts` の `own`）。どちらも 1 回の commit が map の大きさに比例する。
  - viewer の保存: 自動保存のたびに、map 全体について `diffState(base, state)` を取る（`viewer.ts` の `saveDocToLocalDb` と `save_command.ts`）。
  - local の rebase: 触った map の投影（warm）と近傍の索引を捨てるので、次に読むときに map 全体を投影し直す。commit の側も map 全体を複製しているので、今は同じ桁にとどまる。
- 根拠: コードを読んだ。所要時間は測っていない（原則により、構造で判断する）。
- 扱い: 未対応。remote の journal を通し番号で引けるようにする（行の位置の索引）、commit と保存の差分を変えた record に限る、の二つに設計が要る。名前付き snapshot の記録を確かめるため commit のたびに全 record を走査していた件は、このログと同じ commit で解消した（名前付き snapshot の record に触れない commit では何もしない）。

### 2026-11-25 push と pull のたびに、working store を confirmed 全体の複製から作り直している

- 種類: 問題
- 書いた agent: unscopen の競合パネルを直した Claude Code の session
- 対象: `beta/src/node/sync/local.ts` の `rebuild()`
- 中身: `rebuild()` は、変わった範囲に関係なく毎回、confirmed の record を全部書き出して新しい working store を作る。そのうえで、pending をすべて当て直す。push の最後にも pull が走るので、同期 1 回ごとに「workspace 全体＋outbox 全体」に比例した処理になる。2026-11-25 の MacBook では、confirmed が 29MB、outbox が 113 件（664KB）だった。また、confirmed は `compactAfterLines: 0` で開いているので、その journal は、remote から snapshot ごと取り直さない限り短くならない。作り直しは単純には省けない。pull で戻ってきたのが自分の Command だけでも、remote は確定のときに兄弟順キーを作り直すことがある（sync-principles）。そのため「自分の Command しか戻らなかったから working store はそのままでよい」とは言えない。差分で当てる方法か、複製を安くする方法（APFS の clone など）を設計する必要がある。
- 根拠: `rebuild()` と `pullNow()` を読んだ。大きさは MacBook の Beta workspace を `du` と `wc` で測った。所要時間は測っていない。
- 扱い: 実装で解消（このログと同じ commit）。pull では working store をその場で rebase する。基点より後に pending が変えた record と、届いた行が変えた record だけを confirmed の値に戻し（1 行の `local-rebase`）、pending を commit し直す。手間は届いた行と pending に比例する。起動時は、基点（`sync/remote.json` の `working`）が working store の journal と outbox に合えば、そのまま開いて止まっていた間の行だけを rebase する。confirmed は、追記に失敗したときだけ開き直す。全体の作り直しは、clone、reclone、基点が合わないとき、rebase が途中で失敗したときだけになった。試験（`beta/tests/unit/local_sync_store.test.ts`）では、同じ Δ を 10 node と 5,010 node の workspace に当て、rebase が書く record の数が同じであることを確かめる。直す前の実装ではこの試験は失敗する。設計は [local mode の設計](local-mode-design.md) 5 節。

### 2026-11-25 push を、同じ issuer が続けて書いた Command ごとに 1 リクエストで送るようにした

- 種類: 気づき
- 書いた agent: unscopen の競合パネルを直した Claude Code の session
- 対象: `beta/src/node/sync/local.ts` の `push()`
- 中身: これまでの push は、Command 1 件ごとに 1 リクエストを送っていた。remote の `/api/sync/push` はリストを受け取り、順番に確定させて 1 件ずつ結果を返す。それでも 1 件ずつ送っていたのは、remote が issuer をリクエストのヘッダーから決めるためで、人と MCP の Command を同じリクエストに混ぜられないからだった。今は、ヘッダーが同じ間は Command をまとめ、issuer が変わる所とリクエスト本文が 4,000,000 バイトに達する所でリクエストを分ける。結果が返らない Command があれば、そこで push を止め、その Command は outbox に残る。
- 根拠: `beta/tests/unit/local_sync.test.ts` に試験を 2 つ足した。同じ issuer の 3 件が 1 リクエストになること（直す前は 3 リクエストで失敗する）と、issuer が変わる所でリクエストが分かれること。
- 扱い: 実装で解消（このログと同じ commit）

### 2026-11-25 空の attributes・nodeViews と、nodeType が無い node は、record store を通ると形が変わる

- 種類: 気づき
- 書いた agent: unscopen の競合パネルを直した Claude Code の session
- 対象: `beta/src/shared/map_changes.ts` の `fieldConflicts`、`beta/src/shared/record_model/from_snapshot.ts:143` と `:244`
- 中身: record store には、空の `nodeViews` / `attributes` の入れ物を表す record がない。そのため、読み戻すと欄そのものが無くなる。`nodeType` が無い node は `"text"` として読み戻される。viewer は `nodeViews: {}` を持ち、unscopen では `nodeType` を消す。そのため、Command の `before` と今の値の照合（compare-and-set）が食い違い、local モードの unscopen と、その後の scopen が毎回 409 `DOC_NODE_CONFLICT_Q` になっていた。照合では、空の入れ物と欄が無いことを同じとみなし、node の `nodeType` が無いことと `"text"` を同じとみなす。適用する側の `assignFields` は、もともと空の入れ物を値として扱っていなかった。
- 根拠: 使い捨ての remote と local を実際のブラウザで動かし、409 を再現した。直した後は保存も push も通り、通常の Beta でも 200 で通ることを確かめた。回帰試験は `beta/tests/unit/map_changes.test.ts`。
- 扱い: 実装で解消（26e93e9: unscopen で競合パネルが出ないようにした。8b5f69d: unscopen の後の scopen で出ないようにした）

### 2026-11-23 local モードを実機（MacBook・Mac mini、Tailscale 越し）で通した結果

- 種類: 事実
- 書いた agent: local モードの検収（orchestrator）
- 対象: [local モードの設計](local-mode-design.md) 7〜8 節、[同期の要件](sync-requirements.md) R1.1、R6.1
- 中身: 試験用の remote を mini に置き（tailscale serve の後ろ、login の照合つき）、MacBook と mini に local を一台ずつ置いて、両方向の push と pull、同じ node の競合、remote 停止中の編集と復帰後の push を通した。すべて合格。その過程で三点を直した。(1) tailscale serve は止まった remote の代わりに 502 を返し、local はそれを「拒否」と表示していた。gateway の 502・503・504 は「届かない」とした（631d53f）。(2) 同期の表示は使われていない古い toolbar に付いていて画面に出ていなかった。workbench の header の差し込み口へ移した（384a80f）。(3) clone を持つデータディレクトリを M3E_SYNC_REMOTE なしで起動すると remote として動き、編集が outbox を通らなかった。`sync/remote.json` があれば local として起動するようにした（4cca321）。
- 根拠: 判定 `beta/tests/acceptance/local_mode_judge.mjs`（remote 1・local 2、16/16 合格）と、実機での手順の結果。
- 扱い: 解消。Windows の local は、Windows の `npm ci` が ENOTEMPTY で失敗し、未確認（依存の入れ直し中）。

### 2026-11-23 通常の Beta workspace は mini の remote と MacBook の local になった

- 種類: 事実
- 書いた agent: local モードの検収（orchestrator）
- 対象: [local モードの設計](local-mode-design.md) 2 節
- 中身: ws_REMH の remote は mini（`https://swingbymac-mini.tail6206ae.ts.net`、LaunchAgent `com.m3e.remote-beta`）。MacBook の Beta（4173）はその local で、`~/Library/Application Support/M3E/workspaces/ws_REMH…` は clone（`sync/remote.json` を持つ）。移す前のディレクトリは `~/Backups/M3E/261123-0833-pre-local/` に退避した。MacBook の M3E plugin は local（127.0.0.1:4173）を指す。mini の AI agent は remote の URL を使う（mini の loopback は login の照合で 403）。local の clone が remote の off-host の写しを兼ねるので、remote の clone を MacBook へ定期保存する LaunchAgent は入れていない。
- 根拠: clone 後の local の状態（確定番号 14 が remote と一致、map 42）。
- 扱い: 記録のみ。push と pull は手動（R6.1）。

### 2026-11-23 local モードの v1 で共有する状態と今後の境界

- 種類: 気づき
- 書いた agent: local モード実装
- 対象: [local モードの設計](local-mode-design.md) 2〜6 節、[同期の要件](sync-requirements.md) R4.4、R4.5、R6.9
- 中身: local は snapshot と journal を保持する。clone に commit index を添えると、map の更新日時、削除した ID の再利用制約、確定済み Command の重複排除を引き継げる。working store の再構築で番号が同じでも内容が変わりうる。既存の Neo4j applier は同一 workspace の seq が一致すると再構築を省くため、local の working store には接続しない。
- 根拠: `local_sync_store.test.ts` で clone、journal の再生、再 clone、outbox の復元、重複排除、入れ替え失敗時の保全を検証した。Neo4j の挙動は `beta/src/node/record_store/engine.ts` の起動時の判定を読んだ。
- 扱い: working store と outbox は実装で解消。Neo4j の切り替え、宣言された依存と再送窓の期限切れ、再 clone 時の結果再照合は未対応。歴史を作り直すときは `record_store_cli --create … --from-snapshot … --new-history` で履歴 ID を発行し、epoch を増やせる。

### 2026-11-23 単一 Command が既存の push の受付上限を超える場合

- 種類: 問題
- 書いた agent: local モード実装
- 対象: `beta/src/node/sync/http.ts`、[同期の要件](sync-requirements.md) K10
- 中身: local は同じ issuer の Command をまとめて送る。単一 Command が push の受付上限を超える場合にも、outbox を保持し、止まっている Command と理由を同期状態で確認できる必要がある。
- 根拠: `beta/tests/unit/local_sync_store.test.ts` の `transport A1: pushes and confirms a single Command above the batch and former request caps`、`transport A2: reports PUSH_COMMAND_TOO_LARGE, preserves order and retains blocked status after restart`、`transport retries smaller batches after a proxy 413 and clears blocked status only after settlement`。A1 は 9,000,000 byte の値を単一 Command として確定し、A2 は 32,000,000 byte の本文上限超過で停止理由・後続の順序・再起動後の状態を検証する。変更前の origin/dev-beta では A1・A2 が失敗し、変更後は合格。実 HTTP handler をプロセス内で通した。socket を使う既存試験は sandbox の listen EPERM により未検証。
- 扱い: transport の実装で解消。通常の batch は本文全体で 4,000,000 byte まで、大きい Command は単独送信し、remote は非圧縮 JSON 本文を 32,000,000 byte まで受け付ける。413 は接続破棄ではなく明示応答になり、単独送信の拒否は同期状態 API の `push.state: blocked` / `PUSH_COMMAND_TOO_LARGE` として map 名・intent・理由・Command の識別情報を保持する。後続は追い越さず、手動再試行で結果が確定すれば解除する。Command の分割と journal の変更はない。K10 の変更対象数・依存数などは未決のまま。viewer の表示追加は本変更の範囲外。


### 2026-11-23 Mac mini の remote は、mini 上の process からの loopback 接続で login を偽れる

- 種類: 問題
- 書いた agent: 3 端末同期の段階 1（Mac mini の remote への移設）を進める session
- 対象: `beta/src/node/remote_access.ts` の `allowedLogin`、`scripts/remote/README.md` のアクセス境界
- 中身: Mac mini の M3E は 127.0.0.1 だけで待ち受け、`tailscale serve` を通った要求の `Tailscale-User-Login` を許可リストと照合する。tailnet の外から来る偽の header は serve が本物の login で上書きする。一方、mini 上で動く process（Swingby の docker 群など）は 127.0.0.1:4173 に直接つなぎ、この header を自分で付けられる。そうすると workspace 全体を読み書きできる。
- 根拠: リハーサルで、header の無い loopback 接続が 403、serve 経由の偽 header が本物の login に置き換わることを確かめた。header を付けた loopback 接続は確かめていないが、照合が header だけを見ることはコードから分かる。
- 扱い: akaghef が 2026-11-27 に、提案のとおりに決めた（「全部推奨で」）。決定は「unix socket で閉じる。tailscale serve が unix socket へ転送できない場合は、mini 上の process を信頼する」。M3E 側は実装した（`M3E_LISTEN_SOCKET`、socket は 0600、試験は `beta/tests/unit/remote_socket.test.ts`）。しかし Mac mini の Tailscale（`io.tailscale.ipn.macsys` の system extension）は、`unix:<path>` を受け付けても転送できず、`/tmp`・`/Users/Shared`・ホームの下のどの socket にも 502 を返した（2026-11-27 に mini で確かめた）。そのため決定の分岐に従い、mini は loopback の TCP のままにして、mini 上の process を信頼する。sandbox でない `tailscaled` に替えれば socket で閉じられる（`scripts/remote/README.md`）。

### 2026-11-23 remote の journal の issuer に、接続した人の login が入らない

- 種類: 気づき
- 書いた agent: 3 端末同期の段階 1 を進める session
- 対象: `beta/src/node/sync/http.ts` の `connectionFromRequest`、`beta/src/node/sync/issuer.ts`
- 中身: remote では、照合を通った login（`Tailscale-User-Login`）が分かっているが、viewer からの確定の issuer は接続の種類（viewer）の account のままで、誰が書いたかが journal に残らない。login を issuer に渡す接続点は `connectionFromRequest` である。
- 根拠: コードを読んだ。
- 扱い: akaghef が 2026-11-27 に、提案のとおりに決めた（「全部推奨で」）。実装で解消。remote は、許可リストとの照合を通った login を、viewer からの確定の issuer に入れる。MCP からの確定の issuer は、その AI agent の account のままにする。login が無いとき（local モード、header の無い loopback）は従来どおり。新しい欄は足していない。試験は `beta/tests/unit/sync_remote_identity.test.ts` と `local_sync_store.test.ts`。

### 2026-11-23 remote の map の読み込みを圧縮しない

- 種類: 気づき
- 書いた agent: 3 端末同期の段階 1 を進める session
- 対象: `beta/src/node/start_viewer.ts` の map 読み込みの応答
- 中身: 20,150 node の map（約 8 MB の JSON）を Tailscale 越しに読むと 1.2〜1.7 秒かかる。同じ map を手元の server から読むと 0.1 秒である。`Accept-Encoding: gzip` を送っても、圧縮しない応答が返る。自宅 LAN の外から DERP 経由でつなぐと、さらに遅くなりうる。
- 根拠: 遅延はリハーサル時の curl 計測。圧縮の回帰試験は `beta/tests/unit/local_sync_store.test.ts` の `transport B1: map load negotiates gzip and decompresses to the exact uncompressed response` と `transport B2: map load without Accept-Encoding keeps the original JSON body`。B1 は origin/dev-beta で Content-Encoding が無く失敗し、変更後は合格。B2 は前後とも合格し、ヘッダーなし・gzip;q=0 の非圧縮応答を確認する。実 map route をプロセス内で通した。Tailscale 越しの再計測はしていない。
- 扱い: 実装で解消。map 読み込みと共通の JSON 応答 helper が Accept-Encoding を照合し、gzip を許す要求には Node.js 組み込み zlib の非同期 gzip と Content-Encoding: gzip、Vary: Accept-Encoding を返す。展開後の本文は非圧縮応答と byte 単位で同じ。ヘッダーなし・gzip を拒否した要求では従来の JSON 本文を返す。圧縮の処理量は当該応答の byte 数に比例する。

### 2026-11-22 削除した node の本文が commit-index.json に上限なく積もる

- 種類: 問題
- 書いた agent: format 2 の統合を受け入れる session
- 対象: `beta/src/node/record_store/store.ts` の `retired` と `commit-index.json`
- 中身: 削除した ID は、同じ本文を作り直す Undo のときだけ戻せる。そのために、store は削除した node の本文を `retired` に持ち、`commit-index.json` に書く。件数にも期間にも上限が無く、削除のたびに index が大きくなり、確定ごとに書き直す量も増える。90 日の保持期間や archive の削除とも結び付いていない。
- 根拠: `retired` の読み書きを読んだ。消す経路は、同じ ID の作り直しだけである。
- 扱い: 未対応

### 2026-11-22 射影や書き戻しの journal の actor は、kind が常に system である

- 種類: 問題
- 書いた agent: format 2 の統合を受け入れる session
- 対象: `beta/src/node/record_store/store.ts`（射影、書き戻し、band、昇格、namedSnapshot の Command）
- 中身: これらの Command は、journal の `actor` を `{kind: "system", id: issuer}` と書く。MCP から来たときの issuer は AI agent の account なので、actor の kind と issuer の account の種類が食い違う。issuer は正しい。
- 根拠: port 4192 の実データの複製で、MCP の named-snapshot と project の行が `issuer: acct_ai_…` と `actor.kind: system` を持つ。
- 扱い: 未対応

### 2026-11-22 確定のたびに、射影と拒否の判定が map 全体を歩く

- 種類: 問題
- 書いた agent: format 2 の統合を受け入れる session
- 対象: `beta/src/node/record_store/store.ts` の `commitChanges`、`beta/src/shared/record_model/steady.ts` の `MapProjector.project`、`beta/src/node/record_store/operations.ts` の `commitTimeRefusal`、`beta/tests/unit/record_store_perf.test.ts`
- 中身: 20,000 node の map で 1 つの node の text を変える確定は、手元で中央値 20〜27 ms、CI の runner では 68〜104 ms で、試験の上限 100 ms を越える回がある。確定の時間の約 6 割は、map の state 全体から record を作り直す射影である。約 1.5 割は、拒否の判定が確定前の record 全体を走査して、lock・grant・node・edge・scope の表を作る分である。node の内容（text・details・note・collapsed・link）だけを変える Command では、画面用モデルの検証を省き、前の確定の結果を使う。射影を Command の触れた record だけに絞ることと、拒否の判定を種類ごとの索引から引くことはしていない。
- 根拠: 単一の text 編集 20 回の CPU profile。`commitChanges` の中で `MapProjector.project` が 59.5%、`applyChangesReduced` が 20.1%、`commitTimeRefusal` が 15.0%。CI の Build & Test は fe6e0d6 で 100.5 ms、fd3e2da で 100.1 ms と 104.5 ms、fd7e700 で 72.4 ms。
- 扱い: 未対応

### 2026-11-22 減衰する累積の record の kind 名は、仕様が名付けていない

- 種類: 問題
- 書いた agent: format 2 の decay と局所検査の session
- 対象: DB 仕様書 9 節、format2-requirements.md の R4.22・R11.2・R11.4、`beta/src/shared/record_model/types.ts`（`DecayRecord`）、`beta/src/shared/record_model/decay.ts`
- 中身: 仕様は累積を `{v[k], t}` として portable snapshot の状態に持つ、と書く。record の kind 名は無い。実装は kind `decay` を使う。key は対象の rk で、`node|id` または `scope|id` である。rk は `decay|` にその対象を続けたものになる。確定が触れた node と、その node が載る scope を、確定ごとに 1 回ずつ進める。読むときは scale ごとに 1 回掛けるだけで、1 は足さない。`m3e:derived:` の計算値は保存しない。
- 根拠: DB 仕様書 9 節と format2-requirements.md を読んだ。どちらも kind 名を書いていない。`record_store_decay.test.ts` が、決めた式と snapshot の再生、圧縮、Neo4j の往復を見ている。
- 扱い: 未対応

### 2026-11-22 減衰の scale の列は、仕様に無い

- 種類: 問題
- 書いた agent: format 2 の decay と局所検査の session
- 対象: DB 仕様書 9 節、quantities-requirements.md、`beta/src/shared/record_model/decay.ts` の `DECAY_SCALES`
- 中身: 仕様は scale `k` ごとに `v_k(now) = v_k(t) * 2^(-(now-t)/2^k 秒) + 1` と書く。`k` の一覧は無い。実装は `k = 6, 10, 16, 20, 24` の 5 つを、この順で `v` に並べる。時刻は確定の `committedAt` である。
- 根拠: DB 仕様書 9 節と quantities-requirements.md を読んだ。scale の列はどちらにも無い。
- 扱い: 未対応

### 2026-11-22 extensionDef の ref の形は、仕様が二通りに読める

- 種類: 問題
- 書いた agent: format 2 の decay と局所検査の session
- 対象: DB 仕様書 10.2、`beta/src/shared/record_model/extensions.ts`（`extensionValueErrors`）
- 中身: 10.2 は、ref の指す node が存在するとき、その node が同じ extension を持つことを確定時に検査する、と書く。ref の文字列が `name@version` なのか `prefix:class:name` なのかは書いていない。実装は、`name@version` ならその版だけを、`prefix:class:name` ならどの版でも、extensions に含まれるかを見る。どちらでもない文字列（既存の `ref: "node"` を含む）は保存し、照合しない。参照先の node が無いときは broken として保存を許す。
- 根拠: DB 仕様書 10.2 を読んだ。`record_store_decay.test.ts` が、存在するが extension を持たない node の拒否と、無い node の保存を見ている。
- 扱い: 未対応

### 2026-11-22 account record を Command で作れない

- 種類: 問題
- 書いた agent: format 2 の同期入口の session
- 対象: DB 仕様書 5.1、format2-requirements.md 3 節、`beta/src/node/sync/issuer.ts`
- 中身: 接続から選んだ account id を journal の issuer に書く。account record 自体は作らない。store は map の差分しか Command で書けず、account record を置く API が無い。初めて見た接続でも account record は増えない。
- 根拠: `RecordWorkspaceStore.commitMapCommand` と `applyLine` を読んだ。account を書く公開 API は無い。
- 扱い: 未対応

### 2026-11-22 pull と clone は scope の開示で絞らない

- 種類: 問題
- 書いた agent: format 2 の同期入口の session
- 対象: format2-requirements.md R10.14、`beta/src/node/sync/journal_read.ts`、`beta/src/node/sync/http.ts`
- 中身: `GET /api/sync/pull` は `scope` を受け取る。`GET /api/sync/clone` も同じである。開示の権利は store に無いので、どちらも workspace の journal 全体と portable snapshot 全体を返す。
- 根拠: `pullSince` は `scope` を読まない。clone は `store.records()` をそのまま返す。
- 扱い: 未対応

### 2026-11-22 古い base の移動は LWW にならない

- 種類: 問題
- 書いた agent: format 2 の同期入口の session
- 対象: DB 仕様書 14 節、`beta/src/node/sync/push.ts`
- 中身: push は `baseSeq` を受け取る。store の適用は field の CAS のままである。古い base の移動を LWW で受け入れる経路は無い。`baseSeq` は結果に使わない。
- 根拠: `pushCommands` は `baseSeq` を `commitMapCommand` に渡さない。store の Command 適用は `before` の一致を見る。
- 扱い: 未対応

### 2026-11-22 commandId の冪等は map 単位で、拒否の記憶は store の backup に入らない

- 種類: 問題
- 書いた agent: format 2 の同期入口の session
- 対象: format2-requirements.md R3.17、DB 仕様書 5.3、`beta/src/node/sync/push.ts`、`beta/src/node/record_store/store.ts` の `commitMapCommand`
- 中身: 成功した Command の再送は store が `(mapId, commandId)` で最初の結果を返す。workspace 全体の commandId ではない。拒否は store が覚えないので、同期入口が `sync-rejections.jsonl` に書く。この file は store の backup に含まれない。
- 根拠: `commandKey` は mapId と commandId である。`backupTo` は snapshot、journal、commit index を写し、`sync-rejections.jsonl` を写さない。
- 扱い: 未対応

### 2026-11-22 SQLite には minSeq が待つ applied seq が無い

- 種類: 問題
- 書いた agent: format 2 の同期入口の session
- 対象: DB 仕様書 14 節、`beta/src/node/sync/min_seq.ts`
- 中身: record store が開いていないとき、minSeq が 0 より大きい read は `ENGINE_BEHIND` を返す。SQLite の command_log には workspace の applied seq が無い。0 は待たない。
- 根拠: `enforceMinSeq` は `activeRecordStore()` が null で minSeq が 0 より大きいとき 503 を返す。
- 扱い: 未対応

### 2026-11-22 マップ全体の保存の issuer は接続の account ではない

- 種類: 問題
- 書いた agent: format 2 の同期入口の session
- 対象: DB 仕様書 5.1、`beta/src/node/record_store/legacy_api.ts` の `SERVER_ISSUER`、`beta/src/node/start_viewer.ts` の map Command 経路、`beta/src/node/mcp_service.ts`
- 中身: MCP の参加、viewer の Command、`/api/sync/push` は接続から選んだ account id を issuer にする。map 全体の保存は `legacy_api` の `system:server` のままである。この file は今回の範囲外である。
- 根拠: `SERVER_ISSUER` は `"system:server"` である。`saveWholeMap` の呼び出しは `legacy_api` に残っている。
- 扱い: 未対応

### 2026-11-22 scope ごとの履歴は、共有の journal を切らない

- 種類: 問題
- 書いた agent: format 2 の band と射影の session
- 対象: format2-requirements.md R4.14・R4.15・15 節、DB 仕様書 6 節、`beta/src/node/record_store/store.ts` の `pruneArchive`
- 中身: `retention.ms` が無い scope は、短縮の比較では 30 日（2,592,000,000 ミリ秒）として読む。archive の削除は 90 日のままである。明示した `retention.ms` は、その 90 日より長いときだけ削除までの期間を延ばす。短い明示値は、確認つきの Command で欄に保存するが、その窓より古い履歴を journal から切らない。journal は workspace に一本で、scope ごとに切れない。欄の無い scope を 30 日で消すことはしない。
- 根拠: `pruneArchive` は指定と、scope が明示した `retention.ms` の最長との大きい方を使う。明示が無ければ 0 を返し、90 日を縮めない。`record_store_bands.test.ts` で、40 日の明示は 90 日削除を縮めず、200 日の明示は 90 日では消さず 200 日で消す。
- 扱い: 未対応

### 2026-11-22 retention.bytes は保存するだけで、削除に使わない

- 種類: 問題
- 書いた agent: format 2 の band と射影の session
- 対象: DB 仕様書 6 節、format2-requirements.md 14 節 U14.4（容量に何を含めるか）
- 中身: scope の `retention.bytes` は record に保存し、snapshot の書き出しと replay と Neo4j の往復で残る。何を容量として数えるかは未決なので、byte 数での削除はしない。
- 根拠: U14.4 を読んだ。`longestExplicitRetentionMs` は `ms` だけを見る。
- 扱い: 未対応

### 2026-11-22 短縮した保持期間は、子の scope へ継承しない

- 種類: 問題
- 書いた agent: format 2 の band と射影の session
- 対象: format2-requirements.md 14 節 U14.4（継承による保持期間の短縮）、sync-requirements.md R8.4
- 中身: 短縮の継承は未決である。store は、各 scope が明示した `retention.ms` のうち最長のものだけを使い、それを 90 日の削除より延ばすためにだけ使う。子の scope が祖先の短い期間を受け継ぐことはしない。
- 根拠: U14.4 を読んだ。`pruneArchive` は scope の木を辿らない。
- 扱い: 未対応

### 2026-11-22 crypto-shredding の消去単位は置かない

- 種類: 問題
- 書いた agent: format 2 の band と射影の session
- 対象: format2-requirements.md 14 節 U14.4（crypto-shredding の消去単位）
- 中身: 消去単位、鍵の共有、鍵の backup、offline 復元の条件は未決である。保持期間の実装は archive の file の期限と印だけを扱い、crypto-shredding はしない。
- 根拠: U14.4 を読んだ。record store に鍵の単位は無い。
- 扱い: 未対応

### 2026-11-22 書き戻しの CONFLICT は Command 全体を拒否する

- 種類: 問題
- 書いた agent: format 2 の band と射影の session
- 対象: DB 仕様書 12.7 節、format2-requirements.md の一つの Command は原子であるという決定
- 中身: 12.7 節は、ロックされた実体の書き戻し項目を拒否し、他の項目は確定する、と書く。一つの Command を原子にする決定と食い違い、15 節はこの食い違いを解いていない。実装は、baseSeq より後の変更もロックも、一件でも CONFLICT なら Command 全体を拒否する。他の項目だけを確定することはしない。
- 根拠: `planWriteBack` は検査をすべて終えてから変更する。`record_store_bands.test.ts` は、CONFLICT のあと面の編集が残り、baseSeq が進まないことを確かめる。
- 扱い: 未対応

### 2026-11-22 昇格は、scope の一部の node を rapid のまま残すことができない

- 種類: 問題
- 書いた agent: format 2 の band と射影の session
- 対象: sync-requirements.md R8.6、`beta/src/node/record_store/bands.ts` の `planPromote`
- 中身: 昇格は rapid の scope からだけ行い、各 node に新しい Deep entity か既存の対象かを要する。`hold` は、一つの deep の scope の中に昇格しない node を残すことができないので、確定しない。
- 根拠: `planPromote` は `hold` を拒否する。`record_store_bands.test.ts` がその拒否を確かめる。
- 扱い: 未対応

### 2026-11-22 射影の面上の alias でない node を、scope を分けて Deep に置けない

- 種類: 問題
- 書いた agent: format 2 の band と射影の session
- 対象: format2-requirements.md R7.9、DB 仕様書 12.4 節
- 中身: 書き戻しで `new`、`hold`、指定なしの alias でない node は、体系側を変えず、scope の band も変えない。射影を持つ scope は deep になれない。その node を Deep に置くための scope の分割はしない。node はその面の rapid のまま残る。
- 根拠: `planWriteBack` はそれらの選択で体系側の node を作らない。射影と deep の同時指定は確定時に拒否する。
- 扱い: 未対応

### 2026-11-22 観測用の面の畳みは Surface View に保存しない

- 種類: 問題
- 書いた agent: format 2 の band と射影の session
- 対象: format2-requirements.md R7.8、DB 仕様書 12.3 節
- 中身: 観測用の面は scope と projection だけを保存し、読むときに木を求める。畳んだ状態は実体の ID を鍵に Surface View へ置く、と決まっている。`readProjection` は木を返すだけで、畳みを保存しない。Surface View の欄は足していない。
- 根拠: `readProjectionView` の observe 分岐を読んだ。scope の record に畳みの欄は無い。
- 扱い: 未対応

### 2026-11-22 面の中の木のエンジンは足していない

- 種類: 気づき
- 書いた agent: format 2 の band と射影の session
- 対象: format2-requirements.md 14 節 U14.1、DB 仕様書 12.5 節
- 中身: 面の中を扱う木のエンジンは、計測するまで要件ではない。射影は、store がすでに持つ parent edge の木を歩く。
- 根拠: U14.1 を読んだ。`collectPlane` は parent edge を辿る。
- 扱い: 未対応

### 2026-11-22 namedSnapshot は map に属するので mapId を持つ

- 種類: 気づき
- 書いた agent: format 2 の band と射影の session
- 対象: DB 仕様書 3.1 節、`beta/src/shared/record_model/types.ts` の namedSnapshot
- 中身: namedSnapshot の record は map に属する。store は `mapId` を持つ。DB 仕様書 3.1 節の欄の一覧には `mapId` が無い。3.1 節のレコードの一覧に namedSnapshot、scope の band、node の valid がまだ載っていない件は、仕様の書き手への依頼のままである。仕様書は変えていない。
- 根拠: projector が namedSnapshot に mapId を付け、`record_store_bands.test.ts` の replay が `mapId` の往復を確かめる。
- 扱い: 実装で解消（この commit。record は mapId を持つ。仕様書の一覧は書き手へ残す）

### 2026-11-22 拒否した map-field の更新が、呼び出し側の state を変えていた

- 種類: 問題
- 書いた agent: format 2 の band と射影の session
- 対象: `beta/src/shared/map_changes.ts` の `applyMapField`
- 中身: map-field の更新は、呼び出し側と共有した bag に直接書いていた。namedSnapshot の削除を確認なしで拒否したあと、warm state からその record が消えたままになり、次の削除は見つからない。更新の前に bag をコピーする。
- 根拠: `record_store_bands.test.ts` の namedSnapshot の試験が、拒否のあと確認つきの削除で印を外せる。
- 扱い: 実装で解消（この commit）

### 2026-11-22 射影と書き戻しは、新しい道具ではなく既存の道具の引数で受ける

- 種類: 気づき
- 書いた agent: format 2 の band と射影の session
- 対象: `beta/src/node/mcp_server.ts`、`beta/src/node/mcp_service.ts`
- 中身: 既存の道具の schema は未知の引数を拒む。射影、書き戻し、既存の Deep entity への結び、band の変更、昇格、namedSnapshot の作成と削除は、`m3e_update` の kind と引数で受ける。Deep の scope で node を作るときの「新しい実体か既存の対象か」は `m3e_create` の `deep` で受ける。新しい道具は足していない。
- 根拠: `mcp_server.ts` の schema と `record_store_bands.test.ts` の MCP の試験。
- 扱い: 実装で解消（この commit）

### 2026-11-22 m3e:target を出す欄が node に無い

- 種類: 仕様の穴
- 書いた agent: format 2 の commit 時の意味の session
- 対象: DB 仕様書 6 節（出来事の種類）、`beta/src/node/record_store/journal_archive.ts`
- 中身: 6 節は `m3e:target` を目標の更新間隔の変更としている。node にも scope にも、その間隔を置く欄が無い。touched は `m3e:target` を出さない。
- 根拠: DB 仕様書 6 節と、`beta/src/shared/record_model/types.ts` の node・scope の欄を読んだ。
- 扱い: 未対応

### 2026-11-22 nodeView の位置と valid.from だけの変更に、出来事の種類が無い

- 種類: 仕様の穴
- 書いた agent: format 2 の commit 時の意味の session
- 対象: DB 仕様書 6 節、`beta/src/node/record_store/journal_archive.ts`
- 中身: 6 節の `m3e:content` は text と本文である。nodeView の `x` と `y` には種類が割り当てられていない。位置だけの変更は touched に種類を出さない。`valid.from` だけの変更も同じである。`valid.to` を空から埋める変更は `m3e:end` である。
- 根拠: DB 仕様書 6 節の種類の一覧と、`changeKinds` の実装を読んだ。
- 扱い: 未対応

### 2026-11-22 grant の出し手が scope を編集できるかを、store が判定できない

- 種類: 仕様の穴
- 書いた agent: format 2 の commit 時の意味の session
- 対象: DB 仕様書 3.2 節、同期の要件 R2.7、`beta/src/node/record_store/operations.ts`
- 中身: AI agent の unlock は、同じ scope の `m3e:unlock` で、`committedAt` より前に期限が来ていない grant を要する。出し手がその scope をまだ編集できるかは、scope の編集権が record に無いので判定しない。出し手は編集できるものとして扱う。期限の瞬間（`committedAt >= expiresAt`）は拒否する。下位の scope への継承はしない。
- 根拠: DB 仕様書 3.2 節と record store の record の種類を読んだ。編集権の record は無い。
- 扱い: 未対応

### 2026-11-22 射影の面上の OC2 は projection.dissolved を記録できない

- 種類: 仕様の穴
- 書いた agent: format 2 の commit 時の意味の session
- 対象: DB 仕様書 12.7 節、`beta/src/node/record_store/operations.ts`
- 中身: OC2 は、実体を置く面上では行き先の親を指定した移動である。射影の面上では `projection.dissolved` を記録する。scope にその欄が無く、射影はこの作業に含まれない。node を消す OC2 は拒否し、実体を置く面上の移動を案内する。
- 根拠: DB 仕様書 12.7 節と `ScopeRecord` の欄を読んだ。
- 扱い: 実装で解消（この commit。射影の面上の OC2 は projection.dissolved に親子を足し、alias の部分木を面から外す）

### 2026-11-22 「正本」が少なくとも五つの意味で使われていて、どの写しに対する優先かが文書ごとに違う

- 種類: 問題
- 書いた agent: 同期の思想の session
- 対象: [Glossary](../../../docs/00_Home/Glossary.md) の alias の行、DB 仕様書 0・1・12 節、[ADR 014](../../../docs/09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md)、[sync-principles](sync-principles.md)、この spec の各文書
- 中身: 2026-11-21 に akaghef が「"正本"って言い方曖昧だからやめろ。別の意味を定義せよ」と指摘し、2026-11-22 に「間違いではないが、含まれたニュアンスを明確にしたい」と述べた。仕様と ADR での使い方は、少なくとも次の五つに分かれる。
  1. 復旧の起点（durability authority、system of record）。他はここから作り直せる。例: 「journal と snapshot が正本の形式」「replay の正本は確定したレコード差分」。
  2. 正しさを判定する場所（semantic authority）。不変条件の検査と問い合わせの答えを出す。例: 「Neo4j は各端末の正本エンジン」。
  3. 導出元。導出物（materialization、書き出しの形式、cache）と対になる。例: 「SQLite は書き出しの形式で、正本ではない」「何を正本 data とし、何を導出値とするか」。
  4. 実体を置く唯一の面。他の面には alias として現れる。例: 「実体は一つの面に一つだけ置く。その面を正本の面と呼ぶ」、akaghef の「組織図を正本として」。
  5. 文書の single source of truth。例: 「正本 doc」「Authoring Map は編集正本」「Live の正本は Vault の Markdown」。

  五つに共通する核は「写しが食い違ったら、こちらが勝つ。他はこちらから作り直すか、こちらを指す」という優先である。この核は常に成り立つので、どの用法も間違いではない。ただし、何の写しに対する優先か（bytes、解釈、導出物、出現、文書）が用法ごとに違う。修飾なしで書くと、読み手はどれか分からない。

  実害は、すでに一度起きている。2026-11-18 の項「何を正本とするかの記述が、二つの文書で食い違っている」では、「正本エンジン」を 1 と読むか 2 と読むかで、同期・復旧・backup の設計が二通りに分かれた。
- 根拠: Glossary、DB 仕様書、ADR 014、この spec の文書で「正本」を grep し、文脈を読んで分類した（2026-11-22）。数えたのは約 200 か所で、全件を分類したわけではない。
- 扱い: 決定（2026-11-22 akaghef）。修飾なしの「正本」は使わない。1 と 2 は durability authority / semantic authority、3 は「導出元」と書く。4 は名前を付けるまで「実体を置く面」と説明的に書く。5 は文書運用の語として範囲外にする。既存の文書の書き換えは、Glossary の語の変更として別の作業で、語の組と範囲を確かめてから一括で行う（未着手）。それまでは、新しく書く文でだけ修飾なしの「正本」を使わない。

### 2026-11-22 DB 仕様書 12 節の未決を、案のとおりに決定として書いた。実装は、どれも未対応である

- 種類: 仕様と実装のずれ
- 書いた agent: 物理量と拡張の土台の session（DB 仕様書 12 節の書き手）
- 対象: DB 仕様書 12.1〜12.4・12.6〜12.8 節、`docs/04_Architecture/Multi_Select.md`
- 中身: akaghef が 2026-11-22 に、未決をすべて案のとおりに決めた（発言は「Neo4j 化について作業を進める」session で受けた）。12 節で決定になったもの: 射影と書き戻しの形（scope の `projection` の欄 `mode`・`from`・`range`・`baseSeq`・`dissolved`）、観測用のフィルタの面は alias と parent edge のレコードを保存しない、既存の Deep entity に結ぶことは node を alias に変えて表す、名前付きの snapshot はレコードの種類 `namedSnapshot` と削減の対象から外した archive の file で持つ、作業の面は書き戻した後も残す、消す操作を四つ（面から外す、関係を解く、実体を終える、実体を取り消す）に分け、面を移す操作は今は置かない、実体を終えた状態は node の有効期間（`valid.from`・`valid.to`）で持つ、実体を取り消すと他の面の alias は `broken` で残る、コピーは同一性と範囲などの軸で定義し、範囲の中の alias は省いたとき alias のまま写す。案が無かった項目は、12 節の書き手が選んだ: scope に帯域の欄 `band` を置く（射影で作った面は必ず `rapid`）、有効期間の欄の形、`namedSnapshot` の欄の形。面の中を扱う木のエンジン（12.5 節）は、計測してから決めるので、提案のままである。語の組（facet、「正本の面」という言い方）と、鍵やメニューへの割り当ては、保留である。
- 根拠: 「Neo4j 化について作業を進める」session の記録で、akaghef の 2026-11-22 の発言（すべて案のとおりに要件をまとめる）を読んだ。実装のコードは、この件では読み直していない。
- 扱い: 仕様へ反映（DB 仕様書 12 節）。record store は OC1–OC4、node の valid.from / valid.to、Command のコピー（範囲の中の alias は alias のまま、来歴は node の copyOf）を持つ。scope の band、射影、書き戻し、namedSnapshot は実装で解消（この commit。射影の面、書き戻し、昇格、既存の Deep entity への結び、名前付きの portable snapshot の印）。OC5 は未対応。3.1 節のレコードの一覧に、namedSnapshot、scope の band、node の valid は、まだ載っていない（3 節の書き手へ依頼）

### 2026-11-22 Rapid と Deep、昇格、射影のモードの決定を、DB 仕様書 12 節に反映した。保存の形で決めることが三つ出た

- 種類: 仕様の穴
- 書いた agent: 物理量と拡張の土台の session（DB 仕様書の書き手）
- 対象: DB 仕様書 12.1・12.3・12.4・12.6・12.8 節。同期の要件 R8.5・R8.6、同期の思想「過去の情報の残し方」
- 中身: akaghef が 2026-11-22 に決めた内容（同期の要件の書き手の session が R8.5・R8.6 に書いた）を、保存の形の側に写した。決まったこと: Rapid と Deep は構造で分かれ、scope が Rapid であるとは射影で作られたことである。Deep も版をすべては残さず、昇格のときに名前付きの snapshot を残す。昇格では同じ実体を指す node を二つ作らず、新しい Deep entity にするか既存の Deep entity に結ぶかを Command で指定する。射影には観測用のフィルタと作業の面の二つのモードがある。これで、scope に帯域の欄は要らず、全版のためのレコードも要らない。保存の形で新しく決めることが三つある。(1) 観測用のフィルタの面を、alias と parent edge のレコードとして保存せず、読むたびに求める案。(2) 既存の Deep entity に結ぶことを、node を alias に変えることで表す案。Glossary の entity binding は many-to-many だが、alias の参照先は一つである。(3) 名前付きの snapshot を持つレコード。今の snapshot は workspace に一つの file で、archive の segment は 90 日で消えるので、名前と通し番号の索引と、削減の対象から外す印が要る。射影のモードの欄は `projection.mode` として置いた（名前と値の綴りは仮）。この反映の前の 12.4 節は、作業の面に足した alias でない node を「すでに体系の一部」と書いていたが、決定と合わないので改めた。
- 根拠: 同期の要件の書き手の作業ツリー（branch `codex/sync-rd-promotion`）の変更を読んだ。その変更は、この記録の時点で dev-beta に入っていない。akaghef の発言そのものは、この session では受けていない。
- 扱い: 仕様へ反映（DB 仕様書 12.1・12.3・12.4・12.6 節）。上の (1)〜(3) は akaghef の判断待ち

### 2026-11-22 「コピーする」の意味を、同一性と範囲の軸で分ける案を、DB 仕様書 12.8 節に【提案】として書いた

- 種類: 仕様の穴
- 書いた agent: 物理量と拡張の土台の session（DB 仕様書の書き手）
- 対象: DB 仕様書 12.6・12.8 節。operation-algebra-requirements 11 節、`docs/04_Architecture/Multi_Select.md`
- 中身: akaghef が 2026-11-21 に、正本の面と alias の読みの上では、実体をコピーすることの意味も分かれる、と述べた。案は、コピーを種類の列挙ではなく軸の組み合わせで定義することである。Command が選ぶ軸は、同一性（出現を増やすか、実体を複製するか）、範囲（node 一つ、部分木、scope）、置き先、時間の四つ。範囲の中の alias は alias のまま写す、外を指す参照は共有する、範囲の中の scope は中まで写す、の三つは固定とした（operation-algebra-requirements 11 節の仮決めと同じ）。同一性と範囲の組み合わせで、alias の作成・部分木の射影・射影と、shallow copy・deep copy・scope copy が、一つの表に並ぶ。射影は、出現を増やす操作を範囲に広げたものと読める。出現を増やす操作は、workspace をまたげない。元になった会話は `docs/research/m3e_data_structure_conversations/raw_conversations/261121_コピーの体系整理.md` にある（主の checkout、git には入れていない）。
- 根拠: operation-algebra-requirements 11 節と、DB 仕様書 12.2〜12.4 節を読んだ。実装の copy と貼り付けの経路は、この件では読んでいない。
- 扱い: 一部が決まった（akaghef、2026-11-22。仕様へ反映、DB 仕様書 12.8 節「操作の入口」）。決まったこと: コピーの意味は copy する時点で入口を分けて選ぶ、選択肢はすべて Command の引数に持たせて人の入口は絞り細かい選択は AI agent が出す、書き戻しの対象は射影で作った新しい面だけ、時点の写しは今は定義しない。残りも決まった（akaghef、2026-11-22）: 範囲の中の alias は alias のまま写す（QD2）、貼り付けは写す側に合わせる（QD5）。貼り付けは実装済み（`beta/src/shared/clipboard_subtree.ts`）で、Multi_Select.md もこの規則に揃えた。operation-algebra-requirements 11 節の「既存の Multi_Select.md と食い違う（未対応）」の記述は未修正

### 2026-11-22 extensionDef の fields[].default と fields[].ref を、確定のときに使っていない

- 種類: 問題
- 書いた agent: format 2 の保存実装
- 対象: DB 仕様書 10.2 と 10.7、`beta/src/shared/record_model/types.ts`（`ExtensionField`）、`beta/src/shared/record_model/extensions.ts`（`extensionValueErrors`、`extensionDefShapeError`）
- 中身: extensionDef の `fields` は `default` と `ref` を保存する。10.7 は型の検査だけを書いており、`default` をいつ埋めるか、`ref` を何と照合するかを書いていない。実装はどちらも保存するだけで、埋めず、検査しない。required の欄が attribute に無い付与は、`default` があっても拒否する。
- 根拠: `extensionValueErrors` は required の欠落を、attribute にその key があるかどうかだけで見る。`default` は読まない。`extensionDefShapeError` は `ref` の形を検査しない。
- 扱い: 仕様へ反映（DB 仕様書 10.2。default は付ける Command の中で server が埋める。ref は参照先の extensions を照合し、参照先が無ければ broken で保存を許す）。実装で解消（この commit。付ける Command の中で required の default を埋め、ref は参照先の node が存在するときだけ extensions を照合する）。ref の文字列の形は未決で、別項

### 2026-11-22 journal の provenance を決めた形にし、observed を MCP の読み取り集合から作った。6 件の選択は akaghef が決めた

- 種類: 気づき
- 書いた agent: journal envelope 実装 session
- 対象: DB 仕様書 6 節（`provenance`）、`beta/src/node/record_store/provenance.ts`、`beta/src/node/record_store/store.ts`（`shownRecords`・`revsOf`・確定時の検査）、`beta/src/node/mcp_service.ts`（読み取り集合と `provenanceOf`）、`beta/src/browser/save_command.ts`
- 中身:
  - journal の行の `provenance` は `{items: [{mode, rk, rev}], truncated?}` になった。store は確定のときに形を検査する。形の合わない item を持つ Command は `INVALID_COMMAND` で断る。rk の重複は最初の 1 件だけを残す。100 件を超えた分は切り、`truncated: true` を付ける。
  - これまでの値（MCP の `{contextId, tool}`、viewer の `{tabId}`）は journal に残さない。どちらも `actor.id` と同じ値である。viewer はもう送らない。
  - 【決定】observed は、MCP の参加（participation）が見せられた record の読み取り集合（read set）から作る。OCC の read set と同じ考え方で、rk ごとに読んだ時点の `rev` を持つ。参加ごとに新しい順に 10,000 件まで残す。
  - 【決定】「見せられた」の範囲は次の二つである。
    - `m3e_get`（state）が返したページの node（その details record を含む）と relation edge。
    - 変更の event が本文を見せた node（先頭 30 件）。
    - 検索の結果と、文脈の要約に出る子の名前は含めない。
  - 【決定】確定のときに、読んだ後で他の発行者が書き換えた record（今の `rev` が読んだ `rev` と違い、自分の確定の seq でもないもの）は外す。読んだものが、もう今の値ではないためである。自分で書き換えた record は、読んだ時点の `rev` のまま残す。消えた record も外す。
  - 【決定】declared は copy の出所の subtree だけである。agent が出所を明示する引数は、まだ作っていない。
  - 【決定】並びは、declared を先に、次に observed を読んだのが新しい順に置く。上限の 100 件はこの順で埋める。
  - 【決定】SQLite の上で動くときは record key が無いので、`items` は空になる。道具の名前（`tool`）は残らない（`intent` が残る）。
- 根拠: `beta/tests/unit/journal_provenance.test.ts` の 4 件。修正を外すと 4 件とも失敗する。他者の書き換えを外す条件を抜くと 1 件、自分の書き換えを残す条件を抜くと 1 件失敗することも確かめた。MCP・確定・record store・server の既存試験（151 件）は通る。
- 扱い: 実装で解消（commit「Journal provenance takes the frozen shape」。provenance を決めた形にし、読み取り集合から observed を作った）。仕様へ反映（DB 仕様書 6 節。決定との差 3 点のうち provenance の 1 点が解消する。文面は DB スキーマ設計 session へ送る）。6 件の【決定】は、2026-11-22 に akaghef が案のとおりに決めた。

### 2026-11-21 「消す」の意味を、出現・関係・実体に分ける案を、DB 仕様書 12.7 節に【提案】として書いた

- 種類: 仕様の穴
- 書いた agent: 物理量と拡張の土台の session（DB 仕様書の書き手）
- 対象: DB 仕様書 12.3・12.4・12.6・12.7 節
- 中身: akaghef が 2026-11-21 に、正本の面（例: 組織図）で実体を消すことの意味は状況によって違い、それを厳密に分けたい、と述べた。今の delete は、面から外すこと、親子の関係を解くこと、実体を終えること（退職）、実体を取り消すこと（誤り）を区別せず、node を消して alias を `broken` にする。案は、操作を五つ（面から外す、関係を解く、実体を終える、実体を取り消す、正本の面を移す）に分け、Command の種類が意味を運ぶ形にすることである。面から外すことと関係を解くことは、面に残る状態が同じなので、解いた関係を scope の `projection` に記録する欄を足した（名前は仮）。あわせて、射影の範囲に alias が入っているときは参照先の実体を指す alias を作る（alias を指す alias は作らない）と書いた。
- 根拠: DB 仕様書 12.2 節の「参照先を消したとき、alias は `broken` になる」と、12.4 節の書き戻しの表を読んだ。実装の delete の経路は、この件では読み直していない。
- 扱い: akaghef の判断待ち。決めること: 実体が終わった状態を node のどの欄で持つか（保存の形の変更）、実体を取り消すときに他の面の alias を `broken` で残すか拒否するか、正本の面を移す操作のために scope をまたぐ move の保留を見直すか、射影した面で関係を解いた実体を正本の面のどこへ置くか

### 2026-11-21 alias は子を持てる、と決まった。実装と、いくつかの文書は「持てない」のままである

- 種類: 仕様と実装のずれ
- 書いた agent: 物理量と拡張の土台の session（DB 仕様書の書き手）
- 対象: DB 仕様書 3.2 節、4 節の不変条件 3、12.2 節。`beta/src/shared/record_model/invariants.ts:108-111`、`beta/src/node/rapid_mvp.ts:425`、`beta/src/node/mcp_service.ts:434`・`524`、`beta/src/node/flash_jobs.ts:121`
- 中身: akaghef が 2026-11-21 に「alias は子を持たない」を廃止した。面をまたいで同じ実体をつなぐために、正本の面に実体を置き、他の面には alias を置いて、その下に子を並べる（例: 組織図の人を正本にし、タスクの割り当ての面に alias を置く）。DB 仕様書、record-schema、post-migration-spec、Glossary は改めた。実装は、上の 4 か所で alias の子を拒否している。次の文書は、今の実装の説明か、他の session の文書なので、まだ「持てない」と書いている: `docs/03_Spec/Data_Model.md` 87 行目、`docs/protocols/map-write-protocol.md` 27 行目、`operation-algebra-requirements.md` 96 行目（alias が子を持てないことを前提に、子孫の共有を論じている）、`draft-record-model.md` 172 行目。
- 根拠: `git grep` で「子を持たない」「cannot own children」を探して読んだ。
- 扱い: 仕様へ反映（DB 仕様書 3.2・4・12.2 節、2026-11-22 に `operation-algebra-requirements.md` 96 行目も整合）。残る文書（現行実装の説明である `Data_Model.md`・`map-write-protocol.md` と草案 `draft-record-model.md`）および実装（上記 4 か所）は未対応。viewer が alias の子をどう描くか、alias を畳んだときの表示、MCP の応答の形は決まっていない

### 2026-11-21 射影・書き戻し・エンジンの分担を、DB 仕様書 12 節に【提案】として書いた

- 種類: 気づき
- 書いた agent: 物理量と拡張の土台の session（DB 仕様書の書き手）
- 対象: DB 仕様書 12.3〜12.6 節、1 節、8 節、[ADR 014](../../../docs/09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md)
- 中身: akaghef の読み（体系から一側面を面として切り出し、整理して書き戻す。Rapid は木、Deep は graph で、保存エンジンの層で扱いを分けたい）を受けて、射影の入力と出力、scope の `projection` 欄、書き戻しの対応表、エンジンの分担を案として書いた。エンジンの分担を採ると、「Neo4j は各端末の正本エンジン」（ADR 014、DB 仕様書 1・8 節）を「面の中は木のエンジン、面をまたぐものは Neo4j」に改めることになる。
- 根拠: 2026-11-21 の akaghef との対話。workload の表の数値（面は通常 10 node、最大約 1,100）は、同期の要件 R10.1 の値である。処理の速さは測っていない。
- 扱い: akaghef の判断待ち（12.3〜12.5 の採否と、12.6 の五点）

### 2026-11-19 journal の畳み込みを、archive への移動と 90 日後の検証つき削除として実装した。仮決めが 5 件ある

- 種類: 気づき
- 書いた agent: Neo4j 化の実装の session
- 対象: DB 仕様書 6 節、`beta/src/node/record_store/store.ts`（`compact()`、`append()`、`commitsAfter()`、`committedCommand()`）、`beta/src/node/record_store/journal_archive.ts`
- 中身: 畳み込みは journal を捨てず、journal と置き換わる snapshot を `archive/` へ hard link（できない環境では複製）で移す。名前は `journal.<最初の通し番号>-<最後の通し番号>.f<snapshot の format>.jsonl` と `snapshot.<通し番号>.f<format>.jsonl`、移した時刻は `archive/index.json`。新しい snapshot の sha256 は `commit-index.json` の `snapshot` に記録する。archive の削除は移してから 90 日後で、今の snapshot を fsync して checksum を読み直し、記録と一致し、削除する範囲を覆っているときだけ行う。問題が 1 件でもあれば何も消さない。journal の各行には、確定で canonical な値に差分が出たレコードの一覧 `touched`（`rk` と出来事の種類 `ev`）を store が作って書く。Neo4j の追いつきと、確定済みの Command の読み出しは、畳み込み後も archive から行う（以前は Neo4j を全件作り直し、Command は読めなかった）。次の 5 点は二方向に戻せるので仮決めにした。
  - 畳み込みの契機は replay の長さだけ: snapshot より後の journal の行が 50,000 行（`M3E_COMPACT_AFTER_LINES`、0 で無効）に達した確定の直後と、開いたときの replay がその長さだったとき。時刻では起動しない。
  - 削除の判定は、開いたときと畳み込みの後に自動で行う。止まった理由は `maintenanceStatus()` と警告の log に出す。
  - `ev` の割り当ては、`attributes` → `m3e:attribute`、`extensions` → `m3e:extension`、parent edge の `source`・`target`・`ord`・`scopeId`・`type` と scope の `rootNodeId` → `m3e:structure`、新規 → `m3e:create`、削除 → `m3e:delete`、それ以外（text、本文、surface と nodeView の位置を含む）→ `m3e:content`。位置の変更に別の種類を作るかは未決。`m3e:target` は対象の欄が決まるまで出さない。
  - snapshot の `format` は 1 のまま。format 2 への切り替え（base snapshot の作成）は、parent edge の欄や extension 定義など他の format の変更と一緒に行う。archive の名前の `f1` はその前の区間を示す。
  - journal の `provenance` は、今までどおり Command の provenance をそのまま書く（MCP からは `{contextId, tool}`）。DB 仕様書 6 節の【決定】の形 `{items, truncated?}` とは違う。確定済みの Command を読む既存の経路がこの値を返しているため変えていない。Command の provenance を `items` へどう写すかは未決。
- 根拠: `beta/tests/unit/record_store_compaction.test.ts` の 9 件が通り、変更前の `store.ts` では 9 件とも落ちることを確かめた。最初の snapshot と全 journal の行から作り直したレコード、途中の snapshot とその後の行から作り直したレコード、store 自身の snapshot と後続の行から開いたレコードが、元のレコードと一字一句一致する。既存の record store の試験も実行した。
- 扱い: 実装で解消（journal を消さない畳み込みの commit）。仮決めの 5 点は、変えるなら akaghef の判断で直す。出来事の種類の割り当ては m3e:reparent、m3e:order、m3e:end であり、位置と m3e:target は別項である。DB 仕様書 6 節の「圧縮は journal を空にする」「journal を空にしている」「手放す操作は v1 では実装しない」の 3 文は、この実装と 90 日の決定に合わなくなったので、DB 仕様書の担当へ直しを依頼した


### 2026-11-19 実データの兄弟順キーに同じ値は無く、兄弟順キーを fractional-indexing に移した

- 種類: 気づき
- 書いた agent: 操作の代数の設計の session（GPT Pro との要件レビュー）
- 対象: DB 仕様書 3.4 節・4 節、`beta/src/shared/record_model/order_key.ts`
- 中身: 三つの workspace の最新 backup の read-only の写し（41・12・12 map、parent edge 49,923 本）を `toSnapshot` で変換して数えた。同じ map・同じ親の下で同じ `ord`：0 件。有効でない `ord`：0 件。`children[]` に同じ子が二度：0 件。並べた親と子の `parentId` の食い違い：0 件。保存データはまだ `ord` を持たず、変換のときに `children[]` の順から作るので、「移行前の等しい key」の例外は現在の実データでは起きない（守りとしてだけ残す）。兄弟順キーは `fractional-indexing` の base62 の key に移した。以前の base36 の key は無効として、読み込み時に振り直す。
- 根拠: scratchpad の集計スクリプトで、`node:sqlite` の readOnly で写しを読んで計測。単体試験 `record_model_order_key`・`record_model_steady`・`record_model_to_snapshot`。
- 扱い: 仕様へ反映（兄弟順の文面を DB 仕様書の担当 session へ送付済み。[操作の代数の要件](operation-algebra-requirements.md) 8 節）

### 2026-11-19 操作の代数の要件のうち、保存形式に効かない六点

- 種類: 気づき
- 書いた agent: 操作の代数の設計の session（GPT Pro との要件レビュー）
- 対象: [操作の代数の要件](operation-algebra-requirements.md) 9・11・12 節
- 中身: 【決定】(1) scope の移動だけでは relationType を変えず推論もしない。(2) unscopen で処分の方針が決まっていない所有データ（linear-text・注釈・Surface View の設定）があれば拒否する。(3) shallow copy は選んだ node だけ、scope copy は deep で同じ root の別の方向の scope を含めない。(4) deep copy の外側を指す参照は共有し、境界をまたぐ relation edge は既定では複製しない。(5) dissolve で条件・根拠を持つ中間 node、join で attribute を本文だけに落とすものは拒否し、中身のない中間 node 自身の色と配置の削除は明示して許す。(6) copy の来歴は journal を圧縮しても失わない形で残す。
- 根拠: akaghef の決定（2026-11-22）。
- 扱い: 仕様へ反映（[操作の代数の要件](operation-algebra-requirements.md) 9・11・12 節）。copy の来歴は node の copyOf として record store が持つ。dissolve の条件、join、unscopen の所有データの扱いは未対応

### 2026-11-19 ADR 014 の「stream の輸送は Syncthing」が、remote と outbox の形と合わない

- 種類: 問題
- 書いた agent: DB スキーマ設計の session（DB 仕様書の書き手）
- 対象: [ADR 014](../../../docs/09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md) の Decision 5、DB 仕様書 2 節
- 中身: freeze v1 で、journal は remote 上で workspace に一本、端末は outbox に未確定の Command を積む形になった。Syncthing は file 単位の複製で、ack も reject も返さない。そのため、outbox から remote への push（確定の要求と、その結果の受け取り）には使えない。使えるとしても、remote が単一の writer になる pull の log shipping だけである。ADR 014 の Decision 5 は「stream の輸送は Syncthing で行う」のままである。
- 根拠: ADR 014 の Decision 5 と、DB 仕様書 2 節・sync-principles の「remote と local」を読んで比べた。
- 扱い: 仕様へ反映（2026-11-21 akaghef の判断。ADR 014 Decision 5 を、remote の server への HTTP の push / pull に直した。Syncthing は廃止。sync-principles 16 行目の 2026-11-18 の決定に揃える整合の修正）

### 2026-11-19 拒否した Command の結果を覚えていないため、前提が変わった後の再送が通る

- 種類: 問題
- 書いた agent: 操作の代数の設計の session（GPT Pro との要件レビュー）
- 対象: DB 仕様書 5.3 節、`beta/src/node/record_store/store.ts:616`（再送の判定）、`store.ts:1231`（確定した Command だけを登録）
- 中身: 再送で「最初の結果」を返すのは、確定した Command だけである。拒否した Command は ID を覚えないので、拒否の後に状態が変わってから同じ ID を再送すると、今度は確定する。依頼した側から見ると、一度は拒否と返った依頼が、応答を受け取れなかった再送で黙って通る。確定的な拒否（`CONFLICT`、`INVALID_STATE`、`INVALID_COMMAND`）も最初の結果として持ち、同じ ID には同じ拒否を返すことを提案する。一時的な拒否（`ENGINE_BEHIND`）は除く。
- 根拠: `store.ts:612-627` と、`this.commands.set` の 3 か所（`store.ts:438`、`1223`、`1231`）を読んだ。登録は確定の経路と読み込みの経路だけで、拒否の経路には無い。実行はしていない。
- 扱い: akaghef が 2026-11-27 に、提案のとおりに決めた（「全部推奨で」）。確定的な拒否（`CONFLICT`、`INVALID_STATE`、`INVALID_COMMAND`）も最初の結果として持ち、同じ ID には同じ拒否を返す。`ENGINE_BEHIND` は除く。未実装

### 2026-11-19 再送の判定は map ごとで、通し番号は workspace で一本

- 種類: 問題
- 書いた agent: 操作の代数の設計の session（GPT Pro との要件レビュー）
- 対象: DB 仕様書 5.2 節・5.3 節、`beta/src/node/record_store/store.ts:272`（`commandKey(mapId, commandId)`）
- 中身: Command の ID は map ごとに一意とみなされる。一方、通し番号は workspace で一本で、node を別の map へ移すことも想定している。複数の map に触る Command がどの map の ID として登録されるか、同じ ID が別の map で使われたときに別の Command とみなしてよいか、が決まっていない。再送の判定のキーを workspace 単位にし、触った map は Command の中に集合として持つことを提案する。
- 根拠: `store.ts:272`、`617` を読んだ。仕様書 5.3 節は単位を書いていない。
- 扱い: akaghef が 2026-11-27 に、提案のとおりに決めた（「全部推奨で」）。再送の判定のキーを workspace 単位にし、触った map は Command の中に集合として持つ。未実装

### 2026-11-19 兄弟順キーが同じ値の兄弟の間には、node を入れられない

- 種類: 問題
- 書いた agent: 操作の代数の設計の session（GPT Pro との要件レビュー）
- 対象: DB 仕様書 3.4 節（兄弟順キー `ord`）、4 節
- 中身: 不変条件は、同じ親の下で兄弟順キーが一意であることを求めていない（並びは、キーと `connectionId` の組で決まる）。キー k の兄弟 a と b の間へ x を入れたいとき、x のキーだけを変えても入らない（k より小さければ a の前、k 以上なら b の後になる）。「他の兄弟のキーを変えずに、どこへでも入れられる」という前提が成り立たない。案は二つある。確定した状態でキーを一意にする（必要なら振り直しを同じ Command に含める）。または、その位置の指定を拒否する。
- 根拠: 仕様書 3.4 節と 4 節の文から導いた。実データに同じ値のキーがあるかは未確認。
- 扱い: 仕様へ反映（DB 仕様書 3.4 節と 4 節の不変条件 9。同じ親の下で `ord` は一意で、等しい key の間への挿入は振り直しを同じ Command に含める。実データの重複は 0 件で、この例外は防御のためだけに残る）。base62 の key への実装は、操作の代数の session が進めている

### 2026-11-19 relation edge の重複を禁じる不変条件が無い

- 種類: 問題
- 書いた agent: 操作の代数の設計の session（GPT Pro との要件レビュー）
- 対象: DB 仕様書 4 節
- 中身: 操作の設計では「同じ端点・同じ relationType の relation edge は、link で作らない」としている。しかし不変条件には入っていないので、端点の付け替え（relink）や relationType の書き換えで重複を作れる。重複の禁止を不変条件にするか、link の便宜の挙動にとどめるかを決める必要がある。
- 根拠: 仕様書 4 節の一覧を読んだ。実装の検査は未確認。
- 扱い: 仕様へ反映（2026-11-22 akaghef 決定: 不変条件では禁じず、多重エッジを構造上許容し、重複抑止は link 操作の便宜に留める。操作の代数の要件 10 節に反映済み。DB 仕様書 4 節は変更不要）

### 2026-11-19 scope をまたぐ付け替えでは、子孫側の parent edge の scope も書き換える必要があるが、誰が作るか決まっていない

- 種類: 問題
- 書いた agent: 操作の代数の設計の session（GPT Pro との要件レビュー）
- 対象: DB 仕様書 4 節の 6 番
- 中身: node a を scope S から別の scope T の node の下へ移し、a の子への parent edge が S のままだと、不変条件 6 を破る（a は S の root ではなく、a に入る parent edge の scope は T）。付け替えの Command は、同じ面に載る子孫側の parent edge の scope も、次の scope の境界まで T へ書き換えて含める必要がある。この書き換えを出す側が作るのか、確定する側が補うのかが決まっていない。scopen・unscopen の逆も、実際に書き換えた parent edge の集合と元の scope を持つ必要がある。
- 根拠: 仕様書 4 節の 6 番の文から導いた。実装の挙動（拒否になるか）は未確認。
- 扱い: 仕様へ反映（同期の要件 R2.4・DB 仕様書 5.2 節規則 8 の「scope をまたぐ移動は当面未対応・拒否」に合わせて、2026-11-22 に操作の代数の要件 9 節へ【保留】を明記）。実装の確定前拒否ガードおよび将来実装時の生成責任は未対応

### 2026-11-19 journal の 1 行が、送られた変更と変更後のレコードの両方を持っている

- 種類: 気づき
- 書いた agent: Neo4j 化の fork の session（DB 仕様書を書いた担当）
- 対象: DB 仕様書 6 節、`beta/src/node/record_store/store.ts:131`（`changes`）と `:137`（`ops`）
- 中身: journal の 1 行は、送られた変更（変更前と変更後の値）と、レコードへの操作（変更後のレコード全体）の両方を書いている。中身がほぼ二重で、1 行の大きさが増える。変更の側だけを残し、レコードへの操作は確定の処理を再生して作り直す形にすれば、およそ半分になる。ただし、再生が決定的であることを確かめる試験が前提になる。
- 根拠: `JournalLine` の型と、確定の処理で両方を書いている箇所を読んだ。実データでの 1 行の大きさは測っていない（未確認）。
- 扱い: 未対応（畳み込みの契機と、古い journal の保管期間と合わせて決める）

### 2026-11-19 確定のたびに map 全体の不変条件を検査している

- 種類: 問題
- 書いた agent: Neo4j 化の fork の session（DB 仕様書を書いた担当）
- 対象: DB 仕様書 4 節、`beta/src/node/record_store/store.ts:1114`
- 中身: 仕様は「検査は触った周辺だけで行い、map 全体は走査しない」とする。実装は確定のたびに、その map の全レコードで不変条件を検査している。今の規模（最大の map で約 2 万 node）では動くが、費用が map の大きさに比例するので、100 万 node の map では確定が遅くなる。
- 根拠: 確定の処理が `checkInvariants` に map の全レコードを渡している箇所を読んだ。時間は測っていない（未確認）。
- 扱い: 仕様へ反映（DB 仕様書 4 節に、実装との差を書いた）。実装で解消（この commit。確定は触った record とその近傍だけを検査する。map 全体の検査は `checkInvariants` として残し、試験と `record_store_cli --verify` が使う）。40,201 node の map で、構造を変える確定は 175.7 ms、近傍の検査は 0.5 ms、全体の検査は 111.5 ms。確定の時間には、射影と検証が map 全体を歩く分が残る

### 2026-11-19 parent edge のレコードに、relationType と attribute の欄が無い

- 種類: 問題
- 書いた agent: Neo4j 化の fork の session（DB 仕様書を書いた担当）、物理量と拡張の土台の設計の session
- 対象: DB 仕様書 3.4 節、`beta/src/shared/record_model/types.ts`（`EdgeConnectionRecord`）、snapshot-format 2 節
- 中身: 仕様では parent edge も relationType と attribute を持つ。実装の parent edge のレコードには、どちらの欄も無い。今の移行では parent edge の relationType を設定しないので問題は出ていないが、parent edge に役割（たとえば `rdfs:subClassOf`）を付ける操作を作るときに欄が要る。極性（parent edge の「保つ / 反転する」）を attribute に置く案も、この欄を前提にしている。
- 根拠: 型定義と snapshot-format の表を読んで比べた。
- 扱い: 仕様へ反映（DB 仕様書 3.4 節に、実装との差を書いた）。実装は未対応

### 2026-11-19 確定の発行者を、まだ端末の申告で決めている

- 種類: 問題
- 書いた agent: Neo4j 化の fork の session（DB 仕様書を書いた担当）
- 対象: DB 仕様書 5.1 節、record-schema 10 節
- 中身: 仕様では、発行者はサーバが認証済みの接続から決め、画面や AI agent の自己申告は使わない。実装は、Command と一緒に送られた申告をそのまま確定の表に書いている。アカウントと認証の仕組みができるまで、確定の表の発行者は検証されていない値である。
- 根拠: record-schema の監査の記録と、確定の処理を読んだ。
- 扱い: 仕様へ反映（DB 仕様書 5.1 節に、実装との差を書いた）。実装は未対応（アカウントの仕組みが前提）

### 2026-11-19 journal が端末ごとではなく、workspace ごとに一つになっている

- 種類: 問題
- 書いた agent: Neo4j 化の fork の session（DB 仕様書を書いた担当）
- 対象: DB 仕様書 2 節、ADR 014 の Decision 1
- 中身: ADR 014 では、journal は workspace × 書き手の端末ごとの追記専用の列で、書くのはその端末だけとする。実装は workspace ごとに journal が一つで、一つのサーバだけが書く。端末をまたぐ同期（Mac mini での集約、他の端末の journal の取り込み）を作るときに、ファイルの単位と通し番号の振り方を変える必要がある。
- 根拠: `beta/src/node/record_store/store.ts` の冒頭の説明と、ファイルの置き方を読んだ。
- 扱い: 仕様へ反映（DB 仕様書 2 節を、2026-11-18 の akaghef の決定に合わせた。確定済みの journal は remote 上で workspace ごとに一本であり、今の実装はこれに合っている。欠けているのは local outbox である）。local outbox は実装で解消（local モードのオフライン編集と手動同期）

### 2026-11-19 圧縮すると、どの確定がどの node に触れたかが失われ、書かれる頻度を作り直せない

- 種類: 問題
- 書いた agent: 物理量と拡張の土台の設計の session
- 対象: DB 仕様書 6 節、`beta/src/node/record_store/store.ts:121`（`JournalLine`）、`store.ts:752`（`compact()`）
- 中身: 圧縮は journal を空にし、`commit-index.json` には map ごとの最後の確定と、確定済みの Command の ID（直近 100,000 件）だけを残す。確定ごとに差分が出たレコードの一覧は残らないので、圧縮より前の書かれる頻度（DB 仕様書 9 節の提案）は作り直せない。記録を始める前の確定は、後から分類できない。akaghef は 2026-11-19 に次の方向を示した。保存期限と復元期限を分ける。journal も出来事の記録も消さず、古い journal は保管へ移す。再生を保証するのは、最後のスキーマ変更の直後に書く snapshot から後だけにする。版は journal の各行に持たせず、切り替えの時点だけを記録する（snapshot の頭の `format` と `seq` で足りる）。出来事の記録は、通し番号・時刻・触れたレコードの ID・出来事の種類だけの、スキーマに依らない形にし、再生できない区間でも数えられるようにする。
- 根拠: DB 仕様書 6 節の圧縮の記述と、`JournalLine` と `SnapshotHeader`（`beta/src/shared/record_model/types.ts:10`）の型を読んだ。
- 扱い: 仕様へ反映（freeze v1。DB 仕様書 6 節の envelope の `touched`、archive の 90 日での削除、9 節の減衰する量の累積を snapshot に持つこと）。累積は実装で解消（この commit。kind `decay` の record を snapshot に持つ。kind 名と scale の列は未決で、別項）。`touched` と 90 日の削除は、この項の時点で既に入っている

### 2026-11-19 名前の接頭辞の規則は MCP でしか検査しておらず、アプリの中から接頭辞の無い名前が書かれている

- 種類: 問題
- 書いた agent: 物理量と拡張の土台の設計の session
- 対象: DB 仕様書 3.8 節、`beta/src/node/layout_capture.ts:50`
- 中身: 新しい attribute 名と relationType に接頭辞を求める検査は、MCP の入口（`beta/src/node/mcp_service.ts`）にしか無い。`layout_capture.ts` は relationType `reference` を接頭辞なしで書く。viewer など他の書き手も検査を通らない。
- 根拠: `git grep '"reference"'` で書き手を探した。他の書き手は網羅していない。
- 扱い: 未対応（既存の名前の対応規則と、確定の側で検査するかを決めてから直す）

### 2026-11-19 attribute の値には型の取り決めが無く、整数と小数を区別できない

- 種類: 気づき
- 書いた agent: 物理量と拡張の土台の設計の session
- 対象: DB 仕様書 3.3 節、10 節、`beta/src/shared/record_model/types.ts`（`JsonValue`）
- 中身: attribute の値は任意の JSON 値で、JSON には整数と小数の区別が無い。拡張の欄（task の status、目標の更新間隔など）の型は、保存の形ではなく、拡張の定義に欄の型を書かせて確定のときに検査するしかない。時刻は今 `committedAt` が文字列で持っている。型の語彙（文字列・整数・小数・真偽・列挙・時刻・期間・node の参照・列）と、時刻・期間の表し方は未決。
- 根拠: `JsonValue`、`NodeRecord`、`JournalLine` の型を読んだ。
- 扱い: 仕様へ反映（freeze v1。DB 仕様書 3.3 節と 10.7 節の型の語彙。拡張の欄だけを確定時に検査する）。実装は未対応

### 2026-11-19 同期の要件に、確定の保証範囲と復旧の対象が決まっていない

- 種類: 問題
- 書いた agent: 同期の思想と要件の session
- 対象: [sync-principles](sync-principles.md) 全体、DB 仕様書 6 節・8.3 節
- 中身: 同期の要件を GPT-6 Pro と詰めた第 1 往復で、次の穴が出た。いずれも決めないと実装者が勝手に決めてしまい、後から変えにくい。
  - remote が確定して fsync した直後に保存媒体が壊れ、どの local もまだ pull していなければ、その確定は local を集めても戻らない。媒体 1 つの喪失で確定を失ってよいかが決まっていない。
  - 複製の単位が scope なので、どの local も持たない scope がありうる。local を集めた remote の作り直しが完全かどうかを検査する規則が無い。
  - push の一部を確定した後で abort の条件（世代・履歴 ID・hash 鎖の不一致）が分かると、確定済みの分は取り消せない。abort の条件は確定を始める前に検査し終える必要がある。
  - 削除と、削除した側が見ていなかった子の追加・移動の競合、scope をまたぐ移動で所属・共有範囲・保持の方針が変わるか、権限を外した後の offline clone、conflict を誰が解けるか、Rapid から Deep への昇格が同じ ID の移動か新しい ID の複製か、が決まっていない。
- 根拠: GPT-6 Pro の回答（第 1 往復）を読んだ。実装との照合はしていない（未確認）。
- 扱い: 仕様へ反映（[同期の要件](sync-requirements.md) と [sync-principles](sync-principles.md)）。2026-11-19 に akaghef が問いに答えた。媒体の喪失は許して復旧地点を示す（暫定）、削除は見ていた集合を基準に競合、scope をまたぐ移動は当面実装しない、競合は権限のある編集者が解く、ロックを付ける。Rapid と Deep の違い・昇格、入れ子の scope の権限は追加の協議として保留。未決の事項は同書の K1〜K15

### 2026-11-19 復旧の経路で戻すべき状態と、適用待ちの確定の扱いが仕様に無い

- 種類: 問題
- 書いた agent: 同期の思想と要件の session
- 対象: DB 仕様書 6 節・8.3 節、`beta/src/node/neo4j_store/apply.ts:192`（`appliedSeq` の書き込み）
- 中身: 復旧の正本が snapshot と journal なら、グラフの中身だけでなく、権限、未解決の conflict、Command の結果（重複排除の記録）、世代、端末の失効も、そこから戻せなければならない。Neo4j にだけ置いた状態は、指定された復旧の経路で失われる。また、journal に fsync した後、Neo4j に適用する前に止まった確定は、適用の失敗を理由に未確定へ戻せない。その確定を適用し終えるまで（`appliedSeq` が journal の末尾に追いつくまで）、古い Neo4j の状態で次の Command を検査してはいけない。どちらも今の DB 仕様書には書かれていない。
- 根拠: GPT-6 Pro の回答（第 1 往復）の指摘を、DB 仕様書 8.3 節の「反映した位置は `appliedSeq` に持つ」と照らした。確定の処理が、検査の前に `appliedSeq` の遅れを解消しているかどうかは確かめていない（未確認）。
- 扱い: 仕様へ【提案】として記載（[DB 仕様書 6.1 節「復旧で戻す状態と、engine に未適用の確定」](../../../docs/03_Spec/Database_Spec.md#recovery-state-and-unapplied-commits)）。akaghef の確認待ち

### 2026-11-19 journal の畳み込みがどこからも呼ばれていない

- 種類: 問題
- 書いた agent: Neo4j 化の本線の session
- 対象: DB 仕様書 6 節、`beta/src/node/record_store/store.ts:752`（`compact()`）
- 中身: 正本は「ある時点の snapshot と、それより後の journal」で、journal は定期的に snapshot へ畳み込む前提である。畳み込みの処理 `compact()` は実装されているが、試験の外からは呼ばれていない。今のままでは journal が増え続け、起動時の再生も長くなる。いつ畳むか（件数、大きさ、時刻、起動時）が仕様で決まっていない。
- 根拠: `git grep` で `compact()` の呼び出しを探し、`beta/src` の試験以外に無いことを確かめた。
- 扱い: 仕様へ反映（freeze v1。契機は replay の長さ。DB 仕様書 6 節）。実装で解消（journal の行数を契機に畳み込み、journal は archive へ移す。上の「journal の畳み込みを、archive への移動と 90 日後の検証つき削除として実装した」）

### 2026-11-18 何を正本とするかの記述が、二つの文書で食い違っている

- 種類: 問題
- 書いた agent: Neo4j 化の本線の session
- 対象: DB 仕様書 1 節、[ADR 014](../../../docs/09_Decisions/ADR_014_Journal_Canonical_And_Neo4j_Engine.md)、[sync-principles](sync-principles.md)（dev-beta に統合済み。2026-11-19 に同期の思想の session が確かめた）
- 中身: DB 仕様書と ADR 014 は「正本は journal と snapshot、Neo4j は端末ごとの導出物で、同期も backup もしない」とする。今の実装もこの形である。一方 `sync-principles.md` は「Neo4j は正本エンジンで、他の何かの写しではない」とする。どちらも 2026-11-16 の akaghef の決定（brief の「正本エンジンは Neo4j」）を根拠にしており、「正本エンジン」の読み方が分かれている。このままでは同期・復旧・backup の設計が二通りになる。
- 根拠: 両方の文書の該当行を読んで比べた。
- 扱い: 仕様へ反映（freeze v1。Neo4j は各端末の正本エンジンで semantic authority、journal と snapshot は durability authority。DB 仕様書 0・1 節と ADR 014 を改めた）

### 2026-11-18 一部の attribute だけを読んだ状態からの保存は、読んでいない attribute を消さない。ただし 2 つの操作が衝突として拒否される

- 種類: 問題
- 書いた agent: 描画バグの session（表示の速さの作業）
- 対象: DB 仕様書 3.3 節、5 節、`beta/src/shared/map_changes.ts`（`diffAttributes`、`applyChanges`）、`beta/src/browser/scope_view_client.ts`（`save`）
- 中身: 当初は「attribute はまとめて 1 つの値として書かれるので、一部だけ読んで保存すると読んでいない attribute が消える」と報告したが、これは誤りだった。scope だけを読む経路の保存は、読んだ時点の状態と今の状態の差を attribute 1 項目ずつの変更として送る。読んでいない attribute は差に現れないので、保存しても残る。残る問題は次の 2 つで、どちらもデータは消えず、保存が衝突として拒否される。(1) 読んでいない attribute と同じ名前の attribute を書くと、作成として送られ、すでに値があるので拒否される。(2) 読んでいない attribute を持つ node を消すと、その attribute を消す変更が送られないので拒否される。描画に要る項目だけを読む形にするなら、この 2 つの扱い（読んでいない attribute の有無を読み手に伝える、node の削除は attribute ごと消す、など）を仕様で決める必要がある。map 全体を 1 つの値として保存する経路は、scope だけを読む経路では使えないようにしてあるが、この経路に一部だけ読んだ状態を渡せば消える。
- 根拠: 2026-11-19 に `diffState` と `applyChanges` を直接呼んで確かめた。サーバー側の node が attribute を 2 つ持ち、読み手がその 1 つを持たない状態で、本文と残りの attribute を変えて適用すると、読んでいない attribute は残った。同じ形で、読んでいない名前の attribute を書いた場合と、node を消した場合は、どちらも `ok: false` でその attribute の衝突が返った。保存の経路は `scope_view_client.ts` の `save` を読み、差を送ることと、map 全体の保存を拒否することを確かめた。
- 扱い: 仕様へ反映（DB 仕様書 5.4 節に【仮決め】として書いた。同じ key の作成は CONFLICT のままにし、projection の応答で省いた key の名前を返す。node の削除は record 単位の tombstone にし、前提は `rev` だけにする）。実装は未対応

### 2026-11-18 scope の読み出しの大半が、描画に使わない attribute だった

- 種類: 気づき
- 書いた agent: 描画バグの session（表示の速さの作業）
- 対象: DB 仕様書 9 節、10 節
- 中身: scope だけを読む経路で、応答（約 2.1 MB）のほぼ全部が描画に使わない attribute だった。描画に要る項目は node の種別によって違う（たとえば `source-mermaid` を描画に使う種別がある）。そこで、描画に要る項目は node type の定義が宣言する、という要件が出ている。拡張の仕組み（10 節）の定義に、この宣言を持たせる案がある。
- 根拠: その session の計測による。
- 扱い: 仕様へ反映（DB 仕様書 10.6 節に【提案】として、拡張の定義が持つ描画の宣言と、それを使う projection を書いた）。実装は未対応
