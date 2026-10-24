# Research & Design Decisions

## Summary

**Feature**: `edge-graphlink-selection`。既存 viewer の Extension 調査。調査日2026-10-20、基準commit `ad1f40b7e1c4a9f00939625b1fb3fcd9c5ac2577`（Lane実装を含む origin/dev-beta の基準版）、branch `codex/edge-graphlink-selection`。sourceへの変更は行っていない。

関連方針は S17 と S3（`docs/00_Home/Current_Status.md:27–47`）。本稿の current-behavior は特記しない限り**ソース静的調査**であり、ブラウザ実測ではない。既存テストの assertion は過去の成功証明として扱わない。

主要な選択機能のギャップは親子edge選択状態とAlt矢印の経路。Directorレビューに基づきOP40 / OP41（承認済み 2026-10-20）を採用し、IS111 / IS112は解決済み。既存のGraphLink除外・集約は維持し、Disperse親子ガイドはDC51で選択時のみ描く契約に確定しIS114は解決済み。Radial入口不足はIS113として別作業に記録する。本仕様の完了対象は実装済みviewに限定する。

## Research Log

### 正本・用語・資料の優先順位

| 調査事項 | Findings / source |
|---|---|
| 親子だけが edge | `docs/00_Home/Glossary.md:30–35`。GraphLink、edge port、LinkPort、EdgeStyle、Surface View を分離 |
| 六つの Surface View | `docs/03_Spec/map_layout_modes.md:33–67`。古い本文§2の実装分析は現在のコードの根拠にしない |
| Disperse / Lane の親子表現 | 同 `:85–101`。Disperse はgroup、Laneは帯でありLaneのEdgeStyle optionはない |
| Lane と System | 同 `:103–116`。Laneは兄弟順に中心線へ整列、SystemはGraphLink方向で段を作る |
| steering の拘束 | `.kiro/steering/ui_view_taxonomy_and_ports.md:8–28`。分類・port分離を維持。`:28` のAxial/Radial/System凍結は今回の全view共通操作の明示依頼と競合するため、今回の限定仕様にはユーザー依頼を優先。一般の解凍や配置変更とはしない |
| GraphLink fields | `docs/03_Spec/Data_Model.md:269–289` は label / relationType / style / direction / attributes。sourcePort / targetPort はコード `beta/src/shared/types.ts:29–40` と Glossary LinkPort に存在 |
| 資料のdrift | Data_Model `:289` は attributes が型未実装とするが、現コード `types.ts:40` は実装済み。`.kiro/steering/ui_view_taxonomy_and_ports.md:32–35` のport未実装メモも現在の実装全体を表さない |

今回の必読入口として Agent_Brief / Current_Status / Glossary を読み、template4種、`edge-port-seam` と `progressive-nav-seam` の Boundary / typed contract / requirements traceability の形式を参照した。以前の5分類はコピーせず、現行6分類を使用する。

### 選択・入力

