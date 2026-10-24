# 草案: 書込み経路と Command intent の対応表

2026-10-25。brief の PR15 に当たる棚卸しの草案。状態は**未レビュー**で、移行先（DC39）と出し方（DC40）の判断はしていない。採番は Director が行うので、この文書は新しい追跡 ID を持たない。行は表ごとの通し番号（例: 層 A の 12 行目）で参照する。

## 前提

- 基準: dev-beta `da2cdb4`（作業中に `3503a95` から viewer filter の merge で進んだ）。サーバー側（`beta/src/node/`）は `3503a95` と同一。[research-current-state.md](./research-current-state.md) の行番号は `d67b834` 基準で、`start_viewer.ts` は `a128c85`（受信上限の変更）、`viewer.ts` は `a128c85` と viewer filter の merge でずれている。本書の行番号は `da2cdb4` 基準。
- ファイル名だけの場合の置き場: `start_viewer.ts`・`rapid_mvp.ts`・`mcp_service.ts`・`collab.ts`・`cloud_sync.ts`・`vault_*.ts`・`flash_*.ts`・`blueprint_importer.ts`・`scope_binding.ts`・`backup.ts`・`system_diagram_runner.ts` は `beta/src/node/`。`viewer.ts`・`home.ts`・`lane_view_controller.ts`・`edge_graphlink_selection_adapter.ts` は `beta/src/browser/`。`concreteness_axis.ts` は `beta/src/shared/`。Final は `final/src/node/` と明記する。
- 根拠の印: **確認** はコードを読んで確かめたこと、**推論** はコードからの推論（再現していない）、**実データ** は個人 workspace の DB を読み取り専用（`mode=ro`）で照会した結果。保存要求の実測・ブラウザでの再現はしていない。
- 保存されている field と Glossary の語の対応: `nodes` = node（`parentId`・`children` が親子 edge と兄弟順、`collapsed` が collapse 状態）、`links` = GraphLink、`linearNotesByScope` = scope ごとの linear-text、`scopes` = scope の派生記録、`surfaces` = Surface View の設定と node の位置（Layout）、`annotations` = 注釈（[Annotation Panel](../../../docs/00_Home/Glossary.md) の Pen 等の描画）、`linearTextFontScale`・`linearPanelWidth` = linear-text 表示の書体倍率と幅。
- Command intent の出典: Glossary の `Command`（`assert` / `rename` / `reparent` / `bind` / `transfer` / `delete` 等）、[Command_Language.md](../../../docs/03_Spec/Command_Language.md) 4 節（`set-attribute` / `unset-attribute` / `set-type` / `clone` / `replace` / `view` / `load` / `export` / `history`）、Glossary の操作語（`reorder`・`scopen`・`unscopen`・`collapse`）。intent の列で backtick のない「定義語なし（…）」は、定義済みの語がない意図を説明したもの。名前ではない。
- 「同時に変える記録」は、brief の論理レコードモデル（node、edge＝親と兄弟順、GraphLink、scope ごとの linear-text、属性）の単位で書く。

## 0. 数のまとめ

- 層 A（サーバー・プロセスの書込み経路）: **63 行**。うち SQLite の `maps` 行か DB file を変えるもの 52 行（Final の 3 行を含む）、外部の複製先・Markdown・backup・sample の file だけを書くもの 8 行（28・29・42・43・44・49・50・57）、休眠・未追跡の実装 3 行（61〜63）。
- 層 B（ブラウザ操作）: **61 行**。すべて層 B 50 を通り、層 A 1〜3（collab 参加中は層 A 24）の全状態保存で確定する。うち 7 行（37・40・41・43・56・58・59）は、少なくとも一部が利用者の操作なしに書く。
- 確定時に revision を確かめ直すのは、層 A 1〜3 と MCP（層 A 7〜14）、それを通る Flash job（15）だけ。research の結論と同じ。
- intent ごとの行数は 5.1 節。定義語のない意図を含む行は 39 行（層 A 23・層 B 16）。

## 1. 層 A: サーバー・プロセスの書込み経路

### 1.1 現状

