# Viewer Neon 表現実験

## Why

viewerのNeon調表現を製品コードから切り離し、将来のデザイン比較に使える自己完結したidea bundleとして保存する。現在のUI方針への採用を意味しない。

## Idea

- 深い紺色の背景、グリッド、glowによりcanvasの奥行きを強調する。
- node種別と選択状態を色・halo・線幅で識別する。
- toolbar、meta-panel、statusを半透明panelとして統一する。
- mapの構造を変えず、viewerのpresentation layerだけで印象を変更する。

## Bundle contents

- [`viewer-neon.png`](./viewer-neon.png): default sampleを全体表示した実験画面
- [`viewer-neon-implementation.patch`](./viewer-neon-implementation.patch): 5ファイルの実装差分
- [`implementation-notes.md`](./implementation-notes.md): 差分の責任範囲と再利用時の注意点

## Provenance

- `codex/viewer-neon`: viewerのNeon cinematic themeを試作するための作業系統。
- `537abae`: viewer、workbench、SVG node描画、CSS、HTMLへNeon表現を加えた変更。
- 取得日: 2026-07-20

## Open Questions

- glowとgridは長時間利用時の可読性・疲労に耐えるか。
- nodeType、選択、hover、focusの色が意味的に衝突しないか。
- 既存のVisual Design Guidelinesへ昇格させる要素はどれか。
- Windows / macOSのfont rendering差を許容できるか。

## Next Action

現行viewerと同一map・同一viewportで比較し、採用するtokenと破棄する装飾を分離してから仕様へ昇格する。

Related: `S2` Team Collaboration / Demo quality
