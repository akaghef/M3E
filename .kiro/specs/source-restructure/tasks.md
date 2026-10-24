# ソース構造整理 — 実装タスク

2026-10-16。状態: spec 承認済み（DC12、2026-10-16 23:03 JST）。実装開始は人間の確認後の別指示による。全項目未実施。チェック欄は後続の実装証拠が揃ってから更新する。

DC17 改訂（2026-10-16 23:37 JST）: PR7 を fit モーション修正トラックへ拡張。担当は既存の別 Codex app スレッド、構造整理は sol6.1、Director は判定を担当する。別スレッドの調査は design に出典・限界付きで記録し、下記の未実施チェックを測定済み/修正済みとして埋めない。

この文書の PR1〜PR13 は本 spec 内の段階番号であり、`backlog/source-quality-static-scan.md` の対策候補 PR1〜PR5 とは別スコープである。対応は、backlog PR1→本 spec PR1、backlog PR2→PR4、backlog PR3→PR5、backlog PR4→PR2/PR7/PR8、backlog PR5→PR10/PR11。

範囲は [requirements.md](requirements.md)、設計と判断 DC1〜DC11 は [design.md](design.md)。この文書作成では製品・試験・設定を編集せず、以下の検証コマンドも実行していない。

## 共通の出荷条件

全実装段階は isolated `codex/<task>` worktree で進め、1段階ごとに検証→commit→`dev-beta` 統合→push→通常 Beta 確認を完了する。統合手順は [Worktree Separation Rules](../../../docs/06_Operations/Worktree_Separation_Rules.md) を参照。spec 下書きの確定だけでは実装開始としない。

判定の所有者は Director。ESLint の基準値・方針ファイル、性能比較器と policy（N/k/集約）、各段階のゲート目標値は Director が所有する。実装者（sol6.1）は変更を提案できるが、自分で上限を上げる、基準を作り直す、判定を変更することはできない。初期基準の生成案も Director が独立に実行・照合して承認する。実装者の自己検証に加え、Director が合否コマンドを独立に実行して段階を判定し、その後に統合する。

各段階の表の数値は変更前に設定する削減目標。source が変われば作業開始前に Director へ差分を提示する。失敗後に下げない。viewer の17,202行・154 let は今回の調査時点の暫定値であり、PR1 開始時に再計測し Director が封じる。以後は直前の受理値を基準にする。各指標は非増加、少なくとも指定した対象指標は厳密に減らす。全関数の上限・移動追跡も同時に検査し、行数だけで合格にしない。

PR7 は挙動修正専用であり、構造削減のための関数移動・分割を含めない。PR1 より先に統合する場合は Director が PR1 統合時に基準を再計測して封じる。後なら既存静的ゲートに従い viewer の行数・let を増やさない。PR1未導入時に存在しない静的commandを実行済み扱いにしない。通常の型・build・既存試験は維持する。

各段階に共通する実装後コマンド（repository root から）:

```bash
npm --prefix beta run typecheck
npm --prefix beta run lint:deps
npm --prefix beta run lint:copy
npm --prefix beta run lint:source-quality
npm --prefix beta run build
npm --prefix beta test
npm --prefix beta run test:legacy-node
git diff --check
```

`lint:source-quality` は PR1 で追加予定、`test:legacy-node` は PR1 で既存7本を収集し PR3 で移動先へ更新する予定。他の command は現状存在する。未実装 command を現在実行済みと報告しない。初期測定時は現在の build 後の各 `dist/node/*_test.js` を個別実行して結果を保存し、その同じ試験を npm command へ収集する。

RQ1 の全既存試験は、unit と旧 Node 試験だけでなく Playwright の現存 config も実施する。全 suite を初期基準・各段階の統合前に回し、段階内の反復では下記の最小関連セットを使う。現在の標準 config に専用 lab spec が混在する場合、その失敗を隠さず記録し、専用 config の結果と区別する。テストを削除・skip して整えるのは禁止。

```bash
cd beta
npx playwright test
npx playwright test --config playwright.e2e.config.js
npx playwright test --config playwright.node-lab.config.js
npx playwright test --config playwright.runtime-board.config.js
npx playwright test --config playwright.agent-node.config.js
npx playwright test --config playwright.agent-orrery.config.js
npx playwright test --config playwright.ot-seam.config.js
```

