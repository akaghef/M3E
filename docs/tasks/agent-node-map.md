# Agent nodeを通常マップへ組み込む

## 要求と範囲

新規のM3EマップにAgent nodeを並べる。除外するのはAgent runtimeへの接続であり、既存M3Eの作成・保存・編集・Undo・再読み込みは使用する。専用preview URL、読み取り専用化、追加の操作バー、独立したドラッグ処理は設けない。

## データと描画

通常のTreeNodeを使用し、`attributes["m3e:agent"]` にversion 1の表示属性をJSONで保存する。必須項目はagentKind、icon、model、lastActiveAt、attention、actorCount。任意項目はname、realm、team、role、lifecycleState、semanticColor。idはTreeNode.id、タイトルはtext、本文はdetailsを正本とし、表示属性内へ複製しない。不正な形式はAgent nodeとして描画せず通常ノード表示を維持する。

`shared/agent_node.ts`と`shared/agent_node.css`をLabと通常Viewerで共有し、通常のNodeDrawContentから描画する。アイコンは同じ検証済みカタログとコマ定義を使う。未取り込み素材は未取り込み表示を維持する。

標準の選択・ドラッグ・編集・保存経路を使う。ズーム40%未満はfar、80%未満はmiddle、それ以上はnear。レイアウトの占有範囲はnearの大きさで固定し、表示密度の切り替えで配置を動かさない。Agent nodeを含むマップはSVG描画を使用する。WebGLのAgent node描画は未対応。

## 新規マップの表示意図

`M:(Agent nodes)`を新規作成し、root直下に10状態の表示例を横並びの行として置く。状態別の親や追加Scope、GraphLink、alias、anchorは作らない。親子関係はマップへの所属だけを表す。通常Disperseをprimary Surfaceにしてrootを非表示にする。

これはレビュー用の静的な表示例でありruntime観測ではない。RealmはMac、teamはM3E。色は状態を表し、背景の不透明度は10%。本文にも表示例であることを記す。個人データのmap IDをソースに固定しない。

## 検証

一時SQLiteのcreateAppServerを使い、標準URLからの表示、runtime未接続、選択・タイトル編集・ドラッグ・Undo・再読み込み後の保持、通常ノードとの混在をブラウザで検査する。Labの既存操作と再生検査も保持する。実際の新規マップは正式APIで作成して再取得し、通常本体画面で目視する。