| Current behavior | File:line evidence | 設計への影響 |
|---|---|---|
| GraphLink用の選択変数がある | `beta/src/browser/viewer.ts:848`、`:9487–9506` | Connection の共通一時状態を追加し、既存値は互換投影にする |
| GraphLink選択はselectedLinkIdとselectedGraphLinkIdを設定しnode選択集合を空にする | `viewer.ts:9487–9506` | 両端強調をnode複数選択と混ぜない |
| statusは両端名、`[ and ] adjust ports, Delete removes`。node不在時にIDへfallback | `viewer.ts:9498–9501` | L4のID非表示と不一致。formatStatusへIDを渡さない |
| node単一選択はGraphLink選択を解除 | `viewer.ts:9413–9430` | L2 / Esc後の既存node選択経路を再利用 |
| selectGraphLink呼出元はSVG/WebGLポインター | `viewer.ts:15623–15627`, `:15792–15810`。全 `selectGraphLink` 呼出を検索 | キーボードからの開始経路は未実装 |
| 既存矢印はaltKeyを除外。Laneを先に分岐 | `viewer.ts:17025–17095` | L1 / DC35用の共通handlerを先に挿入する必要 |
| F2は現在nodeのinline編集 | `viewer.ts:16725–16729` | Connection 選択時は先に文脈dispatchが必要 |
| Escはcut取消、Disperseではtool解除が先 | `viewer.ts:16572–16579`, `:16685–16690` | L2のEscが既存returnで消えない順序にする |
| 編集modeはeditorの存在で決まる | `viewer.ts:12260–12266` | focusだけに依存せずセッションguardを保つ |
| input / textarea / select / contenteditable判定 | `viewer.ts:1237–1248` | Alt矢印を入力欄から奪わない |
| keydownはIME、edit、linear、text field、Grab等を先に判定 | `viewer.ts:16372–16451` | 新キーをguardより前に置かない |
| read-only通過判定で矢印とbracketsを許可 | `viewer.ts:509–523` | bracketsがGraphLink mutationになった文脈で別のwritable判定が必要 |
| GraphLink消滅時の既存選択正規化 | `viewer.ts:9293–9298` | 新しい親子選択とoriginも同様にreconcileする |

### Lane navigation と描画

| Current behavior | File:line evidence | 設計への影響 |
|---|---|---|
| Laneの行/列に沿う方向変換 | `beta/src/shared/lane_navigation.ts:20–28` | 新しい選択機能でnode navigationを複製しない |
| レーン内隣接、レーン間最近傍、レーン名・rootへの移動 | 同 `:58–96` | node状態の挙動をそのまま維持する |
| shared navigationはF2を扱わない | 同 `:65–96` と `viewer.ts:16725–16729` | F2はviewerのeditorであり、lane_navigationへ追加しない |
| root / lane 名が選択可能なtextで描画される | `beta/src/browser/lane_scene.ts:9–19` | DC37ではrootも両端として強調できるようにする |
| lane bandはlane-node-idで対応し、現在pointer-events none | 同 `:14–18` | bandをclick操作へ拡張せず表示アダプターから強調する |
| Laneのvisible GraphLinkは前景、hitは後方 | 同 `:4–6`、`viewer.ts:8226–8228`, `:8576–8577` | 選択強調でこの重なり・hit優先を壊さない |
| Laneは孫以外のGraphLinkを除外 | `viewer.ts:8086–8087` | OP40により非描画分は候補外。IS111解決済み |
| Laneの更に深い子は表示されないという前提がnode追加にもある | `viewer.ts:12487–12495` | OP41によりorigin維持・深度制限の理由表示。IS112解決済み |
| 既存A-sysテストは25孫・6レーン・82 GraphLinkをassert | `beta/tests/visual/lane_view.spec.js:58–80` | 既存fixtureは再利用できるが、今回はテストを実行していない |

### 各 Surface View の Connection 描画

