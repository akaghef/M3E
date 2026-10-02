# OT Force Seam Lab — source and adaptations

Required Notice: Copyright (c) 2026 gyroid

OT-derived force integration in `../../shared/ot_force.ts` is under
PolyForm Perimeter License 1.0.1: https://polyformproject.org/licenses/perimeter/1.0.1/

Upstream: gyroid-eth/orrery-telemetry, commit
`22ffe6483530e643c8fc1af486319990e0181de4`, `dashboard/index.html`.
Source dashboard SHA-256 (OT Component Seam Labs provenance):
`413a6e2f0c5bc8cf07b7e86c16dc22a3d4aae578ffd23fbcc70876567f6305ae`.

移植元: OT Component Seam Labsの`cut/surface-overview/logic.js`に保持された
`NETP_DEF` / `step()` / `runSim()` / `NC_CFG`。
inverse-square repulsion cutoff 300、Hooke spring、中心引力倍率 .04、減衰 .86、
成分速度上限18、二段冷却 .9/.7、移動量 .45 未満5frameの収束判定を踏襲する。

変更: DOM/global変数を型付き入力に変更。viewport中心・境界clampを固定world中心へ変更。
spawn専用ばねはM3Eの親子意味に流用しない。ばねは明示した関係のみ。
再加熱予算240 fixed steps、完全同座標の決定論的分離、矩形衝突、入れ子group、
collapseによる可視縮約、pin、停止理由、入力検証を追加。group間ばねの力はbranchの
可視メンバーへ配分し、group内重心への凝集力 .025 を追加する。逐語複製ではない。

Labはoffline fixtureのみ。実API、OT runtime、M3E DBへ接続しない。
製品ViewerやWebCola採用決定を変更しない。

起動: `beta/`で`npm run lab:force`。
入口: `http://127.0.0.1:14279/src/labs/force/force-lab.html`。
検証: `npx vitest run tests/unit/ot_force.test.ts`、`npm run typecheck`、
`npm run lint:deps`、`npm run build:browser`、実ブラウザ操作・目視。
