# Implementation Plan

## 実行条件

本書は実装タスク。2026-10-20 に akaghef が本仕様を承認し、L2 / L3 / L4 は全て採用された（requirements.md 承認記録）。実装の前提は本仕様の承認（OP40 / OP41は承認済み 2026-10-20）。IS111 / IS112は解決済み。IS113 / IS114 / RK12は別の後続事項であり、タスクの依存条件ではない。OP42は却下。各作業は原則1–3時間の境界とし、超える場合は同じ受入条件を保って分割する。

通常 Beta / personal workspace / 4173 には検証データを書かない。既存4187の起動・停止・ビルド差替えはこの計画の既定操作に含めない。製品実装承認後の通常 Beta 配備は別の運用手順に従い、以下のレビュー完了と混同しない。

## Tasks

2026-10-21 更新: 実装・自動検証・通常Beta反映は verification.md に記録。
task 5 / 8 のレビューURLと機能は用意済み。利用者の実見・採否は自動試験から
推測せず未完了のまま保持する。継続実装は利用者の引き継ぎ・実行指示に従った。

- [x] 1. 専用 map とレビュー・テスト起動手順を用意する
  - 下記「レビュー用 map / URL」の人工 map を fixture にする。子順と画面順の違い、incoming / outgoing、同じ両端の異なる GraphLink、label / relationType、空 label、親なし / 子なし、非描画endpointの三理由、Systemの保存三件→描画一線を含める。fixtureごとに期待描画集合を手書きし、renderer outputから生成しない。
  - `lane_helpers.js` の既存 `createAppServer` と一時データ方式を使う。テストサーバーを模倣実装しない。node / browser のビルド成功と対象 checkout を記録する。
  - 既存 A-sys は `lane.sqlite` の読み取り専用取得または既存 API export から新しい temp data profile へ複製する。稼働中 SQLite の単純ファイルコピーではなく SQLite backup または API を使う。元データの値を変更しない。
  - 4188 が空いていることを確認して既存製品サーバーを起動し、人工 map と A-sys コピーを保存する。使用中なら別ポートを選び、下記 URL を実URLへ更新する。
  - _Requirements: 6.5, 6.6, 6.7_
  - _Boundary: 受入データ・実行前提_
  - _Depends: なし（仕様承認が前提）_
  - _Allowed write scope: `beta/tests/fixtures/edge_graphlink_selection.json`, `beta/tests/visual/lane_helpers.js`, `.kiro/specs/edge-graphlink-selection/research.md`, `/tmp/m3e-edge-graphlink-selection-review/`_
  - _Verification: ビルド成功、専用 API の readback、元 review data と personal workspace への書込ゼロ_
  - _Browser verification: 各 URL が指定 map / view を開くこと。キー機能の受入とは別_
  - _Data safety note: review コピーと人工 map のみ。sync / cloud を接続しない_

- [x] 2. 共通の選択・移動 pure function を実装する
  - design.md の Selection / Scene / Presented と typed signatures を実装する。OP40の件数statusと集約線の編集拒否に必要なformatStatus / editIntentの共通部分も先に実装する（個別編集のcycleはtask 6）。
  - selectionTransition と parentChildTarget、enumerateDrawn、orderDrawn、cycleDrawn、arrowEndpoint、escapeNode、reconcileSelection、selectionHighlight を単体試験する。複数選択のprimaryを起点にする契約も含む。
  - 6px境界、0/5/10pxの非連鎖行分け、同点、入力配列の順序差、wrap、両方向 GraphLink、親への edge の左右除外、集約一候補、OP41のorigin維持・理由表示を確認する。
  - _Requirements: 1.1–1.6, 2.1–2.7, 3.1–3.5, 4.11, 5.1, 5.7, 6.3_
  - _Boundary: shared 選択判定_
  - _Depends: なし（仕様承認が前提）_
  - _Allowed write scope: `beta/src/shared/edge_graphlink_selection.ts`, `beta/tests/unit/edge_graphlink_selection.test.ts`, `beta/src/shared/edge_graphlink_edit.ts`, `beta/tests/unit/edge_graphlink_edit.test.ts`_
  - _Verification: `cd beta && npx vitest run tests/unit/edge_graphlink_selection.test.ts tests/unit/edge_graphlink_edit.test.ts`、DOM / browser import 不在、入力不変_
  - _Browser verification: 後続4・5で必要_
  - _Data safety note: pure function。永続化なし_