Playwright はこの直前に build する。fixture server と real server の結果を区別し、通常 Beta で元の対象操作を再確認する。snapshot が無い・OS が違う等の失敗を成功扱いにしない。環境制約で実行できなければ `未実行（Director 依頼）`、具体的な spec と理由を報告し、段階を合格にしない。

性能対象段階の共通コマンド例（`beta/` から、専用 server / frozen fixture を準備した後）:

```bash
node perf/run_webgl_pan_zoom.mjs --base-url "$RESTRUCTURE_BASE_URL" --manifest "$RESTRUCTURE_MANIFEST" --renderer both --browser-channel chrome --warmup 2 --runs 5 --output "$RESTRUCTURE_RESULT"
node perf/compare_webgl_pan_zoom.mjs --baseline-dir "$RESTRUCTURE_BASELINE" --candidate-dir "$RESTRUCTURE_CANDIDATE" --policy "$RESTRUCTURE_POLICY"
```

各 build について前者を独立20回、別の出力名で実行する。後者は PR2 で追加予定の比較器であり、現在存在しない。DC6/DC10 の GPU と集約条件を厳守する。基準/候補を同じ build に向けない。環境変数は作業前に実在する専用 origin/fixture/artifact path へ解決し、通常 personal workspace に fixture を作らない。

## 先行する調査とゲート

### PR1 CI の静的ゲート（RQ1・RQ3・RQ6）

- [ ] PR1 静的初期測定、検査器、旧試験収集、CI 接続、基準の固定を完了する。

| 項目 | 内容 |
|---|---|
| 作業 | ESLint 9/typescript-eslint 8 と標準2規則、baseline policy、viewer AST/行数検査を追加。新規20/100、現状例外、移動対応、配置指標を固定 |
| 作業 | 既存7本の Node 試験を全て実行する script を追加。CI に build/全試験の収集と source-quality を接続 |
| 作業 | labs を除く製品 src の CCN 50超関数を全列挙し、PR12 の対象台帳にする。移動先まで同一関数として追跡 |
| 守る挙動 | 製品コードは変更しない。既存試験の内容と件数を保持 |
| 最小検証 | 共通検証、新しい静的 gate の正例・負例試験 |
| ゲート目標 | 初回は上限を導入する工程。viewer17,202 / let154 / 配置対象13は暫定。開始時の実測を Director が固定し、新規違反0を保証。PR7が先に統合されたらPR1統合時にそのsourceを再計測して封じる |
| 負例検証 | 新規違反、既存悪化、let/行数増加、parse error、欠損 baseline、候補branchでの上限引上げ、rename の免責、移動先未収集を拒否。負例は tests 内だけに置く |
| 性能 | 不要。製品コードを変えない静的 gate のため、GPU 環境なしで単独出荷できる |
| 巻き戻し | 新規 tool/config/policy だけを一括 revert。後続は開始せずゲートを再設計 |

### PR2 性能の妥当性・比較器・基準取得（RQ1・RQ6・RQ7）

- [ ] PR2 GPU 妥当性、比較器、固定 policy、20回の基準計測を完了する。

| 項目 | 内容 |
|---|---|
| 前提 | PR1 と独立に着手可能。Director が計測契約を固定。PR7の着手/修正をPR2待ちにしない |
| 作業 | 既存 runner へ GPU renderer 記録/妥当性判定を追加。比較器と policy を Director 所有で準備し、hardware GPU で同一 build20回の基準を取得 |
| 守る挙動 | 製品コード不変。fixture hash・1 page・geometry upload不変・runner CLI互換を保持 |
| 最小検証 | `cd beta` で `npx vitest run tests/unit/webgl_pan_zoom_runner_contract.test.js`、新 comparator 試験、共通性能コマンド。Director が独立再実行 |
| ゲート目標 | 製品の静的値は不変。初期の計測基準導入工程であり、製品関数の削減工程とは分ける。妥当性・20回分・全指標の判定欠落0 |
| 負例検証 | software GPU、no-measurement、long task非対応、frame0、不一致環境/fixture、中央値/p90超過、policy引上げを拒否 |
| 性能 | 必須。hardware GPU evidenceがなければ未完了。静的ゲートPR1の出荷は止めない |
| 巻き戻し | runner/比較器/policyだけを戻し、性能依存の後続を停止。製品sourceは変更しない |

