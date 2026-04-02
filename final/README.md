# M3E Final

**This is a memorandum for user. NOT to write here.**

安定版リリース環境。Betaで品質確認された状態を固定し、日常利用・配布を目的とする。
新機能の先行開発はしない。機能追加はBeta側で検証してからFinalへ反映する。

→ 方針の詳細は [FINAL_POLICY.md](FINAL_POLICY.md) を参照。

## 起動

```bat
scripts\final\launch.bat
```

> **注意:** `npm --prefix final start` を直接実行すると `M3E_DATA_DIR` が未設定になり、データがアプリディレクトリ配下に保存される。必ずスクリプト経由で起動すること。

## Betaの最新を取り込む（migrate）

```bat
scripts\final\migrate-from-beta.bat
```

処理内容:
1. `beta/` の最新ソースを `final/` へ同期
2. `npm ci` で依存関係を更新
3. `npm run build` でビルド
4. データmigrationを実行（スキーマ変更がある場合）
5. 起動確認

## 手動ビルド

```bash
cd final
npm install
npm run build
```

個別ターゲット:
```bash
npm run build:node     # Node files only (dist/node/)
npm run build:browser  # Browser files only (dist/browser/)
```

## テスト

```bash
cd final
npm test               # ユニットテスト
npm run test:visual    # Playwright ビジュアル回帰テスト
```

## データファイル

- 既定の場所: `%APPDATA%\M3E\rapid-mvp.sqlite`
- `M3E_DATA_DIR` 環境変数で上書き可能
- `.sqlite` はリポジトリに含まれない（`.gitignore` で除外）

## デモデータ

| ボタン | ファイル |
|--------|---------|
| Default | `data/rapid-sample.json`（起動時に再生成） |
| Airplane | `data/airplane-parts-demo.json` |
| Aircraft.mm | `data/aircraft.mm`（Freeplaneフォーマット） |