- [x] 3. 描画 snapshot と親子 edge の強調を接続する
  - 既存 geometry / path から元 identity、両端中心、labelAnchor、line / lane-band / group-frame を公開する。preview / hit / ガイド / 内訳線は候補に登録しない。
  - 既存 render hook、lane_scene、選択表示へ adapter を接続する。DC37 の root→lane / lane→item / Disperse の親 frame と両端が識別できることを確認する。
  - OP40に従い既存の除外・集約結果をsnapshotへ記録する。Systemの集約線には全linkIdsを対応させ、一本だけを候補にする。Disperseのguideは候補外とし、描画は変更しない。
  - SVG / WebGL で同じ対象が強調される。Lane の前景描画と node 優先 hit を保持する。
  - _Requirements: 1.4, 1.6, 2.1, 2.2, 2.5, 2.7, 5.1, 5.6, 5.7, 6.3, 6.4_
  - _Boundary: 既存 renderer と selection adapter の明示的な統合作業_
  - _Depends: 1, 2_
  - _Allowed write scope: `beta/src/browser/edge_graphlink_selection_adapter.ts`, `beta/src/browser/lane_scene.ts`, `beta/src/browser/viewer.ts`, `beta/src/browser/viewer.globals.d.ts`, `beta/viewer.css`, `beta/tests/visual/edge_graphlink_selection.spec.js`_
  - _Verification: fixtureごとの独立した期待描画集合と候補の比較、viewer差分上限、既存 route の再利用確認_
  - _Browser verification: `npm run build:browser` 後、SVG / WebGL の両端・帯・枠と描画集合を観測_
  - _Data safety note: 表示変更で nodes / children[] / links を改変しない_

- [x] 4. キー・既存 click・Lane navigation を共通選択へ接続する
  - キー所有権 guard 後、既存 F2 / Esc / Delete / brackets / Disperse tool / Lane arrow より前に共通 adapter を接続する。
  - Alt 巡回、上下選択、L2 の端移動と Esc、click からの origin、node 状態に戻った後の Lane 行・列移動を確認する。task 2の集約件数status・編集拒否を接続し、選択レビューの段階から旧編集helperへの落下を防ぐ。
  - input / activeElement / editor session / IME を調べ、編集中の Alt+矢印で preventDefault しない。
  - _Requirements: 1.1–1.6, 2.1–2.7, 3.1–3.6, 4.11, 5.7, 6.1–6.5_
  - _Boundary: input / selection 接続_
  - _Depends: 3_
  - _Allowed write scope: `beta/src/browser/edge_graphlink_selection_adapter.ts`, `beta/src/browser/viewer.ts`, `beta/tests/visual/edge_graphlink_selection.spec.js`_
  - _Verification: unit test 再実行、viewer上限と共通ロジック新規分岐ゼロ_
  - _Browser verification: build:browser 後、Tree / System / Disperse / Lane down / Lane right の keyboard-only 遷移、Axialも同じfixtureで確認（省略時は具体的理由と代替検証結果を記録）_
  - _Data safety note: 選択・移動・Esc が Undo や map state に変更を追加しない_

- [ ] 5. 選択・移動のレビュー viewer を akaghef に渡す
  - A-sys コピーの Lane down/right と人工 map の Tree / System / Disperse の実URLを渡す。source revision、dirty差分の有無、build:browser の時刻を添える。
  - 初期 node、Alt+上下、左右全周、L2 の対応 / 非対応、Esc、帯 / 枠と両端、集約線の件数表示・編集拒否、非描画端の理由表示の確認手順を渡す。未対応ケースは未達として記載する。
  - 下記URLが開けることを自身で観測してから提示する。古い4187だけを渡してチェックポイント完了にしない。
  - _Requirements: 1.4, 2.3–2.7, 3.1–3.6, 5.1, 5.6, 5.7, 6.5–6.7_
  - _Boundary: akaghef の選択・移動レビュー_
  - _Depends: 4_
  - _Allowed write scope: `.kiro/specs/edge-graphlink-selection/research.md`_
  - _Verification: URLの読み込み、表示された map / view / build の一致、受領したフィードバックを記録_
  - _Browser verification: 必須。観測と akaghef の承認を別記_
  - _Data safety note: レビュー用コピーのみ_

