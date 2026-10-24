# 現行の Rapid 保存経路 — 事実確認

2026-10-24。Codex（読み取り専用）による dev-beta `d67b834` の調査結果。Director が見出しの採番だけを整形し、本文は調査結果のまま残す。リンクはリポジトリ相対。

調査対象は現在の `dev-beta`。**要求サイズ超過と、保存成功扱いで編集を落とす経路を確認しました。「研究」で現在、実際に失われている編集の特定は UNKNOWN です。** 書き込み・サーバー操作・ファイル変更なし。Git 状態は開始時と終了時で一致しました。

<details>
<summary>調査基準・ライブ DB・読み取り方法</summary>

HEAD: `d67b8348a0d5857375c6adabc788e00ce6ac518d` — Director Playbook に CI push gate と作業ツリーの commit 制限を記録。
DB: `$M3E_HOME/workspaces/<個人 workspace>/data.sqlite`（macOS の既定は `~/Library/Application Support/M3E`）
接続はすべて `python3 sqlite3.connect('file:'+path+'?mode=ro', uri=True)`。
実行照会: `SELECT id,saved_at,length(CAST(state_json AS BLOB)),state_json FROM maps`
実行照会: `SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name`、`PRAGMA table_info(maps)`、`PRAGMA journal_mode`
Python で root の text が「研究」の行を選び、Node.js の `Buffer.byteLength(JSON.stringify(value))` で各値と要求本文を計算。
配置根拠: [launch.sh:18–24](../../../scripts/beta/launch.sh:18)、[start_viewer.ts:170–176](../../../beta/src/node/start_viewer.ts:170)。既存起動ログの DB パスとも一致。
`git diff HEAD -- beta/src final/src scripts install` は差分なし。既存の未コミット変更は保持。
</details>

### 1. CONFIRMED：要求本文と上限

本文は `version:1, savedAt, state, baseSavedAt, baseState, force`。通常ロード後の `baseState` は全状態の複製で、`force:true` でも送信します。[viewer.ts:12763–12813](../../../beta/src/browser/viewer.ts:12763)、[viewer.ts:13666–13669](../../../beta/src/browser/viewer.ts:13666)
上限は **10,000,000 バイト**。受信 chunk の累計が超えると `Request body too large.` で reject し、`req.destroy()`。[start_viewer.ts:2178–2196](../../../beta/src/node/start_viewer.ts:2178)
**「必ず HTTP 413」は REFUTED。** 保存 handler は HTTP 400 と `{error:"Request body too large."}` を返そうとしますが、接続破棄済みなので応答到達は保証されません。[start_viewer.ts:2699–2706](../../../beta/src/node/start_viewer.ts:2699)

### 2. CONFIRMED：研究の保存状態は、二重送信すると上限超過

上記 read-only DB 照会の実測：**20,150 node、`state_json` 7,967,381 バイト**。`saved_at` は `2026-10-22T17:33:30.895Z`。調査終了時も同値でした。
以下は各 field の**値を JSON 化した UTF-8 バイト数**と、保存状態全体に対する比率です。

| field | バイト | 比率 |
|---|---:|---:|
| `nodes` | 7,712,037 | 96.79513% |
| `links`（GraphLink） | 2 | 0.00003% |
| `linearNotesByScope` | 137,149 | 1.72138% |
| `scopes` | 6,811 | 0.08549% |
| `surfaces` | 111,244 | 1.39624% |
| `rootId` | 24 | 0.00030% |
| `annotations` | 2 | 0.00003% |
| `linearTextFontScale` | 1 | 0.00001% |
| field 名・区切り等 | 111 | 0.00139% |

DB の状態を `state` と `baseState` に使い、1 節の形式で組み立てた推計は **15,934,889 バイト**。上限を **5,934,889 バイト超過**します。
これは要求構築の計算結果です。実ブラウザーの未保存状態・正規化後の本文は採取していません。ブラウザーはロード・保存時に正規化するため、その差は別です。[viewer.ts:2703–2757](../../../beta/src/browser/viewer.ts:2703)、[viewer.ts:12763–12769](../../../beta/src/browser/viewer.ts:12763)