| # | 区分 | 入口（file:line） | 呼出し元 | 今の読み書き | transaction・競合確認 | `map_updated` | 根拠 |
|---|---|---|---|---|---|---|---|
| 1 | ブラウザ保存 | `start_viewer.ts:2561–2614, 2689–2706`（POST `/api/maps/:id` 通常確定） | viewer の自動保存・明示保存 `viewer.ts:12761`、層 A 51〜55 の script | 受信は state 全体＋baseState 全体＋baseSavedAt。DB の map 全体を読み、state_json を全置換 | process 内の `activeMapSaves`。baseSavedAt を送った時は一致した場合だけ通る（送らなければ比べない）。既存 map は `saveToSqliteIfUnchanged`（BEGIN IMMEDIATE で全体の SHA を再確認、`rapid_mvp.ts:1519`） | あり | 確認 |
| 2 | ブラウザ保存 | `start_viewer.ts:2617–2676`（base 不一致時のマージ）、`mergeLocalNodeChanges` `:2772` | 同上 | baseState・DB・受信 state を比べ、node 単位の変更だけを DB の状態へ適用して全置換。応答に確定 state を含まない | 同上。マージ結果は DB の revision に対して条件付き確定 | あり | 確認（IS117・IS119） |
| 3 | ブラウザ保存 | `start_viewer.ts:2615`（`force`）→ `:2689–2692` | 競合 Panel の Use Local `viewer.ts:12810`、層 A 52・54・55 | base の確認を飛ばし、受信 state で全置換 | 要求時点に読んだ revision との条件付き確定だけ | あり | 確認 |
| 4 | ブラウザ保存 | `start_viewer.ts:2613, 2692`（存在しない map id への POST） | 任意の POST（初回の実行で固定 id の map を作る `scripts/ops/v4_service_slice_demo.mjs:22, 358` など） | `saveToSqlite` の UPSERT で map 行を新規作成 | なし | あり | 確認 |
| 5 | ブラウザ保存 | `start_viewer.ts:2584–2604` → `rapid_mvp.ts:1269`（POST `?scope=` の部分木置換） | repo 内は test だけ（`git grep` で確認） | map 全体を読み、部分木を受信分で置換。旧部分木に触れる GraphLink を、境界をまたぐものも含めて全部消す（`rapid_mvp.ts:1423–1436`）。全置換 | `activeMapSaves` だけ。base revision なし。単文 | あり（savedAt が保存値と別、`rapid_mvp.ts:1469`） | 確認 |
| 6 | ブラウザ保存 | `start_viewer.ts:2652–2653, 2690–2692` → `vault_watch.ts:205` | live Obsidian の map への層 A 1・2 | Markdown を先に書き、その後 SQLite を無条件に全置換 | 二つの保存先をまたぐ transaction なし。SQLite の revision 再確認を省く | あり | 確認 |
| 7 | MCP | `mcp_service.ts:393`（`m3e_create` node）。共通処理 `:367–493` | MCP の agent（`mcp_server.ts:99` → `start_viewer.ts:234`） | map 全体を読み、Core で node を追加して全置換 | context の baseline か `expected_revision`（`:380`）。保存中と live Vault の map は拒否（`start_viewer.ts:180–190`）。`saveToSqliteIfUnchanged`（`:480`） | あり（`onSaved` `:487` → `start_viewer.ts:186`） | 確認 |
| 8 | MCP | `mcp_service.ts:397`（copy）→ `rapid_mvp.ts:412` | 同上 | 部分木を新しい ID で複製。`scopes`・`surfaces`・注釈・linear-text も付け替えて複製。全置換 | 同上。1000 node まで | あり | 確認 |
| 9 | MCP | `mcp_service.ts:406–438`（import_structure） | 同上、Flash job（層 A 15） | node を 1 つずつ追加（そのたびに Core が全状態を複製、`rapid_mvp.ts:119, 186`）。root を scopen し、root の attributes に import key（`m3e:flashImportKey`）等を書く。全置換 | 同上。import key で再送を検出（`:410`） | あり | 確認 |
| 10 | MCP | `mcp_service.ts:439`（import_mfh） | 同上 | MF-H の見出しを部分木として追加。全置換 | 同上 | あり | 確認 |
| 11 | MCP | `mcp_service.ts:458`（`m3e_update` content）、`:494`（attributes の patch） | 同上 | text・alias の表示名・attributes を変更。全置換 | 同上 | あり | 確認 |
| 12 | MCP | `mcp_service.ts:465`（move）→ `rapid_mvp.ts:600` | 同上 | 親を変え、新しい親の末尾へ置く（順は指定できない）。全置換 | 同上。map をまたぐ移動は拒否 | あり | 確認 |
| 13 | MCP | `mcp_service.ts:470`（scopen / unscopen）→ `rapid_mvp.ts:403` | 同上 | nodeType だけを変える。`scopes`・`surfaces` は更新しない | 同上 | あり | 確認 |
| 14 | MCP | `mcp_service.ts:473`（`m3e_delete`）→ `rapid_mvp.ts:575` | 同上 | 部分木を削除し、接する GraphLink を消し、target を失う alias を broken にして text を書き換える。linear-text・注釈・`surfaces` の位置は残る。全置換 | 同上 | あり | 確認 |
| 15 | Flash | `start_viewer.ts:195–224`、`flash_jobs.ts:35`（起動時の resume）、`:54`（retry-import）、`:67`（submit）、`:90`（run） | `/api/flash/jobs` の client、起動時（`start_viewer.ts:3906`） | job を JSON file に保存し、生成が終わると層 A 9 を呼ぶ | 層 A 9 と同じ。REVISION_CONFLICT などで job を failed にし、自動では再試行しない（`flash_jobs.ts:117`） | あり | 確認 |
| 16 | Flash | `start_viewer.ts:1932–1953`（旧 draft の approve）、`flash_ingest.ts:372` | viewer の V4 Panel `viewer.ts:1963`、`v4_service_slice_demo.mjs:163` | map 全体を読み、draft の node を足して全置換。draft は process 内のメモリだけ | 単文。競合確認なし | **なし** | 確認 |
| 17 | linear-text | `start_viewer.ts:1643–1681`（PUT `/linear/:scope`） | repo 内は test だけ | body を受け取る前に map 全体を読み（`:1619`）、linear-text 1 件を置き換えて全置換。collab の mapVersion を進める（`:1677`） | 単文。競合確認なし | あり（savedAt が保存値と別、`:1675`） | 確認 |
| 18 | linear-text | `start_viewer.ts:1683–1709`（DELETE） | 同上 | linear-text 1 件を消して全置換 | 同上 | あり（同上、`:1702`） | 確認 |
| 19 | GraphLink | `start_viewer.ts:2253–2311`（POST `/links`）→ `rapid_mvp.ts:336` | 同上 | body 受信前に読んだ map（`:2241`）へ GraphLink を足して全置換。同じ端点の重複を拒否しない（viewer は拒否する） | 同上 | あり（savedAt が別、`:2305`） | 確認 |
| 20 | GraphLink | `start_viewer.ts:2313–2331`（DELETE `/links/:link`） | 同上 | GraphLink を消して全置換 | 同上 | あり（`:2326`） | 確認 |
| 21 | agent の追加 | `start_viewer.ts:3190–3274`（append-mf-h）、合流処理 `:3091–3139` | 外部の agent（`tools/rapid_mapify_oracle/` の実行記録） | MF-H を親の下へ追加。同名（大文字小文字を無視）の既存の子には合流する。全置換し、Vault 書出しを予約 | 任意の baseSavedAt を事前に比べるだけ（`:3218`）。単文 | あり | 確認 |
| 22 | agent の追加 | `start_viewer.ts:3276–3387`（rapid/mapify-oracle） | 同上 | 層 A 21 と同じ。opId は応答に返すだけ | 同上 | あり | 確認 |
| 23 | agent の追加 | `start_viewer.ts:3389–3540`（cas/pn-generate） | viewer の Rapid 生成 `viewer.ts:6906` → `:6635` | 生成前に map 全体を読み、Codex App Server の生成を待ってから子を足し、provenance の属性（`m3e:pn.*`・`m3e:cas.*`）を書いて全置換 | 事前比較は生成前だけ。確定時の再確認なし（IS122） | あり | 確認 |
| 24 | collab | `start_viewer.ts:4137–4161` → `collab.ts:341` | viewer `viewer.ts:10405`（collab 参加中は通常保存の代わりに `:12778`、通常保存の後にも `:12854`） | 受信 nodes を map に適用して全置換。scope root を含む全量送信では、受信になかった既存の子孫を「端末で削除された」とみなして消す（`collab.ts:390–391`）。audit に記録 | scope lock と、process 全体で 1 つの `mapVersion`（`collab.ts:56`。全 map 共通で、collab push と層 A 17・18 だけが進める）。DB の revision は見ない | あり（collab の SSE も） | 確認 |
| 25 | Vault | `start_viewer.ts:2020–2046` → `vault_importer.ts:505` | viewer `viewer.ts:2243`（現在開いている map が対象）、`:2298`、`v4_service_slice_demo.mjs:187` | 既存 map は ID の再利用のためだけに読み、Vault から `{rootId, nodes, links:{}}` を作り直して全置換（`vault_importer.ts:473`） | 非同期の import をまたぐ transaction なし（IS122・IS123） | あり（savedAt が別、`vault_importer.ts:519`） | 確認 |
| 26 | Vault | `vault_watch.ts:124`（fs.watch）、`:266`、`:57` | Vault 側のファイル変更 | 層 A 25 と同じ再 import | debounce と、自分の書出し直後の抑止（`:130`）だけ | あり（`start_viewer.ts:2010`、savedAt が別） | 確認 |
| 27 | Vault | `vault_watch.ts:273–346` | Vault 側のファイル削除 | 該当 node の attributes に `vault:status=missing` 等を書き、details に追記。target の alias を broken にし、参照先を `missing:<id>` に書き換える（`:337`）。全置換 | 単文 | あり | 確認 |
| 28 | Vault | `vault_watch.ts:191`（予約）、`:101`、`:73` | 層 A 1・2・7〜14・21〜23 の確定後 | SQLite から Markdown 群を書き出す（live では Vault が canonical source） | なし | なし（Vault 側の書込み） | 確認 |
| 29 | Vault | `start_viewer.ts:2049–2071` → `vault_exporter.ts:210` | viewer の書出し（部分木を含む、`viewer.ts:2271`） | Markdown を順に書く。SQLite は変えない | 全ファイルをまとめる transaction なし | なし | 確認 |
| 30 | Blueprint | `start_viewer.ts:2145–2170` → `blueprint_importer.ts:1034`（map id の決め方 `:589`） | API の client | 生成した全状態で保存。map id が既存なら丸ごと置換 | 単文。競合確認なし | あり（savedAt が別、`:1044`） | 確認 |
| 31 | Home | `start_viewer.ts:1180–1205` → `rapid_mvp.ts:1009`（new） | `home.ts:146`、`render_runtime_map.mjs:72` | 新しい map の全状態を保存 | 存在確認だけ | なし | 確認 |
| 32 | Home | `start_viewer.ts:1207–1216` → `rapid_mvp.ts:1017`（duplicate） | `home.ts:185` | state_json を丸ごと複製して INSERT。node ID も GraphLink ID も同じまま | 存在確認と INSERT が別の文。transaction なし | なし | 確認 |
| 33 | Home | `start_viewer.ts:1218–1251` → `rapid_mvp.ts:1044`（rename） | `home.ts:178`、`render_runtime_map.mjs:78` | 全状態を読み、root の text を書き換えて全置換。saved_at を更新 | SELECT と UPDATE が別の文。transaction なし | なし | 確認 |
| 34 | Home | `start_viewer.ts:1253–1265` → `rapid_mvp.ts:1092`（archive・restore） | `home.ts:193, 197` | `archived` 列だけを UPDATE（restore は archive の解除） | 単文 | なし | 確認 |
| 35 | Home | `start_viewer.ts:1267–1300` → `rapid_mvp.ts:1074`（tags） | API だけ（Home に UI なし） | `tags` 列だけを UPDATE | 単文 | なし | 確認 |
| 36 | Home | `start_viewer.ts:1302–1330` → `rapid_mvp.ts:1106`（pin） | `home.ts:171` | `pinned` 列だけを UPDATE | 単文 | なし | 確認 |
| 37 | Home | `start_viewer.ts:1332–1377` → `rapid_mvp.ts:1120`（bind-vault・unbind-vault） | `home.ts:205, 212` | `source` 列（Obsidian の path）だけを UPDATE。watch は始めない | 単文 | なし | 確認 |
| 38 | Home | `start_viewer.ts:1379–1425`、`:1078–1111`（import-file） | `home.ts:154` | .md は 1 node の map、.json は state を validate せずそのまま新しい map に保存（AppState 型にない key も残る） | 単文 | なし | 確認 |
| 39 | Home | `start_viewer.ts:1427–1471`、`:1113–1164`（import-vault） | `home.ts:163` | Vault 直下の .md だけを 1 階層で読む別実装で新しい map を作り、`source` を設定。validate なし | 各単文 | なし | 確認 |
| 40 | Home | `start_viewer.ts:1473–1490` → `rapid_mvp.ts:1135`（delete） | `home.ts:201` | archived を確かめて map 行を DELETE | SELECT と DELETE が別の文 | あり | 確認 |
| 41 | backup | `start_viewer.ts:1539–1560`（conflict backup の restore） | API だけ（viewer から呼ばない） | backup の全状態を validate して全置換 | 単文。競合確認なし | **なし**（応答の savedAt も保存値と別、`:1557`） | 確認 |
| 42 | cloud | `start_viewer.ts:3599–3650`（pull） | viewer `viewer.ts:12985`（読込み時を含む） | SQLite は書かない。browser が送った localState を conflict backup の file に保存し（`:3632`）、cloud の全状態を返す | — | なし | 確認 |
| 43 | cloud | `start_viewer.ts:3652–3729`（push）→ `cloud_sync.ts:129`（file）、`:288`（Supabase）、`:634` | viewer `viewer.ts:12902`（保存成功のたびに自動 `:12857`、Panel から手動） | browser の現在の全状態（確定後に足された編集を含み得る）を cloud の全状態として保存。競合時は conflict backup | 時刻か mapVersion の事前比較。比較と書込みを一体にする lock なし | なし | 確認 |
| 44 | cloud | `start_viewer.ts:3932–3970` → `cloud_sync.ts:525`（auto-sync の定期 push） | 起動時に有効なら一定間隔（既定 30 秒） | 既定 map だけを DB から読み、savedAt を毎回現在時刻にして push。base は常に null | 基準なしは非競合として扱う（`cloud_sync.ts:25`、IS124） | なし | 確認 |
| 45 | 起動 | `start_viewer.ts:3898`、`:322–343` → `rapid_mvp.ts:1044` | 起動のたび | 既定 map（env 指定がなければ 開発）が既存なら、root の text を固定の label で上書きし saved_at を進めて全置換。なければ作成 | 各単文。transaction なし | なし | 確認（IS132、6 節） |
| 46 | 起動 | `start_viewer.ts:3899`（研究、id と label は `:133–134` の固定値） | 起動のたび（workspace を問わない） | 層 A 45 と同じ | 同上 | なし | 確認・実データ |
| 47 | 起動 | `start_viewer.ts:298–311, 313–320`（`ensureMap` 内の旧 id 移行） | 起動のたび | 旧 id の行を新 id へ UPDATE。新旧の行が両方あると、旧行を内容を確かめずに DELETE（`:325–330`） | 各単文 | なし | 確認 |
| 48 | 起動 | `rapid_mvp.ts:852–895`（DB を開くたびの schema 移行） | 全経路 | `documents→maps` の改名と列の追加 | 個別の DDL | なし | 確認 |
| 49 | 起動 | `start_viewer.ts:498–509, 4413–4416` → `rapid_mvp.ts:1602` | 起動のたび | `beta/data/` の sample JSON と sample 専用 SQLite を作る（workspace の外） | — | なし | 確認 |
| 50 | backup | `start_viewer.ts:3922–3930` → `backup.ts:44`（engine backup） | 起動時と定期 | DB file の物理複製 | — | なし | 確認 |
| 51 | CLI | `system_diagram_runner.ts:78–95, 258–310`（command の種類 `:215–219`） | CLI | 最初に取った全状態に command を適用し、command ごとに全体を POST（baseSavedAt なし）。node ID は呼出し元が指定。破壊的な command の前に JSON snapshot を書く（`:282`） | 層 A 1 の base なし | あり | 確認 |
| 52 | CLI | `projects/PJ02_MathOntoBridge/runtime/render_runtime_map.mjs:67–87, 640–651` | CLI | new と rename の後、生成した全状態を `force: true` で POST | なし（force） | あり | 確認 |
| 53 | CLI | `projects/PJ02_MathOntoBridge/runtime/sync_runtime_state.mjs:275–293` | CLI | 全状態を取って変更し、baseSavedAt 付きで POST | 層 A 1・2 | あり | 確認 |
| 54 | script | `scripts/ops/v4_service_slice_demo.mjs:129–131, 150–188, 250–266, 358–364` | 手動 | 全状態の POST（force を含む）、旧 Flash の approve、Vault の export と import | — | あり | 確認 |
| 55 | script | `scripts/ops/vm_swingby_conflict_lab.ps1:119, 143, 178–201` | 手動 | 全状態の POST（force を含む） | — | あり | 確認 |
| 56 | script | `scripts/beta/launch.sh:133–139`、`scripts/final/launch.sh:167–168` 以降 | 起動 script | workspace に DB がない時、seed DB を丸ごと複製 | — | なし | 確認 |
| 57 | script | `scripts/ops/m3e-data-snapshot.sh:116, 155–156` | 手動・nightly | backup と SQL dump を作る | — | なし | 確認 |
| 58 | Final | `final/src/node/start_viewer.ts:2348`（保存。マージ時 `:2488`、通常 `:2525`、部分木 `:2428`） | Final の viewer | Beta の層 A 1〜5 と同型だが、条件付き確定（IfUnchanged）がない | 無条件の単文 | あり | 確認 |
| 59 | Final | `final/src/node/start_viewer.ts`: Home `:1043–1360`、restore `:1432`、linear-text `:1550, 1577`、旧 Flash `:1822`、GraphLink `:2169, 2190`、agent の追加 `:3083, 3186, 3334`、sync `:3374`、auto-sync `:3760`。`final/src/node/collab.ts:465`、`vault_importer.ts:446`、`vault_watch.ts:345`、`blueprint_importer.ts:1041` | Final | Beta の対応経路と同型（MCP と Flash job はない） | 同上 | 経路ごと | 確認 |
| 60 | Final | `final/src/node/start_viewer.ts:206–228, 3726–3727` | 起動のたび | tutorial（env 指定）と 研究 に層 A 45〜47 と同じ処理 | — | なし | 確認・実データ |
| 61 | 休眠 | `scope_binding.ts:147–242`（同じ DB file に binding 用の表を作る）、`:661`（state へ patch を適用）、`:688`（記録） | test だけ（`beta/tests/unit/scope_binding.test.js`） | patch を state に適用（メモリ）／binding 用の表に transaction で記録。`idempotency_key` を持つ | transaction あり | なし | 確認（ライブ DB に表はない） |
| 62 | 休眠 | `beta/legacy/rapid_mvp.js:314–316` | 通常の起動対象外 | sample JSON | — | なし | 確認 |
| 63 | 未追跡 | `install/mac/payload/app/dist/node/start_viewer.js:91, 1918–1919` 他（git 未追跡のビルド済み旧実装） | 配布 app を起動した時 | 旧版の全経路（起動時の `ensureMap` を含む） | 旧版のまま | 旧版のまま | 確認（中身の網羅はしていない） |

