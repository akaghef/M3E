# Visual Tests

## 概要

このフォルダには、MVP Viewer の見た目崩れを検知するための
Playwright ベースのビジュアル回帰テストを配置しています。

- テスト本体: `viewer.visual.spec.js`
- 比較対象: `#board` 領域のスクリーンショット
- 設定: `../../playwright.config.js`

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
npm --prefix mvp run test:visual
```

`mvp` フォルダ内から:

```bash
npm run test:visual
```

## ベースライン更新

見た目の変更を意図的に反映する場合のみ実行します。

```bash
npm --prefix mvp run test:visual:update
```

## 関連ファイル

- `mvp/tests/visual/viewer.visual.spec.js`
- `mvp/playwright.config.js`
- `mvp/test_server.js`