### 3. CONFIRMED：通常の自動保存は失敗を無視する

700 ms の自動保存は `void saveDocToLocalDb(false)` で boolean を無視。非409の HTTP エラー・通信失敗・保存例外は catch で `false` になり、`showStatus=false` では表示されません。[viewer.ts:473](../../../beta/src/browser/viewer.ts:473)、[viewer.ts:13111–13125](../../../beta/src/browser/viewer.ts:13111)、[viewer.ts:12853–12882](../../../beta/src/browser/viewer.ts:12853)
409 は自動保存でも status を表示し、remote state があれば選択 Panel を出します。明示保存は catch の失敗表示あり、削除後の即時保存は `Local save failed after delete.` を表示します。[viewer.ts:12816–12850](../../../beta/src/browser/viewer.ts:12816)、[viewer.ts:13128–13139](../../../beta/src/browser/viewer.ts:13128)
linear-text の「saved」表示は保存完了待ちではなく、自動保存予約直後です。[viewer.ts:15335–15344](../../../beta/src/browser/viewer.ts:15335)

### 4. CONFIRMED：競合マージは `nodes` だけ

`currentState` 全体を複製し、各 node 全体の変更・追加・削除だけを比較・適用します。`links`、`linearNotesByScope`、`scopes`、`surfaces`、`annotations`、表示設定、`rootId` の local 変更はマージ対象外です。[start_viewer.ts:2764–2811](../../../beta/src/node/start_viewer.ts:2764)
node 内の `nodeType`・`scopeId`・attributes は node として扱われます。top-level の scope データとは区別が必要です。
**読み取り専用の診断実行**として HEAD の同関数をメモリ上で実行し、GraphLink・linear-text・scope データ等を落としても `ok:true` になることを確認しました。DB 保存・ブラウザー再現ではありません。
マージ後の検証が通れば、保存して HTTP 200／`merged:true` を返します。[start_viewer.ts:2637–2662](../../../beta/src/node/start_viewer.ts:2637)

### 5. CONFIRMED：内容未適用でも保存基準時刻が進む

`map_updated` は自己通知の除外後、重複判定・未保存判定・再取得より先に `lastServerSavedAt` を更新します。自動保存予約中なら内容適用を行わず return。[viewer.ts:13201–13218](../../../beta/src/browser/viewer.ts:13201)
したがって「古い内容＋新しい基準時刻」が成立します。次の保存時に時刻が一致するとマージ分岐を通らず、その要求時点の revision 検査を通って古い全状態で外部編集を上書きし得ます。**コードからの推論で、実保存の再現は未実施です。** [start_viewer.ts:2611–2623](../../../beta/src/node/start_viewer.ts:2611)、[start_viewer.ts:2682–2687](../../../beta/src/node/start_viewer.ts:2682)

### 6. REFUTED：ブラウザーはマージ後の確定状態を採用しない

サーバーのマージ成功応答に確定 `state` はありません。ブラウザーは新しい `savedAt` と、**自分が送った `submittedState`** を新しい基準にします。[start_viewer.ts:2653–2662](../../../beta/src/node/start_viewer.ts:2653)、[viewer.ts:12858–12865](../../../beta/src/browser/viewer.ts:12858)
その後の保存で、直前のマージが保持した外部編集を上書きし得ます。これはコードからの推論です。

### 7. CONFIRMED：書き込み経路一覧

共通保存 `saveToSqlite` は全 `state_json` の単文 UPSERT。読み取りから確定までの transaction・revision 検査はありません。`saveToSqliteIfUnchanged` だけが **BEGIN IMMEDIATE 内で保存状態全体の SHA-256 revision を再確認して全置換**します。[rapid_mvp.ts:1489–1537](../../../beta/src/node/rapid_mvp.ts:1489)
以下の「単文」は SQLite の文単位の確定であり、全状態の読み取りを保護する lock を意味しません。通知列は `map_updated` です。