**対象外と確認した入口**（永続する map data を変えない）: agent の active node（`start_viewer.ts:3145`、メモリ）、presence と collab の register・heartbeat・scope lock（メモリ）、MCP の `m3e_context`・`m3e_get`・`m3e_feedback`（feedback file だけ）、Vault watch の start・stop（session はメモリで、再起動で消える）、auto-sync の起動時 pull（`cloud_sync.ts:574`、log だけ）、ORRERY API（GET だけ、`orrery_api.ts:44`）、AI と linear-transform の route、layout-snapshot・edge-port-snapshot・resolve（GET）、conflict backup の削除（backup file）、system clipboard、open-local-path、local-fs（読取り）、viewer の local FS 表示（`viewer.ts:454–456` で読み取り専用）。

### 1.2 Command intent への対応付け

| # | 意図（定義語） | 提案 intent | 同時に変える記録 | base revision・競合条件 | 冪等キー | 移行の扱い |
|---|---|---|---|---|---|---|
| 1 | viewer の各操作（層 B）の確定 | なし（全状態を運ぶだけの経路） | — | 層 B の各 Command の対象 revision | なし | 削除（層 B の Command の送信に置き換える） |
| 2 | 同時編集の自動マージ | なし | — | 記録単位の base revision と Command の再検証に置き換える | なし | 削除 |
| 3 | 端末の状態で競合を解決する | 定義語なし（map 全体の置換） | map の全記録 | なし（強制） | なし | 削除（確定前の Command を再適用するか破棄するかの選択に置き換える） |
| 4 | 保存先の map がなければ作る | 定義語なし（map 行の作成） | map 行、root node | map id が未使用 | なし | 他経路へ統合（層 A 31） |
| 5 | 部分木の差し替え | 定義語なし（部分木の置換） | 部分木の node と edge、内部と境界をまたぐ GraphLink | 部分木の revision | なし | 削除（呼出し元なし。要るなら Command 列に分解） |
| 6 | canonical source が Vault の map の編集 | 層 B の各 Command（宛先が Vault） | Markdown と SQLite の両方 | Vault 側の revision | なし | owner adapter へ |
| 7 | 子 node の追加 | `assert`、`set-attribute` | 新しい node、edge（親と兄弟順）、attributes | 親の存在と兄弟順の revision | なし（要る） | Command へ変換 |
| 8 | 部分木の複製（新しい ID） | `clone` | 新しい node と edge、内部 GraphLink、alias の参照先の付替え、`scopes`・`surfaces`、注釈、linear-text | 複製元の部分木の revision（読取り）、複製先の親 | なし（要る） | Command へ変換 |
| 9 | Flash の構造を scope として一括追加 | `assert`、`scopen`、`set-attribute` | 全 node と edge、root の attributes | 追加先の親の存在 | import key（node の attributes に保存） | Command へ変換（キーを commandId へ移すかは未決） |
| 10 | MF-H を部分木として一括追加 | `assert` | 全 node と edge | 親の存在 | なし（要る） | Command へ変換 |
| 11 | text・alias の表示名・attributes の変更 | `rename`、`set-attribute`、`unset-attribute` | 対象 node（write alias なら target） | node か field の revision | なし（同じ値なら冪等） | Command へ変換 |
| 12 | 親の変更 | `reparent` | node の edge、旧親と新親の兄弟順 | node・旧親・新親の revision。循環は確定時に検査 | なし（要る） | Command へ変換（MCP には `reorder` がない） |
| 13 | scope 境界の付け外し | `scopen`、`unscopen` | nodeType、`scopes`・`surfaces`（派生の扱いは未決） | node の revision | 実質冪等 | Command へ変換 |
| 14 | 部分木の削除 | `delete` | 部分木の全 node と edge、接する GraphLink、target を失う alias（broken 化）、親の兄弟順。linear-text・注釈・位置の扱いは未決 | 部分木全体の revision（同時編集との規則は未決） | 実質冪等 | Command へ変換 |
| 15 | Flash の生成結果の取込み | 層 A 9 と同じ | 同左 | 同左 | request_id → job id → import key | 他経路へ統合（すでに層 A 9 を通る） |
| 16 | Flash draft の承認 | `assert` | 足す node と edge | 親の存在 | draft の状態（process 内だけ） | 他経路へ統合（層 A 15）か削除 |
| 17 | scope の linear-text の書換え | 定義語なし（linear-text の書換え） | linear-text 1 件 | その linear-text の revision | なし（同じ値なら冪等） | 他経路へ統合（層 B 42 と同じ Command） |
| 18 | scope の linear-text の削除 | 定義語なし（linear-text の削除） | 同上 | 同上 | 実質冪等 | 他経路へ統合（同上） |
| 19 | GraphLink の追加 | `assert` | GraphLink 1 件（生成時から安定した ID、RQ28） | 両端の存在と非 alias、重複の規則 | なし（再送で 2 本目ができる） | 他経路へ統合（層 B 24・25 と同じ Command） |
| 20 | GraphLink の削除 | `delete` | GraphLink 1 件 | GraphLink の revision | 実質冪等 | 他経路へ統合（層 B 30 と同じ Command） |
| 21 | MF-H を親の下へ追加 | `assert`、定義語なし（同名の既存の子への合流） | 足す node と edge | 親と既存の子の text | 同名への合流で実質冪等 | Command へ変換（層 A 22 と一本化） |
| 22 | 同上（教師データとの比較つき） | `assert`、定義語なし（同上） | 同上 | 同上 | opId（未使用） | 他経路へ統合（層 A 21） |
| 23 | 生成 AI による子の追加 | `assert`、`set-attribute` | 足す node と edge、provenance の属性 | 生成前に読んだ親の revision を確定時に再検査 | opId（重複の検査なし） | Command へ変換 |
| 24 | Team Collaboration の scope 単位の保存 | なし（全量の送信） | — | scope lock は write authority とは別に検討 | なし | 削除（Command の経路に統合） |
| 25 | Vault の Markdown から map を作り直す | 定義語なし（外部の canonical source による map 全体の置換） | map の全記録 | Vault 側の変更 | なし | owner adapter へ（source event を差分の Command にする） |
| 26 | Vault 側の変更の取込み | 定義語なし（同上） | 変わったファイルに対応する node | 同上 | なし | owner adapter へ |
| 27 | Vault 側のファイル削除の取込み | `set-attribute`、定義語なし（alias の参照先の書換え） | 該当 node の attributes と details、target の alias | 該当 node の revision | 実質冪等 | owner adapter へ |
| 28 | 確定した変更を Vault へ写す | `export` | Markdown | 確定した revision | なし | owner adapter へ |
| 29 | Vault への書出し | `export` | — | — | — | export のみ残す |
| 30 | Blueprint から map を生成 | 定義語なし（map の作成と一括追加。既存 map なら全体の置換） | map の全記録 | map id が未使用（既存なら未決） | なし | Command へ変換（新しい map の作成と `assert` の列） |
| 31 | 空の map を作る | 定義語なし（map 行の作成） | map 行、root node | map id が未使用 | なし（要る） | Command へ変換 |
| 32 | map の複製 | 定義語なし（map の複製） | 新しい map の全記録 | 複製元の revision | なし | Command へ変換（portable snapshot の取込みとして） |
| 33 | map の表示名（root の text）の変更 | `rename` | root node | root の revision | 同じ値なら冪等 | Command へ変換 |
| 34 | archive とその解除 | 定義語なし（map 行の属性の変更） | map 行の列 | なし | 冪等 | 未決（map 行の更新として残すか Command にするか） |
| 35 | tags | 定義語なし（同上） | 同上 | 同上 | 冪等 | 未決（同上） |
| 36 | pin | 定義語なし（同上） | 同上 | 同上 | 冪等 | 未決（同上） |
| 37 | Vault を canonical source として宣言・解除 | 定義語なし（canonical owner の設定） | map 行の `source`、Vault adapter の登録 | なし | 冪等 | owner adapter へ（owner routing の設定として） |
| 38 | file から新しい map を作る | 定義語なし（map の作成と取込み） | 新しい map の全記録 | map id が未使用 | なし | Command へ変換（portable snapshot の取込みとして） |
| 39 | Vault から新しい map を作る（別実装） | 定義語なし（同上） | 同上 | 同上 | なし | 他経路へ統合（層 A 25 の adapter） |
| 40 | map の削除 | 定義語なし（map の削除） | map 行（journal に削除を記録） | map の revision | 冪等 | Command へ変換 |
| 41 | backup の全状態に戻す | 定義語なし（map 全体の復元） | map の全記録 | なし | なし | 削除（portable snapshot と journal の replay による復旧へ、RQ26） |
| 42 | cloud の複製を取り込む | なし（取り込み） | — | cloud 側の revision | なし | owner adapter へ |
| 43 | cloud へ複製を送る | `export` | cloud 上の全状態 | cloud 側の revision | なし | owner adapter へ（確定済みの journal を送る） |
| 44 | 定期的に cloud へ送る | `export` | 同上 | なし（常に null） | なし | owner adapter へ（または削除） |
| 45 | 既定 map の存在保証と名前の固定 | なし | — | — | — | 削除（初回の作成だけ残す） |
| 46 | 研究 map の存在保証と名前の固定 | なし | — | — | — | 削除 |
| 47 | 旧 map id の移行 | なし | — | — | — | 削除（一度きりの data migration に吸収） |
| 48 | DB schema の移行 | なし | — | — | — | 削除（同上） |
| 49 | sample の生成 | なし（workspace の map data ではない） | — | — | — | 対象外（既定 map への誤読込み＝層 B 58 だけ止める） |
| 50 | engine backup | なし（backup） | — | — | — | export のみ残す（backup として。Recovery Gate の根拠にはしない） |
| 51 | System Diagram の command を map に反映 | `delete`、`assert`、`rename`、`set-attribute` | command ごとの記録 | なし（いまは base なし） | なし | Command へ変換（呼出し元が ID を決めてよいかは未決） |
| 52 | PJ02 の実行状態を map に描く | 定義語なし（map 全体の置換） | map の全記録 | なし（force） | なし | Command へ変換か削除 |
| 53 | PJ02 の実行状態の同期 | `assert`、`rename`、`set-attribute` | 変わる node | 全体の revision | なし | Command へ変換 |
| 54 | V4 の demo | 複数（層 A 1・3・16・25・29） | — | — | — | 削除か Command 前提で作り直す |
| 55 | VM での競合試験 | 定義語なし（map 全体の置換） | — | — | — | 削除か Command 前提で作り直す |
| 56 | workspace の初期化 | なし（seed の複製） | DB 全体 | DB がない | — | 他経路へ統合（seed を新しい形式で配る、IS128） |
| 57 | snapshot の取得 | `export` | — | — | — | export のみ残す（portable snapshot の生成に寄せる） |
| 58 | Final の保存 | 層 A 1〜5 と同じ | — | — | — | 他経路へ統合（Beta から再 promote。旧 Final に新形式の workspace を書かせない担保が要る） |
| 59 | Final の個別経路 | Beta の対応行と同じ | — | — | — | 他経路へ統合（同上） |
| 60 | Final の起動時の書換え | なし | — | — | — | 削除 |
| 61 | scope bind の patch 適用 | `bind` | binding の記録と足す node | binding の revision | `idempotency_key`（既存） | 未決（Command の設計に取り込むか廃止するか） |
| 62 | legacy の sample | なし | — | — | — | 削除 |
| 63 | 配布 payload の旧実装 | なし | — | — | — | 削除（配布物を新しい実装で作り直す） |

