# Agent nodeだけのマップ表示

## 要求と範囲

PJ08のRQ5（指示と観測を同じmap面に置く）へ向け、Agent node Labの表示を通常Viewerの同じcanvas / cameraに載せて確認する。今回は表示のみで、バックエンド・実行・指示送信・保存は対象外。

入口は `/viewer.html?preview=agent-nodes`。ブラウザ内で独立したmapを生成し、親となるrootはDisperseの既存規則で非表示にする。個人workspaceにmapを作成せず、既存mapを読み書きしない。通常Viewerの初期化から独立した入口を選び、API、SSE、共同編集、クラウド同期、Vault、clipboard同期は起動しない。

## 表示と操作

- Agent nodeだけを同じ面に並べる。10状態は例示であり実観測ではない。RealmはMac、teamはM3E。
- Labと同じ描画関数、スタイル、検証済みアイコン素材を使用する。
- 既存Viewerのパン・ズーム・全体表示を使用する。ノードの選択・ドラッグはブラウザ内の配置だけを変える。
- ズーム40%未満はfar、80%未満はmiddle、それ以上はnear。手動切り替えも可能。
- 全体表示の計算範囲はnearの大きさを維持し、縮小表示の変化で倍率が往復しないようにする。
- 全体表示、配置リセット、アイコン再生停止、Seam Labs一覧・Agent node Labとの往復を用意する。
- リロードで配置を初期状態へ戻す。Backend接続時の保存・同期方式は決めない。

## 検証契約

既存Labの検査に加え、通常Viewerへの描画、パン・ズーム、表示密度、ドラッグ、再生、往復をブラウザで確認する。`network=1`や既存mapを示すqueryが併記されてもpreviewを優先し、API/SSE/BroadcastChannelを起動しないことを検査する。実データ接続や最終UI採否とは区別する。