| Current behavior | File:line evidence | 設計への影響 |
|---|---|---|
| 親子pathとchild attributeのedge labelを描く | `viewer.ts:8390–8409` | 親子identityとlabelAnchorを既存pathから公開 |
| 親子描画はLaneでは呼ばず、scatterではchildrenを空にする | `viewer.ts:8482–8493` | Lane / Disperseの上下選択はline以外のPresentationが必要 |
| Axial互換timelineは軸/点/stemも描く | `viewer.ts:8029–8048` | これらの装飾を候補として数えない |
| Disperseはlayout.groupsからrectを描く | `viewer.ts:7960–7968` | group ownershipをsnapshotへ公開する |
| scatterでは親子scatter-guide線も生成される | `viewer.ts:8015–8027` | 調査時は IS114 として記録。2026-10-24 の DC51 で選択中の親子 edge だけを描く契約に解決 |
| guideは透明ではなくstroke設定がある | `beta/viewer.css:1329–1336`, `:1357–1360` | 調査時の実表示は未測定。DC51 では選択時だけ描画し、左右巡回の候補から引き続き除外 |
| GraphLinkは両端位置、表示・scope条件を満たすものを描く | `viewer.ts:8051–8085` | sharedで独自のvisibility判定を再実装しない |
| 親子関係を持つ両端のGraphLinkは除外 | `viewer.ts:8074–8076`, `:8089–8091` | OP40で独立候補にしない。折込先の親子edgeが表す（IS111解決済み） |
| 親子間GraphLinkのlabelを親子edgeのlabelへまとめる | `viewer.ts:7974–8004`, `:8401–8405` | 親子labelとGraphLink.labelの編集先を混ぜない |
| flow/Systemで代表nodeへ写し、同じ両端とlabel/typeをdeduplicate | `viewer.ts:8066–8071`, `:8092–8100` | OP40で描画一線を一候補とし、元の保存件数を追跡して表示・編集拒否 |
| scatter GraphLinkはline、その他はpath | `viewer.ts:8101–8126`, `:8225–8237` | SVG要素形で選択ロジックを分岐せず同一Refを使う |
| 通常pathにはselected classとport overlayがあるがscatterのline branchには同じselected classがない | `viewer.ts:8112–8126`, `:8203–8204`, `:8225–8237` | Disperseも同じ選択表示になるようadapterで適合 |
| WebGL snapshotはSVGの親子path/guideとGraphLink path/lineを取得 | `viewer.ts:4603–4604` | 描画snapshotにはguideがあっても選択候補から除外。DC51 では選択中の親子 edge の guide だけを SVG / WebGL とも描画 |
| canonicalSurfaceViewNameはTree/Axial/Disperse/System/Lane。未知名はTree | `beta/src/shared/node_draw_port.ts:155–172` | Radialを他viewで代用しない。IS113から将来のRadial実装の受入へ引継ぎ |
| SurfaceKindにRadialがない | `beta/src/shared/types.ts:7–8`、`beta/src/shared/edge_port.ts:16–35` | 本仕様の完了を妨げない。Radial実装時に同じsnapshot契約を接続する（IS113） |

### edge port / route の再利用

`beta/src/shared/parent_child_edge_adapter.ts:6–10` は ParentChildEdgeRef を持ち、`:72–81` の `routeParentChildEdge` は `selectPorts` と `route` を合成する。選択契約はその親子identityを再利用する。

`beta/src/shared/edge_port.ts:3–14` は矩形と接続点、`:103–115` は `selectPorts` とexplicit side、Lane同列の扱い。`beta/src/shared/edge_route.ts:3–16` はEdgeStyle相当とpath/commands、`:75–93` はrouteを実装する。選択ではこれらのgeometryを再計算しない。

GraphLinkの既存path/label位置は `viewer.ts:8132–8201`、Laneの場合の `laneLinkGeometry` 呼出は `:8132`。`nearestEdgePortSideForGraphLinkEdit` は `viewer.ts:12073–12087` のpointer endpoint編集で用いられ、親子 edgeへ流用しない。

画面中心の既存計算例は `viewer.ts:8136–8139`、矩形への変換は `:5810–5818`。node中心Yと矩形上端Yを混同しない。camera変換は `viewer.ts:4645–4652`、既存のactive node画面内移動は `viewer.ts:5527–5553` の `nudgeActiveNodeIntoView` を参照。OP41により非描画endpointへの自動展開・scope移動は行わず、origin維持と理由表示を行う。

### 編集・履歴

