# ADR 002: React UI Basis

## Status

Accepted

## Date

2026-03-13

## Context

これまでの設計では、無限平面とノード操作を前提に、Canvas 中心のアプリケーションとして考えていた。  
しかし現状では、開発時間が限られていること、フロントエンド実装の専門性が十分ではないこと、AI 支援を前提に開発を進めることを踏まえると、描画技術の純粋性よりも、短時間で安定して実装を継続できる構造を優先する必要がある。

## Decision

M3E の独自実装方針を、Canvas 中心の設計から、React を UI 基盤とし描画を独立したレンダリング層として扱う設計へ転換する。

## Decision Details

- パネル、ツールバー、検索、設定などの周辺 UI は React コンポーネントで実装する
- 思考マップの描画面は独立した rendering surface とする
- rendering surface の内部実装は Canvas または SVG を許容する
- コアデータモデルと操作ロジックはフレームワーク非依存の TypeScript に置く

## Rationale

- AI がコード生成しやすく、参照情報も得やすい
- 部品単位で修正や差し替えがしやすい
- 技術的負債を局所化しやすい
- 初期段階では性能最適化より実装速度と継続性を優先すべき

## Consequences

### Positive

- UI の進行を止めずに開発できる
- 描画技術の変更がコアロジックに波及しにくい
- 周辺 UI の実装を標準的な React パターンで進めやすい

### Negative

- UI shell と rendering layer の境界設計が必要になる
- 初期の描画実装が二重構造に見える可能性がある
- 純粋な Canvas 中心設計に比べると、構造の一貫性を明示的に守る必要がある

## Related

- Current Status: [../00_Home/Current_Status.md](../00_Home/Current_Status.md)
- MVC and Command: [../04_Architecture/MVC_and_Command.md](../04_Architecture/MVC_and_Command.md)
- Legacy: [../legacy/README.md](../legacy/README.md)
