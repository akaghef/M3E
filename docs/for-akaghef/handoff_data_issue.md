# 引継ぎ: データ読み込み問題

## 問題
Downloads にある `M3E_dataV1.sqlite` の正しいデータ（`akaghef-beta` ドキュメント、350ノード）をbetaアプリで開きたいが、起動すると別のデータ（4ノードや9ノード）が表示される。

## 原因（判明済み）
betaアプリが読むデータディレクトリは **3箇所**あり、混乱の元になっている：

| パス | 使われる条件 |
|---|---|
| `C:\Users\Akaghef\data\M3E\` | 環境変数 `M3E_DATA_DIR` がこれにセットされている場合（**現在のシステム環境**） |
| `beta\data\` | `M3E_DATA_DIR` 未設定時のフォールバック（`path.join(ROOT, "data")`） |
| `%LOCALAPPDATA%\M3E\` | install/dist版の `launch.bat` 使用時 |

`scripts\beta\launch.bat` は `M3E_DATA_DIR=%CD%\beta\data` をセットするが、**システム環境変数に `M3E_DATA_DIR=C:\Users\Akaghef\data\M3E` が既にある**ため、`setlocal` スコープの影響で上書きが効いていない可能性がある。

## 対応済み
- Downloads版SQLiteを以下3箇所すべてにコピー済み：
  - `beta\data\M3E_dataV1.sqlite` → 350ノード OK
  - `C:\Users\Akaghef\data\M3E\M3E_dataV1.sqlite` → 350ノード OK
  - `%LOCALAPPDATA%\M3E\M3E_dataV1.sqlite` → 350ノード OK（以前のセッションで対応）

## 未確認・未対応
1. **アプリ再起動後に正しく表示されるか未確認**（コピー直後にセッション終了）
2. 環境変数 `M3E_DATA_DIR` のシステムレベル設定を確認・修正すべき
3. `scripts\beta\launch.bat` の `setlocal` 内で `M3E_DATA_DIR` をセットしているが、`npm start` 子プロセスに渡る前に `endlocal` される可能性 → bat の env 伝搬を要検証
4. アプリ起動時に実際に使われた `DATA_DIR` をログ出力して確認するのが確実

## 正しいデータの所在
**原本:** `C:\Users\Akaghef\Downloads\M3E_dataV1.sqlite`
- `akaghef-beta`: 350ノード, saved_at 2026-04-11T19:28:33 ← これが本物
- strategyボード、チュートリアル、Agent Status等すべて入っている

## 関連コード
- `beta/src/node/start_viewer.ts:62-69` — DATA_DIR, DEFAULT_DOC_ID 定義
- `beta/src/node/rapid_mvp.ts:555-582` — saveToSqlite（ON CONFLICT DO UPDATE で上書き）
- `scripts/beta/launch.bat` — M3E_DATA_DIR セット
- `install/dist/common_env.bat` — install版のパス定義
