回のセッションで実装した差分を自然言語でまとめます。

1. HOME画面の実装（dev-visual ブランチ、commit a7fca67）
マインドマップビューワに加えて、保存済みドキュメントを一覧する独立した「HOME ページ」を新設しました。

バックエンド

RapidMvpModel に listDocuments() を追加。SQLite の documents テーブルから全ドキュメントを保存日時の降順で取得し、各行の state_json をパースしてルートノードの text を「ラベル」として抽出します。
HTTP サーバに GET /api/docs を追加し、上記リストを { docs: [{id, savedAt, label}, ...] } の形で返します。
フロントエンド

新規ファイル home.html + src/browser/home.ts をスタンドアロンのページとして作成。/api/docs を fetch して <ul> にリンク形式で描画します。各リンクは viewer.html?localDocId=xxx を指すただの <a href> で、クリック・新規タブ・ブックマークすべてブラウザ標準で機能します。
viewer.html のツールバーに「🏠 Home」ボタンを追加。
viewer.ts の exitScope() を改修し、ルートノードで Back scope を押したときに（以前は no-op だった）home.html へページ遷移するようにしました。
viewer.css に HOME ページ用のスタイル（ダークテーマ、ドキュメント一覧の見た目）を追加。
2. launch-beta スキルの作成（dev-data ブランチ、未コミット）
.claude/skills/launch-beta/SKILL.md を新設。/launch-beta visual のようにロール名を渡すと、対応するワークツリーの scripts/beta/launch.bat をバックグラウンドで起動するだけの軽量スキル。ロール→ワークツリーの対応表を保持し、worktree が未作成なら中断する仕様です。

3. ブランチ/worktree 整理（dev-data ブランチ上で実行）
dev-beta-visual ブランチを dev-visual にリネーム。
dev-beta-data worktree とブランチを削除（clean だったため）。
M3E-dev-beta-visual → M3E-dev-visual へのパスリネームはOSロックで失敗し未完了。ブランチ切替は成功しているので機能的には影響なし。
現在の状態: HOME画面は dev-visual ブランチにコミット済み、launch-beta スキルは dev-data ブランチに未コミットで残っています。

