# 検証記録

実行日: 2026-07-20

## Automated check

```text
npm run test:runtime-board
```

検証対象:

1. graph、legend、minimap、step overlayの初期表示
2. step 1→6の遷移とactive / completed状態
3. node選択によるdetail drawerの開閉と内容
4. play / pauseによる時系列進行

結果: **4 tests passed**。専用port `14277`、Chromium、viewport 1440×900で確認した。

## Captured evidence

`runtime-board.png` は同じ実装を専用port `14278`で起動し、step 5（Phase 1 基盤抽選）へ進めて取得した。製品受入れの証明ではなく、実験画面を将来比較するための固定証拠として扱う。