PR7 は PR2 の完了前でも実frame時刻とInspectorによる比較で進行する。PR2 が利用可能になり次第、同一runnerによる共通判定を追加する。PR7が先に統合された場合も修正前版/修正版を比較し、PR4前に修正後基準をDirectorが受理する。historical製品sourceへ新計測表示をbackportしない。

### PR3 早期の配置整理（RQ3・RQ5・RQ6）

- [ ] PR3 試験・dogfood・demo・PJ 専用コードを用途別に移動する。

| 項目 | 内容 |
|---|---|
| 前提 | PR1 の静的ゲートが統合済み |
| 作業 | 7本 `*_test.ts`、3本 dogfood、pj03 demo、2本 pjv34 を移動。project 所有者/参照確認→import/compile root/npm scripts の更新→収集照合 |
| 守る挙動 | CLI 引数・exit code・出力、手動実行の副作用、test case と件数、製品 build/start。sample 生成を通常起動へ追加しない |
| 最小検証 | 共通検証。移動前後の7本全試験と同じ件数。`npm --prefix beta run demo:pj03 -- --help` 等は side effect を確認してから使い、help 非対応の script は一時環境で安全な既存入口を使う |
| ゲート目標 | 製品 src 内の対象数13→0。未特定の所有 project があれば0達成前に完了にしない。関数別例外は移動先へ引継ぎ、複雑度削減として数えない。viewer/let は不変 |
| 性能 | 不要（製品 runtime と camera 経路の不変を参照・build 差分で確認できた場合）。runtime を変更する必要が出たら分離して性能対象を再判断 |
| 巻き戻し | 移動・import・build/test script・例外path対応を同一単位で戻す |

### PR4 キー入力（RQ1・RQ3・RQ4・RQ6）

- [ ] PR4 コマンド一覧、keyboard owner、既存優先順位の検証、旧 keydown 削除を完了する。

| 項目 | 内容 |
|---|---|
| 前提 | PR3 と PR2。PR7のfit修正がdev-betaへ統合済みで、通常Beta確認と修正後の性能基準をDirectorが受理済み |
| 守る挙動 | Mac/Windows 修飾キー、primary+Alt の shortcut 表示、IME、editor、grab、read-only、Escape 優先、repeat、keyup/blur、focus、fit/zoom command |
| 最小検証 | 共通検証。`cd beta` で `npx vitest run tests/unit/viewer_keyboard.test.ts`、`npx playwright test tests/visual/shortcuts.spec.js tests/visual/keyboard_modes.spec.js tests/visual/grab_tree_move.spec.js tests/visual/fit_cycle.spec.js` |
| ゲート目標 | viewer の行数を直前から500以上減らす。CCN 411 の旧 keydown を削除し、一覧/dispatcher/新 handler は各20/100以内。let 非増加、key owner へ状態を移譲 |
| 性能 | 必須。pan/zoom 共通比較に加え、キーからのzoom/fitでPR7修正後の動作を保持することを検証。camera implementationの挙動修正を混ぜない |
| 巻き戻し | 一覧、listener binding、旧本体削除、関連 gate 更新を同じ単位で戻す |

### PR5 サーバーを1分野ずつ移行（RQ1・RQ2・RQ3・RQ5・RQ6）

- [ ] PR5 Fastify 適合性、分野ごとの契約比較、旧 routing 全廃を完了する。

まず非出荷の互換実証を行う。Fastify `serverFactory` / `ready()` で同期 `createAppServer`、listen/close、複数 instance、SSE cleanup、raw body が成立することを確認する。ここで不適合なら変更を本流へ出さず Director に報告する。適合後、幹の導入と最初の小分野の移行を1出荷単位とし、旧 root dispatcher の CCN が厳密減少するようにする。巨大サーバー全体をまとめて出荷しない。

