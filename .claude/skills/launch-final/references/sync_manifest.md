# Final 同期マニフェスト

beta/ → final/ の同期対象一覧。
このファイル、`SKILL.md` Step 3、`scripts/final/migrate-from-beta.sh|.bat` の3箇所を一致させること。

## ディレクトリ同期（再帰コピー）

| beta/ ソース | final/ 先 | 備考 |
|-------------|-----------|------|
| `beta/src/` | `final/src/` | 全ソースコード |
| `beta/tests/` | `final/tests/` | テストファイル |
| `beta/legacy/` | `final/legacy/` | レガシー互換 |
| `beta/public/` | `final/public/` | 静的アセット（KaTeX等）。beta側に存在する場合のみ |

## 単体ファイル同期

| beta/ ソース | final/ 先 | 備考 |
|-------------|-----------|------|
| `beta/viewer.html` | `final/viewer.html` | メインHTML |
| `beta/viewer.css` | `final/viewer.css` | スタイルシート |
| `beta/package.json` | `final/package.json` | 依存定義 |
| `beta/package-lock.json` | `final/package-lock.json` | ロックファイル |
| `beta/tsconfig.browser.json` | `final/tsconfig.browser.json` | TS設定 |
| `beta/tsconfig.node.json` | `final/tsconfig.node.json` | TS設定 |
| `beta/playwright.config.js` | `final/playwright.config.js` | E2E設定 |
| `beta/test_server.js` | `final/test_server.js` | テスト用サーバー |

## デモデータ同期

| パターン | 備考 |
|---------|------|
| `beta/data/*.json` | サンプルJSON |
| `beta/data/*.mm` | FreeMind形式 |

## 同期除外（final/ 固有）

以下は同期で上書きしない:

- `final/FINAL_POLICY.md` — Final方針ドキュメント
- `final/README.md` — Final固有の説明
- `final/data/` 内のユーザー作成ファイル
- `final/node_modules/` — `npm ci` で再生成
- `final/dist/` — `npm run build` で再生成

## 同期スクリプトの所在

- **Shell**: `scripts/final/migrate-from-beta.sh`（macOS/Linux）
- **Batch**: `scripts/final/migrate-from-beta.bat`（Windows）
- **総合**: `scripts/final/update-and-launch.bat|.sh`（同期 + ビルド + 起動）

## 更新履歴

| 日付 | 変更 |
|------|------|
| 2026-04-08 | 初版作成。既存 migrate-from-beta スクリプトから抽出 |
