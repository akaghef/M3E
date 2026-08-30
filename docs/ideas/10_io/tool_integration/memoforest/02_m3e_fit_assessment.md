# M3E適合評価

## 結論

置換ではなく相補関係として扱う。

| 面 | Memoforest | M3E |
|---|---|---|
| 主用途 | 1文書を深く読む・分解・注釈する | 複数source / map / scopeを横断する |
| 主構造 | syntax tree + section + annotation | Rapid spine + Deep semantic graph |
| 強み | 編集連続性、Markdown、KaTeX、複数pane | identity、scope、typed relation、authority、projection |
| 弱み | cross-source authority / provenance不足 | 外部専用editorほどの局所編集UXは持たない |

## Fit

- 調査メモと論点分解
- 数式を含む長文読解
- treeを人間が手修正するRapid authoring
- AIとの対象限定manual round-trip
- M3E nodeから開くartifact portal

## Non-fit

- M3E全体のcanonical store
- Git / Obsidian / SaaSを横断する唯一のidentity registry
- raw database writeによる双方向同期
- proposal / approval / auditを省略した自動反映

## Product position hypothesis

M3E viewerからMemoforestへ「Open for deep reading」、MemoforestからM3Eへ「Publish proposal」を提供する。後者は直接上書きせず、diff、owner、base revision、provenanceを表示してSemantic Commandへ正規化する。

