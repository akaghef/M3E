# ADR 003: Freeplane-Informed Custom Engine

## Status

Accepted

## Date

2026-03-30

## Context

Freeplane-first は、研究支援価値の検証を早く進めるうえでは有効だった。
しかし、M3E の独自価値は Freeplane 上の補助レイヤーに閉じず、
研究思考に合った描画、操作、差分提示の設計そのものにある。

Freeplane に UI と操作を委ね続けると、次の制約が大きい。

- M3E 固有の操作系を作りにくい
- 描画と意味づけを一体で設計しにくい
- `scope` `alias` `command` などの中核概念を自然に表しにくい
- AI 提案の差分提示を M3E 主導で設計しにくい

一方で Freeplane 自体には、`.mm` 構造、ノード属性、保存運用など参考にできる点が多い。

## Decision

M3E は Freeplane を参考実装および互換入力形式として扱い、
描画エンジンと操作系は M3E 側で自作する。

## Decision Details

- `.mm` は当面の互換入力形式として扱う
- Freeplane の `text` `details` `note` `attributes` `link` は参考にする
- UI shell は React + TypeScript を基盤にする
- 描画は独立したレンダリング層として実装する
- 初期描画は SVG 先行でよいが、レイアウトと描画を分離して Canvas 移行可能性を残す
- M3E の中核モデルは Freeplane の内部表現に委ねない

## Consequences

### Positive

- M3E 固有の思考支援 UI を最初から設計できる
- 描画と操作をモデルに合わせて最適化できる
- Freeplane 互換を保ちながら独自進化できる

### Negative

- 初期実装コストが上がる
- Undo/Redo、入力、保存、描画品質を自前で担保する必要がある
- Freeplane-first より立ち上がり速度は下がる可能性がある

### Follow-up

- MVP 定義を独自描画前提に更新する
- Freeplane から取り込む要素と持ち込まない要素を明文化する
- 描画層の境界を `04_Architecture` で明文化する

## Related

- 方針文書: [../02_Strategy/Current_Pivot_Freeplane_First.md](../02_Strategy/Current_Pivot_Freeplane_First.md)
- 帯域仕様: [../03_Spec/Band_Spec.md](../03_Spec/Band_Spec.md)
- 写像: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
- 旧判断: [./ADR_001_Freeplane_First.md](./ADR_001_Freeplane_First.md)
- UI 基盤判断: [./ADR_002_React_UI_Basis.md](./ADR_002_React_UI_Basis.md)
