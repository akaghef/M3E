# Design Document

## Overview

案F2の表示する対象を選ぶ選択 UI（以下フィルタ）を、既存 WorkbenchApp と共通 scene に接続する設計草案。確定条件・未決は [requirements.md](requirements.md) を正本とする。以下の実装配置と境界案も Phase 0 の審査対象であり、製品コードは変更していない。

### Goals

Layout を保持して濃淡と件数だけを更新する。判定・操作・描画処理を別 module に置き、viewer.ts を短くする。既存の SVG / WebGL、選択、Inspector、status bar の一時メッセージを維持する。

### Non-Goals

新しい描画エンジン、server、保存 schema、npm 依存は追加しない。mock の実装 runtime、Domain の固定集合、候補 GraphLink を移植しない。未対応 Surface View の WebGL 化や Radial の実装は別件である。

## Existing Architecture Analysis

基準は `ad1f40b`（既存 Lane の構造実装を含む dev-beta）、作業枝 `codex/viewer-filter`。2026-10-20 に以下のソース行をこの checkout で再確認した。すべて静的確認であり、browser 実測ではない。行番号は実装開始時に再確認する。

| 境界 | ソースと確認結果 |
|---|---|
| 旧重要度 | `beta/src/browser/viewer.ts:564` の型、`:686` の `all` 初期値、`:687` の集合。代入は初期化のみで操作 UI はない |
| score | `viewer.ts:6319`。整数文字列、緊急等=4、高等=3、中等=2、低等=1、欠落/不明=0。属性は nullish 優先で空文字を次の属性へ落とさない |
| 旧非表示処理 | `viewer.ts:6350` の membership、`:6357` の子孫一致→先祖保持と root 強制保持、`:6391` の `scopeChildren` |
| Layout | `viewer.ts:5639` の `visibleChildren` は重要度を使わず nested folder で止まる。`:7156` の Disperse traversal は collapse まで子孫を読む |
| GraphLink | `viewer.ts:8049` 以降が描画選別、`:8057` 以降で Disperse / System の代表端点解決、`:8080` が旧重要度での除外。`shared/types.ts:29` の GraphLink は attributes を保持 |
| Lane | `beta/src/shared/lane_view.ts:69` の projection、`:80` の folder 境界、`:92` の元 GraphLink 選別。`beta/tests/visual/lane_view.spec.js:59` は `lane_asys.json` を使用し、25孫 / 82 GraphLink を検査 |
| 共通描画 | `viewer.ts:8574` の `RetainedSvgScene.update` に全 View が合流。`:9337` の `patch` は選択変更時に node markup を直接差し替える |
| WebGL | `viewer.ts:4456` は Tree / Disperse のみ。agent node / NETWORK は SVG。`beta/src/rendering/webgl_scene_tiles.ts:176` は primitive の computed opacity、`:245` は outerHTML ベースの capture cache、`:327` は Canvas2D の alpha、`:368` 以降は paint command 比較による tile 無効化 |
| status bar | `viewer.ts:4295` の `setStatus` は2500msで消える。`beta/src/browser/workbench-ui.tsx:315` が読む一時状態を `:1478` で表示。`:1454` が TopBar mount |
| 件数 | `viewer.ts:8613` は map 全体の node 数、続く linkCount も実描画選別と同じでないため、そのまま流用不可 |
| メニュー | `viewer.ts:11332` の `showContextMenu` は click / 外側 click、`:15473` の `toggleDropdown` は hidden / aria-expanded を扱う。完全な keyboard menu 部品ではない |

## Boundary Commitments

| 操作 | 所有する層 |
|---|---|
| KEEP | 現行の node / GraphLink / edge 描画、Layout、force、保存、選択対象、Inspector、TopBar、既存 Panel |
| ADD | 純粋な判定 module、session 状態、React bar、scene の濃淡適用、status bar の独立した件数表示 |
| REPLACE | 操作不能な旧重要度の状態と非表示・選択制限分岐。score の意味はそのまま移す |
| FAIL | 対象 node / link を Layout 入力から間引く、opacity のために relayout、SVG ancestor の opacity だけで WebGL 完了扱い、別 renderer の作成 |

## Architecture

### Module Plan