| 項目 | 各出荷単位の共通条件 |
|---|---|
| 前提 | PR4。旧版/新版 HTTP 契約表が移行前に固定済み |
| 守る挙動 | URL/method、status/body/header、404/405/HEAD、JSON/type/size、local-only/auth、SSE、起動終了、DB/data/static root、環境変数、既存 CLI |
| 作業 | 1分野を `routes/<分野>.ts` に登録→旧 if/parser を削除→contract 比較。未移行だけ既定 route へ。app へ業務分岐を足さない |
| 最小検証 | 共通検証、新規 HTTP differential suite、下表の関連試験。`npm --prefix beta run test:e2e` で real server も確認 |
| ゲート目標 | 各分野ごと旧 root dispatch の CCN を少なくとも1、または対象 handler の既存超過量を厳密削減。全指標非増加。parser 残数は毎回減少し最終0。app/新 handler は20/100以内 |
| 性能 | 原則不要（browser source・通知頻度不変の一般 JSON 分野）。map watch/collab/vault/orrery/static 分野は描画更新や配信物へ作用するので共通性能比較を必須 |
| 巻き戻し | 直近の1分野と route/旧 parser 差分を戻す。DB migration は含めない。Fastify 導入を戻す場合は依存分野を逆順に戻す |

関連試験の実行は `cd beta` の後に `npx vitest run <下表のパス>`。1行が巨大な場合も1分野ずつ分け、統合順序・確認済み endpoint を記録する。

| 移行する分野 | 既存の主な試験・追加する契約 |
|---|---|
| diagnostics（最初の候補） | `tests/unit/layout_composition_api.test.js tests/unit/edge_port_composition_api.test.js tests/unit/layout_snapshot_direction_api.test.js`、resolve |
| maps/home | `tests/unit/home_pin_api.test.js tests/unit/local_doc_conflict_api_integration.test.js`、全 CRUD/not-found |
| agent maps / MCP | `tests/unit/mcp_service.test.ts tests/unit/mcp_hooks.test.ts`、HTTP MCP と agent endpoint の旧版比較 |
| collab / observation | `tests/unit/collab_api.test.js tests/unit/collab_push.test.js tests/unit/presence.test.js`、map watch/audit/SSE切断 |
| sync / backups | `tests/unit/cloud_sync_api_integration.test.js tests/unit/conflict_backup_api.test.js`、競合と復元 |
| vault | `tests/unit/vault_watch_api_integration.test.js tests/unit/vault_import_api_integration.test.js tests/unit/home_vault_api.test.js` |
| blueprint / flash | `tests/unit/blueprint_import_api_integration.test.js`、draft/approve の全 route |
| linear / AI | `tests/unit/linear_transform_api_integration.test.js tests/unit/linear_notes_api.test.js tests/unit/cas_pn_generate_api.test.js` |
| orrery | `tests/unit/orrery_api.test.ts` と `tests/e2e/orrery_network.spec.js`、local-only と server.close |
| local_fs / clipboard / artifacts / static | 既存 route 全ての differential、traversal/absence、`tests/e2e/compiled_labs.spec.js tests/e2e/markdown_hover_preview.spec.js` |

表は試験選択の入口であり route の完全な一覧ではない。完全な endpoint/method inventory は実 source から移行前に確定する。全 route の移行後、旧 `legacy_routes.ts` と dispatch parser を削除する。`start_server.ts` / `server/app.ts` へ改名し、既存 `start_viewer` は必要な import/CLI 互換だけ残す。

### PR6 通信・同期・collab クライアント（RQ1・RQ3・RQ4・RQ6）

- [ ] PR6 map sync、collab、cloud/vault の順に小単位で owner を移譲する。

| 項目 | 内容 |
|---|---|
| 前提 | PR5 完了 |
| 守る挙動 | load/save、debounce、savedAt/baseVersion、競合提示、read-only、tab/source除外、SSE再接続、heartbeat/lock、visibility、scope/map切替後の古い応答、dispose |
| 最小検証 | 共通検証。`cd beta` で `npx vitest run tests/unit/cloud_sync_conflict.test.js tests/unit/cloud_sync_transport.test.js tests/unit/collab_api.test.js tests/unit/collab_push.test.js tests/unit/vault_watch_api_integration.test.js tests/unit/local_doc_conflict_api_integration.test.js`。追加 client lifecycle 試験、real-server E2E |
| ゲート目標 | 完了時 viewer 500行以上・let10以上減少。各小単位で owner を移す実コード/let を厳密減少し、元 listener/timer を削除 |
| 性能 | 必須。同期通知が render/fit を呼ぶため共通比較と、remote update→対象 scope 表示の元操作確認 |
| 巻き戻し | connection owner 単位で戻す。subscription が二重になる暫定併走をしない |

## PR7 fit モーション修正トラック（RQ1・RQ3・RQ6・RQ7、DC17）

