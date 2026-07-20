# 実装差分の責任範囲

| 対象 | 実験内容 |
|---|---|
| `beta/viewer.css` | 背景grid、panel、button、node、edge、drawer相当のNeon装飾 |
| `beta/viewer.html` | theme用fontと表示shellの調整 |
| `beta/src/browser/viewer.ts` | node状態に応じたclass・表示属性の追加 |
| `beta/src/browser/workbench-ui.tsx` | workbench表現のtheme整合 |
| `beta/src/shared/node_draw_svg.ts` | SVG nodeの色・線表現の調整 |

## 再利用時の制約

- patchを現行viewerへ一括適用しない。CSS token、状態class、SVG表現を別々に比較する。
- node / edge / mapの意味やデータ構造は変更対象にしない。
- keyboard操作、hit-test、contrast、visual regressionを現行基準で再検証する。
- screenshotは選定証拠であり、pixel-perfectな製品仕様ではない。

## Bundle作成時の検証

- `npm run build`: 成功（Node / Browser / Workbench TypeScript compileとVite production build）。
- Chrome、viewport 1440×900でdefault sampleを読み込み、4 nodes / 0 linksの表示とNeon装飾を目視確認。
- 起動時に一部optional resourceの404を確認したため、この画面証拠だけを機能受入れ判定には使わない。