| 入口・経路 | `state_json` の扱い | transaction／lock・競合確認 | 通知・根拠 |
|---|---|---|---|
| Browser `POST /api/maps/:id` | 全状態置換／競合時 node マージ | process 内 `activeMapSaves`、任意の `baseSavedAt`、既存mapは即時transaction＋revision再確認 | あり。[start_viewer.ts:2553–2709](../../../beta/src/node/start_viewer.ts:2553) |
| 同 POST `?scope=...` | 全状態を読み、部分木を交換して全置換 | 同process lock、単文。基準revision検査なし | あり。[start_viewer.ts:2579–2601](../../../beta/src/node/start_viewer.ts:2579)、[rapid_mvp.ts:1275](../../../beta/src/node/rapid_mvp.ts:1275)、[rapid_mvp.ts:1445–1466](../../../beta/src/node/rapid_mvp.ts:1445) |
| Model Context Protocol `m3e_create/update/delete` | 全状態を読み、操作後に全置換 | retained／`expected_revision`＋即時transactionで再確認。browser保存中・live Vaultは拒否 | あり。[mcp_service.ts:367–487](../../../beta/src/node/mcp_service.ts:367)、[start_viewer.ts:180–190](../../../beta/src/node/start_viewer.ts:180) |
| `import_structure`、`import_mfh`、copy | 上記MCPと同じ | 同じ。`import_structure` はimport keyをnode属性に同時保存 | あり。[mcp_service.ts:398–453](../../../beta/src/node/mcp_service.ts:398) |
| Flash jobs生成完了・再開・`retry-import` | `m3e_create(import_structure)`へ到達 | 上記MCPと同じ | あり。[flash_jobs.ts:35](../../../beta/src/node/flash_jobs.ts:35)、[flash_jobs.ts:54–66](../../../beta/src/node/flash_jobs.ts:54)、[flash_jobs.ts:108–119](../../../beta/src/node/flash_jobs.ts:108) |
| 旧 Flash draft `approve` | 全状態を読み、追加後に全置換 | 単文、競合確認なし | **なし**。[start_viewer.ts:1931–1953](../../../beta/src/node/start_viewer.ts:1931) |
| `PUT/DELETE /api/maps/:id/linear/:scope` | 全状態を読み、linear-text変更後に全置換 | PUTは**body受信前に読込**。単文、競合確認なし | あり。[start_viewer.ts:1615–1705](../../../beta/src/node/start_viewer.ts:1615) |
| GraphLink `POST .../links`／`DELETE .../links/:link` | 全状態を読み、変更後に全置換 | 作成はbody受信前に読込。単文、競合確認なし | あり。[start_viewer.ts:2231–2320](../../../beta/src/node/start_viewer.ts:2231) |
| `.../subtree/append-mf-h` | 全状態を読み、追加後に全置換 | 単文、任意の`baseSavedAt`事前確認のみ | あり。[start_viewer.ts:3209–3249](../../../beta/src/node/start_viewer.ts:3209) |
| `.../rapid/mapify-oracle` | 同上 | 単文、任意の`baseSavedAt`事前確認のみ | あり。[start_viewer.ts:3287–3352](../../../beta/src/node/start_viewer.ts:3287) |
| `.../cas/pn-generate` | 全状態を読み、生成待機後に全置換 | 任意の時刻確認は**生成前だけ**。確定時再確認なし | あり。[start_viewer.ts:3405–3499](../../../beta/src/node/start_viewer.ts:3405) |
| `/api/collab/push/:map` | 全状態を読み、受信nodesを適用して全置換 | process内scope lock＋process内`mapVersion`。単文、DB revision再確認なし | あり。[collab.ts:341–465](../../../beta/src/node/collab.ts:341)、[start_viewer.ts:4140–4149](../../../beta/src/node/start_viewer.ts:4140) |
| `/api/vault/import` | 既存状態を読んでID再利用、Vaultから全状態を再生成・全置換 | 非同期importを跨ぐtransaction／競合確認なし | あり。[vault_importer.ts:505–519](../../../beta/src/node/vault_importer.ts:505)、[start_viewer.ts:2028–2034](../../../beta/src/node/start_viewer.ts:2028) |
| Vault watch変更／削除 | 再importによる全置換／全状態を読んでmissing属性変更後に全置換 | debounce・自己イベント抑止のみ。DB競合確認なし | あり。[vault_watch.ts:57–66](../../../beta/src/node/vault_watch.ts:57)、[vault_watch.ts:266–345](../../../beta/src/node/vault_watch.ts:266) |
| Browser保存＋live Obsidian | Markdownを書いた後、SQLite全置換 | 二保存先を跨ぐtransactionなし。SQLiteのrevision再確認も省略 | あり。[vault_watch.ts:205–230](../../../beta/src/node/vault_watch.ts:205)、[start_viewer.ts:2643–2649](../../../beta/src/node/start_viewer.ts:2643)、[start_viewer.ts:2682–2687](../../../beta/src/node/start_viewer.ts:2682) |
| `/api/vault/export` | Markdownファイルを順次保存。SQLite更新なし | 全ファイル一括transaction／revision確認なし | なし。[vault_exporter.ts:210–256](../../../beta/src/node/vault_exporter.ts:210) |
| `/api/blueprint/import` | 生成した全状態で保存 | 単文、競合確認なし | あり。[blueprint_importer.ts:1034–1044](../../../beta/src/node/blueprint_importer.ts:1034)、[start_viewer.ts:2153–2158](../../../beta/src/node/start_viewer.ts:2153) |
| Home new／duplicate | 全状態新規保存／既存JSONをコピーINSERT | 単文、存在確認のみ | なし。[start_viewer.ts:1200–1213](../../../beta/src/node/start_viewer.ts:1200)、[rapid_mvp.ts:1017–1038](../../../beta/src/node/rapid_mvp.ts:1017) |
| Home import-file／import-vault | 新規mapへ全状態保存 | 単文、競合確認なし | なし。[start_viewer.ts:1403–1422](../../../beta/src/node/start_viewer.ts:1403)、[start_viewer.ts:1462–1468](../../../beta/src/node/start_viewer.ts:1462) |
| Home rename | 全状態を読み、root text変更後に全置換 | 単文、競合確認なし | なし。[rapid_mvp.ts:1044–1068](../../../beta/src/node/rapid_mvp.ts:1044)、[start_viewer.ts:1239–1248](../../../beta/src/node/start_viewer.ts:1239) |
| tags／archive／restore／pin／bind-vault／unbind-vault | 対応するmap列だけUPDATE | 単文、revision確認なし。ここでのrestoreはarchive解除 | なし。[rapid_mvp.ts:1074–1126](../../../beta/src/node/rapid_mvp.ts:1074) |
| Home map削除 | map行DELETE | archived確認後に単文DELETE | あり。[rapid_mvp.ts:1135–1147](../../../beta/src/node/rapid_mvp.ts:1135)、[start_viewer.ts:1472–1475](../../../beta/src/node/start_viewer.ts:1472) |
| `/api/sync/backups/:map/restore/:backup` | backupの全状態で置換 | 単文、競合確認なし | **なし**。[start_viewer.ts:1538–1557](../../../beta/src/node/start_viewer.ts:1538) |
| cloud push／定期push | 全状態をJSONファイル／Supabase行へ保存。local SQLite更新なし | 時刻／mapVersionの事前比較。比較と書込を一体化するlock・条件付き確定なし | なし。[cloud_sync.ts:129–162](../../../beta/src/node/cloud_sync.ts:129)、[cloud_sync.ts:288–354](../../../beta/src/node/cloud_sync.ts:288)、[cloud_sync.ts:533–550](../../../beta/src/node/cloud_sync.ts:533) |
| cloud pull | **SQLiteへ保存しない**。状態をbrowserへ返し、`loadPayload`で採用 | local確定なし。後日の通常保存は最上段 | なし。[start_viewer.ts:3613–3636](../../../beta/src/node/start_viewer.ts:3613)、[viewer.ts:13023–13030](../../../beta/src/browser/viewer.ts:13023) |
| 起動時ensureMap・旧ID移行 | root再命名による全置換／ID更新・旧行削除・新規作成 | 各単文、全体transaction／revision確認なし | なし。[start_viewer.ts:298–343](../../../beta/src/node/start_viewer.ts:298)、[start_viewer.ts:3888–3890](../../../beta/src/node/start_viewer.ts:3888) |
| DB schema移行 | `documents→maps`、列追加。node別保存への移行なし | 個別DDL、全体transactionなし | なし。[rapid_mvp.ts:852–894](../../../beta/src/node/rapid_mvp.ts:852) |