| ファイル案 | 責任 |
|---|---|
| `beta/src/shared/view_filter.ts` | 入力を変更しない score・scope 所有・各軸・AND・件数判定。DOM / React / viewer を import しない |
| `beta/src/browser/viewer-filter-controller.ts` | viewer session 内の状態、購読・通知、map 変更 reset、scene 入力と評価結果の保持 |
| `beta/src/browser/viewer-filter-bar.tsx` | chip、直下メニュー、選択・解除、ARIA、keyboard、disabled 理由。WorkbenchApp から mount |
| `beta/src/browser/viewer-filter-scene.ts` | 既存 scene parts / node patch に同じ濃淡を適用。元 markup / opacity を基準に復元可能にする |
| `beta/src/browser/workbench-ui.tsx` と既存 CSS | TopBar 隣への mount、status bar の一時メッセージとは別の件数 span。既存画面の構造を再利用 |
| `beta/src/browser/viewer.ts` | map と描画対象の受渡し、共通 scene と選択 patch の呼出、旧重要度処理の撤去のみ |
| `beta/src/rendering/webgl_scene_tiles.ts` | 既存 capture / tile 更新を利用。paint 更新だけで必要な invalidation が届かない場合に限り最小の修正 |

### State and Data Flow

状態案は `{confidence: "all" | "system-evidenced", importance: "all" | "high-plus" | "high-only", scopes: Set<string>}`。内部参照キーは表示しない。scope 名は node の既存表示ラベルを使い、名称がないときも raw ID にフォールバックしない。

chip 操作 → controller の状態更新 → 最新の描画対象と純粋判定 → 保存済みの scene parts に濃淡を適用 → `RetainedSvgScene.update` → WebGL の paint capture / tile 更新 → status bar の件数購読通知とする。通常の `renderScene` で作る無加工の parts と同じ適用関数を使い、フィルタ変更だけで `buildLayout` や通常の Layout を含む `scheduleRender` を呼ばない。scene parts の所有・更新を既存 retained scene に接続し、別 renderer を持たない。

通常の編集や View 切替は従来どおり Layout を計算し、最後に現在の状態を再適用する。フィルタは Layout cache key / force 入力 / metric 入力に参加しない。実行中 force を停止・再起動しないことを呼出数でも検証する。座標不変試験は同一の安定した配置の前後を比較し、force 自身の進行をフィルタ起因の移動と混同しない。

map 切替では通知前に reset し、古い map の応答で上書きされないよう controller の現 map を照合する。保存・localStorage・URL・履歴へ書かない。同一 map の scope / View 切替は選択を保持する案。候補が2未満の scope 軸は非適用・非 active として「すべて」を表示し、内部選択を保持して再び候補が増えたら適用する。候補から外れた選択は自動消去しない。これは requirements の未決に含み、承認前に実装しない。

## Predicate Contract

確度の判定を先に求める。CURRENT は文字列の完全一致 `system-evidenced`、TO-BE は属性の有無に関わらず true。欠落値を保存上 `declared` に補完しない。重要度 score は既存関数の純粋な抽出とし、数字・文字列・欠落時の意味を変えない。

scope 所有は node の parent から先祖 chain を辿り、最も近い scope 境界を使う。現在の scope の root 自身は現在の scope とする。scope を示す既存 model 情報を用い、folder の通常境界と整合させる。alias は参照先ではなく alias node 自身の所有と属性で判定する案。`isNodeInScope` は root の子孫かを返す別用途（`viewer.ts:6290`）である。

フィルタなしで描画される node 集合と GraphLink 集合を先に確定し、その集合をフィルタで縮めない。確度に一致する GraphLink の端点集合を作り、各 node の重要度・scope・確度端点条件を AND する。その後 GraphLink の確度と両端 node の一致、edge の両端 node の一致を計算する。一致しない相手を持つことで隣接 node を連鎖的に不一致へ変えない。すべて絞らない場合、GraphLink を持たない node も一致する。

### 描画対象と件数の境界案（akaghef 確認待ち）

| 対象 | 判定・件数の案 |
|---|---|
| 通常 node | 現在の scene に本体を描く node を各1件。viewport 外も含める。collapse / scope により初めから描かれない node は分母に含めない |
| Lane | 見出し・レーン名・個数は構造を示すため保持し、node 件数は本体のある孫だけ。対応 node の見出し文字にもその node の濃淡を適用するが、飾り枠や個数は node と数えない。A-sys の分母は25 / 82 |
| GraphLink | 実際に線を描く保存 GraphLink を1件。hit / visible / label / 矢印を重複計数しない。省略 link と候補ペアは含めない |
| 集約された端点 | System / Disperse で代表 node に接続する線は描画上の代表端点で node 一致・端点集合を判定し、confidence は元 GraphLink から読む。元の隠れた node を分母に増やさない |
| System preview | 独立した node 本体ではない内部 preview は件数に含めず、所有する表示カードの濃淡に従う。preview 自体を scope 選択肢に増やさない |
| NETWORK | 現行 scene の独立した node 本体と GraphLink があれば同じ判定対象。所有 scope を持たない runtime node は現在の root scope に割り当てる案。既存 SVG fallback を保持 |
| alias | 表示中の alias node を1件。参照先を二重計数しない。scope 所有も表示位置から求める |

