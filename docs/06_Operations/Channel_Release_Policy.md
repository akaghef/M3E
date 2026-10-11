# Beta / Final の運用方針

2026-10-11 合意。チャネル運用・起動・更新・昇格の正本。

| 対象 | 意味 | ソース・更新 | データ |
|---|---|---|---|
| Beta | 本人が日常利用する検証済み最新版、4173 | dev-beta に統合・pushした beta/。担当 AI が稼働確認まで届ける | 既存 personal workspace を保持 |
| Preview | 未統合変更の試験 | 独立作業ツリー、独立ポート | 一時 workspace のみ |
| Final | 明示選定して固定した安定版、38482 | main 到達・Version Registry 記載の公開済みタグ | 起動設定に指定された既存 workspace を保持 |

## 開発と完了

開発ソースは beta/ を正本とし、Final 独自開発はしない。現存 final/ は移行期間の互換用スナップショットとして保持する。ソース二重配置の撤去は別の移行として行う。通常変更は Worktree Separation Rules に従い、PR 必須・人間のマージ待ちは設けない。

通常 Beta は dev-beta と origin/dev-beta の一致、ソース・依存・起動入力の clean を共通検査する。起動時は入力内容と配信 bundle のハッシュ、Node 版を build 記録と照合し、古ければ再生成する。更新は fetch → fast-forward → npm ci → build →通常起動。失敗した build のために既存サーバーを先に停止しない。起動成功やハッシュ一致と、元の症状の動作確認は別。担当 AI が対象操作・保存・再読込を確認して初めて完了とする。

## Final 更新と昇格の分離

日常の Final 更新は `scripts/final/update-and-launch.sh --release <公開済みタグ>`（Windows は .bat）。タグを省略して最新 Beta を選ぶことは禁止する。main 到達と Version Registry のタグ・データ schema を検査し、M3E_HOME/releases/<tag>-<commit> に選定版の final/ を構築して起動する。元の checkout、旧リリース、個人 DB は上書きしない。展開された scripts/final/launch を次回起動にも使用できる。

現行のリリース更新実装は schema v1 同士のみ。未知の schema は停止する。明示タグを指定する更新は公開済み版の利用であり、新しい Final への昇格ではない。

昇格は別途明示承認が必要。担当者は次を順に行う。

1. 特定の dev-beta commit を選び、変更点・既知制限・対象 OS・データ schema を提示する。
2. 独立した release 作業ツリーで、その固定 commit の beta/ から Final 候補を生成する。稼働中 checkout をコピー元・出力先にしない。移行期間は final/ に生成するが、開発は行わない。
3. build、対象 OS の起動、主要操作、保存・再読込、データ互換性を検証する。必要な migration はバックアップ・移行・読戻し・復元を一時データで試験する。
4. 明示承認の対象 commit と証拠を照合して main / tag / Version Registry を更新する。公開操作にはその承認が必要。
5. 公開済みタグを通常更新経路で構築し、端末別に稼働版と動作確認結果を記録する。

旧 migrate-from-beta / sync-beta-to-final は副作用なしで終了する。daily-sync の --with-final も拒否する。定期更新から昇格を行わない。

## データ・復旧・端末

アプリの版と workspace の保存先は別の軸。環境変数を優先し、Final は既存 m3e.conf の設定を保持する。更新による DB コピー、保存先変更、schema の暗黙変更は禁止。Beta と Final の同時利用時は同じ SQLite を共有させない。

新規利用時のみ既定 workspace に seed を作る。既存利用では現在の M3E_DATA_DIR / workspace を記録し、同じ設定を渡す。リリース更新コマンドはデータ移行コマンドではない。

Final の復旧は保持済みリリースの launch を同じ設定で実行する。schema が異なる版への復旧は自動実行せず、検証済みのデータ復元を先に行う。Beta の復旧は不具合変更の通常 revert を検証・統合して再配信する。データ破壊を含む場合はアプリだけ戻して完了扱いしない。

端末ごとにチャネル、source commit / release tag、起動先、workspace、配信 hash、確認した操作を記録する。Mac の検証を Windows や別端末の完了として報告しない。

## 自動検査

`node --test scripts/ops/channel-runtime.test.mjs` が拒否条件、固定版選定、失敗時の保持を検査する。OS 固有ラッパーの実機確認は別に必要。規則変更だけで Final を昇格したり、既存個人データを試験に使ったりしない。

起動前 build と更新の共通処理は Git common directory の `m3e-channel.lock` で排他する。担当 AI が統合から再起動確認まで行う場合も同じローカル排他を用いる。処理途中で強制終了された lock は自動削除しない。owner.json のホストと PID の終了を確認してから復旧する。