## 2. 層 B: 永続 data を変えるブラウザ操作

共通事項（確認）: 層 B の操作はすべて `map.state` をその場で書き換え、`touchDocument`（`viewer.ts:13425`）か `scheduleAutosave`（`:13099`）で 700 ms 後の全状態保存（層 B 50 → 層 A 1〜3）に乗る。`touchDocument` は毎回、層 B 40 の状態同期と、別 tab への全状態の送信（`:13165`）を行う。Undo 履歴は全状態の複製（`pushUndoSnapshot` `:4307`）。

### 2.1 現状

| # | 操作（Actions_Beta の名前など） | 関数（file:line） | 触る永続 field | Undo 履歴 | 根拠・備考 |
|---|---|---|---|---|---|
| 1 | addChild（Tab） | `viewer.ts:11706` | `nodes`（新しい node、親の children、親の collapsed=false） | 1 件 | 確認 |
| 2 | addSibling（Edit 中の Enter） | `viewer.ts:11727` | `nodes`（新しい node、親の children に挿入） | 1 件 | 確認。root では addChild |
| 3 | 方向を指定した作成（Lane を含む） | `viewer.ts:12408` | 1・2 と同じ（touch をまとめる） | 1 件 | 確認 |
| 4 | Disperse の背景クリックで node を置く | `viewer.ts:11912` | `nodes`、`surfaces`（位置）、親の collapsed | 1 件 | 確認 |
| 5 | V4 の議論 node（sticky / decision） | `viewer.ts:2094` | `nodes`（attributes `discussion:*`・`m3e:surface`）、親の collapsed | 1 件 | 確認 |
| 6 | AI の話題提案を子として追加 | `viewer.ts:6844`（event `:6937`） | `nodes`（同名の子は除く）、親の collapsed | 1 件 | 確認 |
| 7 | テンプレート node の子を複製 | `viewer.ts:11013`、`:10992` | `nodes`（同名の子は除く）、親の collapsed | 1 件 | 確認 |
| 8 | node の text の編集（startEdit 系 → 確定） | `viewer.ts:12101`（`stopInlineEdit` `:12263`） | `nodes`（text。Markdown link の形なら link と attributes も）、同じ target を持つ alias の text（`:4170`） | 1 件 | 確認 |
| 9 | alias の表示名の編集 | `viewer.ts:12101`（alias-label） | alias の aliasLabel と text | 1 件 | 確認 |
| 10 | write alias から target の text を編集 | `viewer.ts:12101`（target-text） | target の text、alias の text | 1 件 | 確認 |
| 11 | delete（部分木。複数選択可） | `viewer.ts:12596` | `nodes`（部分木と親の children）、`links`（接する GraphLink、`:12068`）、alias（broken 化と text の書換え、`:4185`）。linear-text・注釈・位置は残る | 1 件 | 確認。削除後すぐ保存 |
| 12 | broken alias の削除 | `viewer.ts:11194` | `nodes` | 1 件 | 確認。別 tab へ送らない |
| 13 | broken alias の修復（text node にする） | `viewer.ts:11221` | `nodes`（nodeType と alias の field） | 1 件 | 確認。別 tab へ送らない |
| 14 | node move の共通処理 | `viewer.ts:15001` | `nodes`（旧親と新親の children、parentId、新親の collapsed） | 呼出し元による | 確認 |
| 15 | Grab（M を押したまま方向キー） | `viewer.ts:12197`（開始）、`:12221`（移動）、`:12237`（確定） | 14 と同じ（reparent / reorder） | 保持中の連続移動で 1 件 | 確認。保持中は自動保存と別 tab への送信を止め、開始時に全状態を複製 |
| 16 | ポインターの drag & drop | `viewer.ts:16006` | 14 と同じ | 1 件 | 確認 |
| 17 | markReparent → applyReparent（Mod+M → P、Alt+M） | `viewer.ts:13990`、`:14017`、`:14025` | 14 と同じ（複数） | 1 件 | 確認 |
| 18 | cut → paste | `viewer.ts:14923`（cut の分岐） | 14 と同じ（複数） | 1 件 | 確認 |
| 19 | groupSelected | `viewer.ts:14426` | `nodes`（新しい親を挿入し、選択 node を移す） | **移動ごとに 1 件** | 確認。途中の状態も Undo で現れ、自動保存され得る |
| 20 | copy → paste（新しい ID） | `viewer.ts:14566`、`:14521`、`:14545`、structured clipboard `:14923` | `nodes`、`links`（部分木内の GraphLink）、alias の参照先の付替え、Concreteness Axis の付随属性。linear-text・位置・注釈は複製しない | 1 件 | 確認。MCP の copy（層 A 8）と範囲が違う |
| 21 | toggleFolder（scopen / unscopen） | `viewer.ts:3992` | `nodes`（nodeType）、`scopes`・`surfaces`（次の同期で再計算。unscopen した scope の `surfaces` は消える、`:2578`） | 1 件 | 確認 |
| 22 | alias を現在の scope root の子に作る | `viewer.ts:4015` | `nodes`（alias node、scope root の children） | 1 件 | 確認 |
| 23 | addAliasAsChild | `viewer.ts:4056` | `nodes` | 1 件 | 確認 |
| 24 | GraphLink の元を mark して張る | `viewer.ts:11833` | `links` | 1 件 | 確認 |
| 25 | Disperse で GraphLink を張る | `viewer.ts:11879` | `links` | 1 件 | 確認 |
| 26 | GraphLink の port 変更と端点の付替え | `viewer.ts:11964`（呼出し: SVG `:15805`・`:16006`・`:12013`、WebGL `:4752`・`:4889`） | `links`（sourcePort・targetPort。付替えでは同じ ID のまま sourceNodeId・targetNodeId を変える） | 1 件 | 確認 |
| 27 | GraphLink の port の巡回（[ / ]） | `viewer.ts:12079` | `links` | 1 件 | 確認 |
| 28 | 線の選択からの label・style・矢印の向きの変更 | `edge_graphlink_selection_adapter.ts:160–191` | `links`（label・style・矢印の向き）。親子 edge の label は 34 へ | 1 件 | 確認 |
| 29 | Disperse の GraphLink の色 | `viewer.ts:11951` | `links`（color） | 1 件 | 確認 |
| 30 | GraphLink の削除 | `viewer.ts:12047`、`:11941` | `links` | 1 件 | 確認。前者は直後に保存 |
| 31 | 塗り・装飾の変更と解除 | `viewer.ts:11361`、`:11384`、`:11332` | `nodes`（attributes `m3e:style`、複数 node） | **なし** | 確認 |
| 32 | tabular component の切替 | `viewer.ts:11248` | `nodes`（attributes `m3e:component`） | 1 件 | 確認 |
| 33 | node 幅の変更 | `viewer.ts:5471`（resize handle） | `nodes`（attributes `m3e:label-width`） | 1 件 | 確認 |
| 34 | 親子 edge の label | `viewer.ts:11405`、`:12295` | 子 node の attributes `m3e:edge-label` | 1 件 | 確認 |
| 35 | reviews/Qn の採択と却下 | `viewer.ts:13325`、`:13358` | `nodes`（選択肢・兄弟・質問 node の attributes と `m3e:style`） | **なし** | 確認 |
| 36 | toggleCollapse | `viewer.ts:12655` | `nodes`（collapsed） | **なし** | 確認 |
| 37 | 他の操作に付随する collapse | 1・4〜7・14 の親の展開、`viewer.ts:15576`（Disperse の展開）、`:13385`（説明表示。保存を予約せず次の保存に乗る） | `nodes`（collapsed） | 呼出し元による | 確認 |
| 38 | Surface View の切替・間隔・方向・Lane の線の設定 | `viewer.ts:1111`、`:1138`、`:1149`、`:1160`（event `:15107`） | `surfaces`、`scopes`（primarySurfaceId） | **なし** | 確認 |
| 39 | Lane root の指定 | `lane_view_controller.ts:25–35` | `surfaces`（表示 root）、`scopes` | 1 件 | 確認 |
| 40 | 状態の同期（全編集と全保存で暗黙に実行） | `viewer.ts:2670`（`touchDocument` と `currentDocSnapshot` `:12742` から） | `scopes`（全 folder から再計算。relationIds は全 GraphLink を走査）、`surfaces`（現在の scope の surface に map の全 node 分の位置記録を作り、attributes の flow 位置・形を写し、方向と間隔を書く） | — | 確認・実データ（一つの surface に 14,437 件） |
| 41 | Disperse の配置（自動配置の収束、drag、pagehide、scope の切替） | `viewer.ts:7385`、`:7449`、`:7588`（描画時）、`:15725`、`:16175` | `surfaces`（位置 x, y） | drag は 1 件、自動配置は reflow の時だけ | 確認 |
| 42 | linear-text の入力 | `viewer.ts:15296` | `linearNotesByScope`（入力のたびに自動保存を予約） | **なし** | 確認 |
| 43 | linear-text の Mod+Enter・Reset・Panel 表示時の初期化 | `viewer.ts:15315`、`:15402`、`:7039` | `linearNotesByScope`（Panel を開いただけで、tree から作った text を保存対象にする） | **なし** | 確認 |
| 44 | linear-text の Apply（tree へ反映） | `viewer.ts:7167`、`:7136`、`:7120` | `nodes`（scope の部分木の text と children を位置で対応させて置き換え、余りを削除。削除時に GraphLink と alias を処理しない） | 1 件 | 確認 |
| 45 | .md の取込み（linear-text へ） | `viewer.ts:15225`（.md の分岐 `:15246`） | `linearNotesByScope` | **なし** | 確認 |
| 46 | linear-text の書体倍率と Panel 幅 | `viewer.ts:2501`、`:5310`、`:15343`、`:15375` | `linearTextFontScale`、`linearPanelWidth` | **なし** | 確認 |
| 47 | 注釈（Pen・Date label・Eraser） | `viewer.ts:3043`、`:3186`、`:3123` | `annotations` | 1 件 | 確認 |
| 48 | Concreteness Axis の level ≠ 0 での編集 | `concreteness_axis.ts:119–197`（`viewer.ts:4246` から） | `nodes`（attributes `m3e:concreteness:*` に level ごとの親・順・境界・collapse を書く。level < 0 で作った node は root の直下に置く）、`links`・`annotations`・`linearNotesByScope` | 呼出し元による | 確認 |
| 49 | undo / redo | `viewer.ts:4325`、`:4362` | 全 field（全状態の複製を戻す） | — | 確認。外部の変更を取り込んだ後も履歴を消さない |
| 50 | 自動保存・明示保存・削除後の即時保存 | `viewer.ts:12761`、`:13099`、`:13118` | 全 field（層 A 1〜3） | — | 確認 |
| 51 | 競合 Panel（Use Local / Use Remote） | `viewer.ts:12810`、`:12813` | Use Local は force で全置換、Use Remote は remote の全状態で置き換え Undo 履歴を消す | — | 確認 |
| 52 | 別 tab への送信と受信 | `viewer.ts:13165`、`:13139`（受信 `:13146`） | 受信側は全状態を置き換える（未保存の確認なし。linear-text の別保持値を戻さない） | 受信で消さない | 確認（IS120） |
| 53 | 外部更新の取込み | `viewer.ts:13185`（`map_updated` `:13191`）、`:13249` | 全状態を取り直して置き換える | 消さない | 確認（IS118） |
| 54 | collab push と競合 Panel | `viewer.ts:10405`、`:10377`、`:10457` | 現在の scope の全子孫の node（層 A 24） | — | 確認（IS121） |
| 55 | cloud push と競合 Panel | `viewer.ts:12902`、`:11679` | cloud の全状態（層 A 43） | — | 確認 |
| 56 | cloud pull の採用（読込み時と手動） | `viewer.ts:12985`、`:13462`・`:13476`（読込み時）、`:13073` | 画面の全状態を cloud の状態で置き換える（SQLite へは書かず、次の保存で反映） | 消す | 確認 |
| 57 | サーバーが書いた後の再読込みと直接の取込み | `viewer.ts:2243`（Vault import）、`:2298`（live 開始）、`:1963`（V4 draft の適用）、`:6906`（Rapid 生成 → `applyExternalUpdate`） | 全状態を置き換える（自動保存待ちの編集を確かめない） | 再読込みでは消す | 確認 |
| 58 | UI からの file の取込み・sample の読込み・読込み失敗時の代替 | `viewer.ts:15225`（.json・.mm）、`:13440`、`:15054`、`:13488–13490` | 画面の全状態を置き換えるが確定しない。map id は現在のまま | 消す | 確認 |
| 59 | 読込み時の正規化 | `viewer.ts:2720`、`:2578` | `nodes` の既定値、`links` の作り直し、`annotations`、`scopes`・`surfaces` の再計算（最初の保存で確定する） | — | 確認 |
| 60 | Home の map 操作 | `home.ts:146–215` | 層 A 31〜40 | — | 確認 |
| 61 | export（JSON・.mm・Vault の部分木・structured clipboard への copy） | `viewer.ts:12679`、`:9530`、`:12722` | なし（書出しだけ） | — | 確認 |

