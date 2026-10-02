# IS5 — 公開 M3E における OT の PolyForm ライセンス境界

- status: open
- raised: 2026-09-21
- raised_by: fugu (Hermes)
- decided_by: akaghef
- source: `analysis/260921_am_ot_herdr_layer_comparison.md` IS5
- related: `ADR_011 DC18`（map を外部配布する経路を作る時点で再判断）

## 何が問われているか

OT（`gyroid-eth/orrery-telemetry`）は **PolyForm Perimeter License 1.0.1**（fugu が upstream
`LICENSE` で確認、2026-09-21）。source-available だが OSI の意味の open source ではなく、
**競合製品の他者提供に制約**がある。持ち込まれた外部 doc は次を指摘する:

> 別 process / plugin / 無償提供 / 別言語 port なら自動的に問題が無くなる、という条文ではない。
> M3E への適用は配布形態次第なので法的に断定しないが、**個人 A-sys への採用**と、
> **公開 M3E への同梱・必須依存化**は分けるべき。公開版は許諾・確認なしに OT 取り込みを前提にしない。

herdr は Apache-2.0 なのでこの制約は無い。

## なぜ今 PJ08 で問うか

- `farthest_goal` は外部利用を明示線に置いている（Swingby チーム知識マップ = human が他人になる初試験、
  将来の公開研究 DB `lo-Graph Atlas`）。
- `ADR_011 DC18` は「map を M3E の外へ配布・公開・共有する経路を作るときは、その時点で改めて判断する」と
  既に留保済み。本 Q はその留保を **ライセンス次元で具体化**する。

## 選択肢

| ID | 案 | 帰結 |
|---|---|---|
| **OP1** | **境界を明文化する。** 「OT は個人 A-sys / 非公開 multi-PC の runtime substrate としてのみ採用。公開 M3E への同梱・必須依存化は別判断（要 PolyForm 条項確認）」を PJ08 の範囲外セクションに追記 | 現行スコープ（個人 multi-PC + 常駐 host）と完全整合。撤退可能性（portable source + adapter が残る、S17.8-6）を担保。最小で安全 |
| **OP2** | **公開経路では OT を切り離せる adapter 境界を Phase 3 の要件に加える。** connector seam を OT 固有に密結合させず、観測層を差し替え可能にする | RK3（上流契約の非制御）への対処にもなる。設計コストは増えるが撤退線が強くなる |
| **OP3** | **今は判断しない。** 公開経路を実際に作る時点まで DC18 の留保のまま置く | ADR_011 現状維持。ただし Phase 3 で OT に密結合すると、後で剥がすコストが上がる |

## Director（fugu）の見立て

**OP1 を基本線、OP2 を Phase 3 設計時に併記**を推す。理由:

- OP1 は canon（DC18）と矛盾せず、doc の「個人採用と公開同梱を分ける」を素直に文書化するだけ。
- OP2 は farthest_goal RK3（上流非制御）と S17.8-6（撤退可能性）を実装レベルで満たす。connector seam を
  exclusive に切る（T-3-1 の done_when）方針とも整合し、追加コストは seam 設計の一部に吸収できる。
- 法的断定は避ける。PolyForm Perimeter の「競合製品」該当性は M3E の配布形態が確定してからでないと
  判断できない。ここでは「分けて扱う」という運用境界の合意だけを取る。

## akaghef の回答

<!-- ここに記入 -->