CLI／scripts も別経路として確認しました。`system_diagram_runner` は一度取得した全状態を操作ごとに POST し、`baseSavedAt` を送りません。`v4_service_slice_demo`、`vm_swingby_conflict_lab` も通常POSTへ到達します。[system_diagram_runner.ts:78–95](../../../beta/src/node/system_diagram_runner.ts:78)、[system_diagram_runner.ts:258–310](../../../beta/src/node/system_diagram_runner.ts:258)、[v4_service_slice_demo.mjs:129](../../../scripts/ops/v4_service_slice_demo.mjs:129)、[vm_swingby_conflict_lab.ps1:119](../../../scripts/ops/vm_swingby_conflict_lab.ps1:119)
Rapid sample CLI は専用JSON・SQLiteへ保存。launcherのseedコピーはDB不存在時だけ。snapshot scriptはbackup先への出力で、既存map更新ではありません。[rapid_mvp.ts:1615–1619](../../../beta/src/node/rapid_mvp.ts:1615)、[launch.sh:134–138](../../../scripts/beta/launch.sh:134)、[m3e-data-snapshot.sh:154–156](../../../scripts/ops/m3e-data-snapshot.sh:154)
同HEADには別のFinal実装もあり、全JSON UPSERTを保持。既定workspaceはBetaと別ですが、設定で同じDBを指定できます。`beta/legacy` はJSON sample保存で、通常起動対象ではありません。[final rapid_mvp.ts:1296–1318](../../../final/src/node/rapid_mvp.ts:1296)、[Final launch.sh:130–137](../../../scripts/final/launch.sh:130)、[legacy rapid_mvp.js:314–316](../../../beta/legacy/rapid_mvp.js:314)、[package.json:39](../../../beta/package.json:39)

