# Final 方針

## 位置づけ

Finalは、Betaで品質確認された状態を安定リリースとして固定し、継続的なmigration・更新が容易に行えるようにする段階とする。

Betaが「継続利用に耐える信頼性の確立」を目的とするのに対し、Finalは「安定した本番運用と、次バージョンへの移行の容易さ」を目的とする。

## 基本方針

### 1. Betaの安定版をベースとする

FinalはBetaで動作確認が完了した状態のコードをベースとする。
Finalで新機能を先行開発しない。機能追加はBetaで検証してからFinalへ反映する。

### 2. Migration容易性を最優先に設計する

Finalでは以下の移行シナリオを一発のコマンドで実行できることを目標とする。

- データのmigration（Beta → Final）
- Finalの更新（pull + install + build）
- 起動

### 3. データ互換性を保証する

Final間のバージョン更新では、既存のユーザーデータ（`.sqlite`）が自動的に移行されることを原則とする。
破壊的なスキーマ変更が必要な場合は、migration scriptを必ず用意する。

### 4. スクリプトによる運用を原則とする

手動操作は最小化し、`scripts/final/` 以下のスクリプトですべての運用が完結できるようにする。

## 環境ディレクトリ構成

```
M3E/
├── beta/         ← 現行開発環境
├── final/        ← 安定版リリース環境（本ドキュメント）
└── scripts/
    ├── beta/     ← beta 起動・更新スクリプト
    └── final/    ← final 起動・更新・migration スクリプト
```

## Migration手順（Beta → Final）

`scripts/final/migrate-from-beta.bat` を実行する。

日常運用では `scripts/final/update-and-launch.bat` を実行する（内部で migration を呼び出す）。

処理内容:
1. `beta/` の最新ソースを `final/` へ同期
2. `npm ci` で依存関係を更新
3. `npm run build` でビルド
4. データmigrationスクリプトを実行（スキーマ変更がある場合）
5. 起動確認

## データの扱い

- ユーザーデータ（`.sqlite`）はリポジトリに含まれない（`.gitignore` で除外）
- Final更新時、データは自動的に移行される（migration scriptが責任を持つ）
- 更新前の自動バックアップをmigration script内で行う
- データファイルの場所（既定）: `%APPDATA%\M3E\M3E_dataV1.sqlite`（`M3E_DATA_DIR` で上書き可能）
- 重要: `scripts/final/launch.bat` 経由で起動すること（直接 `npm --prefix final start` を実行すると `M3E_DATA_DIR` が未設定となり、アプリディレクトリ配下へ保存される）

## Final完了イメージ

Final完了時点では次の状態であることを目標とする。

- `scripts/final/launch.bat` 一発で起動できる
- `scripts/final/migrate-from-beta.bat` 一発でBetaの最新を取り込める
- データが安全に引き継がれる
- ユーザーが手動でビルドや設定変更をしなくてよい
