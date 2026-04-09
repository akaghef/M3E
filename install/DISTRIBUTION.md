# M3E — セットアップガイド

## ダウンロード

**[M3E をダウンロード (zip)](https://github.com/akaghef/M3E/archive/refs/heads/main.zip)**

ダウンロード後、展開して以下の手順でセットアップ。

---

## インストール

### Windows

**`install\setup.bat`** をダブルクリックしてください。

### macOS / Linux

ターミナルで以下を実行:

```bash
bash install/setup.sh
```

### インストーラーが自動で行うこと

1. Node.js をダウンロード（未インストールの場合）
2. データ保存先を確認
3. チュートリアルデータの配置（初回のみ）
4. アプリのビルド
5. アプリアイコンの生成（自動変換）
6. デスクトップショートカット作成（アイコン付き）
   - Windows: `.lnk` ショートカット
   - macOS: `.app` バンドル
   - Linux: `.desktop` ファイル

> Node.js のインストールやコマンド操作は不要です。

---

## 起動

デスクトップの **M3E** をダブルクリック。

ブラウザで `http://localhost:38482/viewer.html` が開きます。

終了するにはターミナルを閉じるか Ctrl+C。

---

## 設定変更

| OS | 設定ファイル |
|----|------------|
| Windows | `%LOCALAPPDATA%\M3E\m3e.conf` |
| macOS | `~/Library/Application Support/M3E/m3e.conf` |
| Linux | `~/.config/M3E/m3e.conf` |

```
M3E_DATA_DIR=/path/to/data
M3E_PORT=38482
```

設定をリセットするには `m3e.conf` を削除してセットアップを再実行。

---

## 配布

上記のダウンロードリンクを共有するだけ。受け取った人は展開してセットアップスクリプトを実行すれば完了。

なお、運用負担と再現性の観点で、主軸は installer 配布へ移行する。
設計方針は次を参照:

- `dev-docs/06_Operations/Distribution_Validation_Balanced_Plan.md`
- 新導線の実装先: `install2/`

### 最小構成

```
install/
  assets/
    image.jpg       ← アイコン原画
    tutorial/       ← チュートリアル用サンプルデータ
  setup.bat
  setup.sh
final/              (ソースのみ、node_modules/dist は除外)
scripts/final/
LICENSE
```

---

## トラブルシューティング

| 問題 | 対処 |
|------|------|
| ダウンロード失敗 | インターネット接続を確認して再実行 |
| ビルド失敗 | セットアップスクリプトを再実行 |
| ポート使用中 | ランチャーが自動で既存プロセスを停止します |
| データ場所の確認 | 上記の設定ファイルを参照 |