### 2.2 Command intent への対応付け

| # | 意図（定義語） | 提案 intent | 同時に変える記録 | base revision・競合条件 | 冪等キー | 移行の扱い |
|---|---|---|---|---|---|---|
| 1 | 子 node の追加 | `assert`、`collapse` | 新しい node、edge（親と兄弟順）、親の collapse 状態（永続にするなら） | 親の存在。末尾への追加は衝突しにくい | 要る（commandId） | Command へ変換 |
| 2 | 兄弟の追加 | `assert` | 新しい node、edge（挿入位置の兄弟順） | 親と隣の兄弟の順（IS126） | 要る | Command へ変換 |
| 3 | 1・2 と同じ | `assert` | 同上 | 同上 | 要る | 他経路へ統合（1・2） |
| 4 | Disperse 上に node を置く | `assert`、定義語なし（Layout の記録の書込み） | 新しい node、edge、位置 | 親の存在 | 要る | Command へ変換 |
| 5 | 議論 node の追加 | `assert`、`set-attribute` | 新しい node、edge、attributes | 親の存在 | 要る | Command へ変換 |
| 6 | 複数の子の追加（同名を除く） | `assert`、定義語なし（同名の既存の子を除く追加） | 足す node と edge | 親と既存の子の text | 要る | Command へ変換（層 A 21 と同じ形） |
| 7 | テンプレートの子の複製 | `clone`、定義語なし（同名を除く） | 複製する node と edge | テンプレート部分木の revision、追加先の親 | 要る | Command へ変換 |
| 8 | node の text の変更 | `rename`、`set-attribute` | 対象 node の text・link・attributes。alias の表示 text は target から導ける派生値（保存するなら同時に） | node（text）の revision | 同じ値なら冪等 | Command へ変換 |
| 9 | alias の表示名の変更 | `rename` | alias node の aliasLabel | alias の revision | 冪等 | Command へ変換 |
| 10 | write alias を通した target の編集 | `rename` | target node（alias の access を検証） | target の revision | 冪等 | Command へ変換 |
| 11 | 部分木の削除 | `delete` | 層 A 14 と同じ | 層 A 14 と同じ | 実質冪等 | 他経路へ統合（層 A 14 と同じ Command） |
| 12 | broken alias の削除 | `delete` | alias node、親の兄弟順 | alias の revision | 冪等 | Command へ変換 |
| 13 | broken alias を text node にする | `set-type` | 対象 node（alias の field を消す） | node の revision | 冪等 | Command へ変換 |
| 14 | node move | `reparent`、`reorder` | node の edge、旧親と新親の兄弟順、展開の状態 | node と両方の親の revision、循環の検査 | 要る | Command へ変換（検証を一つにする） |
| 15 | Grab による node move | `reparent`、`reorder` | 同上（保持中の連続移動を一つの Command にまとめる） | 開始時の revision | 要る | Command へ変換 |
| 16 | drag & drop | `reparent`、`reorder` | 同上 | 同上 | 要る | Command へ変換 |
| 17 | 移動元を指定して親を選ぶ | `reparent` | 複数の部分木の edge と兄弟順 | 各 node と新しい親の revision | 要る | Command へ変換 |
| 18 | cut → paste | `reparent` | 同上 | 同上 | 要る | Command へ変換 |
| 19 | 選択 node 群の上に新しい親を挿入 | 定義語なし（新しい親の挿入） | 新しい node、移す全 node の edge、元の親の兄弟順 | 共通の親と移す node の revision | 要る | Command へ変換（一つの Command・一つの Undo にする） |
| 20 | 部分木の複製（新しい ID） | `clone` | 層 A 8 と同じ範囲にそろえる（いまは linear-text・位置・注釈が漏れる） | 複製元と複製先 | 要る | 他経路へ統合（層 A 8 と同じ Command） |
| 21 | scope 境界の付け外し | `scopen`、`unscopen` | nodeType、`scopes`・`surfaces`（派生の扱いは未決） | node の revision | 冪等 | 他経路へ統合（層 A 13 と同じ Command） |
| 22 | alias の作成（scope root の下） | `bind` | alias node、edge | target の存在と非 alias、scope root の存在 | 要る | Command へ変換 |
| 23 | alias の作成（target の子） | `bind` | 同上 | 同上 | 要る | Command へ変換 |
| 24 | GraphLink の追加 | `assert` | GraphLink 1 件 | 両端の存在と非 alias、重複の規則 | 要る | Command へ変換（層 A 19 と同じ Command） |
| 25 | GraphLink の追加（Disperse） | `assert` | 同上 | 同上 | 要る | 他経路へ統合（24） |
| 26 | port の変更と端点の付替え | `set-attribute`、定義語なし（同じ ID のまま端点を付け替える） | GraphLink 1 件 | GraphLink と新しい端点の revision | 冪等 | Command へ変換 |
| 27 | port の巡回 | `set-attribute` | GraphLink 1 件 | GraphLink の revision | 巡回は非冪等（値を指定する Command にする） | Command へ変換 |
| 28 | label・style・矢印の向き | `set-attribute`、`unset-attribute` | GraphLink 1 件 | 同上 | 巡回は値の指定に | Command へ変換 |
| 29 | 色 | `set-attribute` | GraphLink 1 件 | 同上 | 冪等 | Command へ変換 |
| 30 | GraphLink の削除 | `delete` | GraphLink 1 件 | 同上 | 冪等 | Command へ変換（層 A 20 と同じ Command） |
| 31 | Style の変更 | `set-attribute`、`unset-attribute` | 対象 node 群の `m3e:style` | 各 node の revision（属性単位） | 冪等 | Command へ変換（Undo も付ける） |
| 32 | registered component の付け外し | `set-attribute`、`unset-attribute` | 1 node | 同上 | 冪等 | Command へ変換 |
| 33 | node 幅 | `set-attribute` | 1 node | 同上 | 冪等 | Command へ変換 |
| 34 | 親子 edge の label | `set-attribute`、`unset-attribute` | 子 node | 子 node の revision | 冪等 | Command へ変換（置き場は未決） |
| 35 | 判断待ちの採択と却下 | `set-attribute`、`unset-attribute` | 選択肢・兄弟・質問 node の attributes と Style | 質問 node 配下の revision | 冪等 | Command へ変換（一つの Command にする） |
| 36 | collapse | `collapse` | node の collapse 状態 | node の revision（後勝ちでよいかは未決） | 冪等 | 未決（Command で確定する正本 data か、viewer の表示状態か） |
| 37 | 付随する collapse | `collapse` | 同上 | 同上 | 冪等 | 未決（主な操作の Command に含めるか分けるか） |
| 38 | Surface View の設定 | 定義語なし（Surface View の設定の保存。Command_Language の view に当たり、semantic write と区別される） | `surfaces`、`scopes` の primarySurfaceId | surface の revision | 冪等 | 未決 |
| 39 | Lane root の指定 | 定義語なし（同上） | 同上 | 同上 | 冪等 | 未決 |
| 40 | 派生記録の再計算 | なし（利用者の意図なし） | — | — | — | 削除（materialization にするか、明示の Command に分ける） |
| 41 | Disperse の位置 | 定義語なし（Layout の記録の書込み） | 複数 node の位置 | surface の revision | 冪等 | 未決（自動配置の収束で書くかを含む） |
| 42 | linear-text の編集 | 定義語なし（linear-text の書換え） | linear-text 1 件 | その linear-text の revision（同時編集は後勝ちか未決） | 同じ値なら冪等 | Command へ変換（入力ごとではなく確定の単位で） |
| 43 | linear-text の初期化と Reset | 定義語なし（同上） | 同上 | 同上 | 冪等 | Command へ変換（Panel を開いただけでは書かない） |
| 44 | linear-text から scope の部分木を作り直す | 定義語なし（text による部分木の置換） | scope の部分木の node と edge、削除に伴う GraphLink と alias | 部分木の revision | 要る | Command へ変換（`rename`・`assert`・`delete`・`reorder` の列に分ける。位置での対応付けの是非は未決） |
| 45 | .md を linear-text へ | 定義語なし（linear-text の書換え） | linear-text 1 件 | 同上 | 冪等 | 他経路へ統合（42） |
| 46 | 書体倍率と Panel 幅 | 定義語なし（viewer の表示設定） | map の二つの field | なし | 冪等 | 未決（viewport と同じく map の外へ移すか） |
| 47 | 注釈の追加と削除 | 定義語なし（注釈の追加・削除） | 注釈 1 件 | 注釈の revision | 要る（追加） | Command へ変換 |
| 48 | Concreteness Axis での構造の編集 | `set-attribute`（意味は level つきの node move・境界・collapse） | 対象 node と子の level ごとの属性、level < 0 の新しい node と root の children | 対象 node の revision | 要る | 未決 |
| 49 | undo / redo | `history` | 戻す Command の記録 | 戻す対象の revision | 要る | Command へ変換（逆向きの Command か変更前の値か、IS127） |
| 50 | 保存 | なし（全状態を運ぶだけ） | — | — | — | 削除（確定前の Command の送信と保持に置き換える、RQ22） |
| 51 | 競合の解決 | 定義語なし（Use Local は map 全体の置換。Use Remote は確定前の編集の破棄） | — | — | — | 削除（Command 単位の再適用か破棄に置き換える） |
| 52 | 別 tab への送信と受信 | なし（取り込み） | — | — | — | 他経路へ統合（共通の取り込み処理。確定した変更だけを配る） |
| 53 | 外部更新の取込み | なし（取り込み） | — | — | — | 他経路へ統合（同上。差分で適用） |
| 54 | collab | なし（全量の送信） | — | — | — | 削除（Command の経路に統合） |
| 55 | cloud push | `export` | — | — | — | owner adapter へ |
| 56 | cloud pull の採用 | なし（取り込み） | — | — | — | owner adapter へ |
| 57 | サーバーが書いた後の再読込み | なし（取り込み） | — | — | — | 他経路へ統合（共通の取り込み処理） |
| 58 | UI からの取込みと sample | `load`（画面に開くだけ）。永続にするなら定義語なし（map の作成と取込み） | — | — | — | 他経路へ統合（新しい map として取り込む Command。既定 map の代わりに sample を出す処理は削除） |
| 59 | 読込み時の正規化 | なし | — | — | — | 削除（一度きりの data migration に吸収） |
| 60 | Home の map 操作 | 層 A 31〜40 と同じ | — | — | — | 層 A と同じ |
| 61 | export | `export` | — | — | — | export のみ残す |

