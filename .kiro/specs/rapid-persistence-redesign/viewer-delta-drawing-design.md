# viewer の変更量に比例する描画更新の設計案

2026-11-25。対象は scopen / unscopen 後の描画。基準パスはリポジトリ root。本ラウンドは保存経路の修正とこの設計案までとし、描画コードは変更しない。

## 計測状況と境界

20,000 node の map で、選択した 1 node に `f` を入力し、2 回目の `requestAnimationFrame` までを DV2 とする。保存タイマー発火から Command 送信までの DV1 とは別である。

この実行環境では `node beta/tests/acceptance/delta_viewer_judge.mjs beta` が Chromium 起動時に停止した。原因は `bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer … Permission denied (1100)`。ブラウザ内の計測は開始していない。Playwright: **未実行（Director 依頼）**。約 8.2 秒という変更前の DV2 は依頼者の測定値であり、この session の測定値ではない。処理ごとの時間・割合・時間順の順位は未計測で、下表はソースを読んで確かめた実行経路と計測対象である。CPU profile を取得したとの主張はしない。

| 区間 | file:function | 確認した処理・計算量 | 今回の時間 |
|---|---|---|---|
| 編集直前 | `beta/src/browser/viewer.ts:makeSelectedFolder` → `pushUndoSnapshot` → `cloneState` | undo 用に map 全体を JSON 複製する。DV2 に含まれるが DV1 には含まれない | 未計測 |
| 保存対象の確定 | `beta/src/browser/viewer.ts:touchDocument` → `syncMapModelStateFromRuntime` → `sanitizeMapModelState` | scope / Surface View を正規化するため全 node を列挙。Surface View の node ごとの情報も全 node を確認する。scope ごとに relation edge も検索する | 未計測 |
| Layout の入力・配置 | `beta/src/browser/viewer.ts:buildLayout`、`beta/src/shared/layout_port.ts:layout` / `buildMeasuredTreeContext` / `TreeSpanCache.prepare` | scope 内の node を再帰走査し、寸法と Layout の入力を JSON 化する。cache があっても入力走査は残る。`TreeSpanCache.prepare` も毎回全子孫を訪れる | 未計測 |
| SVG の生成・反映 | `beta/src/browser/viewer.ts:renderScene`、`beta/src/browser/incremental_scene.ts:RetainedSvgScene.update` | scopen は `touchDocument(false, …)` → `render(false)`。`nodeSvgCache.begin(!incremental)` が cache を消し、`update(..., !incremental)` が `replaceChildren()` して全 fragment を再生成する | 未計測 |
| filter・範囲 | `beta/src/browser/viewer-filter-scene.ts:filterSceneInput`、`beta/src/browser/viewer.ts:sceneBox` | 全描画要素から filter の入力と全体の範囲を作り直す。範囲が markup から得られないと SVG の `getBBox()` を使う | 未計測 |
| SVG から WebGL への受け渡し | `beta/src/browser/viewer.ts:activateWebGLProjection` / `buildWebGLRenderSnapshot`、`beta/src/rendering/webgl_scene_tiles.ts:captureSvgPaintScene` | 次の frame で SVG の全図形・文字を列挙。`getComputedStyle`、`getBBox`、文字位置、変換行列を読み、描画情報を作る。scopen では incremental cache を使わない | 未計測 |
| WebGL の更新 | `beta/src/rendering/webgl_projection.ts:WebGLRenderingProjection.setSnapshot`、`beta/src/rendering/webgl_scene_tiles.ts:WebGLSceneTiles.setScene` | node の空間索引と ID 索引を全再構築。新旧全描画情報を JSON 化して照合し、`PaintIndex`、path の配列、node ごとの slot 索引を再構築する | 未計測 |
| 表示・送信 | `beta/src/rendering/webgl_scene_tiles.ts:WebGLSceneTiles.draw`、`beta/src/browser/viewer.ts:broadcastState` | WebGL の表示自体は viewport による culling を実装済み。ただし前段の全要素処理は残る。編集後の BroadcastChannel は map 全体を送る | 未計測 |

`render` の時間と `activateWebGLProjection` の時間は別に測る。`render` に包含される Layout、SVG、filter、範囲の時間を、親区間の時間に再加算しない。`setSnapshot` は projection の内数。保存成功後の `scheduleRender()` も全再描画を予約するため、入力から 2 frame の区間と保存成功後の区間を分けて報告する。

## orchestrator が実測する手順

診断専用スクリプトを `/private/tmp/delta-viewer-round2-profile.mjs` に用意した。acceptance ファイルは変更していない。このスクリプトは acceptance と同じ一時 workspace / map 生成とキー入力を用い、50 / 20,000 node でそれぞれ 1 回の scopen を CDP `Profiler.start` / `Profiler.stop` で記録する。保存タイマーからの時間も取得するが、合否は判定しない。診断結果を DV1 / DV2 の独立検収の代用にしない。

```sh
node /private/tmp/delta-viewer-round2-profile.mjs beta
node beta/tests/acceptance/delta_viewer_judge.mjs beta
```