### 8. PARTIAL：履歴単位では全状態複製。ただし全操作一律ではない

Browserの履歴追加、Undo、Redoは `JSON.parse(JSON.stringify(canonicalMapState()))`。Grab開始時も全状態を複製します。[viewer.ts:4286–4353](../../../beta/src/browser/viewer.ts:4286)、[viewer.ts:12231](../../../beta/src/browser/viewer.ts:12231)
Coreも `_pushHistory`・Undo・Redoで全状態複製。`import_structure` はnodeごとに `addNode` を呼ぶため、一括保存でも複製はnodeごとに発生します。[rapid_mvp.ts:84–120](../../../beta/src/node/rapid_mvp.ts:84)、[rapid_mvp.ts:186–188](../../../beta/src/node/rapid_mvp.ts:186)、[rapid_mvp.ts:635–648](../../../beta/src/node/rapid_mvp.ts:635)、[mcp_service.ts:425–432](../../../beta/src/node/mcp_service.ts:425)
一方、linear-textのinputには履歴追加がありません。「あらゆる操作ごとに一回」は不正確です。[viewer.ts:15306–15317](../../../beta/src/browser/viewer.ts:15306)

### 9. CONFIRMED：外部更新は全取得・全複製・非増分描画

SSE受信後、map全体GET→JSON解釈・正規化→基準状態の全複製→`render()`→別tab通知です。[viewer.ts:13259–13300](../../../beta/src/browser/viewer.ts:13259)
`render()` の既定値は `incremental=false`。node／edge描画cacheを非増分扱いで開始し、`buildLayout`を呼びます。既存cacheの存在と、この入口が非増分であることは両立します。[viewer.ts:7842–7869](../../../beta/src/browser/viewer.ts:7842)、[viewer.ts:7892](../../../beta/src/browser/viewer.ts:7892)
処理時間・画面更新レートは今回未測定です。

