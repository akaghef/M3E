# OT 力学 Seam Lab 仕様

2026-09-17。状態: **Lab実装仕様確定**。製品採用・PJ08 Phase遷移の決定ではない。
Source: [この会話](codex://threads/01a0a47f-b5ea-7961-b5c9-6c8679c3892a)。
既存調査の原文は [seam-lab-audit](2026-09-17_seam-lab-audit.md)。
PJ08 の「同じmap面で全体像を把握する」目的と farthest_goal の RQ5 に寄与する。

## 要求と範囲

- RQ1（ユーザー）: 現行forceの挙動に不満があり、OT実装で力学Labを組み直して完了させる。
- RQ2（ユーザー）: collapseはTreeと同義。対象ノードを残し、子孫を隠す／再展開する。親子関係・データは変更しない。
- RQ3（ユーザー）: parameterは常時表示しない。Viewer Panel自体の再設計は保留。Add Childなど編集actionの配置問題も今回解かない。
- RQ4: Labと将来の製品が同じDOM非依存の力学seamを使える。Lab独自の力学計算を持たない。
- RQ5: 通常Viewer、既存WebCola、実map、DB、runtime observationは変更しない。ADR_012のWebCola採用は製品上そのまま。OTは今回Labで評価する別実装。
- RQ6（2026-09-22、ユーザー）: SVGだけでは重いため、力学Labの通常経路はWebGL描画にする。製品接続の判断は別に維持する。

## 今回の実装判断

以下はユーザーの逐語指定ではなく、仕様確定・実装の委任を受けた判断。

- DC1: `Radial`と`Disperse`を同じエンジンで評価する。Radialのばねは親子edge＋GraphLink。DisperseのばねはGraphLinkのみ、親子は包含で表す。新しいSurface Viewやcluster subtypeを作らない。
- DC2: 各ノードは中心座標＋可視内容全体の矩形寸法を持つ。hover overlayは衝突矩形に含めない。ズームは寸法を変えない。矩形間の最小間隔は既存normalに合わせ16 map単位。
- DC3: Disperseのgroupは子孫を囲う自動伸縮矩形。親ノードも独立ノードとして内部に残す。見出し領域28、padding24 map単位を確保する。親子groupの包含は許可、兄弟groupと非所属ノードの侵入は禁止。手動resizeは実装しない。
- DC4: 斥力は可視ノード間に適用し、group自身へ二重に斥力を与えない。GraphLinkのばねは実端点の距離で計算し、端点の最小共通祖先の直下にあるbranchの可視メンバーへ均等配分する（共通祖先自身が端点ならそのノードだけ）。groupごとに内部重心への弱い凝集力 `.025` を加え、外部リンクによる箱の無制限な伸長を防ぐ。親子edgeのばねではない。衝突解消時は兄弟groupを剛体移動し、内部の相対座標を保つ。pinを含むgroupはその衝突解消で動かさない。最小16単位に追加1単位の余裕を取って接触連鎖の漸近残差を防ぐ。解消不能なら制約違反を明示し、成功扱いしない。
- DC5: collapse後は元の親ノードIDと通常寸法を維持し、子孫をsimulation対象から外す。内部リンクは隠し、外部GraphLinkは可視代表へ集約する。ばね定数は集約元の重みを加算する。親子edgeとGraphLinkは別集約。展開時は保存した相対位置へ戻し、親が移動した分を追従させてから再加熱する。元の関係・IDは書き換えない。
- DC6: drag中は一時固定。終了後は元のpin状態へ戻す。永続pinは別操作。group dragは可視子孫をまとめて移動し、所属変更は起こさない。Labのpinはセッション内のみ。
- DC7: OTの斥力・ばね・中心引力・減衰・速度制限・二段冷却・5フレーム収束判定を型付き入力へ移す。60Hz固定stepで駆動し、再加熱は240stepまで。予算停止と収束停止は区別する。制約違反が残ればblocked。完全同座標には決定論的な分離方向を与える。
- DC8: 世界の引力中心は固定 `(0,0)`。OTのviewport依存clampは移植しない。pan/zoom/resize/設定panel開閉で力学状態は変えない。fitは明示操作。非表示tabでは時計を止め、復帰後に時間を追いかけない。
- DC9: 調整は斥力KR、リンク自然長L、ばね定数KS、中心引力GR。OT既定値2600/110/.012/.012と範囲を採用する。変更は現在位置から再加熱する。設定を戻す操作と配置をリセットする操作は別。Lab設定はlocalStorage等に保存せず、reloadでfixture既定へ戻る。
- DC10: 一時的な折り畳み式Lab調整領域を使う。これはViewer Panelの最終デザインではない。開閉はsimulationのstart/stopに関与しない。
- DC11（2026-09-22）: 既存M3EのWebGL2 rendererを`src/rendering/`へ共有化し、Viewerのimportは互換入口で維持する。Labはforce snapshotから直接描画snapshotを作り、SVGやViewer内部を経由しない。ノード・文字・GraphLink・親子edge・group枠と見出し・固定表示をGPUへ送る。
- DC12: 文字画像は内容・寸法・styleの変更時だけ再生成する。位置更新では再利用し、atlasは複数ページへ分割して容量超過による文字の無言欠落を避ける。pan/zoomはcamera uniformのみを更新し、位置や文字を再送しない。
- DC13: WebGL不可・context lossではエラー表示して力学を止める。無言でSVGへ切り替えない。context復旧では同じ位置とcameraを維持する。`?renderer=svg`は明示的な比較経路であり、通常WebGLの裏にSVGを生成しない。
- DC14: HTMLのノード選択欄とCanvas上の矢印・C・Pキーで選択・折り畳み・固定を維持する。選択欄の項目は可視ノード構成が変わったときだけ再構築する。

## 型付き契約と所有権

`beta/src/shared/force_seam_interface.ts` が入力・出力・command契約。
`beta/src/shared/ot_force.ts` が唯一の計算・可視縮約・制約解消実装。

入力: stable ID、parentId、GraphLink、中心座標、幅・高さ、pin、mode、parameter。
出力: 可視ノードの座標・寸法、可視代表リンク・重み、group矩形、実行状態、step数、制約違反。
操作: step、parameter変更、mode変更、collapse、pin、drag開始／移動／終了、pause、reheat、配置reset。

seamはDOM、requestAnimationFrame、viewport、storage、network、Viewer、Reactに依存しない。
Labは描画adapter、camera、入力、60Hz schedulerを所有する。共有WebGL rendererはGPU資源のみを所有する。共有map・undo・永続化は所有しない。
rollbackはLab route/index登録を外すだけ。製品の既定経路に変更はない。
hotPathSafe=false: 有限入力のO(N²)力計算と有界制約反復。性能保証はLab fixture最大100ノードまでで測定する。
2000ノードfixtureは描画だけの負荷確認用であり、力学計算を生成・実行しない。WebGL化を力学計算の高速化とは主張しない。

## 出典

upstream: `gyroid-eth/orrery-telemetry`、commit `22ffe6483530e643c8fc1af486319990e0181de4`。
OT Component Seam Labsが保持する`step` / `runSim` / tuning定義を移植元にする。
出典・変更点・ライセンスは `beta/src/labs/force/NOTICE.md` に記録する。
矩形衝突・group包含はOTに元からあったと主張しない。M3E用の追加制約である。

## テストと受入条件

- 正常: 同一入力の決定論性、parameter変更の効果、Radial/Disperseの関係差、大小矩形・入れ子groupの非重複と包含、collapse/展開時のID・関係・相対座標、drag/pin、pause/reheat/収束/予算停止。
- 境界: 完全同座標、単一・空・非連結グラフ、100ノード、ゼロばね/引力、急なparameter変更、入れ子collapse、group drag。
- 失敗: NaN/Infinity、負の寸法、重複ID、cycle、不在端点、不正parameterを拒否。両側pinで衝突する場合はblockedとして報告する。
- ブラウザ: source build後のLab画面、調整領域開閉、parameter変更、pause/reheat、collapse/展開、drag/pin、Radial/Disperse切替、pan/zoom/fit、幅変更、error consoleとnetworkを検査。スクリーンショットを目視する。
- 単体テストだけで画面合格としない。見えないnode/label/link、空の枠だけの表示は不可。

## 未対象

製品Viewerへの昇格、Viewer Panel再設計、設定の製品永続化単位、PC等の属性group、group resize、意味型ごとのばね調整、巨大グラフの性能保証、第三者による動作感承認。
Labの実装完了は製品統合完了・人間の動作感承認を意味しない。

## 実装・検証記録（2026-09-17）

Lab実装完了。`beta/`で`npm run lab:force`を実行し、
`http://127.0.0.1:14279/src/labs/force/force-lab.html`を開く。
Seam Labs一覧からも到達できる。新規依存はない。

| 検査 | 今回の結果 |
|---|---|
| `npx vitest run tests/unit/ot_force.test.ts` | 12件成功。正常fixture3種を両modeで評価。有限座標、矩形非重複、包含、初期extentに対する過大な伸長の回帰も検査 |
| `npm run typecheck` | 全6設定成功 |
| `npm run lint:deps` | 134 modules / 281 dependencies、違反0 |
| `npm run build:browser` | 成功。force HTML/JS/CSS、source noticeを含む |
| 実ブラウザ | macOS・Chromium、production previewで実施。初期12 nodes / 4 groups / 7 GraphLinks、Radialではgroupなし・親子edge9本追加。100ノード表示と停止を確認 |
| 操作 | 調整開閉で状態不変。自然長110→400で位置が変化し再停止。設定resetと配置resetの独立、pause/reheat、collapseで12→8→12、pin維持、node/group dragを確認 |
| camera | pan/zoom/fit/760px幅へのresizeで力学snapshot不変。1280pxと760pxの画面を撮影・目視 |
| 失敗表示 | pin同士の衝突は`blocked`・違反1。キーボードで選択してpin解除後、違反0へ復帰 |
| 依存・配信 | productionの一覧→force HTML/JS/CSS等5requestはすべて200。外部API/DB呼び出しなし。最終production sessionと開発サーバーの新規sessionでconsole error/warningとも0 |
| 原文保存 | 会話の回答とMarkdownを機械比較し一致（末尾改行を除く、6,682文字） |

目視で見つかった「groupが横に伸び続ける」不具合をDC4のbranch単位の力配分・凝集力で修正した。
最小間隔の漸近残差、sliderのlabel対応、drag時のネイティブ文字選択も修正した。
スクリーンショットはworktreeの`output/playwright/force-*.png`に保存したローカル検証成果物で、commit対象に含めない。

既定の入れ子fixtureと100ノードfixtureは、違反0で240stepの**予算停止**になる。
全fixtureが物理的な平衡へ収束した、とは主張しない。自然長400の入れ子fixtureでは収束停止も確認した。
Windows実機、全製品回帰suite、通常Viewerへの接続、非表示tab復帰の実ブラウザ試験は未実施。
今回の完了対象はこの独立Labであり、次はhumanによる動作感確認。その後の製品接続は別判断とする。

## WebGL化の検証記録（2026-09-22）

通常経路をWebGL2へ変更した。SVGは`?renderer=svg`を明示した比較時のみ生成する。
既存Viewerは互換exportを経由して同じ描画実装を使用するが、OT力学のViewer接続は変更していない。
legacy browser script用のTypeScript対象から互換exportを除外し、既存`tsconfig.renderer.json`で共有実装を検査する。出力先の変更はない。

- 単体: OT力学12件、既存WebGL6件、Astraが追加したadapter/cache/resource18件、合計36件成功。single workerで実施。初回の既存100ノード試験は高負荷下で30秒timeoutとなり、制限やassertionを変更せず再実行して全件成功した。
- 型・build: `npm run typecheck`全6設定、`npm run build:browser`成功。新規依存なし。
- 依存境界: `npm run lint:deps`、137 modules / 285 dependencies、違反0。LabsからViewerへのimportは追加していない。
- 実GPU: Chromiumの`ANGLE Metal Renderer: Apple M1`、WebGL activeを確認。通常経路はCanvas1・SVG0。初期12ノード＋箱見出し4件が表示され、235回のgeometry更新に対して文字atlas送信は1回だった。
- 表示・操作: 文字・GraphLink・入れ子の箱、collapse 12→10→12、pin後のノードdrag、group見出しdrag、parameter変更と再加熱、Radialの親子edge9本＋GraphLink7本、キーボード選択・pin解除、100ノード、760px幅を実ブラウザで確認。撮影画像を目視した。
- 描画負荷: 2000ノード・1999リンク・全2000ラベルを4ページのatlasで保持。力学stepは0、予約frameなし。pan/zoomではgeometry/atlas再送なし。これは2000ノードの力学処理の合格ではない。
- 障害: WebGL不可とcontext lossで表示エラー・力学停止・自動SVG切替なし。復旧時は位置とcameraを維持。Astraレビューで見つかった部分確保時の資源解放漏れと、復旧時に未upload bufferを描く問題を修正し、回帰テストに追加した。修正後の復旧試験はconsole error/warningとも0。
- 比較経路: 明示SVGで2000ラベル・SVG1・Canvas0を確認。ホスト負荷が変動しているため、SVG対比のFPSや倍率はこの記録から主張しない。

スクリーンショットは`output/playwright/force-webgl-*.png`。CLI診断出力とともにローカル検証成果物であり、commit対象外。
通常Viewerへの力学接続、全製品回帰suite、Windows実機、公開版へのOT同梱判断は未対象。
