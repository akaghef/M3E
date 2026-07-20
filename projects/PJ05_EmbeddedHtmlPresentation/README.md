# PJ05 Embedded HTML Presentation

status: active
started: 2026-05-14

## 目的

M3E の `map` / `node` / `edge` / `scope` を正本にしたまま、Dave Jeffery 型の flow walkthrough UI を埋め込み HTML surface として生成する。

最初の成果物は、既存の V4 service-equivalent demo と同じ内容を使い、以下の制約を満たす静的 presentation HTML とする。

- node 座標は固定する。
- flow / step の進行で変えるのは link highlight と説明 pane だけにする。
- progress bar は 2 段にする。
  - 上段: flow / chapter 粒度
  - 下段: step 粒度
- HTML は派生成果物であり、M3E state の正本ではない。

## 初期成果物

- `presentation_spec.json`: 固定 node 座標、link、flow、step の schema seed。
- `scripts/generate_v4_demo_presentation.mjs`: V4 demo 用 HTML generator。
- `docs/initial_contract.md`: PJ05 の初期契約。
- `docs/for-akaghef/pj05_presentation/260514_v4_embedded_presentation.html`: 生成済み review artifact。

## 現時点の扱い

これは viewer 本体への組み込み前の derived artifact である。
次段階では同じ `presentation_spec.json` 形を、M3E viewer overlay / embedded iframe / export artifact の共通入力にする。
