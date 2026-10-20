# ADR_013: Lane Surface View を追加し System と区別する

- Status: accepted
- Date: 2026-10-17
- Deciders: akaghef
- Supersedes (in part): [ADR_011](ADR_011_Agent_Orrery_As_M3E_Map.md) / [ADR_012](ADR_012_Radial_Surface_View_Restoration.md) — Surface View の種別一覧と layered architecture 図の対応のみ。Radial / Disperse の決定は維持する。
- Related: [map_layout_modes.md](../03_Spec/map_layout_modes.md) / [Data_Model.md](../03_Spec/Data_Model.md) / [ADR_012](ADR_012_Radial_Surface_View_Restoration.md) / [Pipeline_UI_Reference.md](../04_Architecture/Pipeline_UI_Reference.md)

## Context

層状の図式は、root node の直下の子 node を並列に見せ、その下の孫 node 間の関係を読む。root node は必ずしも scope ではない。この投影はレーンに整列できないフローチャート様の構造を扱う System view とは異なる。

## Decision

Surface View に `Lane` を第6種として追加する。正本は `Tree / Axial / Radial / Disperse / System / Lane` とする。ADR_012 が定めた Radial と Disperse の関係は維持する。

- Lane は root 直下の子 node を `children[]` の兄弟順序に従って並行するレーンへ投影し、各孫 node を親のレーン内に置く。
- direction `down` はレーンを行として縦に並べ、`right` は列として横に並べる。`space` と `edge` は既存 Surface View option の値を用いる。
- 孫 node 間の GraphLink を主線として表示し、レーン境界をまたぐ関係も表す。View の切替で永続 Topology は変わらない。
- レーン順、親子 `edge` から導出する孫 node の所属、親 node の組ごとに集計した GraphLink、兄弟順序の差が2以上の親 node 間の関係、異なるレーンで GraphLink を持たない孫 node の組は保存しない。
- 選択から計算する内訳の線は GraphLink ではなく、Lane view の Topology に含めない。
- 図式内の孫 node に `AI1` や `DEV5` のようなコードを付けない。
- GraphLink に任意の key-value data を保持する `attributes` property を仕様として加える。関係の実現段階などが表す情報は Content とし、`LinkStyle` への写像は Style とする。
- System はレーンに整列できないフローチャート様の構造を扱う。既存 subtype `containment / module / architecture` は維持する。

## Rationale

Lane は既存の tree と GraphLink を投影する Surface View であり、別のデータ構造を要求しない。親子階層を主線にする Tree / Axial や、力学配置を使う Radial / Disperse とも投影の目的が異なる。System の用途を非レーン型のフローチャート様構造に定めることで、層状の図式との区別を保つ。

## Consequences

- `map_layout_modes.md` と Glossary に6種の正本と Lane の projection / option を記載する。
- GraphLink の `attributes` は仕様のみであり、beta 実装への追加は別タスクとする。
- `System.subtype=architecture` は保持する。層状 architecture 図を Lane に割り当てると、この subtype の残る用途の境界には整理の余地がある。
