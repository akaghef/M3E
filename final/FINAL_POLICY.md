# Final 方針

Final は明示選定した安定リリース。運用の正本は [Beta / Final の運用方針](../docs/06_Operations/Channel_Release_Policy.md)。開発は beta/ で行う。

- 通常起動: scripts/final/launch.sh または launch.bat。既存の設定を維持する。
- 更新: scripts/final/update-and-launch.sh --release <公開済みタグ>（Windows は .bat）。既存 Final や個人データを上書きせず別のリリースディレクトリを構築する。
- 昇格: 固定した Beta commit の検証と明示承認を伴う別工程。日常更新では実行しない。
- 旧 migrate-from-beta / sync-beta-to-final は廃止。最新 Beta の自動コピーは禁止。
- schema v1 同士の更新のみ自動対応。異なる schema は検証済み移行・復元手順ができるまで停止する。
- データ保存先は環境変数・既存 m3e.conf を保持する。アプリ版とは別に管理する。

final/ は既存版互換用のスナップショットとして当面保持する。文書の更新は製品ソースの昇格を意味しない。