## 3. 同じ意図を別の実装が別の範囲で扱う箇所（確認）

Command の検証を一つにすると、次の差がそのまま仕様の判断になる。

| 意図 | 実装 A | 実装 B | 差 |
|---|---|---|---|
| 部分木の複製 | MCP の copy（`rapid_mvp.ts:412`） | viewer の paste（`viewer.ts:14566`） | MCP は `scopes`・`surfaces`・注釈・linear-text も複製する。viewer は node と内部 GraphLink だけ |
| GraphLink の追加 | viewer（`viewer.ts:11833`、`:11879`） | REST（`rapid_mvp.ts:336`） | viewer は同じ端点の重複を拒否し、サーバーは拒否しない |
| 部分木の削除 | Core（`rapid_mvp.ts:575`） | viewer（`viewer.ts:12596`）／linear-text の Apply（`viewer.ts:7120`） | broken alias の text の書式が違う。linear-text の Apply は GraphLink も alias も処理しない |
| Vault からの取込み | `/api/vault/import`（`vault_importer.ts`） | Home の import-vault（`start_viewer.ts:1113`） | 後者は直下の .md だけを 1 階層で読み、GraphLink も wikilink も扱わない |
| scopen | viewer（`viewer.ts:3992`） | MCP（`rapid_mvp.ts:403`） | viewer は次の同期で `scopes`・`surfaces` を作り直す。MCP は nodeType だけで、派生記録は次に viewer が保存するまで古いまま |
| 保存の競合確認 | Beta（条件付き確定） | Final（無条件の UPSERT） | 同じ DB を開くと、Final の書込みは Beta の確定を検出せずに上書きする |

## 4. research の 7 節からの訂正と追加

- 行番号は 1 節の表に置き換える（research は `d67b834` 基準）。
- 7 節にあって、内容を確認したもの: ブラウザ保存とマージ、`?scope=`、MCP、Flash、旧 Flash、linear-text、GraphLink、append-mf-h、mapify-oracle、cas/pn-generate、collab、Vault の import・watch・live 保存・export、Blueprint、Home の各操作、backup の restore、cloud の push・pull、起動時の `ensureMap`、schema の移行、CLI と script の一部、Final。
- 追加したもの: `force` による全置換（層 A 3）、存在しない map id への保存による作成（4）、`?scope=` が境界をまたぐ GraphLink を消すこと（5）、MCP の種類ごとの内訳（7〜14）、Vault のファイル削除による参照先の書換え（27）、確定後の Vault 書出し（28）、PJ02 の script 2 本（52・53）、起動時の sample 生成（49）、engine backup（50）、Final に条件付き確定がないこと（58）、Final も 研究 map を作ること（60）、未追跡の配布 payload（63）、collab の `mapVersion` が全 map 共通であること（24）、ブラウザ側の操作の全体（層 B）、特に利用者の操作なしの書込み（層 B 37・40・41・43・56・58・59）。
- 7 節の「cloud pull は SQLite へ保存しない」は正しい。加えて、browser が送った状態を conflict backup の file に保存する（層 A 42）。

## 5. まとめ

### 5.1 必要な Command intent と行数

1 節の対応表（層 A）と 2 節の対応表（層 B）の「提案 intent」に現れた行の数。1 行に複数の intent がある場合はそれぞれに数える。

| intent | 出典 | 層 A の行 | 層 B の行 | 計 |
|---|---|---|---|---:|
| `set-attribute` | Command_Language | 7・9・11・23・27・51・53 | 5・8・26・27・28・29・31・32・33・34・35・48 | 19 |
| `assert` | Glossary・Command_Language | 7・9・10・16・19・21・22・23・51・53 | 1・2・3・4・5・6・24・25 | 18 |
| `rename` | Glossary・Command_Language | 11・33・51・53 | 8・9・10 | 7 |
| `export` | Command_Language | 28・29・43・44・57 | 55・61 | 7 |
| `delete` | Glossary・Command_Language | 14・20・51 | 11・12・30 | 6 |
| `reparent` | Glossary・Command_Language | 12 | 14・15・16・17・18 | 6 |
| `unset-attribute` | Command_Language | 11 | 28・31・32・34・35 | 6 |
| `reorder` | Glossary（node move） | — | 14・15・16 | 3 |
| `clone` | Command_Language | 8 | 7・20 | 3 |
| `bind` | Glossary・Command_Language | 61 | 22・23 | 3 |
| `scopen` | Glossary | 9・13 | 21 | 3 |
| `collapse` | Glossary（Command_Language の view） | — | 1・36・37 | 3 |
| `unscopen` | Glossary | 13 | 21 | 2 |
| `set-type` | Command_Language | — | 13 | 1 |
| `history` | Command_Language | — | 49 | 1 |
| `load` | Command_Language | — | 58 | 1 |
| 定義語なし（5.2 節） | — | 23 行 | 16 行 | 39 |
| なし（全状態を運ぶだけ・取り込み・起動時の処理・backup など） | — | 1・2・24・42・45〜50・56・60・62・63 | 40・50・52・53・54・56・57・59 | 22 |

このほか層 A 6・15・54・58・59 は、他の行と同じ Command を使う（表の「層 A 9 と同じ」など）ので数に入れていない。

- `transfer`（canonical owner をまたぐ移動）と `replace`（text が一致する node 群への一括 rename）を必要とする現行の経路はない。MCP は map をまたぐ移動を拒否する（`mcp_service.ts:467`）。ただし Vault を canonical source として宣言・解除する操作（層 A 37）は owner の切替なので、`transfer` の対象になり得る（推論）。
- `scopen`・`unscopen` は Glossary の操作語で、Command_Language の表では nodeType の変更として `set-type` に当たる。どちらを intent 名にするかは未決。
- `collapse` は Glossary で表示の操作と定義され、Command_Language では `view`（semantic write と区別する）に入る。現状は node の field として保存されている。

