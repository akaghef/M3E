# タスク振り分け (役割別)

> 更新: 2026-04-02

---

## akaghef（確認・指示・判断）

| タスク | 内容 |
|--------|------|
| 思想の再確認 | M3E の設計思想・目的の棚卸し。各機能の方向性を再定義する前に実施 |
| privacy / 機密保護方針決定 | どのデータをローカル限定にするか、外部送信の可否などポリシー決定 |
| web公開・外部公開の判断 | タイミング・スコープ・ライセンス条件の最終判断 |
| AI agent役割設定の承認 | news fetch / AI manager / security manager ロールの詳細承認 |
| 各タスク完了の最終確認 | 各エージェントのアウトプットレビューおよびマージ承認 |

---

## claude（dev-beta: 仕様・タスク管理・マージ・final移行）

| タスク | 優先度 | 内容 |
|--------|--------|------|
| CI/CDパイプライン整備 | P5 | Stage A CIを `beta/**` に拡張。テスト環境構築 |
| 開発環境の移行 | P5 | Alpha→Beta移行の完全確認、launch スクリプト整備 |
| AI agentの役割設定 | P4 | codex1/codex2 へのタスク外注フロー整備、プロンプト設計 |
| コンテキストエンジニアリングの自動化 | P3 | CLAUDE.md / memory / branch構造の自動更新フロー |
| デモ版ローンチ準備 | P3 | `aircraft.mm` / demo JSON クリーンレンダー確認、スタートアップパッケージ |
| Rapid/Deep分離（仕様） | P2 | 思考バンド分離の設計仕様をドキュメント化 |
| final 移行管理 | P2 | `migrate-from-beta.bat` の動作確認・改善 |
| 日常使用ローンチ | P1 | Beta環境で自分が毎日使える状態にする |

---

## codex1（dev-beta-visual: UI・レンダリング）

| タスク | 優先度 | 内容 |
|--------|--------|------|
| Visual polish | P4 | spacing, edge curvature, selected-state contrast, long text 対応 |
| Fit-to-content / Focus-selected | P4 | アクション実装 |
| 帯域の変更（UI） | P3 | Flash/Rapid/Deep の切り替えUI |
| 重要度ビュー | P3 | ノードの重要度を視覚的に表現するビューモード |
| Flash実装（UI層） | P2 | Flash バンドのレンダリング・インタラクション |
| Rapid/Deep分離（UI） | P2 | バンド切り替えのUI実装 |
| reparent UI改善 | P1 | ドロップターゲットハイライト + 拒否メッセージ |

---

## codex2（dev-beta-data: model・controller）

| タスク | 優先度 | 内容 |
|--------|--------|------|
| ViewState分離の完全施行 | P4 | ViewState と PersistedDocument の完全切り離し |
| Linear↔Tree相互変換 | P3 | リスト構造とツリー構造の双方向変換機能 |
| 具象軸（データモデル） | P3 | 抽象ノードと具象ノードの軸をモデルに組み込む |
| Imported metadata レンダリング | P3 | インポートデータのメタ情報をUIに渡す |
| Flash実装（モデル層） | P2 | Flash バンドのデータ構造・永続化 |
| AIコマンド操作 | P2 | AIからのコマンド受付インターフェース設計 |
| AI integration（基盤） | P2 | LLM連携の基盤設計（オフライン優先） |
| Local/Cloud データ同期 | P1 | ローカルSQLite ↔ クラウドストレージの同期設計（HTTPS + Bearer token）。送受信データはE2E暗号化 |
| 同期用E2E暗号化 | P1 | Node.js 組み込み crypto のみ使用。AES-256-GCM。キーはローカルファイル1本（~/.m3e/sync.key）。PUT前に暗号化・GET後に復号。それ以外の複雑化なし |
| delete confirmation（非葉ノード） | P1 | 非葉ノード削除時の確認UI（controller側） |

---

## 保留・検討中

| タスク | 理由 |
|--------|------|
| security manager ロール | privacy方針決定後に設計 |
| news fetch ロール | AI integration 基盤完成後 |
| AI manager ロール | 運用フェーズで必要性を判断 |
| web公開 | 外部公開判断待ち |
| ライセンス | ✅ 完了 (MIT, 2026-04-02) |
