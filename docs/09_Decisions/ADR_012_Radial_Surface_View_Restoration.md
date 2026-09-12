# ADR_012: Radial Surface View を復活させ、Disperse と力学配置を共有する

- Status: accepted
- Date: 2026-09-03
- Deciders: akaghef
- Supersedes: [ADR_010: Radial Surface View を廃止し Tree へ畳む](ADR_010_Radial_Surface_View_Removal.md)
- Related: [map_layout_modes.md](../03_Spec/map_layout_modes.md) / [Disperse_Layout_Design.md](../04_Architecture/Disperse_Layout_Design.md) / [Decision_Pool 2026-08-27-002](../06_Operations/Decision_Pool.md)

## Context

ADR_010 は、当時の実装が canon の角度系（`clockwise / counterclockwise / balanced`）を
一度も持たず、実体が Tree の両側 preset と同一だったことを理由に Radial を廃止した。

この判断自体（「角度系の Radial は実装として存在しなかった」）は正しい。しかし
Radial という **概念**を Tree に畳んだことが誤りだった。Radial が Tree と混同されて
いたのは、Radial固有の意味が定義されていなかったためであり、角度系を諦めることは
Radial 概念そのものを消す理由にならない。

akaghef が改めて Radial と Disperse の違いを与えた:

> Radial は親子の edge を表示する。GraphLink も表示する。
> 一方で Disperse は、親子同士は edge ではなく、入れ子のカテゴリとして表す。
> ノード同士の関係性は GraphLink で記述される。

この定義により、Radial と Disperse は **同一の力学配置エンジンの上で、
親子関係の投影方式（edge か group か）だけが異なる2つの View** として定義できる。
角度系ではなく、この edge/group 軸こそが Radial の固有性である。

加えて、Radial・Disperse を含む全 Surface View は **同じ tree（+ GraphLink）構造**
の上に成立しており、View 間の違いは構造の有無ではなく **投影方式の違い**である
（[map_layout_modes.md](../03_Spec/map_layout_modes.md) 「意味上の分離」参照）。

## Decision

**Radial を Surface View 正本に復帰させる。正本は `Tree / Axial / Radial / Disperse / System` の5種。**

- **Radial**: tree の親子関係を **edge** として描画する。GraphLink も表示する。配置は
  力学系（direction を持たない）。
- **Disperse**: tree の親子関係を **入れ子（包含・group）** として描画する。画面に出る
  線は GraphLink のみ。配置は力学系。
- Radial と Disperse は同一の配置エンジン（WebCola、[Decision_Pool 2026-08-23-003](../06_Operations/Decision_Pool.md)）を共有する。差は WebCola へ親子関係を **link（バネ）として渡すか、group（包含制約）として渡すか**のみ。
- **角度系 option（`clockwise` / `counterclockwise` / `balanced`）は正本から削除する。** ADR_010 の指摘（実装実体がない）は正しいままなので、角度系は復活させない。
- Radial / Disperse の subtype は `scatter`（人が置いた座標をそのまま使う）/ `force`（力学配置）の2つ。**`cluster` という subtype は廃止する。** tree の group（親子の入れ子投影）は Disperse の切替可能な subtype ではなく、Disperse の既定の親子表現そのものである。
- Radial には group 投影が無いため、collapse した部分木は縮約されて単なる1ノードになる（Disperse の super-node 化と同じ「縮約」操作だが、group footprint は持たない）。

## Rationale

- 角度系を持たないことと、Radial という概念自体が無効であることは別の主張である。ADR_010 は前者のみを正しく指摘したが、後者まで結論してしまった。
- Radial と Disperse を「親子の投影方式が違うだけの兄弟 View」として再定義すると、実装は WebCola の呼び出し方の違いに縮退し、Tree との混同は起きない（角度系という誤った固有性の代わりに、edge/group という正しい固有性を持つ）。
- 「自由配置＝構造を持たない」という誤解を解くため、意味上の分離の記述も「同じ tree 構造をどう投影するか」に統一した。

## Consequences

- 正本 [map_layout_modes.md](../03_Spec/map_layout_modes.md) を5種構成に戻し、Disperse subtype 定義を `cluster` 抜きの2種に改める。
- Radial の実装（内部 mode key、UI、seam lab）を Disperse の力学配置エンジンと共有する形で再導入する。角度系コードは復元しない。
- 既存保存データの legacy `mindmap` は Tree の両側 preset のままでよい（ADR_010 の migration 方針を維持）。新規の Radial 選択は edge 投影の力学配置として保存する。

## Follow-up

- seam lab（layout-lab）に Radial の subtype（scatter / force）コントロールを追加する。
- `LayoutResult.groups?` は Disperse のみが埋める（Radial は使わない）契約のままでよいか、実装時に確認する。