- [ ] PR7 別の Codex app スレッドがfit修正を実装し、Directorの判定、dev-beta統合、通常Beta実機確認を完了する。

| 項目 | 内容 |
|---|---|
| 担当・並行範囲 | fit悪化を調査中の既存Codex appスレッドが実装、Directorは判定のみ。viewer logicに触れないPR1〜PR3と並行可能。構造整理の関数移動・分割を混ぜない |
| 前提 | PR2完了は着手条件ではない。既存調査のsource/環境/traceを確認し、変更前のInspector/frame計測を保存 |
| 原因検証 | e2faa94^/e2faa94のA/Bと限定介入を継続。修正前/修正版の比較は別に保存。未再現の1秒停止・一時的30回/秒を解決済みとしない |
| 補間 | 自作cubic/倍率の線形補間をd3-interpolateのinterpolateZoomへ置換し、直接依存とlockfileを更新。viewport中心/幅との変換、時間設定、始終点を検証 |
| 開始時刻 | e2faa94の開始時刻変更を根拠付きで復帰または修正。frame時刻との混用による初回0進行を前後測定 |
| タイル・cache | 移動中の再生成/全消去を終了後へ遅延。cancel/連続fit/新移動での更新漏れ、描画欠け、資源漏れを検証 |
| 描画予約 | camera更新とWebGL描画を同じframeで行えるか検証し、採否をDirectorへ報告 |
| 守る挙動 | fit target/cycle、anchored zoom、cancel、reduced-motion、SVG/WebGL、他の操作、保存/API。モーションの指定修正以外を変えない |
| 最小検証 | 通常のtypecheck/build/既存試験。`cd beta` で `npx playwright test tests/visual/fit_cycle.spec.js tests/visual/surface_camera_resize.spec.js tests/visual/camera_follow.spec.js tests/visual/webgl_projection.spec.js tests/visual/render_updates.spec.js`。下記の実frame比較と通常Beta確認 |
| 静的ゲート | PR1より先に統合ならDirectorがPR1統合時に再計測/初期基準固定。後なら既存ゲート遵守、viewer行数/let非増加。構造削減のための改造を加えない |
| 性能・判定 | Inspector更新カウンター、入力→終点描画の時間、frameごとの倍率を変更前後で比較。通常Betaの実機Chrome/hardware GPU確認を必須とし、Directorが独立判定。PR2利用可能後は共通runner判定も必須 |
| 後続への条件 | PR4は修正のdev-beta統合後に開始。PR8は修正後の受理された補間/開始/描画/cache動作を基準にする |
| 巻き戻し | fit挙動修正と直接依存を同一変更単位で戻す。後続がその挙動へ依存していたら作業停止/依存順に再検証。構造変更を巻き込まない |

元の130%→23%を含むfit操作を同じ環境で前後比較する。Inspectorのカウンター値・frame timestamp/倍率の全系列・終点描画の観測方法・未確定点を保存し、最終座標だけで滑らかさを判定しない。報告された約385msや60回/秒を新しい合否閾値にしない。実frame計測の具体的な取得手段は当該スレッドの既存調査経路を再利用し、実行コマンド/操作条件をDirectorへ提示する。存在しない計測commandをこのspecで実行済みとしない。

PR2がまだ利用できない場合は、その比較だけを未実施として担当・残条件を記録し、PR7の実frame比較/通常Beta確認と混同しない。PR2利用可能後は保存した修正前版/修正版で共通コマンドを実行し、PR4着手前にDirectorが修正後基準を受理する。独立調査の終了時は試験専用process/workspaceだけを終了する。

### PR8 カメラ・viewport（RQ1・RQ3・RQ4・RQ6・RQ7）

- [ ] PR8 全 camera writer を単一 owner の命令へ移譲する。

| 項目 | 内容 |
|---|---|
| 前提 | PR6、PR7の両方が完了。PR7修正後の統合buildと受理されたモーション/性能を基準として固定 |
| 守る挙動 | anchored zoom、wheel pan、fit cycle、scope/layout/selection trigger、animation開始/取消、reduced-motion、clamp、resize、linear/editor/PNの追従、永続化復元 |
| 最小検証 | 共通検証。`cd beta` で `npx vitest run tests/unit/pinch_zoom.test.js tests/unit/frame_invalidation.test.ts`、`npx playwright test tests/visual/fit_cycle.spec.js tests/visual/camera_follow.spec.js tests/visual/surface_camera_resize.spec.js tests/visual/workbench_progressive_nav.spec.js tests/visual/webgl_projection.spec.js` |
| ゲート目標 | viewer500行以上・let10以上減少。cameraの外部直接writer 0、owner1。全関数上限維持 |
| 性能 | 必須。共通前後比較と通常 Beta 再起動後の元操作。animation中の観測を含む |
| 巻き戻し | camera owner と全呼出側の切替を同一単位で戻す。旧/新双方が同時に座標を書かない |

