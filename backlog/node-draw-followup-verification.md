# node-draw seam: 追加検証の follow-up（2026-06-26、akaghef 指示でメモ・一旦飛ばす）

node-draw-seam (PR #67) は第一 ratchet（静的 fragment 描画＋EN5-Lite）で着地。node にはまだ検証すべきことが多数あり、一旦飛ばして PN を先にやる。後で戻る。

## 未検証・要追加（akaghef 指摘）
- **当たり判定（hit-testing）**: node の click/hover/drag/selection のヒット領域。`rect.node-hit` の範囲が見た目と一致するか。lab で未検証。
- **見た目の判定（visual fidelity）**: product とのピクセル一致、font/字間、badge 位置、長文 wrap/overflow、色コントラスト、複数行、icon/alias bracket。golden が静的 fragment 文字列のみで、視覚回帰（screenshot diff baseline）が未整備。

## spec 上の deferred（node-draw-seam で別 seam 化と明記済み）
- **EN5-Full**: real-server node snapshot route（createAppServer）。broad promotion 前の必須 follow-up。今は EN5-Lite。
- **tabular** node component（第一 ratchet 外、別 seam）。
- **folder preview mini graph**（viewer-owned 温存、folderPreview/surfaceDraw seam で別起票）。
- **Markdown/Mermaid preview**（markdown_renderer.ts / preview seam）。

## その他（戻る時に検討）
- node interaction 状態（hover, inline editor, drag ghost, drop target）の lab 検証。
- node visual state の網羅（review/cut/link-source 等は入れたが、組合せ・edge case）。
- 視覚回帰の自動化（Playwright screenshot baseline）＝ G-GUI 自動化（Development_System.md §3.4）と合流させる候補。

関連: `.kiro/specs/node-draw-seam/`、`docs/06_Operations/Development_System.md`（承認ゲート/EN5-Full/G-GUI）。
