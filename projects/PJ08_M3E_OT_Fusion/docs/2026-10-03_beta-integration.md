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
## 本流と通常 Beta への反映

[PR #104](https://github.com/akaghef/M3E/pull/104) をレビュー修正後にマージした。
統合 commit `98da3d09` は読み取り専用 NETWORK と上記の境界修正を `dev-beta` へ反映する。
修正後の PR CI と [統合後の CI](https://github.com/akaghef/M3E/actions/runs/37059847724) は成功。

- primary checkout を fast-forward し、既存の未コミット文書 3 件を three-way merge で復元した。
  既存の未追跡ファイル 5 件は hash 一致を確認した。作業者の変更はこの PR に含めていない。
- primary の Beta を build し、既存の launchd service を更新した。
  明示的なローカル観測 source 設定だけを追加し、既存の起動引数・workspace・同期設定を保持した。
  元の LaunchAgent はバックアップした。初回 bootstrap は error 5 で失敗したが、
  plist 検査後の再実行は成功し、新しい process の port 4173 待受を確認した。
- 通常 Beta の snapshot と Server-Sent Events は HTTP 200。初回 snapshot は 82 actors /
  21 relations、source は connected、公開された command capability は全件空。
  異なる Host / Origin と cross-site request はそれぞれ HTTP 403 で拒否された。
- 新規ブラウザ context、`access=view`、Service Worker 無効、非 GET / HEAD 要求の遮断下で
  実際の通常 Beta を確認した。18 authoring nodes と 82 runtime cards の同居、実 snapshot と
  card identity の対応、実 SSE、指示送信 disabled、描画例外 0 件を確認した。
  起動処理を含めて非 GET / HEAD 要求は 0 件で、通過した書き込みも 0 件。
- 配信された Viewer bundle と primary build の SHA-256 が一致した。
  root が通常 Beta の screenshot を目視し、NETWORK connected と同一 canvas 上の表示を確認した。
  全体 fit は 16% でカード文字が小さく、near LOD 固定の制約は残る。

保存状態は内容と時刻を分けて検査した。再起動前後で選択中マップの state は一致し、
map 一覧の 26 IDs に増減はない。一方、既存の起動時 `ensureMap` → `renameMap` が
既定 2 マップの `savedAt` を更新した。この動作は PR #104 より前から存在する。
再起動後を基準としたブラウザ確認の前後では、state と `savedAt` の両方が一致した。

実観測を含む screenshot と詳細 log は Git 管理外のローカル検証 artifact に保存し、
SHA-256 manifest で再読込を検証した。観測内容を公開 repository へ含めていない。

## 残条件

読み取り専用の観測統合は、human による UI 採否や PJ08 全体の完了判定を代替しない。
後続は owner command API と Role / Task binding 台帳の接続。多 PC の接続と公開配布時の
ライセンス境界はそれぞれ別に評価する。観測 API の LAN 公開は今回の対象外。
