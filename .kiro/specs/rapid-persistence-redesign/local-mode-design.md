# local モードの設計（多端末連携 v1）

sync-principles.md と sync-requirements.md の local 側を実装するための設計。remote 側（`/api/sync/push`・`pull`・`clone`）は実装済みで、これに対になる local を作る。

## 1. 範囲

- 含む：workspace 全体の clone、local commit と outbox、手動の push と pull、競合した Command の保全、workspace と世代の照合（fencing）、map 単位の操作（作成・削除・改名・列の変更）の同期、viewer の同期状態の表示と手動の Push / Pull。
- 含まない（次の段階）：scope 単位の部分複製と開示制御（R6.5〜R6.8）、保持期間切れの再 clone での前提の再照合（R6.9 のうち outbox の保全だけは行う）、自動同期。
- 端末はすべて akaghef の端末で、全 scope を持つ。

## 2. 役割と起動

- remote：今の server。`M3E_SYNC_REMOTE` を持たない。確定（seq の採番）は remote だけが行う。
- local：`M3E_SYNC_REMOTE=<remote の origin>` を持つ server。viewer・MCP からは今の server と同じに見える。
- local は自分で確定しない。local の seq（working store の commit 番号）は remote の seq と別物であり、remote の seq を偽造しない。

local のデータディレクトリ（`M3E_DATA_DIR`）：

| パス | 中身 |
|---|---|
| `sync/remote.json` | remote の origin、`workspaceId`、`historyId`、`epoch`、`confirmedSeq`、working store の基点（`working`：working store のどの通し番号が confirmed のどの通し番号と同じ中身か） |
| `sync/confirmed/` | remote の確定系列の複製（record store。seq は remote の seq） |
| `sync/outbox.jsonl` | 未送信・結果不明の Command（fsync 後に local commit 完了） |
| `sync/conflicts.jsonl` | remote が conflict・reject を返した Command（消さずに保全） |
| `store/` | working store（confirmed に outbox を載せた状態。viewer・MCP はここを読み書きする） |

初回起動で `sync/remote.json` が無ければ clone する：`GET /api/sync/clone` → `sync/confirmed/` と `store/` を同じ snapshot から作る。

## 3. local commit

- viewer・MCP の書込みは、working store に今までどおり commit する。
- 同時に、その commit を outbox の entry として fsync する。entry は remote で compare-and-set（R7.1）できる形で持つ：
  - 内容の変更：`MapCommand`（`commandId`・`actor`・`intent`・`changes: RecordChange[]`、各 change は `before`/`after` を持つ）。`saveWholeMap` の差分（`diffState`）もこの形にする。
  - map 単位の操作：`{mapOp: "create" | "delete" | "rename" | "columns", ...}`。作成は初期内容を `changes` で運ぶ。
- entry は `baseSeq`（そのときの `confirmedSeq`）を持つ。
- `commandId` は local で作り、再送しても変えない（R4.2・R4.5）。

## 4. push（手動）

1. outbox の entry を順に `POST /api/sync/push` へ送る。要求には `workspaceId`・`historyId`・`epoch` を付ける。
2. remote は、まず要求全体の照合（R6.2）を行い、食い違えば何も確定せず要求全体を拒否する。
3. 照合を通れば entry ごとに結果を返す（R6.3）：
   - `committed` / `no-op`（変更後の値と一致）：outbox から外す。内容は次の pull で confirmed に入る。
   - `conflict` / `rejected`：outbox から外し、`sync/conflicts.jsonl` に理由と一緒に移す。黙って捨てない。
   - 通信断・結果不明：outbox に残す。同じ `commandId` で再送する（remote は重複を検出する）。
4. push の後に pull を行う。

remote 側の追加：map 単位の操作（作成・削除・改名・列）を push で受け付ける。作成済みの map への create、存在しない map への変更は conflict として返す。

transport の実装では、同じ issuer が続く entry を JSON 本文（workspace と世代の照合情報を含む）4,000,000 byte までまとめ、それより大きい単一 Command は分割せず単独で送る。remote の非圧縮 JSON 本文の上限は 32,000,000 byte。上限超過は接続を破棄せず HTTP 413 `PUSH_BODY_TOO_LARGE` と `limitBytes` を返し、何も確定しない。request の `Content-Encoding` は未指定または `identity` のみを受け付ける。

proxy などが batch を 413 で拒否したときは、同じ push 内の batch の上限を縮め、単一 Command でも拒否されるかを確かめる。単独でも拒否されたら、outbox と後続の順序を保持し、同期状態に `push.state: "blocked"`・`code: "PUSH_COMMAND_TOO_LARGE"`・`commandId`・map 名・intent・理由・送信 byte 数・remote が返した上限を出す。状態は `sync/remote.json` に保持し、接続確認が成功しても消さない。push は明示操作で再試行でき、対象 Command の結果が確定したら解除する。journal の記録内容は変えない。これは transport の実装上限であり、K10 の変更対象数・依存数などの未決事項を確定するものではない。

