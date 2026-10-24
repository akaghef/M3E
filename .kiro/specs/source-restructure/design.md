# ソース構造整理 — 設計

2026-10-16。状態: spec 承認済み（DC12、2026-10-16 23:03 JST）。対象要件は [requirements.md](requirements.md)。現在は文書のみで、以下の新規 module / command / gate は未実装。

改訂: DC17（2026-10-16 23:37 JST）の fit モーション修正トラックを反映。実装・実測は別の Codex app スレッドが担い、この文書作成担当は製品コードを変更していない。

## 合意した判断

| 決定 | Director の判断 | 対応した選択肢 |
|---|---|---|
| DC1 | Fastify。分野単位の移行と旧版/新版 HTTP 契約試験。raw HTTP は標準拡張点のみ | OP1 Fastify 推奨、Hono + TrieRouter、Express を比較 |
| DC2 | 分野別 factory、非公開 state、read-only snapshot、命令メソッド。camera 書込 owner は1つ | OP2 巨大な共有 state / 新規状態管理 framework を不採用 |
| DC3 | A/B 調査と CI・性能基準を先頭で並行。その後 配置→キー→サーバー→通信→camera→pointer→描画→残り | OP3 の当初案から A/B と配置整理を前倒し |
| DC4 | 既存 seam の意味契約・golden を再利用。本 spec は実コード削除・責任移譲を所有 | OP4 全 spec の置換を不採用 |
| DC5 | 全指標非増加、対象1指標以上を厳密減少。調査だけの工程は別ゲート | OP5 承認 |
| DC6 | hardware GPU 必須、renderer を記録。変動幅から許容値を事前固定 | 性能の追加条件 |
| DC7 | 新規 CCN ≤20、関数行数≤100。最終 viewer ≤2,000行、トップレベル let 0 | OP6 承認。移動・改名で違反を免責しない |
| DC8 | 同期 createAppServer / listen / close を保持。serverFactory と ready の互換実証を先行 | Fastify 適合しなければ選定を再判断 |
| DC9 | e2faa94 前後の独立 build、報告操作の再現、差分部位への介入検証 | 数値差だけの原因断定を不採用 |
| DC10 | N=20、warmup 2 / runs 5、中央値と90パーセンタイル、k=3 | OP7 の全体最大値による合否案は不採用。最大値超過は報告する |
| DC11 | 製品 src 内の試験・デモ・PJ専用ファイル数を追加指標にする | OP8 承認。配置移動に無関係の改善を混ぜない |
| DC12 | 3文書とレビュー修正5点を承認。実装は人間の確認後、sol6.1 へ別途指示 | 設計担当は新規作業を開始せず待機 |
| DC17 | PR7 を既存 Codex app スレッドによる fit モーション修正へ拡張。PR1〜PR3 と並行、PR4 は修正統合後、PR8 は修正後の挙動を保持 | DC3/DC9 の調査限定・PR2待ちを更新。Director は判定、構造整理は混ぜない |

合意は ORRERY Mail の KeenBell からの「OP1〜OP5 の裁定」「OP6 / Fastify 互換 / A/B の裁定」「OP7 / OP8 の裁定」に基づく。実装中の要件変更は別提案とし、失敗後に基準を書き換えない。

後続の「下書きレビュー（修正5点）」に従い、静的ゲートと性能基準を独立段階に分け、viewer 以外の製品 src の巨大関数削減を追加した。判定は Director が所有・独立実行する。tasks の番号はこの spec 内で振り直し、backlog の候補番号とは別スコープとする。調査値は実装開始時の基準としては暫定。

## 現状の境界と移譲先

`viewer.ts` は DOM 取得と起動だけでなく、`viewState`、map、render cache、timer、WebGL、SSE、入力 handler を直接結んでいる。例えば `applyZoom` は WebGL camera と SVG transform、linear 表示、editor、viewport event を更新し、`moveCameraTo`、wheel、pointer、fit が同じ座標を書いている。`renderScene` は layout、node、Connection、annotation と DOM/WebGL snapshot を組み立てる。factory への機械的な移動だけでは依存は解消しない。

以下の module 名は実装パスの予定であり、新しい製品概念名ではない。