### 5.2 定義語のない意図

いずれも名前を付けず、内容だけを書く。IS130 の「親の挿入、親の除去、分割、統合」との対応も示す。

| 意図の内容 | 行 | 今の振る舞い（確認） | IS130 との対応 |
|---|---|---|---|
| 選択した node 群の共通の親の下に新しい node を挿入し、選択 node をその子へ移す | 層 B 19 | 新しい node を最初の選択 node の位置に入れ、選択 node を順に移す。移動ごとに Undo 履歴を積む | 親の挿入 |
| 親を外して子を残す／node を分ける／node をまとめる | なし | viewer・Core・MCP のどこにも該当する処理がない | 親の除去・分割・統合（現行の経路はない） |
| 同名の既存の子に合流させながら子を足す（または同名の子を除いて足す） | 層 A 21・22、層 B 6・7 | 大文字小文字を無視した text の一致で既存の子を再利用する | なし |
| 部分木を丸ごと差し替える | 層 A 5、層 B 44 | `?scope=` は受信した部分木に置き換える。linear-text の Apply は children を位置で対応させて text を上書きし、余りを削除する | なし |
| map 全体を別の状態で置き換える・戻す | 層 A 3・30（既存 map への再 import）・41・52・55、層 B 51（Use Local） | 受信した全状態か backup の全状態で全置換 | なし |
| 外部の canonical source の内容で map を作り直す・ファイル削除に合わせて node と alias を変える | 層 A 25・26・27 | Vault から全状態を作り直す。削除では missing の属性を書き、alias の参照先を書き換える | なし |
| map 行そのものの作成・複製・削除・属性（archive・tags・pin）の変更と、file からの新しい map の作成 | 層 A 4・30・31・32・34・35・36・38・39・40 | 行単位の INSERT・UPDATE・DELETE か、全状態の保存 | なし |
| canonical owner（Vault）の宣言と解除 | 層 A 37 | `source` 列だけを変える | なし（`transfer` に近い。推論） |
| GraphLink の端点を同じ ID のまま別の node へ付け替える | 層 B 26 | sourceNodeId か targetNodeId を書き換える | なし |
| scope の linear-text の書換えと削除 | 層 A 17・18、層 B 42・43・45 | `linearNotesByScope` の 1 件を置き換える | なし |
| Layout と Surface View の設定の保存（位置、表示方式、方向、間隔、Lane root） | 層 B 4・38・39・41 | `surfaces` と `scopes` の primarySurfaceId を書く | なし（Command_Language の view は semantic write でないとする） |
| viewer の表示設定の map への保存（linear-text の書体倍率と幅） | 層 B 46 | map の二つの field を書く | なし |
| 注釈の追加と削除 | 層 B 47 | `annotations` の 1 件を足すか消す | なし |
| 競合時に確定前の編集を捨てて相手の状態を採る | 層 B 51（Use Remote） | remote の全状態を画面に読み込み、Undo 履歴を消す | なし |
| UI から取り込んだ内容を新しい map として永続にする | 層 B 58 | いまは画面に載せるだけで確定しない | なし |

`collapse` 状態の保存（層 B 1・36・37）、Concreteness Axis の level ごとの構造（層 B 48）は、定義語（`collapse`・`set-attribute`）を当てたが、Command で確定する正本 data にするかどうかが未決（8 節）。

### 5.3 消すか統合する経路

- 全状態を運ぶだけの経路: 層 A 1〜3、層 B 50。層 B の各操作を Command として送る形に置き換える。
- 使われていない部分経路: 層 A 5（`?scope=`）、17・18（linear-text の REST）、19・20（GraphLink の REST）は repo 内に test 以外の呼出し元がない。外部の agent や skill が使っていないかを確かめてから、層 B の同じ Command に統合するか削除する。
- 同じ意図の重複: 層 A 15・16（Flash の 2 経路）、21・22（MF-H の 2 経路）、25・39（Vault からの取込みの 2 実装）、層 B 20 と層 A 8（複製）、層 B 11 と層 A 14（削除）、層 B 21 と層 A 13（scopen）。3 節の差を判断してから一つにする。
- 起動時の書込み: 層 A 45〜48、60。初回の作成以外は削除する（6 節）。
- 利用者の操作なしの書込み: 層 B 40（派生記録の再計算）、59（読込み時の正規化）、43 のうち Panel を開いた時の初期化、41 のうち自動配置の収束時の書込み。materialization にするか、一度きりの data migration に吸収する。
- 取り込みの経路: 層 B 52・53・57（と 56 の取り込み部分）。共通の取り込み処理に統合する（brief の Boundary Candidates）。
- collab: 層 A 24、層 B 54。Team Collaboration は brief の Out だが、経路が残っている限り全量送信の消失（5.5 の 10）が起き得る。
- script・旧実装: 層 A 51〜55 は Command の送信に変えるか削除する。58・59 の Final は Beta からの再 promote で置き換える。61〜63 は廃止の判断をする。

### 5.4 外部の canonical source が持つ経路（owner adapter が要るもの）

- Vault（Obsidian）: 層 A 6・25〜28・37・39、層 B 57 の Vault 部分。live では Markdown が canonical source で、SQLite は後から全置換される。owner adapter が Vault の変更を source event として受け、差分の Command に変える必要がある。逆向きは、確定した Command を Markdown へ写す。いまの MCP は live Vault の map への書込みを拒否している（`start_viewer.ts:183–187`）ので、adapter ができるまで agent はその map を編集できない。
- cloud sync: 層 A 42〜44、層 B 55・56。cloud 上には map 全体の複製があり、比較の基準は時刻か mapVersion だけ。確定済みの journal を送る adapter にするか、移行の範囲から外すかを決める（IS128）。
- 次は外部の owner ではない（推論）: Flash の生成サービス、Codex App Server、Mapify は結果を M3E に足すだけで、結果の canonical owner は M3E。provenance を持つ Command（層 A 9・23）でよい。Final は channel であり owner ではないが、別実装の書き手なので IS129 の対象になる。

### 5.5 IS116〜IS132 にない、成功扱いで編集が消える危険

番号は本節の中だけの通し番号。

1. **通知と応答の savedAt が、DB に保存した saved_at と違う経路が 8 本ある**（層 A 5・17・18・19・20・25・26・30。層 A 41 は応答だけ）。保存の後に別に `new Date()` を取って返す・通知するため。受信側（`viewer.ts:13199`）は通知の savedAt をそのまま基準時刻にするので、自動保存を待っている tab では、基準が DB のどの revision とも対応しなくなる。次の保存は必ずマージ経路に入り、nodes 以外の端末の変更が落ちる（IS117）か 409 になる。IS118 は正しい時刻だけが先に進む場合で、これは時刻そのものが DB にない。確認（時刻の計算）・推論（消失）。
2. **Undo・Redo が、外部の変更を取り込む前の全状態に戻す**。外部更新の取込み（`viewer.ts:13249`）と別 tab からの受信（`:13146`）は Undo 履歴を消さない。取り込んだ後に Undo すると、agent や別 tab の確定済みの編集ごと戻る。基準時刻は取り込んだ後の値なので、次の保存は競合検査を通って全置換になる。確認（履歴を消さない）・推論（上書き）。
3. **サーバーが書いた後に画面の全状態を置き換える経路が、自動保存待ちの編集を捨てる**（層 B 57）。Vault import（`viewer.ts:2243`）と V4 draft の適用（`:1963`）は全状態と Undo 履歴を置き換える。Rapid 生成（`:6906`）は外部更新の取込みを直接呼ぶので、`map_updated` の受信と違って自動保存待ちを確かめない。生成を待つ間に打った編集は、予約された自動保存ごと失われる。確認・推論。
4. **linear-text の Apply が node の同一性をずらし、保存を止める**（層 B 44）。children を位置で対応させて text を上書きするので、途中に 1 行足すと、後ろの兄弟の node に別の text が入る。その node の attributes・GraphLink・alias・親子 edge の label は元の node に付いたまま、別の内容を指す。消した node の GraphLink と alias を処理しないため、サーバーの validate が保存を拒否し、Undo するまで以降の保存がすべて失敗する（DC41 の後は失敗が表示される）。確認（処理）・推論（影響）。
5. **Vault の live 連携で、書出し直後に起きた Obsidian 側の変更が捨てられる**。M3E から書き出した後の 2 秒以上（`vault_watch.ts:79`）は、Vault 側の変更を記録せずに無視する（`:130–132`）。編集中は自動保存が 700 ms 間隔で続くので、ほぼ常に無視される状態になり、その間の Obsidian での編集は次の書出しで M3E の状態に上書きされる。確認（無視）・推論（上書き）。
6. **Vault でファイルを消すと、alias の参照先が戻らない形に書き換わる**。target の alias の参照先を `missing:<id>` にする（`vault_watch.ts:337`）。ファイルが戻っても alias は元の node を指さない。確認。
7. **部分木の置換が、境界をまたぐ GraphLink を消す**（層 A 5）。部分木の読取り（`?scope=` の GET、`rapid_mvp.ts:1189`）は両端が部分木の中にある GraphLink しか返さないので、読んでから書く client はそれを残せない。確認。
8. **起動時の `ensureMap` が root の text の変更を毎回戻し、旧 id の行を確かめずに消す**（6 節）。IS132 が扱うのは全置換と基準時刻のずれまで。確認。
9. **viewer の paste が linear-text・位置・注釈を複製しない**（層 B 20）。MCP の copy は複製する。copy した後に元を消すと、それらは失われる。確認。
10. **collab の全量送信が、他の書き手が足した node を消す**（層 A 24）。送信に含まれない既存の子孫を「端末で削除された」とみなして消す。基準の `mapVersion` は全 map 共通で、collab と linear-text の REST しか進めないので、MCP やブラウザ保存が同じ scope に足した node を検出できない。IS121 が扱うのは「nodes しか送らない」まで。確認（処理）・推論（消失）。
11. **UI からの取込み・sample の読込み・読込み時の cloud pull が、確定しない状態を基準にする**（層 B 56・58）。画面の全状態を置き換え、基準もその状態にするが、DB には書かない。次の自動保存は基準と DB が食い違ってマージ経路に入り、取り込んだ内容でも DB の内容でもない状態を確定するか、親の見つからない node で 400 になる。map id を明示しない読込みに失敗すると、既定 map（開発）の id のまま sample を載せる（`viewer.ts:13488`）。推論。
12. **利用者が操作しなくても書く処理が、閲覧中の tab を書き手にする**（層 B 40・41・43・56・59）。状態の同期は、保存のたびに全 node 分の位置記録と、その tab の Surface View の方向・間隔を書く。表示の違う tab どうしが互いの設定を上書きし、他の書き手との競合（409・マージ・IS117）の機会も増える。確認（書込み）・実データ（一つの surface に 14,437 件）・推論（競合）。
13. **AppState の型にない key と field が、記録単位の migration で黙って落ちる**（7 節）。今の全状態保存は、それらを手を付けずに残している（`rapid_mvp.ts:88–100`、`start_viewer.ts:1101–1111`）。実データ・確認。
14. **再送で二重に適用されるか、確定したかが分からない**。GraphLink の REST 追加（層 A 19）は同じ端点の重複を拒否せず冪等キーもないので、応答を失った再送で 2 本目ができる。MCP も commandId を持たないので、応答を失った後の再送は REVISION_CONFLICT になり、前の書込みが確定したかを client が確かめる手段がない（RQ23 の未充足）。確認。
15. **validate を通さずに保存する経路がある**（層 A 27・38・39）。不正な状態が入ると、その map への viewer の保存は validate で毎回拒否される。確認（validate の有無）・推論（影響）。
16. **cloud へ送る状態が、ローカルで確定した状態と違う**（層 A 43・44）。browser 起点の push は送信時点の画面の状態を送るので、ローカルで確定していない編集が cloud にだけ入り得る。定期 push は savedAt を毎回現在時刻にするので、cloud の savedAt と DB の saved_at は一致しない。IS124 は基準なしの上書きまで。確認・推論。
17. **IS125 の具体的な仕組み**: map の watch 用 SSE は全 map 合わせて 4 接続まで（`start_viewer.ts:356`）で、超えると古い接続から閉じる（`:400`）。再接続までの待ちは 60 秒（`:365`）。5 つ目の tab を開くと最も古い tab が通知を受けなくなり、再接続しても現在の状態と照合しない。確認。
18. **IS129 の具体例**: Final の保存（層 A 58）は条件付き確定を持たない。設定で Beta と同じ DB を開くと、Final の保存は Beta 側の確定（MCP を含む）を検出せずに上書きする。確認（コード）・推論（同じ DB を開いた場合）。
19. 消失ではないが単位の問題: groupSelected（層 B 19）は移動ごとに Undo 履歴を積むので、一部の node だけが新しい親の下にある途中の状態が、Undo の途中で自動保存される。確認。

