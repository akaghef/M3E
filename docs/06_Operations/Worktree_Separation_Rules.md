# Worktree Separation Rules

最終更新: 2026-10-09

## 適用と責任

Akaghef の単独開発を前提とする。複数の AI が作業しても、Pull Request と人間のマージ待ちは必須にしない。この文書をブランチ・統合・通常 Beta への反映・完了判定の正本とする。過去の handoff、スキル、作業ログにある PR 必須手順より優先する。

担当 AI は承認済みの作業範囲を、調査・実装・検証・本流統合・push・必要な稼働反映まで担当する。Claude Director を使う場合も、引き継ぎ先と残作業を明示し、誰も担当しないマージ待ちを作らない。人間の判断は要件、破壊的変更、公開・release 判断に使う。

## 作業の分離

- 通常の checkout は `$HOME/dev/M3E`、本流は `dev-beta`。
- コード変更・競合し得る文書変更は `$HOME/dev/M3E-worktrees/<task>`、`codex/<task>` で行う。
- `scripts/ops/worktree.sh new/list/clean/rm` を使う。既存の適切な作業ツリーは再利用できる。
- 書く前に `pwd`、`git branch --show-current`、`git worktree list --porcelain` と既存差分を確認する。各書き込みに作業ディレクトリを明示する。
- ファイル予約を取得する。統合・通常 Beta の build/restart は一担当だけが行い、共有予約 `M3E/dev-beta-integration` を取得して直列化する。予約が使えない場合は共有更新を止める。
- primary への直接実装は行わない。新規の public-safe な `docs/ideas/` への append-only stow、隣接 index 更新、競合しない運用文書保守は従来どおり許容する。
- 他者の未コミット変更を stage、stash、上書き、削除しない。移行前からある未統合枝も消さない。

## 統合手順

1. 元の症状・期待動作・通常起動先を定義する。文書だけの変更は稼働反映を不要と記録できる。
2. 作業枝で最小の変更と関連試験を行い、対象ファイルだけを commit する。`git add -A` や定期処理で他の作業を一括回収しない。
3. 統合予約を取り、`git fetch origin dev-beta`。本流と remote の進みを確認する。remote に新しい変更がある場合は取り込み、重なりをレビュー・再検証する。
4. primary が `dev-beta` であることを確認する。未コミット差分は所有者と範囲を確認し、統合と干渉するなら止める。無関係な差分は保持する。作業枝へ最新本流を通常の merge で取り込み、検証した上で primary を `git merge --ff-only codex/<task>` で進める。競合解決は作業枝で行う。失敗時に reset や force-push で押し通さない。
5. `git push origin dev-beta`。remote の SHA と統合した SHA を照合する。remote が進んで拒否されたら fetch して 3 へ戻る。PR は作らなくてよい。
6. 下記の通常 Beta 反映を実施する。統合後の CI が失敗したら、修正または安全な revert を担当し、完了にしない。CI の対象外は対象外として記録する。
7. 必要な task / map 状態を更新する。戦略の変更がある時だけ Current_Status を更新する。完了証拠を残し、予約を解放する。

作業枝への commit、通常の merge、`dev-beta` への fast-forward と push、既存設定を保つ通常 Beta の build/restart は、承認された実装を届ける工程として追加確認不要。force-push、`reset --hard`、履歴破壊、main/release操作、秘密情報の変更は別途明示承認が必要。

## 通常 Beta への反映

- 通常 Beta は **統合済み dev-beta のソースだけ**から build する。作業枝の dist だけを通常環境にコピーすることは禁止する。
- build 対象に未コミットのソース・設定・依存定義・生成スクリプト変更があれば、通常配信を止める。無関係な文書差分は保持できる。
- `npm --prefix beta run build` を実施し、既存の起動方式で必要な restart を行う。既存の workspace、データ、認証、同期、観測設定を維持する。データ移行や final 更新は含めない。
- build 対象 SHA、稼働プロセスの checkout、起動先 URL/port、配信 bundle と build 成果物の hash を確認する。hash 一致だけでは元ソースの正しさを証明しないので、build 時の SHA と clean な入力も残す。
- GUI の修正は通常起動先を reload して元の再現操作を試す。ブラウザの cache / Service Worker と SVG / WebGL など対象経路を確認する。fixture の成功だけで通常画面の修正完了としない。
- 保存設定の変更は必要に応じ reload/restart 後の保持も確認する。API・データ変更は readback で結果を確認する。個人 workspace に試験マップを作らない。
- 能力・環境の制約で確認できない時は `本流統合済み・稼働未確認` と具体的な残条件を報告する。人間へ検収を黙って転嫁しない。

## プレビュー

未統合のものを見る時は、作業ツリーの独立 port と一時 workspace を使う。通常の 4173 / personal workspace を使わない。依存が不足する場合はその環境を整えるか停止し、通常環境へのコピーで代用しない。
旧 `scripts/beta/preview-worktree.sh` は通常環境を汚すため廃止した。呼び出しは理由付きで失敗する。

## 完了と beta_update

`beta_update` は **検証 → commit → dev-beta 統合 → push → 必要な通常 Beta 反映 → 対象操作の確認**を意味する。PR 作成は完了条件ではない。

報告には、変更の意図、統合 commit、remote 状態、実施した試験、稼働反映の証拠、未確認事項を書く。文書・指示だけなら `稼働反映: 対象外` とし、正本・ミラー・guard の整合を確認する。

次は区別する: `実装済み` / `本流統合済み` / `稼働反映済み` / `動作確認済み`。途中段階を「直った」と呼ばない。

## 任意の Pull Request と既存成果

外部レビューや明示的な PR 依頼には従う。レビュー専用依頼から自動で merge はしない。承認された実装の任意 PR は担当 AI がレビュー・検証・統合まで扱える。
既存の PR / 作業枝は、目的・依存・統合済み部分・未統合差分を確認して個別に回収する。PR が閉じた、古い、競合するという理由で成果を破棄しない。今回の規則変更だけでは未マージ機能の一括統合を許可しない。

## 作業ツリーの終了

担当変更が本流へ到達し、必要な稼働確認が終わってから `worktree.sh rm`。未コミット・未追跡・無視対象の必要な成果物を確認する。`--force` は使わない。branch 削除は取り込みを確認したものに限る。
