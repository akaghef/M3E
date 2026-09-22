# NETWORK と通常 Viewer の接続

## 実装

`codex/pj08-network-integration` は、通常 Viewer の NETWORK ボタンまたは `?network=1` から観測カードを同じ canvas / camera に表示する。保存正本の `map.state`、undo、通常レイアウトを runtime 更新に渡さない。観測用の表示状態だけを `projectOrreryMap` で作る。

- source / host / external ID で identity を決め、表示名から統合しない。
- バージョン付き portable snapshot と Codex App の既存 sanitized snapshot を読む。session 原本や Mail database を再収集しない。
- API / Server-Sent Events は読み取り専用。更新失敗時は最後の正常値を保持し、観測不能と明示する。消失を完了へ変換しない。
- Agent Card / force は既存 Lab の seam を再利用し、force の NOTICE を保持する。
- runtime の座標だけを force が更新する。authoring 座標は固定。drag の pin はページ session 内の状態。
- GraphLink は provenance を持つ意味関係。選択すると対応する transport evidence を表示する。
- runtime 選択中は authoring のキー・ツール操作を遮断する。authoring ノードを選び直すと編集を再開する。
- command controller は能力・incarnation を検証し、同一 ID の再実行と通信断後の自動再送を避ける。送信から verified への飛躍を拒否し、独立した完了証拠を必要とする。

## 観測ソースの設定

環境変数 `M3E_ORRERY_SOURCES` は次の JSON 配列。未設定なら disabled。個人パスや実データは Git に保存しない。

```json
[{"id":"telemetry","hostId":"host-a","path":"/absolute/private/snapshot.json","format":"codex-app-v1"}]
```

`format` は `codex-app-v1` または `orrery-v1`。最大 32 source、各ファイル 8 MiB、1 ファイルは設定した source / host と一致する単一 source。`M3E_ORRERY_POLL_MS` は既定 2000、`M3E_ORRERY_STALE_MS` は既定 120000。

- `GET /api/orrery/runtime`: `m3e.orrery.v1` snapshot。
- `GET /api/orrery/events`: `snapshot` event、接続直後の状態と以後の変更。
- mutation method は拒否。command endpoint は提供しない。

## 検証

- root が統合 build を実行し成功。
- root の focused unit run: 8 files / 72 tests passed。単一 worker thread で実行。
- 初回の unit run は fixture 不足 2 件と worker 起動 timeout 1 件があり、fixture を補って再実行した。
- 現在の実 Codex App snapshot を正規 adapter で読取: 57 actors / 10 relations。本文や identity の実値は証跡へ記載しない。
- ブラウザ回帰試験: `beta/tests/e2e/orrery_network.spec.js`。専用 port 14289 と一時 database を使用。drag / tuning ケースは成功。表示・更新・evidence・保存保護のケースは、旧 toolbar に追加した NETWORK ボタンが Workbench の下に隠れる不具合を検出した。現在の Workbench top-actions に既存ボタンを載せる slot を追加し、通常の pointer click を含む同ケースを再実行して成功。
- 最終の browser build も成功。通常の 4173 や個人 map は変更していない。
- root が成功した試験の screenshot を目視。通常ノード、観測カード、関係線、evidence 詳細、Workbench の NETWORK ボタンを確認。46% 表示ではカード文字が小さく、右 Inspector が一部カードに重なる。現状は near LOD 固定で、最終 UI 採否の証拠にはしない。
- Astra の最終静的レビューで、drag 中の pending snapshot を遅い旧 snapshot が上書きする競合を発見。commit 済みと pending 両方の時刻を比較して修正し、逆順到着を与える実ブラウザ回帰ケースが成功。
- 実 snapshot を設定した read-only API / SSE から、一時 database の Viewer へ接続する追加ブラウザケースが成功。transport mock は使っていない。root が screenshot を目視し、57 Actor / 10 関係線と connected 表示を確認。18% の全体 fit ではカード文字は読めず、near LOD 固定の限界がある。実データの画像は ignored なローカル試験成果物だけに保存した。
- ブラウザは合成データ 3 ケース、実観測 1 ケースを確認。変更後は影響するケースを再実行し、最終 build:browser も成功。

## 未完了の条件

この変更だけで PJ08 全体を完了扱いにしない。

1. NETWORK は SVG。WebGL Agent Card の同等性は未検証で、並行中の Force Lab WebGL 作業を取り込んでいない。
2. command の owner adapter は未接続。UI の送信は unavailable、runtime API は能力を空にしている。state machine の単体成功は実配送・実行完了を意味しない。
3. Role / Task への明示 binding は pure projection 契約まで。binding の編集 UI と実運用の台帳は未接続。
4. 複数 host の入力契約はあるが、Windows / Mac mini 実機間の共有試験は未実施。単一 Mac の実 snapshot から画面までの接続を確認した段階。
5. UI 最終採否は akaghef が並行して確認する。公開配布・OT ライセンス境界の判断も別。

Codex App の現行 OT snapshot は `open` のみを能力として公開し、incarnation を持たない。
dashboard の jump は agent 名で対象を選ぶ。Bridge の観測 socket や AI task の sender binding を
human の指示送信へ転用しない。owner 側の exact external identity / incarnation / command ID /
receipt と送信権限の契約が、実 command adapter を接続する前提になる。

次の統合単位は、既存 owner の command API と binding 台帳を確認し、明示的な能力に限定した adapter を接続すること。API を推測して新しい実行正本を作らない。