- [x] 6. 編集要求と status の pure function を実装する
  - L3 採用時は editIntent / canDelete、全 cycle、parent-child 拒否、read-only、repeat を実装する。
  - task 2のformatStatusをL4採用内容に合わせて拡張する。ID非表示とOP40の集約件数表示・全編集キー拒否はL4の採否によらず守る。
  - _Requirements: 4.1–4.11, 5.2–5.7, 6.3_
  - _Boundary: shared 編集判定と表示文字列_
  - _Depends: 2, 5_
  - _Allowed write scope: `beta/src/shared/edge_graphlink_edit.ts`, `beta/tests/unit/edge_graphlink_edit.test.ts`_
  - _Verification: `cd beta && npx vitest run tests/unit/edge_graphlink_edit.test.ts`、全値の巡回・無変更判定・空名を確認_
  - _Browser verification: 後続7・8で必要_
  - _Data safety note: mutation 自体は行わない_

- [x] 7. label editor と履歴・保存を接続する
  - 集約線で全編集キーとport操作UIを拒否し、編集可能な単一対象だけF2 を固定された Ref と Presentation.labelAnchor に結び、Enter / blur / Esc / IME の lifecycle を実装する。親子 label は child attribute、GraphLink は label のみ。
  - 既存 port / Delete と新しい style / direction を共通 writable guard に通し、既存 snapshot → mutation → touchDocument を一回だけ呼ぶ。
  - node 選択へ戻るまで旧 node 変更キーを消費・拒否する。Undo / Redo 後の reconcile と status 復帰を接続する。
  - _Requirements: 3.4, 4.1–4.11, 5.1–5.7, 6.1–6.4_
  - _Boundary: editor / mutation / history の明示的な統合作業_
  - _Depends: 6_
  - _Allowed write scope: `beta/src/browser/edge_graphlink_selection_adapter.ts`, `beta/src/browser/viewer.ts`, `beta/src/browser/viewer.globals.d.ts`, `beta/tests/visual/edge_graphlink_edit.spec.js`_
  - _Verification: 値変更一回にUndo一回、無変更・取消に履歴なし、attributes / children[] 保持、viewer差分上限_
  - _Browser verification: build:node / build:browser 後、キーボード編集、Undo / Redo / reload / API readback、read-only 拒否、Mac入力欄のAlt矢印_
  - _Data safety note: 新規保存経路を作らず隔離データで検証_

- [ ] 8. 実装済み Surface View の確認と編集レビュー viewer を渡す
  - design.md の実装済み6ケースを対象にSVG / WebGLを確認する。Tree / Disperse / System / Lane down / Lane rightのkeyboard-only E2Eは必須。Axialも同じ人工fixtureを用いるが、省略時は具体的理由とsnapshot・unitの代替検証結果を記録する。Radialは本タスクの受入対象外であり、他viewによる代用もしない。
  - port / style / direction 全周、label解除、Delete禁止、両端強調、ID非表示、node F2とLane navigation回帰、text edit exclusion、集約線の件数と編集拒否・元の保存三件不変、非描画端のorigin維持・理由表示を確認する。
  - A-sys と人工mapのURLを再読込し、**編集を含む今回のビルド**の source/build と実測結果を akaghef に渡す。task 5 のビルドと区別する。
  - _Requirements: 1.1–1.6, 2.1–2.7, 3.1–3.6, 4.1–4.11, 5.1–5.7, 6.1–6.7_
  - _Boundary: 全体受入と akaghef の編集レビュー_
  - _Depends: 7_
  - _Allowed write scope: `beta/tests/visual/edge_graphlink_selection.spec.js`, `beta/tests/visual/edge_graphlink_edit.spec.js`, `.kiro/specs/edge-graphlink-selection/research.md`_
  - _Verification: unit、型検査、viewer行数・責務ゲート、独立fixtureとの比較、履歴・保存のreadback_
  - _Browser verification: `cd beta && npm run build:node && npm run build:browser` 成功後に新規2specと既存 `lane_view.spec.js`, `lane_graphlink_layers.spec.js`, `keyboard_modes.spec.js` を実行_
  - _Data safety note: 期待値を製品出力から生成して自己比較しない。personal workspace 不使用_