## 5. pull（手動）

1. `GET /api/sync/pull?after=<confirmedSeq>` に `workspaceId`・`historyId`・`epoch` を付けて要求する。応答も同じ三つを返し、local は食い違えば取り込まない。
2. 返った journal の行を seq の連続を確かめてから `sync/confirmed/` に追記・適用する（R5.4：確定時の変更をそのまま再生し、merge 規則で再判定しない）。
3. working store をその場で rebase する（[同期の思想](sync-principles.md)の「手間は変化分に比例させる」）。基点より後に pending が変えた record と、届いた行が変えた record だけを confirmed の値に戻し（1 行の `local-rebase` として working store の journal に書く）、pending を順に commit し直す。載らない pending（前提が崩れたもの）は conflicts に移す。手間は届いた行と pending に比例し、workspace の大きさに依らない。届いた行が無く、pending も変わっていなければ何もしない。途中で失敗したら基点を消し、次の pull か起動で全体を作り直す。
4. viewer に map の更新を通知する（既存の watch / SSE）。
5. remote が `reclone` を返した場合（保持期間切れ）：outbox と conflicts を保ったまま clone し直し、working store を新しいディレクトリに全体から作り直して入れ替える（Δ が全体なので全体に比例してよい）。

起動時は、基点が working store の journal と outbox に合っていれば、working store をそのまま開き、止まっている間に届いた行だけを 3 と同じく rebase する。合わなければ（初回、作り直しの途中で止まった、など）全体から作り直す。

## 6. workspace と世代の照合（fencing）

- remote の store は `workspaceId`（既存）、`historyId`（store を作ったときに一度だけ生成）、`epoch`（remote を作り直したときに増やす。初期値 1）を持ち、snapshot の header に記録する。既存の store で欠けていれば、開いたときに一度だけ生成して保存する。
- `/api/sync/clone`・`pull`・`push` の応答はこの三つを返す。`pull`・`push` の要求が三つを付けて来て一致しなければ 409 `FENCED` を返す。
- local は `sync/remote.json` に clone 時の三つを保存し、以後すべての要求に付ける。食い違いの応答を受けたら同期を止め、状態に「同期を拒否された」と出す。

## 7. 同期状態（viewer）

- `GET /api/sync/local/status` → `{mode: "local", remote: {origin, state: "ok" | "unreachable" | "refused"}, push: {state: "idle"} | {state: "blocked", code, commandId, mapName, intent, reason, bytes, limitBytes?}, unsent, conflicts, confirmedSeq, lastPushAt, lastPullAt}`。remote モードの server は `{mode: "remote"}`。`push` は transport の状態で、接続状態と独立する。`commandId` は診断用であり GUI の通常表示には使わない。
- `POST /api/sync/local/push`・`POST /api/sync/local/pull` → 上の手順を実行し、結果の要約（送った件数、確定、conflict、取り込んだ行数）を返す。
- `GET /api/sync/local/conflicts` → 保全した entry の一覧（map 名・intent・理由・時刻）。
- viewer：toolbar に同期状態（接続状態・未送信件数・競合件数）と Push / Pull のボタン。表示に ID を出さない。
- 接続状態と未送信件数は独立に表示する（R1.1）。

## 8. 受入条件（判定は orchestrator が持つ）

remote 1 台と local 2 台（A・B）を別プロセス・別ディレクトリで動かして判定する。

| ID | 手順 | 合格 |
|---|---|---|
| AC1 | A・B を空のディレクトリから起動 | 両方が clone し、map 一覧と内容が remote と一致 |
| AC2 | A で node の text を変え、push | remote に確定、B の pull 後に B で見える。A の `unsent` は 0 |
| AC3 | A で編集し push しない | remote は変わらない（R6.1） |
| AC4 | remote を止めて A で編集、remote を戻して push | 確定する。止まっている間 A の状態は `unreachable`、`unsent` > 0 |
| AC5 | A・B が同じ node の text を別の値に変え、A→B の順に push | A は確定。B の entry は conflicts に残り、B の pull 後の表示は remote の値 |
| AC6 | A・B が別々の node を変え、両方 push・pull | 両方の変更が両端末と remote にある |
| AC7 | A で map を作成・別の map を削除、push、B で pull | B に作成が現れ、削除が消える |
| AC8 | A で編集後、push せずに A を再起動 | outbox が残り、再起動後の push で確定 |
| AC9 | 別の workspace（historyId が違う remote）に A の push・pull を向ける | 409 `FENCED`、何も確定・取り込みしない |
| AC10 | 全手順を通して | local の `confirmedSeq` は常に remote の seq のどれか。remote の journal に local 由来の重複確定がない |