これらは確定条件を省略する例外ではなく、scene 上の node と装飾・preview の識別案である。Director は描画上の代表端点か元の端点か、Lane 見出し・preview の扱いを akaghef に確認する。回答が異なれば実装前に明記して改訂する。

## Presentation and WebGL

各 drawable primitive に既存 opacity と濃淡係数の積を適用する。係数は非一致で0より大きく1より小さい値とし、特定数値の mock 一致は要求しない。一致時は係数1で従来の opacity を保つ。再適用で乗算が累積しないよう無加工の scene / patch を入力とする。shape・text / tspan・badge・GraphLink label・arrow marker を含め、hit 用透明要素の値や pointer-events は維持する。共有 marker を変更して一致 link まで薄くしない。既存 marker capture に合わせ、link 側の paint alpha で合成できるかを検査する。

primitive の paint 変更が capture に渡るよう、変更された属性を outerHTML に反映するか、既存の完全 capture を明示的に行う。CSS の祖先 class だけを変えて cache を再利用しない。新 paint commands を既存 tile 更新へ渡すことで、旧/新の bounds が invalidation されることを確認する。これは再配置ではなく再描画である。

`refreshSvgNodeInteraction` の `RetainedSvgScene.patch` にも同じ関数を使う。WebGL の選択 overlay / partial capture と GraphLink 選択でも、濃淡を保持する。薄い対象の click・keyboard 選択は禁止しない。選択状態を目立たせる既存描画は残すが、フィルタ係数を打ち消さない。

## UI and Accessibility

bar は左右 top bar 間の利用可能な横幅の中央に置く。chip の現在値は scope 複数選択時に人に読める省略表示とし、全ラベルはメニューで読める。各単一選択行に意味を1行付け、TO-BE 選択時は CURRENT、「すべて」選択時は重要度の狭い2値、「高以上」選択時は「高のみ」に「含む」を付ける。

既存 `showContextMenu` の外側 click と `toggleDropdown` の開閉 / aria-expanded の挙動を再利用する。既存 helper は viewer 内の DOM 操作であり React の完成済み部品ではないため、適合する小さな処理だけを共通化し、全メニューの刷新はしない。native button と menu role に keyboard focus 管理を加える。外側 click でも閉じ、Escape・単一選択・閉じるで元 chip に focus を戻す。checkbox は focus を保って即時更新、Tab は閉じて次の操作へ進む。disabled 理由は hover に依存せず説明文と `aria-describedby` で読めるようにする。

新 npm 依存なしで既存 React と DOM API を使う。既存 helper だけでは満たせない keyboard contract は新しい bar の責務として限定実装する。これはアプリや renderer の再実装ではない。

status bar は一時メッセージとは別に controller の件数を購読する span を持ち、active の間は表示し続ける。0件も `0/描画数` と明示する。全解除では件数 span を消し、一時メッセージは変更しない。Inspector の既存 map 全体の件数をこの分母として使わない。

## ImportanceViewMode Replacement and Line Budget

`all` が固定で `importanceVisibleNodeIds` は常に null のため、現状では `isNodeVisibleByImportance` は true。以下を除去しても現在到達できる振る舞いは変わらない。これは到達不能な high-plus / high-only の非表示仕様を維持するという意味ではない。

| 変更対象（viewer.ts） | 承認後の置換 |
|---|---|
| `:564`, `:686–687` | 旧型・mode・集合を削除、新 controller の状態を使う |
| `:6319–6348` | score を shared に抽出し意味を維持 |
| `:6350–6389` | membership、再構築、先祖/root の救済を削除 |
| `:6399` | `scopeChildren` の importance filter を外し、既存 scope の子を返す。linear 出力に新しい間引きを入れない |
| `:7920` | `rebuildImportanceVisibility()` 呼出を削除 |
| `:8080–8082` | GraphLink の importance 由来の早期 return を削除。描画後の濃淡へ置換 |
| `:9247`, `:9253` | 選択正規化から importance guard だけを除去。scope / 存在の検査は維持 |
| `:9415`, `:9509` | 単一選択・pointer 選択から importance guard だけを除去 |
| `:8633` | 旧 mode の debug 表記を削除。status bar は別の件数欄 |

実装開始時の commit と `wc -l` を記録し、差分内訳で正味増加がないことを確認する。現基準17,274行からは上記の不要処理撤去で接続行を確保する。無関係な移設を予算に使わず、超過時は実装完了とせず設計を見直す。

## Verification Strategy

純粋判定は fixture から独立に計算した期待値で検証する。browser では濃淡・件数・座標・経路を別々に観測し、WebGL pixels の変化も測る。全 View の座標不変、実装済み renderer 経路、選択後保持、map reset、保存内容不変を確認する。既存試験・新規試験の具体コマンドは tasks.md に置く。mock と比べるのは構造であり、画像の色や寸法を合格閾値にしない。