### 10. CONFIRMED：ライブworkspace DBのtableは `maps` だけ

`sqlite_master` と `PRAGMA table_info(maps)` のread-only実測で、全列は次のとおりです。

| table | 全column |
|---|---|
| `maps` | `id TEXT PRIMARY KEY`、`version INTEGER NOT NULL`、`saved_at TEXT NOT NULL`、`state_json TEXT NOT NULL`、`tags TEXT`、`archived INTEGER NOT NULL DEFAULT 0`、`pinned INTEGER NOT NULL DEFAULT 0`、`source TEXT` |

backup・audit・sync・Flash jobs・node revision・operation履歴のtableは**ありません**。`version` は保存形式の1で、node revisionではありません。[rapid_mvp.ts:1490–1511](../../../beta/src/node/rapid_mvp.ts:1490)
auditは別JSONLで、collab経路の操作名・対象・version等を保存しますが、変更内容をreplayする情報はありません。Flash jobsは別JSONファイル、旧draftはメモリ上、conflict backupも別JSONです。[audit_log.ts:47–84](../../../beta/src/node/audit_log.ts:47)、[collab.ts:468–485](../../../beta/src/node/collab.ts:468)、[flash_jobs.ts:42–49](../../../beta/src/node/flash_jobs.ts:42)、[flash_ingest.ts:49–52](../../../beta/src/node/flash_ingest.ts:49)、[conflict_backup.ts:62–84](../../../beta/src/node/conflict_backup.ts:62)
`scope_binding.ts` に `binding_event/run/patch` 等のschema定義はありますが、このDBには未作成。全map編集のjournalとして稼働している証拠にはなりません。[scope_binding.ts:147–242](../../../beta/src/node/scope_binding.ts:147)、[scope_binding.ts:688–744](../../../beta/src/node/scope_binding.ts:688)

### 11. PARTIAL：操作APIとrevision検査はあるが、Command envelopeは未統合

仕様4.2の `commandId/actor/targetRef/intent/baseRevision/provenance/approvalState` を満たす共通map書込契約は確認できません。文書自身も Definition only です。[Command_Language.md:5](../../../docs/03_Spec/Command_Language.md:5)、[Command_Language.md:158–170](../../../docs/03_Spec/Command_Language.md:158)
MCPにはtarget参照・操作・expected revision、Flash importには重複防止keyがあります。ただし、確定時は全状態置換です。[mcp_service.ts:367–480](../../../beta/src/node/mcp_service.ts:367)
System DiagramのCommandとORRERYのCommandは別契約です。[system_diagram_command_types.ts:10–15](../../../beta/src/shared/system_diagram_command_types.ts:10)、[orrery_seam_interface.ts:104–111](../../../beta/src/shared/orrery_seam_interface.ts:104)
**node・edge・GraphLink・linear-textを全状態置換なしで確定するAPIは確認できません。** 例外はtags等のmap列更新・map行削除で、7 節のとおり部分SQLです。

### 12. PARTIAL：通常経路はapp server経由。DB全体の単一writer制約はない

BrowserとMCP transportはSQLiteを直接書きません。MCP serverはapp serverの `/api/mcp/call` へ転送します。[mcp_server.ts:77–100](../../../beta/src/node/mcp_server.ts:77)
同じDBを指定した別server・直接Coreを使うprocessを排他する仕組みはありません。`activeMapSaves` はprocess内だけです。条件付き保存は跨processの競合を検出しますが、無条件保存には及びません。[start_viewer.ts:179](../../../beta/src/node/start_viewer.ts:179)、[rapid_mvp.ts:858](../../../beta/src/node/rapid_mvp.ts:858)、[rapid_mvp.ts:1518–1530](../../../beta/src/node/rapid_mvp.ts:1518)
ライブDBの `PRAGMA journal_mode` は **`delete`、WALではありません**。appはtimeoutを指定せず、導入済みbetter-sqlite3の既定値は **5,000 ms** です。[rapid_mvp.ts:858](../../../beta/src/node/rapid_mvp.ts:858)、[database.js:34](../../../beta/node_modules/better-sqlite3/lib/database.js:34)
`lsof`で4173のlistenerは1 processを観測。接続が短命なので、同時に書き得る全processの実数は **UNKNOWN**。SQLiteの物理書込lockと、古い全状態による上書き防止は別です。

