# ADR_010: Radial Surface View を廃止し Tree へ畳む

- Status: accepted
- Date: 2026-08-25
- Deciders: akaghef
- Related: [map_layout_modes.md](../03_Spec/map_layout_modes.md) / [Decision_Pool 2026-08-25-001](../06_Operations/Decision_Pool.md) / [Decision_Pool 2026-08-23-001](../06_Operations/Decision_Pool.md)

## Context

Surface View 正本は `Tree / Axial / Radial / Disperse / System` の5種としていた。
Radial は「中心から発散して読む。主眼は中心概念からの展開」と定義され、
direction は `clockwise / counterclockwise / balanced` と規定されていた。

しかし PR #89 の検証中に、**canon の Radial は一度も実装されていない**ことが判明した。

観測された事実:

- 実装の Radial（内部 mode key `mindmap`）が持つ direction は
  `left/right` / `left` / `right` であり、canon が規定した角度系
  （`clockwise` / `counterclockwise` / `balanced`）ではない。
- 実ブラウザで描画すると、Radial の表示は root の左右に子を振り分けた
  **両側 Tree そのもの**であり、角度配置は存在しない。
- 診断・port 選択の経路は Tree と共有されている。
  `03d1fc3` が Tree の direction 規則を global 化した際、それが Radial へ流入し、
  Radial の一方向表示で接続線が他ノードの矩形を貫通する不具合が発生した
  （Logic Chart = Tree preset では同条件で発生しない）。

つまり Radial は、固有の幾何を持たないまま Tree と実体を共有し、
**同じ実体に2つの名前がある**状態だった。今回の不具合はその重複の症状である。

## Decision

**Radial を Surface View から廃止し、Tree に畳む。**

- Surface View 正本は `Tree / Axial / Disperse / System` の **4種**とする。
- 旧「Mind Map」「`balanced-tree`」は **Tree の両側 preset**（`direction: left/right`）として扱う。
- 現況のコード・UI・seam lab から Radial / `mindmap` の実体を削除する。
- 残す痕跡は **git 履歴と本 ADR のみ**。仕様書の現況記述からは削除する。

## Rationale

Radial が Tree と別に立つための固有の主張は次の4点だった。

| 軸 | Tree | Radial（canon の意図） | Disperse |
|---|---|---|---|
| 位置を決めるもの | depth 軸 + breadth 軸 | 中心からの角度 | 近接・力学 |
| root の扱い | 端に置く | 中心に置く | 特権なし |
| 兄弟の順序 | 保存する | 角度順に保存する | 保存しない |
| 決定性 | 決定的 | 決定的 | force は非決定的 |

このうち実装が満たしていたのは Tree と同じ列だけであり、
角度・中心配置・角度順序のいずれも存在しなかった。

「左右に振り分ける」だけなら `Tree direction: left/right` で足りる。
「中心の周囲に配置する」なら Disperse が担う。
中間に位置する固有の価値（決定的かつ順序保存の 360° 展開）は、
実装されていない以上、現時点の M3E には存在しない。

存在しない概念に名前を与え続けると、実体を共有したまま語彙だけが分岐し、
今回のような port 規則の誤流入を繰り返す。

## Consequences

- Surface View の語彙が1つ減り、Tree と Radial の境界に関する判断が不要になる。
- Radial 固有の不具合（接続線の矩形貫通）は、対象の削除により消滅する。
- 既存 map の内部 mode key `mindmap` / `balanced-tree` は
  **保存スキーマ上の legacy 値**として読み取り互換を維持し、Tree の両側 preset へ移行する。
  移行の実装時期は Surface View の保存スキーマ移行（D2）に合わせる。
- 将来「決定的かつ順序保存の 360° 展開」が必要になった場合は、
  本 ADR を supersede する新 ADR を立てて再導入する。実装のない予約席は置かない。

## Alternatives considered

- **canon どおり角度配置の Radial を新規実装する**: Tree とも Disperse とも明確に別物になり、
  port 誤流入の温床も消える。ただし現時点で「root を中心に 360° 展開して見渡す」読み方を
  必要とする具体的な用途が確認できなかったため採らない。
- **現状維持（Radial = Tree の別名）**: 実体1つに名前2つの状態を残す。
  今回の不具合を生んだ構造そのものであり、採らない。