### PR9 ポインタ入力（RQ1・RQ3・RQ4・RQ6）

- [ ] PR9 SVG/WebGL/board listener と gesture state を移譲する。

| 項目 | 内容 |
|---|---|
| 前提 | PR8 |
| 守る挙動 | mouse/touch/pen、wheel修飾、pinch anchor、pointer capture/cancel/lost focus、drag threshold、reparent、range選択、annotation、GraphLink端点編集、Undo |
| 最小検証 | 共通検証。`cd beta` で `npx playwright test tests/visual/render_interaction_updates.spec.js tests/visual/grab_tree_move.spec.js tests/visual/pen_annotations.spec.js tests/visual/viewer.visual.spec.js tests/visual/webgl_projection.spec.js` と pinch unit |
| ゲート目標 | viewer400行以上・let3以上減少。旧 canvas pointerdown CCN 64を削除、新 handler20/100以内。cameraへの直接writer0を維持 |
| 性能 | 必須。共通前後比較。gesture回数と geometry upload invariant を保持 |
| 巻き戻し | listener登録/破棄と gesture owner を一緒に戻す。capture漏れと二重 listener を確認 |

### PR10 renderScene（RQ1・RQ3・RQ4・RQ6）

- [ ] PR10 描画 owner と既存 seam の呼出側を移譲し、viewer の元本体を削除する。

| 項目 | 内容 |
|---|---|
| 前提 | PR9 |
| 守る挙動 | SVG/WebGL/default、layout/Connection、node種類、folder preview、annotations、LOD、selection、cache invalidation、SSE更新、fallback、fit target と scene revision |
| 最小検証 | 共通検証、`npm --prefix beta run test:edge-port` / `test:layout` / `test:node`。`cd beta` で `npx playwright test tests/visual/incremental_edit.spec.js tests/visual/render_updates.spec.js tests/visual/render_interaction_updates.spec.js tests/visual/webgl_projection.spec.js tests/visual/layout_integrity.spec.js tests/visual/viewer_surface_edge_paths.spec.js` |
| ゲート目標 | viewer500行以上・let8以上減少。旧renderScene CCN 46 / 686行を撤去し、新規pipeline/handlerは20/100以内。GraphLink描画のCCN 88の入れ子も改善対象。source copyによる二重本体0 |
| 性能 | 必須。共通前後比較、geometry upload、描画更新/idle、通常Beta元操作 |
| 巻き戻し | render owner、adapter wiring、旧本体削除を同一単位で戻す。既存goldenは更新しない |

既存 node/edge/layout/PN seam を使う。WebGL direct snapshot、layout algorithm、UI デザイン変更は別段階の名目でも持ち込まない。

### PR11 残りの状態・UI・命名配置（RQ1・RQ3・RQ4・RQ5・RQ6）

- [ ] PR11 残る分野を1つずつ切り出し、最終構造目標を満たす。

| 項目 | 内容 |
|---|---|
| 前提 | PR10 |
| 作業 | selection/edit/session、linear/preview/Inspector/template/local filesystemなどをowner別移譲。rapid modelの実態に合う改名と旧CLI互換を整理。台帳残項目を0にする |
| 守る挙動 | 編集/Undo/clipboard、scope/path、model round-trip、UI labels/focus、preview、設定保存、全旧起動導線。個人data rootを変えない |
| 最小検証 | 共通検証。`cd beta` で `npx vitest run tests/unit/data_model_integrity.test.js tests/unit/scope_structure.test.js tests/unit/home_rapid_mvp_extras.test.js`、各分野の既存unit/E2E、全Playwright suite |
| ゲート目標 | 各小単位でviewer行数かletを厳密削減。最終viewer≤2,000行・let0、共有mutable singleton0、台帳のowner未確定0。配置対象0、routing parser0を維持 |
| 性能 | UI/編集/sessionはrender/cameraの呼出順序に作用するので必須。モデルの純粋なrenameだけなら不要と理由を記録するが、それだけを削減達成の出荷単位にはしない |
| 巻き戻し | 分野単位で戻す。renameはimport/CLI/data root/例外対応も一緒に戻す |

