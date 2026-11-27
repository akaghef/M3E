# viewer の差分描画経路

2026-11-27。基準パスはリポジトリ root。保存形式・scope・Surface View・Layout の意味は変更しない。本書は実装済みの経路と未達を分けて記述する。DV1〜DV4 の合格を表す文書ではない。

## 実装済みの更新経路

`touchDocument` の既知の node 変更を保存と描画で別々に消費する。保存の acknowledgement は scene を再生成しない。map の読み出しに Proxy は使わない。

| 区間 | 実装 | 現在の範囲 |
|---|---|---|
| undo / redo | `viewer_delta_state.ts` の record 単位の before image。逆方向も同じ write set を capture する | scopen / unscopen の入口が node と派生 scope / Surface View の write set を宣言する。rename / alias label / incoming edge label は property before image。edge color / port は link record。keyed state の子・兄弟追加は新規 leaf record・親の collapsed・挿入 slot・割り当てた order key。従来の全 snapshot と混在可能。構造的に未対応の操作・Concreteness は従来 snapshot |
| 正規化 | `viewer_delta_model.ts`。初回に node→incident relation edge、scope→relation edge / Surface View の索引を構築。既知 node の編集は対象部分木と影響先だけ更新 | Surface View の nodeViews は対象 node の項目のみ更新。relationIds の順序は全正規化と同じ。未知の変更・state の入替は全正規化 |
| Layout / SVG | `viewer_delta_scene.ts:StableScenePatch`。全再描画時に子集合と描画依存を保持。既知の編集では対象 node の依存、子集合、寸法を検査し、全対象の検査成功後に SVG fragment を patch | Tree で寸法・子集合・描画依存が変わらない更新。scopen / unscopen もこの判定を通る。キー・node ID・node 数による分岐はない |
| Grab の兄弟順序変更 | `viewer_delta_reorder.ts`。全描画時に親・子順・preorder と subtree span を保持し、交差した兄弟区間を rotation する | 右・左・下向き Tree の同一親の移動。対象部分木の座標・入射 edge・SVG順・paint順・WebGL hit geometry・bounds を更新。親 children 全体の splice / filter は行わない |
| Grab の before image / 配信 | `ChildOrderHistory` に上書きする children の slot を初回だけ記録。逆操作も同じ区間だけ読む | Grab 中の往復で元の順序なら保存しない。取消・Undo・Redo は区間を復元。送信は parent record 全体ではなく children 区間。未知の移動へ遷移する場合は変更前の全 snapshot を復元して従来経路へ戻る |
| viewport / SVG DOM | `svg_viewport.ts` が既存 RBush で fragment の世界座標を索引化し、viewport + 256 CSS px の範囲だけ live SVG に接続する | 画面外は切り離した SVG に保持。全 Layout・hit geometry・paint は保持する。pan / zoom は索引 query と mounted 集合の差分だけ。未知 geometry と defs / controls は接続を保つ。全 capture / full render は明示的に全 fragment を戻す |
| SVG 要素の保持 | `incremental_scene.ts` は [morphdom](https://github.com/patrick-steele-idem/morphdom) で fragment の DOM を差分適用する | 同じ node-hit 要素を animation / drag / full render の間も保持する。追加・削除・異種 tag は通常の DOM 変更。検証用の全再計算は既存 canonical renderer を維持 |
| Workbench の配置 | `viewer-filter-placement.ts`。パネルの追加・削除だけを監視し、ResizeObserver と既存 FrameInvalidation で配置の読取りをまとめる | board 内の map 変更はパネル再検索・同期 layout 読取りを起動しない。サイズをすべて読んでから style を書く |
| bounds | `SceneBounds` が既存ライブラリ RBush を使い fragment bounds を保持 | 更新対象を remove / insert。最小・最大の fragment が縮小しても正しい範囲を返す。不明な bounds は full path |
| SVG→WebGL | fragment 差し替え時に capture の所有者索引を更新し、対象 node の paint のみ取得 | 隠れた全 SVG は再表示せず、変更要素・祖先・既存 defs を一時的な sibling SVG へ複製し、同じ capture 関数で測定する。測定終了・例外時に同期的に除去する。CSS / geometry の実 browser 一致は Director 検証が必要 |
| WebGL | `paint_slots.ts` と `webgl_scene_tiles.ts`。安定 slot と描画順を分離。primitive の追加・削除でも他 node の slot / 空間索引を再生成しない | 変更前後の bounds と交差する cached tile を無効化。tile cache は既存の64枚上限。長い edge も RBush の矩形索引で query し、全 query で走査する overflow bucket を廃止。drag は dense 配列の index でなく stable slot を使う |
| edge 選択 | renderer が採用した record を Ref / GraphLink / 端点で索引化。対象だけ CSS 座標へ遅延変換 | 通常の node キー入力は edge scene を構築しない。非表示理由は問い合わせ対象の祖先だけ調べ、highlight は保持した要素参照だけを更新。全 record / 全理由の列挙は明示した診断 snapshot だけ |
| 入力・Agent node | modal 所有権は DOM の変更分で更新し、既に board に focus があるときは native focus を呼ばない。Agent node は保持した集合の件数で存在判定 | Agent node 集合は既知の node 書込みだけを更新し、未知の変更または state 入替で再構築。modal は同一 task 内の変更も `takeRecords` で確認 |
| BroadcastChannel | `viewer_delta_broadcast.ts`。write set の record と sender sequence を送る | 初回 request と sequence 欠落時だけ全 state を取得。重複を無視。保存後の savedAt 通知は空 patch |

同じ Layout の patch では既存 SVG / hit geometry / 全 node の座標を保持する。画面外の fragment は DOM から切り離すが、fit は全保持 fragment の bounds から計算する。選択した node が画面外でも、保持した fragment の存在と Layout で解決する。pan / zoom は camera 更新と同じ処理内で mounted 集合を更新する。WebGL は patch を受けた task で `present()` し、測定の2 frameの後へ描画を逃がさない。

## 全再構築へ戻る条件と未達

load / import / map 切替 / Surface View 切替 / write set 不明の場合は full path を保持する。さらに現実装は次の場合にも full path へ戻る。これは「全表示更新が O(変更量)」の未達である。

| 未達 | 理由・残る仕事 |
|---|---|
| 寸法変更、可視子集合変更、reparent と対応外の reorder | `buildLayout` と `TreeSpanCache.prepare` が全可視 node を走査する。兄弟間移動は交差した部分木だけ更新するが、大きい部分木の移動には全子孫の費用が残る。prefix sum・lazy offset と viewport に限った座標展開は未実装 |
| 寸法・Style・filter の変更 | 同寸法 rename と alias 参照の更新は差分化した。寸法が変わる rename、Style が edge / layout へ与える影響、filter の変更依存は未対応 |
| Tree 以外、component、preview、active filter、display root の変更 | 追加の描画依存をまだ差分化していない。意味や pixels を変えないため既存 full path |
| 大きい scope の relationIds | scope record が配列全体を所有するため、その scope を更新すると配列の再構成・順序合わせ・before image の費用が残る |
| scopen / unscopen と対応する Grab 以外の undo | 多数の編集入口がまだ従来 `pushUndoSnapshot()` を使う。Grab の Undo / Redo・取消・受信描画は同じ区間 plan を使う。rename / alias label / incoming edge label・keyed state の子/兄弟追加・一部の edge 編集以外の write set 宣言が残る。挿入の履歴は局所化したが、挿入時の Layout・正規化・配信はまだ full path |
| load 時の負荷 | live browser の比較を未実行。bounds と所有者索引の構築分を含め、悪化しないことを Director が計測する |

## 検証

`?deltaDebug=1` で、差分編集直後の SVG markup と Layout を全再構築結果と比較し、不一致を例外にする。通常動作では全比較しない。DOM / GPU / hit test の一致は実 browser の検証を別途必要とする。

`webgl_scene_tiles.test.ts` は50 / 20,000 node の paint 数を増減させ、対象 slot だけ更新し `setScene` を呼ばないことを検査する。同じ試験を基準 commit `c3f3138` の実装に当て、3件とも全再構築呼出しの assertion で失敗することを確認した。長い edge の viewport query の2試験も、基準では画面外の paint を50 / 20,000件読むため失敗し、変更後は0件となった。試験用の一時 source は削除済み。

`viewer_delta_scene.test.ts` は同寸法編集の依存参照・寸法取得・描画が1件ずつであること、Layout が既存 full algorithm と一致すること、後続対象の不一致で部分適用しないこと、bounds の縮小を検査する。`viewer_delta_model.test.ts` は正規化と undo を全正規化と比較する。`viewer_delta_state.test.ts` は局所 before image、逆操作、BroadcastChannel の欠落・重複回復を検査する。

browser: **未実行（Director 依頼）**。実行位置は `beta/`。

```sh
npm run build
node tests/acceptance/delta_viewer_judge.mjs .
npx playwright test
```

R3 で judge に DV3 / DV4 が加わった。DV1 / DV2 / DV4 がこの作業の確認対象で、DV3 の保存差分構築は STORE worker の担当。統合時は全4項目の判定を確認する。visual は retries=1 で、基準 commit `c3f3138` の72 unexpected のリスト外に失敗がないことが条件。基準の0失敗という以前の報告は Director が R3 で訂正した。flaky は retry で通過したものとして unexpected に含めない。ロード時間と50-node DV2も比較する。未測定値や構造試験の成功を実 browser の合格に置き換えない。

## 2026-11-27 の checkpoint と外部測定

Director が前回 checkpoint `f222810` を sandbox 外で測定した結果は、DV1 0.30 / 0.30 ms（比率1.0、PASS）、DV2 31.7 / 307.8 ms（比率9.7、FAIL）。同 checkpoint の全 unit は1,613通過・27 skipped・0失敗で、sandbox 内の vault-watch EMFILE は外では再現しなかった。これらは Director の測定結果であり、現在の変更後の合格を示さない。

その CPU profile にあった全 edge の座標変換、全 node の Agent判定、modal の全 DOM 検索、native focus、全 SVG の再表示を上表の経路へ変更した。50 / 20,000件の登録状態で、通常キー45回に対する scene 構築・座標測定・document 検索が0回となる回帰試験を追加し、同じ試験が前回実装では失敗することを確認した。部分 capture を25回繰り返しても node 所有要素は1件、SVG fragment の数は初回と同じで、一時 SVG は残らない。mock DOM での構造検証であり、profile の連続 toggle で見られた実時間の増加を解消したかは未確認。

残る Layout / viewport / 編集入口の差分化は上記「未達」の通り。次の Director 検証では DV1 / DV2、50-node latency、load、連続 toggle の時間と CPU profile、Playwright を取得する。


## R3 の変更と再検証条件

Director の `c67d593` 測定は unit green（sandbox 外）、Playwright expected 179 / unexpected 59 / flaky 4。基準は167 / 72 / 3。基準の15失敗が解消した一方、`scatter_surface.spec.js:117` と `scope_layout_diff.spec.js:42`（svg）に2件の新規失敗がある。前者は drag 後の SVG node-hit の boundingBox が null、後者は ArrowRight 後も root 選択のまま。提供された assertion には browser pageerror・renderer 状態がなく、原因は未確定。今回の変更による解消も未確認。テストの renderer 指定や合否条件は変更していない。

同測定の DV1 は0.3 / 0.2 ms（PASS）、DV2 は31.8 / 188.4 ms（FAIL）、DV3 は0.6 / 643.8 ms（FAIL、STORE 担当）、DV4 は31.2 / 3693.6 ms（FAIL）。提供 profile の focus 134 ms は profile 開始後190.6〜324.7 msの1回だけで、連続 toggle 全回の median を説明するものではない。focus を編集前に行い、部分 capture stage から camera transform / will-change を外したが、効果は browser 再測定が必要。

Grab は全 map clone と JSON stringify 比較を、変更した children 区間の履歴へ置き換えた。同一親・対応方向・通常 Tree・GraphLink なし・component / preview / active filter なしの場合、移動時と M 解放時の full render を省く。全体 Layout と違う意味を作らず、既存 subtree span と子間隔で移動量を算出する。in-place更新したLayoutは旧topology keyのcacheから破棄し、取消・Undoで移動後の座標を再利用しない。全描画での node extent と layout extent を別々に保持し、移動した極値が縮む場合も全再描画と同じ canvas 領域を計算する。Concreteness の非ゼロ level と未対応の移動には従来 snapshot を使う。

構造試験では50 / 20,000 nodeの兄弟移動で2 nodeの位置だけを読み書きし、変更しない末尾 nodeの位置読取りは0。右・左・下方向の異なる寸法の部分木で全 Layout（座標・順序・領域）が全再計算と一致した。before image・逆操作・配信でも無関係な children slot の読取りは0。SVG順序変更の追加・除去は各2要素で、無関係な DOM identity を保持する。WebGLの再編集後の描画順序と移動後のhit位置も unit で確認した。これらは実 browser の画素一致や実時間の証明ではない。

Director の再実行位置は `beta/`。まず新規回帰2件を再実行し、失敗時は `pageerror`、console error、`#board` の `data-renderer` / `data-render-pending`、`#canvas` の hidden、activeElement を採取する。その後 judge と全visualを実行する。

```sh
npm run build
npx playwright test tests/visual/scatter_surface.spec.js tests/visual/scope_layout_diff.spec.js --retries=1
node tests/acceptance/delta_viewer_judge.mjs .
npx playwright test --retries=1
```

`?deltaDebug=1` を使った兄弟間移動・取消・Undo / RedoのSVG / Layout一致確認も必要。ブラウザー: 未実行（Director 依頼）。全体の表示更新を viewport + O(変更量) に限定する目標は未達のままである。


## R4 の外部測定と変更後の検証境界

Director の `00e11a1` 実測は DV1 0.2 / 0.2 ms（PASS）、DV2 32.4 / 168.3 ms（比率5.2、FAIL）、DV3 0.2 / 62.6 ms（FAIL、STORE worker 担当）、DV4 32.4 / 181.6 ms（比率5.6、FAIL）。前述の scope_layout_diff の svg 回帰は再実行で通過し、Director が flaky と確認した。scatter は edge endpoint の boundingBox が null で失敗した。

提供された scatter trace では失敗前の canvas は hidden ではなく、SVG アニメーションで node-hit が毎回差し替わる経路を確認した。変更後は morphdom で node-hit の identity を保持する。25フレームの位置更新・node追加・edge追加を通じて endpoint の同一性と接続を検証する unit は、旧 `00e11a1` の `RetainedSvgScene` に当てると失敗し、変更後は通過した。これは参照が切れる原因への回帰試験であり、元の Playwright が通過したという報告ではない。

viewport の構造試験は50 / 20,000 fragmentの同じ画面範囲で接続数がともに5件。pan反復でboundsの再計算は0、画面外1件のpatchでbounds取得は1件。全capture中は一時的にvirtualisationを停止し、captureが終わる同じtask内でviewportへ戻す。切り離したfragmentの部分paint取得・描画順・再接続時の要素同一性も検証する。fitとWebGL fallbackは全保持データを維持する設計だが、実ブラウザーでの確認は必要。

テスト実行中、一度アクセスしたlive HTMLCollectionをjsdomがDOM変更ごとに再列挙し、20,000件のmaterialize試験が30秒で失敗した。jsdom実装と段階計測で観察処理の二乗時間を確認し、同じ接続数を静的な一覧で数えるようにした。件数・同一性のassertionと30秒の制限は変更していない。変更後のviewport4試験は約1秒で通過した。

全mapの初期構築・full capture・active filterの変更は全fragmentを一時的に接続する。保存された意味や画素を変えずに既存処理へ渡すためで、これらのload時間と50-node latencyもDirectorが再計測する。寸法変更・巨大部分木のlazy offset・対応外のUndo/受信描画は引き続き未達。browserは未実行（Director 依頼）。R3と同じコマンドでscatter、judge、全visualを再実行し、viewport境界を跨ぐpan/zoom、画面外nodeの検索・fit、scope入出、WebGL fallback、deltaDebugの一致を確認する。


R4 checkpoint のローカル検証は build 成功、全unit 1,638通過・27 skipped・2失敗。失敗は既存vault-watchのEMFILE（2 unhandled error）で、viewport試験の途中失敗は最終runで解消。新しい依存 `morphdom` があるため、別checkoutでの再実行は `npm install` を先に行う。viewer.tsは17,592行（基準17,593行）。


## R5 の統合と再検証条件

Director の `2b70fcd` 測定は DV1 0.4 / 0.5 ms、DV2 31.9 / 32.5 ms（比率1.0）、DV4 31.9 / 32.9 ms（比率1.0）が PASS。DV3 0.7 / 61.4 ms は FAIL。全unitは1,640通過・27 skipped・0失敗。visualは181 expected / 59 unexpected / 2 flakyで、darwin snapshotの不足2件は基準snapshotで通過し、画素一致が確認された。残る新規回帰は concreteness_axis.spec.js:89 の scope 復帰直後の hit target 欠落。これは変更前の Director 測定であり、R5 の測定ではない。

`codex/delta-all` を merge し、parent edge の order key を保持する保存経路と retained geometry / range undo を両立させた。Grab が書き換えた edgeOrder は field before image に含める。連続した新規隣接 node に order key が付く場合も、その block だけを履歴に含める。往復して元の配列順へ戻った場合は元の key も戻す。保存用 edges hint を AppState の collection として配信しない。

保存基準の children は order key の索引から遅延構成される。受信した children slot をその getter の戻り値へ書いても基準は更新されないため、`SaveStateTracker.acceptExternal` で changed edge の索引を更新し、基準側の slot 書込みを省く。ローカルの dirty 集合は消去しない。50 / 20,000 の試験で、基準の全 children getter を読まずに、peer 順序反映後の保存・次の移動が同じ順序になることを検査する。

scope 切替は anchor に合わせた旧 camera から新 scope の fit へ動く。viewport は移動開始時点で現在位置と移動先を別々の RBush query として取得する。間を囲む巨大な矩形は作らず、途中の frame では現在位置を更新し、終了時は移動先だけに戻す。50 / 20,000 fragmentの遠距離移動で接続数はともに開始時7件・終了時3件、移動先の hit 要素は同一、途中区間の接続と bounds 再取得は0。元の browser regression の通過は未検証。

兄弟順序の Undo / Redo・取消・BroadcastChannel 受信は、retained Tree の旧順序と受信 slot から同じ区間 plan を作って描画する。50 / 20,000 の3兄弟順序変更で、遠い node の座標読取りは0で全再計算 Layout と一致する。大きい部分木の全子孫を訪ねる費用はまだ残る。

rename / alias label / incoming edge label は node の field before image を持ち、children 全体を複製しない。alias 参照は target 別の索引で取得する。親・scope の状態が変わらない正規化では子孫を訪ねない。同寸法 rename は既存の measure / renderNodeSvg を使い、子集合の同一性が field patch から分かる場合は子配列を読まない。scope の relationIds が大きい場合の配列再構成、寸法変更、Style、active filter、未対応の編集入口は残る。

同期からの差分描画には server 側の変更が必要。現在の `beta/src/node/start_viewer.ts:broadcastMapUpdate` は mapId / savedAt / sourceTabId / synchronized しか送らず、viewer の `applyExternalUpdate` は全 payload を取得する。既存通知から変更 record を復元できない。server の commit / sync 適用結果から changed records と連続性を確認する revision を渡し、初回・欠落だけ全取得する契約が必要。`beta/src/node/` はこの worker の編集禁止範囲なので、今回は変更していない。viewer 側で全 payload を diff して差分と称する回避は行わない。

部分 capture の20,000件試験が一度30秒を超えた。既存の試験が root.children の live HTMLCollection を観察した後に20,000要素を切り離すため、jsdomが各変更でそのcollectionを再構築していた。同じassertion・30秒制限を保って静的な子一覧を観察するようにした。単独5試験は約5秒で通過。判定条件や対象件数は変更していない。

browser: **未実行（Director 依頼）**。基準パスは repository root。`beta/` で以下を実行する。

```sh
npm run build
npm run test:unit
npx playwright test tests/visual/concreteness_axis.spec.js --retries=1
node tests/acceptance/delta_viewer_judge.mjs .
npx playwright test --retries=1
```

加えて `?deltaDebug=1` で同寸法rename・alias label・Grab・取消・Undo / Redo・別タブ受信、camera移動の開始・中断・終了時の描画とhit testingを確認する。現在のcheckpointは全経路の完了ではない。寸法変更のlazy offset、大きい部分木の移動、構造操作などの残るUndo入口、server同期通知の契約を継続する。


R5 のローカル結果: `npm run test:unit` は1,675通過・27 skipped・2失敗（既存vault-watchのEMFILE、2 unhandled error）。build:testと全typecheckは成功。最終のmetadata正規化変更後の関連42試験も通過した。viewer.tsは17,561行。autosaveの関数抽出試験へ実AliasIndexを接続して依存不足の8失敗を解消し、部分captureのtimeoutも最終runで解消した。全unitの成功を報告するにはDirector環境で既存watch試験を含む再実行が必要。


## R6 の回帰調査と挿入履歴

Director の `1387f96` 実測は DV1〜DV4 が4/4 PASS（DV4 31.4 / 47.7 ms、比率1.5）、DJ1〜DJ5が5/5、localが16/16、unitが1,677通過・0失敗。visualは190 expected / 51 unexpected / 1 flaky。新規の失敗2件は本roundの受入完了を妨げている。

`scope_plane.spec.js:52` の7件は新規 node の未描画ではなく、scope退出のcamera移動先に接続したSVGを見て操作が進み、直後のTabがcameraを途中のzoomで停止させてrootを切り離す状態として、実際のviewerを起動するjsdom診断で再現した。ノード作成前にpending cameraの移動先を確定してから、既存のanchor保持とnudgeを行う。ブラウザーのfont/geometryを再現したという主張ではない。`viewer_scope_edit.test.ts` は固定geometryと手動animation frameで同じscope移動・Tab/Escape・Undo/Redoを通し、camera確定を外すnegative controlではrootが欠けて失敗する。

`scope_layout_diff.spec.js:37` の最初の右矢印でroot選択が残る件は未解決。fixtureを正規化した起動、Workbench付きの起動でもjsdomでは再現しなかった。提供済みerror-contextだけでは入力の消費と描画中の例外を区別できない。Directorのpageerror/console errorまたはtraceが必要であり、推測だけの修正は加えていない。

`captureNodeInsertion` は追加前のleaf不在、親collapsed、挿入slotを保持し、Undoの削除長とRedoの挿入長を反転する。既存の上書きrangeとは区別し、appendは末尾だけを読む。`assignInsertionOrder` は既存 `SaveStateTracker.markParentEdge` を呼び、その際にkeyが付く未保存の隣接leafもfield履歴へ含める。キーが無い旧baselineとConcretenessは従来snapshotを使う。子追加/兄弟追加の共通処理をまとめ、viewer.tsは17,561→17,555行（初期上限17,593）となった。

50 / 20,000のappend履歴、逆操作、peer配信は無関係なchild slot読取り0。中間挿入で後続兄弟が残ること、作成保存の前後どちらからもUndo/RedoのCommandを適用できること、隣接leafのkeyの有無を復元することを検査する。挿入時の全正規化・全Layout・初回の全配信、寸法変更と巨大部分木のlazy offsetは引き続き未達。serverの差分通知は別担当の変更待ちで、node側は変更していない。

browser: **未実行（Director 依頼）**。まず `beta/` で次を実行し、最初の右矢印が失敗したtraceとpageerrorを返す。その後、全judgeと全visualを独立再実行する。

```sh
npx playwright test tests/visual/scope_layout_diff.spec.js tests/visual/scope_plane.spec.js --retries=1 --trace=on
node tests/acceptance/delta_viewer_judge.mjs .
npx playwright test --retries=1
```

R6 checkpoint のローカル結果は build成功、全unit 1,682通過・27 skipped・2失敗（既存vault-watchのEMFILE、2 unhandled error）。最後のConcreteness guard後の関連30試験は全通過。右矢印回帰とブラウザーの修正確認、lazy offsetなどの未達は残っている。