### 13. CONFIRMED：追加の欠落経路あり。実使用での発生は未確認

**別tab：** BroadcastChannel受信は未保存確認なしで状態と基準を交換し、linear-textの別保持値をhydrateしません。次の保存はその古い別保持値をstateへ戻すため、受信済みlinear-textも上書きし得ます。[viewer.ts:13156–13169](../../../beta/src/browser/viewer.ts:13156)、[viewer.ts:2399–2403](../../../beta/src/browser/viewer.ts:2399)、[viewer.ts:12763–12765](../../../beta/src/browser/viewer.ts:12763)
**collab保存：** 通常保存がscope pushへ分岐すると送るのは `changes.nodes` だけ。linear-text・GraphLink等を送らず、node適用成功で保存成功を返し得ます。[viewer.ts:12795–12796](../../../beta/src/browser/viewer.ts:12795)、[viewer.ts:10449–10506](../../../beta/src/browser/viewer.ts:10449)
**非同期処理：** 生成前に全状態を読んだ `cas/pn-generate`、body受信前に読んだlinear-text／GraphLink作成、非同期Vault importは、待機中の別保存を無条件全置換で落とし得ます。7 節の該当箇所が根拠です。
**Vault再import：** 生成状態は `{rootId,nodes,links:{}}`。既存のGraphLink・linear-text・scope付属データを引き継ぐ全状態マージではありません。[vault_importer.ts:473–477](../../../beta/src/node/vault_importer.ts:473)
**cloud定期push：** server側callbackはbase時刻・versionを毎回nullにし、競合判定は基準なしを非競合とします。別PCのcloud状態を上書きし得ます。現在の有効化状態は未確認です。[start_viewer.ts:3937–3939](../../../beta/src/node/start_viewer.ts:3937)、[cloud_sync.ts:25–45](../../../beta/src/node/cloud_sync.ts:25)
**更新取りこぼし：** SSE接続開始は接続コメントのみで現状態の照合・過去通知replayがなく、非表示中は切断します。通知しないrestore／rename／旧Flash承認と合わせ、古い状態からの次回保存に注意が必要です。[start_viewer.ts:392–400](../../../beta/src/node/start_viewer.ts:392)、[viewer.ts:13233–13240](../../../beta/src/browser/viewer.ts:13233)
履歴照会 `git log --since='2026-10-23 00:00:00 +0900' -- <対象paths>` では、保存関連の変更は「Concreteness Axis導入」と「表示・scope復帰・Vault部分木出力の補完」。canonical状態を保存・Undo・別tab通知に使う変更があります。[viewer.ts:4229–4247](../../../beta/src/browser/viewer.ts:4229)、[vault_exporter.ts:178](../../../beta/src/node/vault_exporter.ts:178)
同期間に `rapid_mvp/start_viewer/mcp_service/flash_jobs/cloud_sync/vault_watch/vault_importer/collab` の変更はありません。外部コピーの作成時刻が不明なので、10月23日未明の変更を含むかは **UNKNOWN** です。

最重大経路：外部通知で時刻だけ前進→内容未適用→古い全状態を保存→外部編集を成功応答付きで上書きし得ます（5・6 節）。  
競合マージでは、linear-text・GraphLink等のlocal変更を反映せず成功することをメモリ上の診断で確認しました（4 節）。  
「研究」は20,150 node・7,967,381バイトで、現在と基準を二重送信する推計要求は15,934,889バイト、上限超過です（2 節）。  
「研究が現在、実際に編集を失っているか」は **UNKNOWN**：今回は保存要求・失敗応答・再読み込み前後を実測していません。  
次の一手：Directorは7 節の全書込経路と、基準状態・確定応答・journal・復旧・外部保存先を、一度の移行範囲として確定してください。