2,000行以下でも、巨大なfactoryやstate objectへ移しただけなら未達。viewer 以外の巨大関数は次の PR12 で実際に削減する。

### PR12 viewer 以外の巨大関数を責任別に分割（RQ1・RQ3・RQ5・RQ6）

- [ ] PR12 製品 src の対象関数を1責任ずつ分割し、各20/100以内にする。

| 項目 | 内容 |
|---|---|
| 前提 | 原則PR11後。PR1で対象一覧を固定し、該当moduleの所有/renameに競合しない範囲だけ並行可能 |
| 対象 | labsを除く製品srcの全CCN50超。viewer/server段階で既に解消したものは証拠を再利用し、未解消を残さない。Director指定の `localTopicSuggestions` も対象 |
| 作業 | `importBlueprintToAppState` のparse/normalize/assemble、`copySubtree` の探索/複製/参照対応、MCP `mutate` / `reconcile` の入力判定/対象解決/既存更新、topic提案の規則を責任ごとに分ける。既存ライブラリとmodel命令を使う |
| 守る挙動 | 保存algorithm・schema・入力受理条件・error code・順序・ID生成・参照/alias/GraphLink・copy結果・MCPの原子性/競合/削除時保護・提案出力。新機能や出力改善を混ぜない |
| 最小検証 | 共通検証。`cd beta` で `npx vitest run tests/unit/blueprint_importer.test.js tests/unit/blueprint_import_api_integration.test.js tests/unit/rapid_mvp.test.js tests/unit/data_model_integrity.test.js tests/unit/scope_structure.test.js tests/unit/mcp_service.test.ts tests/unit/mcp_hooks.test.ts`。旧版/新版の同一入力による出力・永続化比較とtopic用characterizationを追加 |
| ゲート目標 | 小単位ごと対象のCCN/行数超過量を厳密減少。最終の対象関数・分割後関数は全てCCN≤20かつ行数≤100、製品srcのCCN50超残数0。移動・改名での対象除外禁止 |
| 性能 | 原則不要（Nodeの純粋な責任分割でbrowser通知順序/頻度不変の場合）。描画/同期への作用が出る場合は共通性能比較も必須 |
| 巻き戻し | 1対象関数/責任ごとの実装とbaseline低下を一緒に戻す。schema migrationなし |

調査用CSVでは importer85、copySubtree80、MCP mutate60/reconcile54。`localTopicSuggestions` は45で50超ではないが、Director の明示指定で対象に含める。正確な最終対象は PR1 の現在source実測から Director が固定する。labsの巨大関数はこの削減段階の対象外で、既存gateを弱める理由にはしない。

## 最終レビューと出荷証拠

- [ ] PR13 要件と段階の証拠を照合して構造整理の完了を判定する。

| 要件 | 必須の完了証拠 |
|---|---|
| RQ1 | 全既存試験、旧新版 HTTP 比較、保存/reload/restart、GPU性能判定、通常Betaの元操作 |
| RQ2 | Fastify route一覧、旧fallback/dispatch parser残存0、app/routeの責任分離 |
| RQ3 | Directorが独立実行したCI/判定証拠、全段階の基準差分、移動追跡、製品srcのCCN50超残数0と指定関数20/100以内 |
| RQ4 | viewer≤2,000/let0、5必須分野と残りのowner台帳、依存検査、本体削除 |
| RQ5 | 旧→新 path/command表、製品srcの非製品対象0、起動とモデル互換 |
| RQ6 | 各段階の統合/push/通常Beta確認、revert範囲、未統合残作業の明示 |
| RQ7 | PR7の原因/介入・fit修正の前後計測・Director判定・通常Beta実機確認。PR4が修正統合後、PR8が修正後挙動を保持する記録。未再現症状とPR2追加判定の状態 |

PR13 は新たな製品変更ではなく検証工程なので、静的削減値は最終値を維持する。生成物は artifact に置き、ソースの基準/判定定義だけを version 管理する。変更ファイル・実施検証・未達条件・次の最小タスクを報告し、spec、実装、統合、稼働、体感確認を区別する。