| Current behavior | File:line evidence | 設計への影響 |
|---|---|---|
| normalizeGraphLinkはautoを保存し、render用sanitizeはfixed sideだけを返す | `viewer.ts:4170–4195` | 古い「auto未実装」記述で上書きしない。既存bracket cycleを維持 |
| bracket cycleはsource/targetをright,bottom,left,topへ変更 | `viewer.ts:12151–12171`, `:16785–16796` | L3の順序を明示。autoからright、autoへ戻す操作追加は対象外 |
| node状態のbracketsはscope出入 | `viewer.ts:16798–16810` | 親子選択時の不適用はconsumeしてscope移動を防ぐ |
| GraphLink削除はsnapshot→delete→touchDocument→flush | `viewer.ts:12118–12137` | 既存mutationを再利用し二重Undoを避ける |
| Delete/Backspaceのglobal処理にはscope exit特例がある | `viewer.ts:16812–16825` | 親子選択時はnode delete / scope exitより前に拒否 |
| 親子labelはchildのm3e:edge-label。空値は削除 | `viewer.ts:12366–12390` | F2の保存先を維持 |
| editor開始には両端layoutと親が必要 | `viewer.ts:12420–12433` | 非描画endpointはOP41により選択しない（IS112解決済み） |
| 親子label editorは右向きTreeの制御点を独自計算 | `viewer.ts:5311–5338` | 「Treeだけを許可するguard」ではない。位置計算がTree前提という正確なギャップ |
| 親子editorはtextarea、Enter確定、Esc取消、blur確定 | `viewer.ts:12441–12476` | GraphLinkにも既存lifecycleを再利用 |
| snapshotはstateとnode selection/collapseのみ | `viewer.ts:4208–4222` | Connection 選択そのもののUndo再現を勝手に仮定しない |
| Undo/Redoはstate復元、selection正規化、render、autosave | `viewer.ts:4225–4293` | 既存経路の後に新しいSelectionをreconcile |
| touchDocumentはstate同期、savedAt、render、autosave、broadcast | `viewer.ts:13431–13444` | 新規保存系を作らない |
| setStatusは2500msで消える | `viewer.ts:4296–4305` | L4の継続表示には選択statusへの復帰が必要 |

### ショートカット衝突の調査（L3）

照合元は `docs/06_Operations/Keybindings_Beta.md:37–210`、`Actions_Beta.md:61–95`、`beta/viewer.html:312–434`、全 `viewer.ts` keydown `:16372–17095`、`workbench-ui.tsx:1429–1443` のdocument listener。`.claude/skills/m3e-shortcuts/SKILL.md:9–42` が一覧・Actions・cheatsheetの所在を示す。ただし同skillのFinal編集指定は今回のBeta/spec-only依頼に適用しない。

| 候補 / 既存キー | 照合結果 | 採否 |
|---|---|---|
| Shift+S | 対象コード・一覧・cheatsheetに割当なし。Mod+Sはdownload、Alt+Sはnavigator（`viewer.ts:16749–16753`, `:16870–16874`） | **L3案: LinkStyle巡回**。Ctrl/Meta/Altなし、GraphLink選択時のみ |
| Shift+B | 対象コード・一覧・cheatsheetに割当なし。KeyBのhandlerも検索なし | **L3案: direction巡回**。Ctrl/Meta/Altなし、GraphLink選択時のみ |
| Shift+D | annotation date（`viewer.ts:16547–16552`） | 不採用 |
| Alt+S / Alt+D / Alt+L | navigator / markdown preview / edge label（`viewer.ts:16852–16856`, `:16870–16874`, `:16888–16892`） | 新規用途に再割当しない |
| F2 | node text edit（`viewer.ts:16725–16729`） | 選択文脈でL3へdispatch。node状態では既存通り |
| `[` / `]` | GraphLink ports、node状態はscope（`viewer.ts:16785–16810`） | 既存挙動を維持。親子edgeは拒否してscopeへ落とさない |
| Delete / Backspace | GraphLink / node削除、Backspaceにscope特例（`viewer.ts:16812–16825`, `:12118–12137`） | 親子選択を先に保護 |
| Alt+矢印 | 通常矢印では除外（`viewer.ts:17025–17095`） | L1 / DC35。board上はブラウザdefaultを抑止、text editingでは通過 |