| 現在の主な symbol / 状態 | 移譲先 | 書込 owner と他分野への契約 |
|---|---|---|
| keydown、keyup、blur、修飾キー、held routing key | `browser/viewer_keyboard.ts` と `viewer_commands.ts` | キー状態は keyboard factory。command 一覧が match/context/priority/execute を宣言。model 操作は注入された命令へ |
| `cameraX/Y`、`zoom`、`cameraMotion`、fit cycle、pending zoom、viewport sync timer | `browser/viewer_camera.ts` | camera factory だけが書込。現在座標を read-only で提供。入力・fit trigger・renderer は直接変更しない |
| `renderScene`、`lastLayout`、visible order、retained SVG、node/edge cache、render revision | `browser/viewer_render.ts` | render factory。read-only の model/view 入力から現在と同じ順序で描画。camera に bounds を通知するだけ |
| `webglProjection`、snapshot cache、selection paint、activation/fallback | `browser/viewer_render.ts` 配下の投影 adapter | 既存 `webgl_projection.ts`、`incremental_scene.ts`、`frame_invalidation.ts` を使用。別の renderer を作らない |
| map load/save、autosave、savedAt、BroadcastChannel、map watch | `browser/viewer_sync.ts` | sync factory が接続・request・timer を保持。model 更新命令と通知を注入 |
| heartbeat、scope lock、presence、collab EventSource | `browser/viewer_collab.ts` | collab factory。権限・retry・ロック・イベント順序を保持。UI DOM は持たない |
| cloud / vault の接続状態、watch stream | `browser/viewer_cloud_sync.ts` / `viewer_vault.ts` | 分野別 connection owner。既存 API・storage key を保持 |
| activePointers、pinch、pan、SVG/WebGL drag、hit-test、pointer capture | `browser/viewer_pointer.ts` | pointer factory が gesture state を保持。camera 命令と選択/編集命令へ委譲 |
| 選択・undo/redo・grab・model update | `browser/viewer_selection.ts` / `viewer_edit.ts` | 選択と編集の owner を分離し、map state 変更は既存更新経路を通す |
| scope/view mode、起動設定、preferences | `browser/viewer_session.ts` | session owner。camera の永続化用データは取得/復元命令で扱う。座標の第二正本を作らない |
| preview、Inspector、linear、template、local filesystem 表示 | 既存 UI module または対応する `browser/viewer_*.ts` | 各 UI が自分の表示状態だけを保持。map/camera の mutable reference を受け取らない |
| bootstrap / DOM binding / cleanup | `browser/viewer.ts` | factory の生成と接続、start/dispose。業務処理と共有可変 singleton を置かない |

移譲開始時に全154 let と可変 const の台帳を作る。各 entry は宣言、読者、書込元、寿命、生成/破棄、移譲先、移譲済み段階を持つ。state object を export しない。`Readonly<T>` だけで可変 Map/Set や入れ子を露出しないよう、read-only view / copy / 値取得を用途ごとに選ぶ。毎フレーム全 map を deep clone する設計も避ける。画面へ同期する順序は既存の command/notification 境界に保つ。

依存は `viewer.ts → factories → shared/rendering contracts`。子から `viewer.ts` を import しない。camera と render は互いの実装を import せず、bootstrap が小さな callback/interface を接続する。`deps: any`、全 viewer 関数を集めた service locator、循環 import、proxy での global state 隠蔽は不可。既存 dependency-cruiser の規則を再利用・拡張する。

### キー入力の保持条件

一覧表は chord と action の単純な対応だけでは足りない。IME、`defaultPrevented`、edit mode、structure drag Escape、誤った OS 修飾キー、各 UI の Escape、text entry、grab、read-only、routing、通常 command の現在の優先順序を保持する。`repeat`、`preventDefault`、focus return、keyup/blur による解除も契約に含める。

`viewer_keyboard.ts` の `keyboardPlatform` / `hasPrimaryModifier` / `nodeLabelEditAction` を再利用する。既存 shortcut 表示のラベル・表示条件を変えない。コマンド本体を巨大な新しい switch に移すことや、一覧表に巨大な inline callback を置くことを完了にしない。

### 描画・camera の保持条件

camera owner は fit target、clamp、anchored zoom、animation cancel、reduced-motion、同時入力、fit cycle reset と viewport 同期の時機を引き取る。構造整理では PR7 の修正後に受理された補間・開始時刻・描画・cache 更新の時機を保持し、修正前の300ms/cubicを復活させない。120ms trailing sync など修正対象外の時機も勝手に変えない。保存された座標の復元も owner の命令に統一する。

