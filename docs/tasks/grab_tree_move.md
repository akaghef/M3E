# Grabによる部分木移動

状態: 実装・ローカル回帰完了。通常Betaの配信証拠は末尾の記録先を参照。

## 引き継いだ要求

NavigateでMを保持するとGrabへ入り、選択ノードと全子孫をつかむ。方向キーを連続入力しても同じノードの選択を保持してreparent・reorderを行う。M解放でNavigateへ戻る。EditのMは文字入力。Grabは未移動の保持中を含み、ポインター移動中の内部状態Draggingと区別する。

サイド会話が追記したActions_Beta、Glossary、Editing_Design、Keybindings_Betaの4文書を、元の未コミット差分を保持してこの作業ツリーへ取り込んだ。

## 確定事項

2026-10-16ユーザー回答で次を確定した。

|項目|提案|状態|
|---|---|---|
|キー|単体MをGrabへ変更。既存Command+M／Control+Mによる移動元指定とPによる親変更は維持できる|確定|
|子方向への移動|直前の兄弟の末尾の子へ移す。親方向では現在の親の直後へ出す|確定。先頭の兄弟は例外として直後の兄弟の子へ移す|
|確定・Undo|M解放またはフォーカス喪失で確定・保存。1回のGrabを1回のUndoにする。Escapeは開始位置へ戻す|確定|

## 実装接続先

viewer_keyboard.tsの利用者向けモードにGrabを加え、viewer.tsのkeydown／keyup／blurへ接続する。既存applyMoveByParentAndIndexを使用し、別の構造変更エンジンは作らない。選択ノードと全子孫の内部構造を保持する。

Treeにはright・left・down・up・left/right・up/downの6方向がある。表示上の親子軸と兄弟軸に入力を対応させ、二方向表示ではつかんだ枝の側を考慮する対応を実装。非Tree面・独立した複数部分木ではGrabを開始せず、scope境界を越えない。保持中の保存を保留し、外部マップ置換時には未確定のGrabを取り消す。正本はActions_Beta。

## 検証・配信の予定

SVG/WebGL、Mac/Windowsの入力契約を確認する。M保持開始、未移動のGrab、連続入力、子孫の一体移動、M解放後の通常ナビゲーション、EditでのM入力、取消、Undo・保存を対象とする。元のドラッグ開始、drop preview、reparent、兄弟reorder、末尾挿入の回帰試験も維持する。

隔離試験の成功と通常Betaの元症状確認を区別する。実装後は作業枝で確認し、統合・push・通常Betaのbuild・実画面確認まで担当する。docs/index.mdは作業が確定してから正規生成スクリプトで更新し、checkを実施する。

元のポインタードラッグ不具合は別の完了済み変更として通常Betaへ反映済み。検証記録は通常checkoutのbeta/tmp/tree-drag-verification-261016/README.md。

## 検証記録（2026-10-16）

型検査・browser build・依存方向検査・重複検査が成功。関連unit 78件が成功。ブラウザ検証は `grab_tree_move.spec.js` 17件、`keyboard_modes.spec.js` 12件、`render_interaction_updates.spec.js` 14件を専用portで実施し、計43件が成功した。Mac/Windowsはnavigator.platformと修飾キーの契約を再現したもので、実OSを2台使った試験ではない。blurはイベント契約の試験と区別する。

初期試行ではWebGL debug公開前の初期化待ちが10秒で失敗した。単独の診断試行は成功し、同じ判定・タイムアウトのまま全43件の回帰を再実行し、成功した。原因未確定の初期失敗も証拠に残し、成功結果へ書き換えない。ログ点検で試験側navigator.platformの再定義エラーを検出したため、再設定可能なfixtureとし、未処理のpageerrorが0件である判定を追加した。

画面付き試験が利用者の作業を妨げたため、以後は自動試験をheadless、可視確認を既存ウィンドウ内のタブに限定する原則をWorktree_Separation_Rulesへ追加した。Akaghef-SystemのAGENTSにも同じ原則を保存済み。Skill自体は変更しておらず、ミラー同期は対象外。

配信SHA、通常Betaの配信bundle照合、既存ウィンドウ内のタブで行う確認、CI結果、初期失敗を含む証拠は通常checkoutの `beta/tmp/grab-verification-261016/README.md` とzipに保存する。個人マップの構造変更は保存しない。
