# Final 同期マニフェスト

beta/ → final/ の同期方式: **exclude モード**（丸ごとコピー + 除外リスト）。
このファイル、`SKILL.md` Step 3、`scripts/final/migrate-from-beta.sh|.bat` の3箇所を一致させること。

## 同期方式

beta/ を丸ごと final/ にコピーし、除外リストに該当するものだけスキップする。
新ファイルが beta/ に追加された場合、自動的に final/ にも反映される。

## 除外リスト

| 対象 | 理由 | カテゴリ |
|------|------|---------|
| `node_modules/` | `npm ci` で再生成 | ビルド生成物 |
| `dist/` | `npm run build` で再生成 | ビルド生成物 |
| `.env` | 開発用シークレット | 開発専用 |
| `Beta_Policy.md` | beta 固有ドキュメント | 開発専用 |
| `prompts/` | 開発用プロンプト | 開発専用 |
| `tmp/` | 一時ファイル | 開発専用 |
| `public/` | 開発用アセット | 開発専用 |
| `e2e_test_server.js` | E2Eテスト専用 | 開発専用 |
| `playwright.e2e.config.js` | E2Eテスト専用 | 開発専用 |
| `data/M3E_dataV1.sqlite` | 作業DB（final側は初期化済み12KB） | データ保護 |
| `data/backups/` | ランタイム生成物 | データ保護 |
| `data/audit/` | ランタイム生成物 | データ保護 |
| `data/conflict-backups/` | ランタイム生成物 | データ保護 |
| `data/.m3e-launched` | 初回起動フラグ | データ保護 |

## final/ 固有ファイル（保護対象）

rsync `--delete` / robocopy `/MIR` で削除されうるため、同期後に `git checkout` で復元する:

- `final/FINAL_POLICY.md`
- `final/README.md`

## コピーされるもの（除外リスト以外すべて）

主要なもの:
- `src/` — 全ソースコード
- `tests/` — テストファイル
- `legacy/` — レガシー互換
- `viewer.html`, `viewer.css` — メインUI
- `package.json`, `package-lock.json` — 依存定義
- `tsconfig.*.json` — TS設定
- `playwright.config.js`, `test_server.js` — テスト設定
- `data/tutorial.sqlite` — チュートリアルデータ
- `data/rapid-mvp.sqlite` — サンプルデータ
- `data/*.json`, `data/*.mm` — デモデータ

## 同期スクリプトの所在

- **Shell**: `scripts/final/migrate-from-beta.sh`（macOS/Linux） — rsync ベース
- **Batch**: `scripts/final/migrate-from-beta.bat`（Windows） — robocopy ベース

## 更新履歴

| 日付 | 変更 |
|------|------|
| 2026-04-11 | exclude モードに移行。include リスト方式を廃止 |
| 2026-04-08 | 初版作成。既存 migrate-from-beta スクリプトから抽出 |