- [x] 9. 採用した操作を既存キー文書・チートシートへ同期する
  - Shift+S / Shift+B、Alt矢印、F2の文脈、Delete禁止、Escを既存一覧へ追加する。
  - 既存の割当を再照合し、未承認群や未対応範囲を完成機能として書かない。
  - _Requirements: 4.1–4.7, 4.11, 5.7, 6.2, 6.7_
  - _Boundary: 操作文書・既存チートシート_
  - _Depends: 8_
  - _Allowed write scope: `docs/06_Operations/Keybindings_Beta.md`, `docs/06_Operations/Actions_Beta.md`, `beta/viewer.html`_
  - _Verification: 実装と一覧の照合、差分の用語・ID非表示確認_
  - _Browser verification: チートシートで同じキーと適用文脈を確認_
  - _Data safety note: 製品データ変更なし_

## レビュー用 map / URL

### A-sys の既存参照

`/Users/akaghef/dev/M3E-worktrees/lane-view-data/serve.sh` は `lane-view/beta` の `dist/node/start_viewer.js` を4187で起動し、`lane.sqlite` を使う。調査時の読み取り専用DB照合で map `asys-lane`、root label「Akaghef-System 構成」を確認した。

参照予定URL: `http://127.0.0.1:4187/viewer.html?map=asys-lane&renderer=svg`。調査時は4187に接続できなかったため、これは稼働確認済みURLではない。別worktreeの既存ビルドであり、新仕様の受入には使わない。

### task 5 / 8 で渡す新ビルド

指定worktreeの `beta` で build:node と build:browser を実行し、既存 `dist/node/start_viewer.js` を使う。例:

```sh
M3E_PORT=4188 \
M3E_DATA_DIR=/tmp/m3e-edge-graphlink-selection-review \
M3E_DB_FILE=review.sqlite \
node dist/node/start_viewer.js
```

既存 API で fixture と A-sys コピーを保存する。各 map には初期 Surface View と direction を保存しておき、URLだけで具体例が開くようにする。未実装の query parameter に依存しない。

| 用途 | map の表示名 | 提案URL（task 1で作成・task 5/8で実測） |
|---|---|---|
| Lane down | Akaghef-System 構成・横の帯 | `http://127.0.0.1:4188/viewer.html?map=selection-asys-down&renderer=svg` |
| Lane right | Akaghef-System 構成・縦の帯 | `http://127.0.0.1:4188/viewer.html?map=selection-asys-right&renderer=svg` |
| Tree | 選択確認・親子の線 | `http://127.0.0.1:4188/viewer.html?map=selection-tree&renderer=svg` |
| Axial | 選択確認・時系列 | `http://127.0.0.1:4188/viewer.html?map=selection-axial&renderer=svg` |
| System | 選択確認・流れ | `http://127.0.0.1:4188/viewer.html?map=selection-system&renderer=svg` |
| Disperse | 選択確認・包含 | `http://127.0.0.1:4188/viewer.html?map=selection-disperse&renderer=svg` |

WebGL確認は同じURLの `renderer=webgl`。URL中の内部 map キーはナビゲーションに限り、GUIタイトル・statusは上記の人間向け名を表示する。公開サイトや live beta への配備は不要。

人工 map の内容: root「選択確認」、子「計画」「実行」「確認」。計画の子は `children[]` 順に「整理」「調査」「相談」、実行の子は「実装」「試験」、確認の子は「記録」。整理から実装へ「引継ぎ / supports」と「参照 / references」の別GraphLink、試験から整理へ incoming「差戻し」、整理から記録へ outgoing「保存」、計画から整理へ親子間GraphLink「補足」を用意する。System用にさらに、別々の保存endpointが同じ代表nodeの組へ写され、同じlabel/typeによって三件が一線にdedupされるケースを加える。独立した期待描画集合では一線・件数3とする。Lane root/レーン名への非描画GraphLink、親子labelへ折り込むGraphLinkの非候補も明示する。図中に識別コードを表示しない。System / Disperse 用の保存座標または既存配置で上下・逆流を含ませ、順序を固定する unit fixture と動的な画面観測を区別する。

レビュー報告には source revision（変更意図付き）、build 時刻・成功、dirty差分の有無、map名、URL、各 Surface View の実測 / 未実施 / 前提不足、akaghef の採否を分けて記録する。ビルド情報を製品GUIの通常表示へ埋め込まない。