## 6. IS132 の調査結果: 起動時の全置換

- 呼出し（確認）: `startServer`（`start_viewer.ts:3897`）が最初に `ensureMap` を 2 回呼ぶ。`:3898` は既定 map（env の `M3E_MAP_ID` がなければ 開発）、`:3899` は 研究。研究 の id と label は `:133–134` の固定値。
- 中身（確認）: `ensureMap`（`:322–343`）は map が存在すれば必ず `RapidMvpModel.renameMap` を呼ぶ。`renameMap`（`rapid_mvp.ts:1044–1072`）は root の text を label で上書きし、`saved_at` を現在時刻にして state_json を書き直す。text が同じでも書く。transaction はなく、`map_updated` も出さない。
- 由来（確認）: 2026-04-15 の commit `67b7cc9`（URL 引数の正規化と Home の導入）。[Data_Runtime_Layout.md](../../../docs/03_Spec/Data_Runtime_Layout.md) の「初期生成ポリシー」（121 行。Akaghef personal workspace では 開発 と 研究 を初期生成する）と、旧 map id（`akaghef-beta` など）の移行のために入った。
- 要否（推論）: 仕様が求めるのは初回の生成だけ。同じ仕様は「`mapLabel` は変更可」（44 行）「`mapLabel` の変更では `mapId` と保存実体を変えない」（132 行）としており、起動ごとの rename はこれと食い違う。rename は旧 id から移した直後に label を整えるためのもので、既存の map に毎回かかるのは副作用とみられる。
- 研究 map が対象になる理由（確認）: 研究 の id が workspace を問わない固定値で、`ensureMap` は workspace の種類を確かめない。そのため Final 用・team 用の workspace でも、起動のたびに 研究 map を作るか書き直す。
- 実データ（読み取り専用）: Beta 既定の workspace では、開発 と 研究 の `saved_at` が 81 ms 差で並ぶ（2026-10-24T12:25:48.985Z と 12:25:49.066Z）。研究 map の id は、data のある 3 つの workspace すべてにある。team 用の workspace には 1 node だけの 開発 map もある。
- 付随する影響:
  - root の text の変更が戻る（確認）: 利用者が 開発・研究 の root の text を変えても、次の起動で固定の label に戻る。Final では tutorial、env で指定した map も同じ。
  - 基準時刻のずれ（推論）: 起動前から開いている tab の基準時刻と DB がずれ、次の保存はマージ経路（IS117）に入る。brief の記述と同じ。
  - 旧 id の行の削除（確認）: 旧 id と新 id の行が両方あると、旧行を内容を確かめずに削除する（`:325–330`、`:313–320`）。現データに旧 id の行はない（実データ）。
- Final（`final/src/node/start_viewer.ts:206–228, 3726–3727`）と、Mac 配布 payload の旧ビルド（層 A 63）にも同じ処理がある。

## 7. 実データで確認した field（読み取り専用）

data のある 3 つの workspace の全 map を `mode=ro` で照会した。中身の text は読まず、key と件数だけを数えた。

- 表は全 workspace で `maps` だけ。scope bind 用の表はない。
- AppState 型にない top-level の key が 6 種類ある（`savedAt`・`sourceDb`・`exportedAt`・`sourceDocSavedAt`・`selectedId`・`scopeId`。各 1〜2 map）。node には型にない field が 5 種類ある（`type`・`aliasOf`・`updatedAt`・`notes`・`createdAt`。各 10〜13 node）。GraphLink に型外の field はない。
- 全 45,718 node のうち collapse 状態が true の node は 5,427。alias は 993、folder は 1,941。target が存在しない alias はない。
- 対象の scope node がもう存在しない linear-text が 63 件、存在しない node の位置を持つ surface が 19 個ある。surface は全部で 1,490 個で、位置の記録が最も多い surface は 14,437 件を持つ（層 B 40 の全 node 分の記録による。推論）。
- attributes の key の接頭辞では `m3e:` が最多（54,563）。import 由来の接頭辞（`blueprint:`・`source:`・`xmind:` など）も多い。key の種類が多いので、論理レコードモデルでは attributes を自由な key-value として残す必要がある（推論）。

## 8. Director への未決事項

1. `scopes` と `surfaces` の記録を正本の論理レコードに残すか。中身は派生の値（scope の root、relation の一覧）と、作者が決めた値（主に使う Surface View、方向と間隔、node の位置、Lane の表示 root）が混ざっている。派生の値は node から作り直す materialization にし、作者の値だけを記録にするか。
2. Layout（node の位置）、Surface View の設定、collapse 状態、linear-text の書体倍率と幅を、Command で確定する正本 data にするか、viewport と同じく viewer ごとの表示状態として map の外に置くか。特に Disperse の自動配置が収束した時の位置の書込みを残すか。
3. 定義語のない意図（5.2 節）に Command intent を割り当てるか。とくに linear-text の書換え、注釈の追加と削除、map 行の作成・複製・削除・属性の変更、新しい親の挿入、同名の子への合流、GraphLink の端点の付替え。Glossary に語を足すのか、既存の intent（`assert`・`delete`・`set-attribute`）の組合せとして書くのか。
4. 親子 edge の label は子 node の attributes（`m3e:edge-label`）にある。reparent した後も残して新しい親との edge の label にするか、edge の記録に移して reparent で消すか。
5. GraphLink の端点の付替えを、同じ ID のままの属性変更とするか、削除と追加（ID が変わる）とするか。生成時からの安定 ID を求める要件との関係で決めたい。
6. 同名の既存の子への合流（MF-H の追加、AI の話題提案、テンプレート）の判定を、Command の検証に含めるか、呼出し元の責任にするか。
7. 冪等キー: Flash の import key は node の attributes に保存されている。journal に commandId を置いた後も node 側に残すか。MCP で応答を失った後の再送に、前の書込みが確定したかを返す仕組みをどこに置くか。
8. 削除と同時編集の規則: 削除する部分木の中で別の書き手が編集や追加をしていた場合、削除を拒否するか、削除を優先するか。
9. 削除のとき、linear-text・注釈・位置の記録・broken alias の text の書換えを同じ transaction に含めるか。実データには、対象の scope がない linear-text が 63 件、存在しない node の位置を持つ surface が 19 個ある。migration ではこれらを落とすか残すか。
10. 実データにある AppState の型にない key（state に 6 種類、node に 5 種類）を、migration でどう扱うか。置き場を作るか、portable snapshot にだけ残すか、落とすか。
11. map の複製と file からの取込みは、同じ node ID を別の map に持ち込む（複製は state_json の丸ごとのコピー）。entity binding を後から足すことを考えると、node ID は map の中で一意であればよいか、workspace の中で一意にするか。
12. 起動時の `ensureMap` のうち、初回の作成以外（root の text の上書き、研究 map をすべての workspace に作ること、旧 id の行の削除）を削除してよいか。すでに Final 用と team 用の workspace に作られた 研究・開発 の map をどう扱うか。
13. Concreteness Axis の level ≠ 0 での編集（level ごとの親・順・境界・collapse を attributes に書く）を、level つきの node move・scopen・collapse の Command にするか、attributes の書込みのままにするか。
14. Undo を逆向きの Command にする場合、外部の変更を取り込んだ後の Undo で戻すのは自分の Command だけにするか。
15. data migration の後に旧実装（Final、Mac 配布 payload のビルド、PJ02 と ops の script）が新しい形式の workspace を開いて書くのを、どう止めるか。script は Command の送信に書き直すか、削除するか。
16. collab（Team Collaboration）の scope lock と、process 全体で 1 つの mapVersion を、Command の write authority と base revision に置き換えるか、collab の経路を廃止するか。Team Collaboration は範囲外だが、経路は残っており、全量送信で他の書き手の node を消し得る。
17. 部分木の置換（`?scope=`）、linear-text の REST、GraphLink の REST は、repo 内に test 以外の呼出し元がない。外部の agent や skill が使っていないかを確かめてから削除してよいか。
18. UI からの file の取込み（.json・.mm）と sample の読込みは、いまは現在の map を画面上で置き換えるだけで確定しない。移行後は「新しい map として取り込む」だけにしてよいか。読込み失敗時に既定 map の id のまま sample を出す処理を消してよいか。
19. cloud sync を一度きりの migration の範囲に含めるか。有効になっているかは未確認。含める場合、cloud 上の全状態の複製を journal ベースにするか。
20. Home の archive・tags・pin・Vault の宣言は `maps` 行の列だけを変えており、map の状態は書かない。これらも Command と journal に通すか、map の目録の更新として別に扱うか。
