# ADR 001: Freeplane First

## Status

Superseded

## Date

2026-03-13

## Context

M3E の原案には独自エディタ開発が含まれていたが、初期フェーズでそれを主目標にすると、描画・入力制御・永続化・Undo/Redo・操作感の調整に大きく時間を使う。
一方で、当時の最優先は「M3E の科学研究支援が実際に研究を加速するか」の検証だった。

## Decision

当時の判断として、M3E は Freeplane を既存の思考整理基盤として採用し、その外側で構造読解・研究論点整理・AI 提案を行う方針を採用した。

## Consequences

### Positive

- 日常運用を早く始められた
- 独自 UI 実装のコストを先送りできた
- 思考支援そのものの価値検証に集中しやすかった

### Negative

- M3E 固有の `scope` `alias` `command` を Freeplane にそのまま載せられなかった
- 独自モデルと Freeplane のズレを意識し続ける必要があった

## Superseded By

- [ADR_003_Freeplane_Informed_Custom_Engine.md](./ADR_003_Freeplane_Informed_Custom_Engine.md)

## Related

- 新方針文書: [../02_Strategy/Current_Pivot_Freeplane_First.md](../02_Strategy/Current_Pivot_Freeplane_First.md)
- 帯域仕様: [../03_Spec/Band_Spec.md](../03_Spec/Band_Spec.md)
- 写像: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
- UI 基盤判断: [./ADR_002_React_UI_Basis.md](./ADR_002_React_UI_Basis.md)
