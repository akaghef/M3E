# Visual Tests

## 概要

このフォルダには、M3E beta Viewer の見た目崩れと主要なブラウザ操作の
Playwright 回帰テストを配置しています。

- テスト本体: `*.spec.js`
- 比較対象: `#board` 領域のスクリーンショット、およびDOM/操作結果
- 設定: `../../playwright.config.js`
- 既定ポート: `14174`

`test:visual` は daily beta の `4173` を再利用しません。テスト用の静的サーバー
`../../test_server.js` を専用ポートで起動します。

## テストケース

### 1. default sample visual baseline

確認内容:

1. `viewer.html` を開く
2. `Default` ボタンでサンプルを読み込む
3. `Fit all` で全体表示を安定化
4. `#board` を `default-sample.png` と比較

### 2. aircraft mm visual baseline

確認内容:

1. `Aircraft.mm` を読み込む
2. `Body` を選択して `Focus` で表示を寄せる
3. `#board` を `aircraft-mm-body-focus.png` と比較

## 実行方法

リポジトリルートから:

```bash
npm --prefix beta run test:visual
```

`beta` フォルダ内から:

```bash
npm run test:visual
```

## ベースライン更新

見た目の変更を意図的に反映する場合のみ実行します。

```bash
npm --prefix beta run test:visual:update
```

## 関連ファイル

- `beta/tests/visual/viewer.visual.spec.js`
- `beta/playwright.config.js`
- `beta/test_server.js`