render owner は existing layout/node/edge の計算、cache invalidation、SVG retained geometry、WebGL snapshot 生成の順序を維持する。現状の SVG から WebGL snapshot を生成する経路を direct snapshot へ変更する最適化は別タスク。`renderScene` の state 正規化や scope reset を移す場合も、描画前後の副作用順序を characterization test で固定する。camera gesture で geometry upload が増えないという既存 runner の invariant を維持する。

## サーバー

### ライブラリの選定

Fastify は find-my-way の木構造 routing と prefix 付き plugin 登録を提供するため、Node HTTP/SSE 中心の現状と分野別移行に合う。`serverFactory`、`ready`、`reply.raw` / `hijack`、content-type parser を標準拡張点として使う。[Fastify Routes](https://fastify.dev/docs/latest/Reference/Routes/)、[Factory](https://fastify.dev/docs/latest/Reference/Server/)、[Reply](https://fastify.dev/docs/latest/Reference/Reply/)、[Content-Type Parser](https://fastify.dev/docs/latest/Reference/ContentTypeParser/)。

Hono は TrieRouter を明示できるが、現状の Node req/res と Fetch API の変換が増えるため今回は選ばない。Hono の標準を無条件に TrieRouter とみなさない。[Hono Routers](https://hono.dev/docs/concepts/routers)。Express の Router は分割できるが、今回の木構造選定の根拠では Fastify を優先する。[Express Routing](https://expressjs.com/en/guide/routing/)。2026-10-16 に公式資料を確認した。実装時は Node 22 と適合する Fastify/plugin version を lockfile に固定する。

### 配置と段階的移行

```text
beta/src/node/
  start_server.ts          起動・環境・終了
  start_viewer.ts          旧起動/import の薄い互換入口
  rapid_model.ts           既存モデル本体
  rapid_mvp.ts             必要な旧 export/CLI 互換だけ
  server/
    app.ts                共通設定と subrouter 登録
    context.ts            既存サービスの依存・寿命
    legacy_routes.ts      移行期間のみの旧振り分け
    routes/
      maps.ts             map CRUD、home 用 map 一覧
      agent_maps.ts       agent 操作
      collab.ts           認証、lock、heartbeat、collab SSE
      sync.ts             cloud sync
      backups.ts          conflict backup
      vault.ts            import/export/watch
      local_fs.ts         filesystem read/open
      clipboard.ts        system clipboard
      artifacts.ts        artifact 一覧とファイル
      flash.ts            ingest/draft/approve
      blueprint.ts        import
      ai.ts               AI status/subagent
      linear.ts           linear notes/transform
      observation.ts      map watch、presence、audit
      diagnostics.ts      resolve/layout/edge snapshot
      mcp.ts              既存 MCP service
      orrery.ts           既存 observation runtime/SSE
      static.ts           HTML、assets、compiled labs
```

既存 URL を変えず、同じ `/api/maps/:mapId/...` の下の分野も Fastify の明示 route に登録する。上記分類は route 所有の整理であり URL prefix の変更ではない。`app.ts` で URL を再 parse しない。1 route file に異なる分野を集めず、1分野の業務処理が増える場合は既存サービス側へ分ける。

最初は全未移行経路の既定処理に旧振り分けを置く。1分野ずつ Fastify route を登録し、その分野の旧 if と parser を除く。新 route の失敗を旧実装で再処理しない。末尾の unknown path/method も契約表どおりに終端させる。fallback が消えるまで完了にしない。

`createAppServer()` は同期で実際の `http.Server` を返し続ける。標準 `serverFactory` で Node server を生成し、最初の request が Fastify の登録完了を `ready()` で待つ案を小工程で実証する。ready rejection、listen 前の失敗、close callback、SSE shutdown、複数 instance、重複 cleanup を試す。既存 `orreryApi.attach` は server.close を変更するため、Fastify close hook との競合を重点確認する。独自の Server 互換 class、listen/close の場当たり的な差替え、Fastify internals への依存で埋め合わせない。標準拡張点で成立しなければこの段階を止め、Director に最小の gap を返す。

### HTTP 契約と raw HTTP

移行前に URL/method ごとの契約表を作る。query、encoded path、末尾 slash、static traversal、HEAD、未対応 method、空 body、不正 JSON、Content-Type、body limit、認証失敗、Origin/local-only、stream、cache/header を含める。Fastify default の自動 HEAD、JSON parse、Ajv coercion/default、404/body limit が現状と同じと仮定しない。

旧 build と新 build は別 process、別 temporary workspace、同じ sanitized 初期状態で実行する。期待値を新実装から生成してその新実装と比較しない。可変時刻等は事前に列挙した箇所だけ正規化し、error code、schema、map state、通知順序は隠さない。

一般 JSON は Fastify parser/validation/error hook に寄せ、入力値の新しい強制変換はしない。MCP/SSE は `request.raw` / `reply.raw` / `reply.hijack()` を必要箇所で使用する。raw body が必要な route は framework の body 消費を事前に避ける設定にし、二重読みしない。移行中の既定 route も body が消費済みの状態で旧 `readRequestBody` へ渡さない。SSE は event 名、payload、初回送信、heartbeat、disconnect cleanup と process shutdown を固定する。

`parseMapPath` のような製品の node path 解決や、perf の route label 正規化は HTTP routing と別責任。残存検査では名前一致を入口に実際の責任をレビューし、dispatch する parser は全廃、非 routing helper は適切に命名して残す。`orrery_api.ts` 内の pathname 分岐も新 route adapter に移し、見えない旧 dispatcher を残さない。

## 静的ゲート

ESLint の標準 `complexity` と `max-lines-per-function` を使う。独自の複雑度計算は作らない。AST 計測は既存 TypeScript/typescript-eslint parser を使い、`let` を文字列検索で数えない。`viewer.ts` の物理行数は `wc -l` 相当、改行で減らす圧縮は禁止する。

調査時点の17,202行、154 let は暫定値。実装開始時に source を再計測し、Director に差分を示して初期基準を封じる。全 source の初期例外は実計測から作成する。既存 CSV は下調べであり、一時ディレクトリへの依存を CI に持ち込まない。

ESLint の基準値・方針ファイル、性能比較器と policy（N/k/集約方法）、各段階のゲート目標値は Director 所有である。実装者（sol6.1）は変更を提案するだけで、自分で上限を上げたり基準を作り直したりしない。初期基準の生成案を含め Director が独立に実行・照合し、承認と合否判定を行う。実装者の自己検証をその代わりにしない。

| 対象 | 比較規則 |
|---|---|
| 新規関数 | CCN ≤20、ESLint 関数行数≤100 |
| 既存超過関数 | 各関数の CCN・行数が過去の上限以下。改善後は即座に下げる |
| 総違反 | 関数数・超過量を併記。新規違反と個別悪化を総量改善で相殺しない |
| viewer | 行数とトップレベル let の両方を非増加。終了時≤2,000 / 0 |
| 配置 | 対象13ファイルを初期確認。追加発見分も分類後に登録。src 内残存数を非増加、移動段階で減らす |
| 所有・依存 | 全 mutable state の owner 台帳、子→viewer import と循環依存の禁止、camera への直接書込の禁止 |

関数識別には path、symbol/closure 所属、正規化 AST の情報を使い、line 番号だけで識別しない。移動は旧→新の1対1対応をレビューして上限を引継ぐ。曖昧な匿名関数は自動で新規免責しない。分割された新規関数は通常上限を満たす。設定 `noInlineConfig` と検査対象 manifest を固定し、eslint-disable、exclude、移動先未収集による回避を防ぐ。配置移動後も例外台帳は移動先まで追跡する。

基準更新は人がレビューする source policy として commit する。測定 JSON や大量の runtime trace は commit せず CI artifact 等に保存する。更新 command は無条件 overwrite を提供せず、上限増加を拒否する。CI は候補 branch の policy だけで判定せず、検証対象の base revision に保存された基準と比較する。同じ変更で baseline を引き上げたり検査対象を外したりして自己承認できないようにする。初期導入だけは Director が現在値をレビューし、その後の更新は非増加を機械検査する。CI 自体が未収集・parse error・baseline 欠損なら失敗する。

DC17 の順序規則: PR7 が静的ゲートより先に統合された場合は、Director が PR1 統合時に修正後 source を再計測して初期基準を封じる。静的ゲートの後なら PR7 もゲートに従い、viewer 行数・let を増やさない。PR7 は挙動修正なので構造削減量の達成を目的に関数を移動・分割しない。既に固定済みのゲートを修正に都合よく引き上げる例外ではない。

### viewer 以外の巨大関数

初期実測で labs を除く製品 src の CCN 50超を一覧化する。server の既存 handler は routing 移行で、残りは tasks の専用段階で責任別に分割し、対象と分割後の関数を20/100以内にする。基準一覧を凍結し、関数の移動・rename・分割対応を追跡する。

調査用 CSV の例は `importBlueprintToAppState`（CCN85、ESLint行数422）、`copySubtree`（80）、MCP `mutate`（60）/`reconcile`（54）。`localTopicSuggestions` は45だが Director の明示指定により含める。入力正規化、対象解決、既存model命令、結果組立を分離し、独自の新しいparserや保存algorithmを導入しない。旧版/新版の同一入力による構造、順序、error、永続化、通知を比較する。labs はこの削減段階から除外するが、集計除外で製品関数を逃がさない。

## 性能検証と原因調査

### 計測環境と runner の不足

既存 runner は1440×900、device pixel ratio 1、1 context / 1 page、fixture hash、WebGL active、geometry upload 不変を確認する。これを維持したまま、後続のゲート工程で GPU renderer 記録・妥当性判定と結果比較を加える。既存 `webgl_pan_zoom_runner_contract.test.js` も守る。`--verify-only` は性能測定ではない。

`WEBGL_debug_renderer_info` など標準 WebGL の renderer/vendor と browser version を実測する。SwiftShader / llvmpipe / software renderer は無効。renderer が隠され hardware と立証できない、WebGL fallback、`longTasks.supported=false`、frame count 0、fixture不一致、未測定 status なら合格にしない。SVG 測定も同じ妥当な実機環境で行う。

まず実機 Chrome の `--browser-channel chrome` を使う既存 headless runner で確認する。hardware GPU が使えない場合は環境不足を RK1 として報告し、hardware GPU を使える実機で同じ runner・両 build・同一 fixture の全測定を行う。GUI runner を別作成しない。headed が必要なら既存 runner の限定拡張を別承認に出し、利用者の window に attach/keystroke 注入する回避はしない。

source revision、build artifact、実 server process の source、runner revision、fixture hash、OS、CPU/GPU、Chrome version、viewport、device scale、電源条件、background load、冷起動条件を記録する。runner 自身の Git 情報だけでは測定先 server の build を証明しない。

### 固定する集約と合否（DC10）

各 build を独立20回実行し、毎回 `--renderer both --warmup 2 --runs 5`。SVG/WebGL と pan/zoom の4群を混ぜない。各群の対象指標は `frames.p95Ms`、`frames.maxMs`、`longTasks.count`、`longTasks.totalMs`、`longTasks.maxMs`。各独立実行の値は同じ操作5回の最大値とする。

基準の20個の値を b、候補を c とする。中央値は中央2値の平均、MAD は `median(abs(b - median(b)))`（補正係数なし）、90パーセンタイルは nearest-rank の18番目。k=3。

```text
median(c) <= median(b) + 3 * MAD(b)
p90(c)    <= p90(b)    + 3 * MAD(b)
```

全4群×5指標で両方を満たすこと。MAD=0 なら追加幅0。全体最大値 `max(c)` は必ず報告し、`max(c)>max(b)` ならリスクとして残すが、Director の DC10 によりこの全体最大値単独は合否条件ではない。`frames.maxMs` 自体を検査対象から外すという意味ではない。

基準 build の20回から求めた上限を候補変更前に封じる。各段階で直前統合版を比較対象に加え、最初の受理基準も維持して小さな悪化の累積を検出する。後付けの外れ値除外、成功するまで再測定、k/N/fixture の変更、基準の引上げは禁止。環境無効は無効として全結果を保存し、条件変更は別提案にする。初期20回すら未測定なので、この文書に架空の ms 値は置かない。

### fit モーション修正トラックと A/B（DC17）

担当は fit の悪化を調査中の既存 Codex app スレッド。Director は基準・合否の独立判定を行い、構造整理担当は fit 修正を代行しない。PR1〜PR3 と別 worktree で並行し、同じ viewer logic を両担当が同時に変更しない。PR4 は修正の `dev-beta` 統合後、PR8 は修正後の受理された挙動から始める。統合・build/restart の排他は既存運用に従う。

#### 別スレッドから報告された観測と候補

出典は KeenBell の2026-10-16 23:37 JST の改訂依頼。報告時点でコード未変更。この文書作成担当は実測しておらず、以下は当担当の測定証拠でも原因確定でもない。

| 報告された観測 | 限界 |
|---|---|
| 30回/秒の頭打ちは一時的で、報告時点では60へ復帰 | 原因未確定。fit 修正の成功証拠にしない |
| 130%→23% の fit: 入力処理約13ms、WebGL再構築約33ms、補間300ms、入力から最終描画まで約385ms | 1秒の停止は未再現。区間の概数を足して厳密な総時間とみなさず、生traceで前後比較する |

元通知の4候補は次の内容で引き継ぐ。外部通知の候補接頭辞を本 spec の識別子として増やさない。

| 原因候補 | PR7 の修正・検証 |
|---|---|
| e2faa94 が開始時刻を再構築後へ遅らせ、`performance.now()` と frame時刻の混用で初回差分が0に丸められる | 変更前後・限定介入を測り、根拠を示して開始時刻の変更を復帰または修正。同じ時間基準で進行を算出 |
| camera 更新と WebGL 描画が別frameで予約される | 同一frameで描画できるか実測し、採否と副作用を記録。未検証のまま変更しない |
| 縮小中にtile再生成とcache全消去が走る | 移動終了後へ遅らせる。完了・cancel・新しい移動への置換時の処理を決め、欠け/古い描画/資源漏れがないことを検証 |
| 倍率を線形空間の `easeInOutCubic` で補間し、中央150msに123%→30%が集中する | 自作補間をやめ、直接依存 `d3-interpolate` の `interpolateZoom` を使う。関数移動・分割は混ぜない |

`interpolateZoom` の入出力は viewport 中心と幅の3値であり、camera translation/zoom をそのまま3値に渡さない。既存の fit 始点・終点・viewport から対応を確認する。補間器は推奨 duration も提供するが、採用する時間設定は修正前の比較基準とともに Director が事前に確認する。自作 easing を重ねて旧挙動を再現する代用はしない。[D3 の公式 zoom interpolation 契約](https://d3js.org/d3-interpolate/zoom)。

#### 比較・判定・引継ぎ

`e2faa94^` / `e2faa94` の独立 build による A/B と差分部位への介入を継続し、今回の修正前版/修正版の比較と区別する。後続 commit の影響、冷起動直後とwarmup後の違いも残す。診断用介入の結果を通常版の受入証拠に混ぜない。未再現の1秒停止や一時的30回/秒の原因まで確定したとは報告しない。

Inspector の各更新カウンターと、入力→最初の変化→終点描画の時刻、各frameの倍率/時刻を変更前後で保存する。camera 値を書いた時刻を終点の描画完了時刻として代用せず、描画観測の方法と限界を記す。130%→23%を含む元の操作を通常 Beta の実機Chrome/hardware GPUで確認する。目標座標、fit cycle、cancel、reduced-motion、SVG/WebGL、保存/API互換も保つ。約385msは単一の報告値であって新しい合否閾値ではない。Director が比較結果と通常Betaの動作を独立に判定する。

PR7 は PR2 完了を待たず進める。PR2 runner が利用可能なら DC6/DC10 の共通判定も必須にする。PR7 が先に統合された場合は、Inspector/実frame比較/通常Beta確認の結果と、PR2 比較が未実施であることを区別する。PR2 が利用可能になった時点で保存した修正前版と修正版を同一runnerで比較し、PR4 の着手前に Director が修正後の性能基準を受理する。旧基準と全結果も保持し、候補失敗を隠す基準引上げはしない。

PR8 は修正後の補間・開始時刻・描画予約・cache更新時機を characterization test と計測結果で保持する。原因と修正内容が説明できない、通常Beta未確認、適用可能な性能判定が未通過なら構造整理を進めたことで解決済みにしない。

## 配置整理と既存 seam

| 現在 | 移動先 / 保持する導線 |
|---|---|
| `src/node/*_test.ts` 7本 | `beta/tests/legacy-node/`。assert/process.exit 型を勝手に Vitest test に変換せず、専用 tsconfig と既存 Node 実行を npm script から収集。実行件数を前後照合 |
| `dogfood_run_02/03/04.ts` | `beta/scripts/dogfood/`。手動実行のみ。副作用を調べ、build が勝手に実行しない |
| `pj03_demo.ts` | `projects/PJ03_SelfDrive/scripts/`。source 冒頭の demo_skeleton 参照を確認済み。`demo:pj03` 導線を保持 |
| `pjv34_template_seed/runner.ts` | `projects/PJ04_MermaidSystemLangGraph/scripts/`。同 project の `docs/system_block_templates.md` の CLI Surface が旧 pjv34 command を互換入口として指定。既存 package command を保持 |
| `rapid_mvp.ts` | `rapid_model.ts` にモデルを移し、sample 生成と起動互換を別に保持。DB schema/API/公開 class alias は変更しない |

compile root / outDir、package scripts、test import、launch shell/bat、`__dirname` による data/static root、project script の相対 path を一緒に確認する。非製品 script を src から移しただけで実行不能にしない。参照を見ずに削除しない。

| 既存 spec | 再利用する現行 source / 試験 | この spec が担うこと / 持ち込まないこと |
|---|---|---|
| `layout-seam-lab` | `layout_port.ts`、layout golden/contract/composition、依存 gate | viewer の adapter を移譲。古い「viewer 内 layout」の現状記述を現在の事実としてコピーしない |
| `edge-port-seam` | `edge_port.ts`、`edge_route.ts`、`parent_child_edge_adapter.ts`、golden/composition | edge と GraphLink の既存分離を保持。新しい幾何 algorithm を足さない |
| `node-draw-seam` | `node_draw_svg.ts` / port、fragment golden、node lab | renderScene 統合時に再利用。folder preview 等の別責任を node draw に詰め込まない |
| `progressive-nav-seam` | `pn_layout.ts`、golden、workbench / pn lab、依存 gate | viewport event 順序を守る。旧 spec の UI 改善・layout 変更を構造整理に混ぜない |

旧 spec の未チェックを未実装の証明にしない。上表の source/試験は存在確認済みで、今回試験は実行していない。旧 spec には現在と異なる taxonomy（例えば過去の Radial）やパスがあるため、現在の canon と source に照合する。既存 spec を書き換えるのはこの文書作成の範囲外。後続で既存要件と対応する完了証拠を記録し、全体を一括完了にしない。

## 試験の現状と不足

`tests/unit` に API の実サーバー試験があり、ephemeral port と一時 SQLite で `createAppServer` を検証している。default Playwright は fixture server `14174`、E2E は real server `14173` を使う。どちらも試験前に製品 build が必要。専用 lab config は default と混ぜない。

既存の shortcut/keyboard、fit cycle/camera follow/resize、drag/pen、render update/WebGL、layout/node/edge、collab/cloud/vault/MCP の試験を守る。追加で必要なのは HTTP differential、state owner の資源破棄、IME/priority の表全体、scope 切替と古い非同期応答、起動互換、性能の妥当性・集約・失敗判定。新しい module の関数をそのまま真似た試験より、旧挙動との差を検出する試験を優先する。

## リスクと停止条件

| リスク | 対処・残る条件 |
|---|---|
| RK1 headless が software GPU | 無効。実機 hardware GPU の同一条件 A/B が取れるまで性能 gate は未通過 |
| RK2 fit修正と未再現症状の混同 | PR7の原因/介入/修正を独立判定。一時的30回/秒や1秒停止は未確定のまま残し、全症状の解消を断定しない。PR8は受理済み修正後の挙動から始める |
| RK3 Fastify の body/HEAD/ready/close が旧契約と異なる | 契約試験と標準拡張点の実証を先行。独自 wrapper が要るなら選定を再判断 |
| RK4 let 0 でも共有 mutable state が残る | 可変 const も台帳と依存検査で追う。factory 外の singleton を owner 移譲と数えない |
| RK5 非同期・イベント順序が変わる | 既存 order を characterization、複数 connection/cleanup と stale response を試す |
| RK6 性能中央値/p90 は通るが最大値が悪化 | 全体最大値超過を隠さず記録。DC10 の合否と体感の受入は区別 |
| RK7 配置変更で試験や CLI が収集外になる | 旧→新 file/command 一覧、実行件数、依存・build root 検査 |
| RK8 source が他作業で変化 | 最新 dev-beta と差分を再評価し、旧計測を新 source の証拠にしない |

実装時の source・artifact・worktree 配置は [repository-canon-values](../../../docs/protocols/repository-canon-values.md) に従う。測定ログ・generated report・個人 fixture は Git に入れない。
