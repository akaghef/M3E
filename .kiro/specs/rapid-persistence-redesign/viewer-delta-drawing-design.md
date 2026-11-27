# viewer の差分描画経路

2026-11-27。基準パスはリポジトリ root。保存形式・scope・Surface View・Layout の意味は変更しない。本書は実装済みの経路と未達を分けて記述する。DV1 / DV2 の合格を表す文書ではない。

## 実装済みの更新経路

`touchDocument` の既知の node 変更を保存と描画で別々に消費する。保存の acknowledgement は scene を再生成しない。map の読み出しに Proxy は使わない。

| 区間 | 実装 | 現在の範囲 |
|---|---|---|
| undo / redo | `viewer_delta_state.ts` の record 単位の before image。逆方向も同じ write set を capture する | scopen / unscopen の入口が node と派生 scope / Surface View の write set を宣言する。従来の全 snapshot と混在可能。未知の操作・Concreteness は従来 snapshot |
| 正規化 | `viewer_delta_model.ts`。初回に node→incident relation edge、scope→relation edge / Surface View の索引を構築。既知 node の編集は対象部分木と影響先だけ更新 | Surface View の nodeViews は対象 node の項目のみ更新。relationIds の順序は全正規化と同じ。未知の変更・state の入替は全正規化 |
| Layout / SVG | `viewer_delta_scene.ts:StableScenePatch`。全再描画時に子集合と描画依存を保持。既知の編集では対象 node の依存、子集合、寸法を検査し、全対象の検査成功後に SVG fragment を patch | Tree で寸法・子集合・描画依存が変わらない更新。scopen / unscopen もこの判定を通る。キー・node ID・node 数による分岐はない |
| bounds | `SceneBounds` が既存ライブラリ RBush を使い fragment bounds を保持 | 更新対象を remove / insert。最小・最大の fragment が縮小しても正しい範囲を返す。不明な bounds は full path |
| SVG→WebGL | fragment 差し替え時に capture の所有者索引を更新し、対象 node の paint のみ取得 | 隠れた全 SVG は再表示せず、変更要素・祖先・既存 defs を一時的な sibling SVG へ複製し、同じ capture 関数で測定する。測定終了・例外時に同期的に除去する。CSS / geometry の実 browser 一致は Director 検証が必要 |
| WebGL | `paint_slots.ts` と `webgl_scene_tiles.ts`。安定 slot と描画順を分離。primitive の追加・削除でも他 node の slot / 空間索引を再生成しない | 変更前後の bounds と交差する cached tile を無効化。tile cache は既存の64枚上限。長い edge も RBush の矩形索引で query し、全 query で走査する overflow bucket を廃止。drag は dense 配列の index でなく stable slot を使う |
| edge 選択 | renderer が採用した record を Ref / GraphLink / 端点で索引化。対象だけ CSS 座標へ遅延変換 | 通常の node キー入力は edge scene を構築しない。非表示理由は問い合わせ対象の祖先だけ調べ、highlight は保持した要素参照だけを更新。全 record / 全理由の列挙は明示した診断 snapshot だけ |
| 入力・Agent node | modal 所有権は DOM の変更分で更新し、既に board に focus があるときは native focus を呼ばない。Agent node は保持した集合の件数で存在判定 | Agent node 集合は既知の node 書込みだけを更新し、未知の変更または state 入替で再構築。modal は同一 task 内の変更も `takeRecords` で確認 |
| BroadcastChannel | `viewer_delta_broadcast.ts`。write set の record と sender sequence を送る | 初回 request と sequence 欠落時だけ全 state を取得。重複を無視。保存後の savedAt 通知は空 patch |

同じ Layout の patch では既存 SVG / hit geometry / 全 node の座標を保持する。pan / zoom / hit test / search の既存入口は変更しない。WebGL は patch を受けた task で `present()` し、測定の2 frameの後へ描画を逃がさない。

## 全再構築へ戻る条件と未達

load / import / map 切替 / Surface View 切替 / write set 不明の場合は full path を保持する。さらに現実装は次の場合にも full path へ戻る。これは「全表示更新が O(変更量)」の未達である。

| 未達 | 理由・残る仕事 |
|---|---|
| 寸法変更、可視子集合変更、reparent / reorder | `buildLayout` と `TreeSpanCache.prepare` が全可視 node を走査する。部分木集計・兄弟列の prefix sum・lazy offset と viewport に限った座標展開は未実装 |
| rename / Style の変更 | 現在の描画依存判定で full path。alias 参照先、接続 edge、filter の変更依存を索引化して通知する必要がある |
| Tree 以外、component、preview、active filter、display root の変更 | 追加の描画依存をまだ差分化していない。意味や pixels を変えないため既存 full path |
| 大きい scope の relationIds | scope record が配列全体を所有するため、その scope を更新すると配列の再構成・順序合わせ・before image の費用が残る |
| scopen / unscopen 以外の undo | 多数の編集入口がまだ従来 `pushUndoSnapshot()` を使う。write set の宣言と逆操作への移行が残る |
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

DV1 / DV2 は `2/2 passed` を必要とする。visual は新規失敗ゼロを必要とする。Director の2026-11-27の実測で、基準 commit `c3f3138` は164通過・6 skipped・0失敗だった。ロード時間と50-node DV2も比較する。未測定値や構造試験の成功を実 browser の合格に置き換えない。

## 2026-11-27 の checkpoint と外部測定

Director が前回 checkpoint `f222810` を sandbox 外で測定した結果は、DV1 0.30 / 0.30 ms（比率1.0、PASS）、DV2 31.7 / 307.8 ms（比率9.7、FAIL）。同 checkpoint の全 unit は1,613通過・27 skipped・0失敗で、sandbox 内の vault-watch EMFILE は外では再現しなかった。これらは Director の測定結果であり、現在の変更後の合格を示さない。

その CPU profile にあった全 edge の座標変換、全 node の Agent判定、modal の全 DOM 検索、native focus、全 SVG の再表示を上表の経路へ変更した。50 / 20,000件の登録状態で、通常キー45回に対する scene 構築・座標測定・document 検索が0回となる回帰試験を追加し、同じ試験が前回実装では失敗することを確認した。部分 capture を25回繰り返しても node 所有要素は1件、SVG fragment の数は初回と同じで、一時 SVG は残らない。mock DOM での構造検証であり、profile の連続 toggle で見られた実時間の増加を解消したかは未確認。

残る Layout / viewport / 編集入口の差分化は上記「未達」の通り。次の Director 検証では DV1 / DV2、50-node latency、load、連続 toggle の時間と CPU profile、Playwright を取得する。
