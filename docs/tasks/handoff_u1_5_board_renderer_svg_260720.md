# Handoff: U1.5 — Board Renderer SVG 化（OP2 移行）

- 日付: 2026-07-20
- 起草: Claude Director
- 状態: **withdrawn（2026-07-20）** — 要件未確定のまま Director が dispatch した手続き誤り。
  akaghef の指摘により停止。renderer 技術方針（OP2=SVG）自体は有効だが、board の製品要件を
  固めてから再 handoff する。実装は未着手（worktree への書き込みなし）
- 前提: U1 実装済み（tasks 1-13 done、検証 green）。akaghef GUI 判定の結果、DOM レーン描画は
  参照実装（m3e-runtime-board-video-repro / Agent Orrery）に対し表現力不足と判定
- 関連: [handoff_track_u_orchestration_seam_260719.md](handoff_track_u_orchestration_seam_260719.md) /
  [ADR_009](../09_Decisions/ADR_009_Orchestration_Fusion_Into_M3E.md) /
  [agent_network_dashboard_reference_260707/](agent_network_dashboard_reference_260707/)

## 決定（akaghef 確定 2026-07-20）

**Rendering tier policy: demo/試作 = OP1(DOM)、標準ソフト(M3E 本体) = OP2(SVG)。**
canvas/WebGL(OP3/OP4) は seam 内部の差し替えオプションとして温存（契約変更なしで乗り換え可能な
ことを design.md に明記）。再評価 trigger = com use 成熟 かつ node 数が SVG 実用限界超過。

評価軸: AX1 = AI 操作可能性（DOM/SVG は selector で読める・Codex 目視確認が assert で機械化できる）、
AX2 = 描画性能（現スケール数百 node では SVG で十分）。決定は seam 契約の内側なので可逆。

## U1.5 スコープ

1. **generator**: `scripts/generate-orchestration-projection.mjs` で d3-force（導入済み）により
   layout を計算し、座標を projection JSON に焼き込む（**schema v0 の凍結 field は不変**。座標は
   追加の optional 拡張とせず、別ファイル or 生成時派生 — Track D との合意なしに schema を広げない）
2. **renderer**: DOM レーンを SVG graph 描画に差し替え（pan/zoom、status ring、edge 種別の線種/色、
   hover/click → detail card、legend）。既存導入済みライブラリ（@antv/x6 / @joint/core / 素の SVG +
   d3-zoom 相当の自作最小 transform）から選定し、選定理由を報告。**canvas 系（cytoscape 既定
   renderer）は不可**
3. **AI 可読性契約**: 全 node/edge に `data-node-id` / `data-kind` / `data-status` / `data-link-type`
   を付与。seam contract の tests 欄に selector assert を追加
4. **design.md 更新**: renderer 差し替え可能性の明記、Revalidation Triggers に再評価 trigger 追加

## 遵守（U1 から不変）

- read-only / exclusive seam / viewer.ts は wiring-only / schema v0 凍結 / 語彙 4 種のみ / fail-closed
- interaction vocabulary の手本 = `agent_network_dashboard_reference_260707/04_interaction_and_motion.md`
  （pan/zoom、ring 状態表現、detail card。replay/SELECT/voice は U1.5 非目標）

## D+C 一括（ADR_009 実行境界の初適用）

Codex は実装(D)と検証(C)を一括で行う: typecheck、unit（selector assert 含む）、vocabulary audit、
既存テスト no-impact。browser 実確認は Director → akaghef の順。