検索は `Shift+S` / `Shift+B`、`KeyS` / `KeyB`、文字キーの比較、全document keydownを照合した。静的なM3E内割当競合は見つからない。OS、ブラウザ拡張、キーボード配列での実測は未実施（RK9）。「競合なし」を実機確認済みの意味で用いない。

一覧には未割当でもコードに存在する操作がある。例えば `Keybindings_Beta.md:60` 付近のt未割当と `viewer.ts:16519–16531` のtemplate completion、一覧のcheatsheet長押し記述 `:165–166` と実装 `viewer.ts:17166–17180` のprimary+Alt同時押しが異なる。一覧のみの照合では不十分。

### レビュー用データと実行前提

指定された個人ローカル資料の入口としてGety skillを読み、`gety connector list` を試したが `gety service is not running`。`open -a Gety` も `Unable to find application named 'Gety'`。検索結果は得られず、明示されたパスを直接読み取り専用で調査した。Getyのsource設定は変更していない。

`/Users/akaghef/dev/M3E-worktrees/lane-view-data/serve.sh:4–5` は別worktree `lane-view/beta` と `M3E_PORT=4187`、`M3E_DATA_DIR=.../lane-view-data`、`M3E_DB_FILE=lane.sqlite` を指定する。これが現在の指定スクリプトであり、本仕様worktreeのビルドではない。

同ディレクトリの `lane.sqlite` を SQLite URI `mode=ro` で読み、`maps` 表の `id,state_json` から `asys-lane`、root「Akaghef-System 構成」を確認した。DBには開発・研究mapもあるので新テストの空DBとして再利用しない。DBは行番号付きのsourceではなく、この読み取りクエリを調査根拠とする。`curl --max-time 4 http://127.0.0.1:4187/api/maps` は接続失敗。viewerの表示、稼働ビルド、key操作は測定していない。

既存の隔離方式は `beta/tests/visual/lane_helpers.js:5–28`。一時ディレクトリと専用SQLiteで製品 `createAppServer()` を起動し、既存APIへfixtureを保存、map query付きviewerを開く。`:29–45` のview切替helperはclick/hoverを使うため、新機能のkeyboard-only受入操作へそのまま流用しない。setupと操作を分ける。

viewerの `map` query読取りは `beta/src/browser/viewer.ts:440–464`。renderer既定値は同 `:441` のWebGL。従ってレビューURLではsvg/webglを明記する。未知mapの表示名をIDへfallbackする同 `:466` 付近の既存処理にも注意し、レビュー時はmapの人間向け名が表示されることを確認する。

`beta/playwright.config.js:3–7,31–40` は専用portを使用し4173を保護する。`beta/package.json:37` のbuild:browserはTypeScript / Vite build、`:43` のtest:unitはbuild:testを含む。既存 `lane_view.spec.js:58–80` はA-sys fixtureの利用例。テスト用のserverやviewerを新しく模倣する必要はない。

## Architecture Pattern Evaluation

| 案 | 評価 |
|---|---|
| viewer.ts内にSurface View別のキー分岐を追加 | 不採用。共通ルールと行数制約に反する |
| DOM pathを全走査して候補とみなす | 不採用。hit path、guide、previewの除外と集約線の件数を区別できない |
| rendererが描画identityと保存GraphLinkの対応付きsnapshotを公開しsharedで選択 | OP40。集約は一候補、件数表示と編集拒否。除外・集約規則自体は維持 |
| 新しいgraph UI library / 複製viewer | 不採用。既存geometry・選択・historyがあり、今回必要な小さい判定以外を再実装する理由がない |

## Design Decisions

L1 / DC35–DC38 は依頼の確定判断としてrequirements.mdへ転記した。拒否済みの「矢印方向ごと一本」方式は採らない。以下は確定判断を具体化する**承認対象の設計案**であり、新しいDC番号を割り当てて確定扱いにしない。

