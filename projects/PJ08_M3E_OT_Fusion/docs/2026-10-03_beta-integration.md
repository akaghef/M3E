# 読み取り専用 NETWORK の通常 Beta 統合

2026-10-03、akaghef が PR #104 のレビューと本流への統合を指示。
対象は通常 Viewer の観測表示。指示の送信、Role / Task binding、複数実機共有、
WebGL Agent Card、UI の最終採否を今回の完了へ混ぜない。

## レビューと修正

- 観測 snapshot / Server-Sent Events を loopback peer と同一 Host / Origin に制限する。
  通常 Viewer server 自体の既存 LAN 機能は変更せず、private な観測 API だけを制限する。
- runtime カード選択後、調整 range input に focus があっても authoring の undo / redo /
  Delete へキーが漏れないようにする。range 自体の調整は維持する。
- README / plan / resume cheatsheet / tasks の現在入口を統一し、以前の GUI 待ちを
  後続実装の停止条件と誤読する文言を修正する。

## 検証・反映の記録

root が修正後に実行した検証:

- `npm run build --prefix beta`、`typecheck`、`lint:deps`、`lint:copy`: 成功。
- focused unit: 8 files / 74 tests 成功。Host / Origin / cross-site / remote peer の拒否を含む。
- `beta/tests/e2e/orrery_network.spec.js`: 一時 database / 専用 port で 5 ケース成功。
  観測と authoring の同居、保存保護、drag / force 調整、入力 focus 下の undo / redo 遮断、
  drag 中の逆順 snapshot、実 source からの画面接続を検査した。
- 初回のブラウザ起動は対応する Chromium headless shell が未導入で失敗した。
  正規 Playwright installer で導入後、全 5 ケースを再実行して成功した。
- 実 source の screenshot を root が目視。カードと connected 表示を確認した。
  全体 fit の文字が小さい near LOD 固定の制約は残り、最終 UI 採否とは扱わない。

実データの本文・identity・個人パス・認証情報はこの文書に含めない。
PR / 本流への統合結果は [PR #104](https://github.com/akaghef/M3E/pull/104) で確認する。
通常 Beta への反映は、マージ後の build と既存 service の再起動、API readback で別に確認する。

## 残条件

読み取り専用の観測統合は、human による UI 採否や PJ08 全体の完了判定を代替しない。
後続は owner command API と Role / Task binding 台帳の接続。多 PC の接続と公開配布時の
ライセンス境界はそれぞれ別に評価する。観測 API の LAN 公開は今回の対象外。