出力された `.cpuprofile` を Chrome DevTools で読み、上表の関数ごとの self time と total time を記入する。minify された bundle の照合には独立した診断 build の source map を使う（`cd beta` 後、`node node_modules/vite/bin/vite.js build --config vite.config.mjs --configLoader runner --sourcemap`）。診断 build と通常 build の結果は混ぜない。ブラウザの style / layout / raster の時間は DevTools Performance の記録で別に調べる。ブラウザが実行可能な環境で、変更前・変更後を同じ Chromium、fixture、viewport、renderer、条件で計測する。

補助的に、既存の `beta/src/rendering/render_update_metrics.ts:renderUpdateMetrics` は render / projection / draw 等の回数と最大時間を記録している。`#board.dataset.editWork` も再計算数を持つ。ただし cache hit 前の走査やブラウザ内部の layout 時間を表さないので、これだけで変更量に比例すると判定しない。

## 変更量に比例させる設計案

| 対象 | 再利用する実装と変更案 | 更新する範囲・成立条件 |
|---|---|---|
| 編集内容の通知 | 保存側の書き込み箇所から、変更した node / edge / scope / Surface View と変更したフィールドを描画にも渡す。保存の確認によって描画の通知を消さず、別々に消費する | ID 不明、load、import、undo、Surface View 切替は全再構築。map の読みに Proxy を置かない |
| 寸法・Layout | `DerivedNodeCache`、`TreeSpanCache`、scope ごとの cache を維持し、変更 node の寸法、先祖の部分木の幅・高さだけを無効化する。全入力 JSON による照合を、変更通知による無効化へ置き換える | 幅・高さが変わらなければ先祖への伝播を停止。兄弟順序と部分木の集計値を保持し、移動した部分木への offset をまとめて適用する。可視範囲内の座標だけを必要時に展開する |
| SVG の部分更新 | `RetainedSvgScene.patch` と node / edge の既存 cache を使う。変更 node、配置が変わった node、その接続 edge、必要な defs だけを更新する | 全 `parts` の作成・全 ID の retain を毎回行わない。scopen は子孫の表示集合の追加・削除も通知する。単に `render(true)` に変えるだけでは、全走査は残る |
| SVG から WebGL の部分更新 | `captureSvgPaintScene(root, onlyNodeIds, true)` と `WebGLRenderingProjection.updateNodePaint` を使う。接続 edge と scope の追加・削除も扱えるよう既存の更新口を拡張する | 現在の `updateNodePaint` / `updateCommands` には slot 数・所有者が同じという制約がある。scopen で図形数が変わる場合にそのまま使わず、追加・削除と描画順を明示的に扱う |
| 空間索引・tile | `PaintIndex.replace`、`WebGLSceneTiles.updateCommands` と既存の node 空間索引を使い、追加・削除・移動だけを更新する。全描画情報の JSON 照合を廃止する | 変更前後の bounds と重なる tile だけを無効化する。現在の全 tile × dirty bounds の照合も、tile 座標から候補を引く形にする |
| culling | `WebGLSceneTiles.draw` の viewport culling を維持し、Layout 後の SVG / WebGL 用情報生成にも空間索引による範囲制限を適用する | viewport 外も、選択、検索、hit test、scope の出入りに必要な Topology と寸法を維持する。viewport と交差する edge、文字、影の余白を含める。culling で map 内容や scope の意味を変えない |
| filter・全体範囲 | `ViewerFilterScene` の索引と fragment ごとの bounds を保持し、変更分を更新する。全体範囲は集計木などで差分更新する | 最小値・最大値を持つ要素の削除や縮小にも対応する。毎回全 node を調べて集計値を検証する方式にはしない |
| 描画外の DV2 費用 | undo は変更前の値と逆操作を保持する方式を検討し、既存 snapshot の意味を保つ。正規化は書き込み対象と依存先だけに限定する。BroadcastChannel は変更通知と受信側の基準状態を使う | undo / redo の範囲、受信順序、欠落時の全取得を先に定義する。これらの修正は今回の範囲外であり、採用決定ではない |

scopen により多数の node が見えなくなる場合、その表示集合の差は大きい。Tree の寸法変更で多数の兄弟の絶対位置が変わる場合も同様である。「1 node の入力だから常に O(1)」とはしない。計算量は入力の変更、先祖への伝播、実際に変わる Layout、viewport に入る描画要素に比例させる。関係のない map 全体や非表示の scope を走査しないことを条件とする。

## 次ラウンドの確認条件

既存の描画経路のまま CPU profile を得て、上表の未計測欄を埋めてから変更対象を選ぶ。最初の候補は SVG 全再生成と WebGL 全再取得の解消だが、時間順位はまだ未確認である。差分描画と全再描画が同じ結果になることを、scopen / unscopen、改名、折り畳み、reparent / reorder、relation edge、undo、scope view、zoom / pan、viewport 外からの再表示で比較する。親 node のラベルが長くなり多数の配置が動く例と、非表示の scope の変更も含める。

DV1 の保存内容、409 の競合処理、404 の全 map 保存、scope view の制約を維持する。DV2 とロード時間は変更前後の実測で判定し、未測定値や cache の計算件数だけで合格としない。