| 論点 | 採用案 / 理由 |
|---|---|
| 同じ高さ | 6 CSS pxの最上部基準行分け。pairwise許容差sortの非推移性を避け、行内は左→右 |
| L2 | 両端中心差の主軸、45度は水平、1px未満は無効。曲線の接線や保存directionと移動方向を混ぜない |
| 状態 | node / parent-child / graph-linkとorigin。選択と両端強調を分離 |
| L3 | Shift+S / Shift+B、既存bracket順、F2保存先を分離、既存Undoだけを使う |
| L4 | IDを受け取らないformatStatus、labelとrelationType併記、表示fallbackは人間向け語 |
| viewer上限 | 基準版17,274行に対するnet +40、added 120以下、sharedに属する新規ロジック分岐0 |
| 合成と再利用 | ParentChildEdgeRef、既存port/route、inline editor、lane navigation、createAppServerを採用。新依存なし |
| OP42 | 却下案。保存された全GraphLinkを個別に描く案は今回対象外 |
| OP40 | 承認済み 2026-10-20。描かれている線だけを候補とし、集約線は一候補・件数表示・全編集キー拒否。IS111解決済み |
| OP41 | 承認済み 2026-10-20。Alt+↑/↓の端が非描画ならorigin維持・理由表示、自動展開なし。IS112解決済み |

## Risks & Mitigations

IS110 は DC50 の Connection（線要素）で解決済み。IS111 / IS112はOP40 / OP41で解決済み。IS113はRadial実装側への引継ぎ、IS114 は DC51 の選択時ガイドで解決済み。RK9は資料/キーdrift、RK10は旧node操作・履歴との接続、RK11はレビューのbuild/data混同。RK12として、どのSurface Viewも描かない保存GraphLinkはキーボードで到達できない制限を受容し、後続課題として可視化する。これらの後続事項は本仕様の完了条件・依存ではない。

草案レビューでは、確定判断の網羅、L2/L3/L4の分離、pure functionの入出力、各taskのwrite scope / depends / verification、review URLとbuild、実装済みviewの受入を照合する。実装開始には仕様承認を必要とし、文書検証を製品E2E完了とは呼ばない。

## References

本稿のfile:lineは上記基準commitの静的調査位置。番号は実装後に変わるため、再調査時は関数名も照合する。tasks.mdに記したURLは将来のレビュー手順であり、稼働・検証結果ではない。

## Directorレビュー反映と検証

OP40により候補集合をfixtureごとの独立した期待描画集合と照合する。保存全集合との一致は要求しない。親子label折込・Lane非描画を除外し、Systemの保存三件→描画一線では一候補・件数3・F2 / brackets / Shift+S / Shift+B / Delete / Backspaceの拒否を確認する。データ・履歴を変えない。

OP41の折り畳み・Lane深度外・scope外は正常な選択拒否として試験する。originは維持し、理由を人間向けに表示する。Disperse guide は候補外を維持し、DC51 に従い選択中の親子 edge の一本だけ描く。Radialの線選択確認は将来のRadial実装作業の受入に引き継ぎ、今回の完了条件から分離する（IS113）。参照先は `docs/09_Decisions/ADR_012_Radial_Surface_View_Restoration.md` とrequirements.mdのIS113行。

承認は実行条件へ移し、タスクは9件に再採番する。選択・移動レビューはtask 5、編集レビューはtask 8。具体的なURL・map名・ビルドの区別を維持する。今回追加する追跡IDはOP40 / OP41 / IS114 / RK12のみ。

検証は4文書の残存表現、型契約、要件対応、タスク依存と書込範囲を対象とする。製品コード・製品テスト・ビルドは今回の仕様修正では変更・実行しない。過去の独立レビュー結果は今回の修正版の検証結果として流用しない。

今回の文書検証結果: 残存表現検索、追跡IDの許可集合、Markdown整形、9タスクの再採番・先行依存、レビューtask 5/8、要件4.11/5.7を含むtraceability、4文書だけのGit変更範囲を確認しPASS。コミットなし。
