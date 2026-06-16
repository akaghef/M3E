Freeplaneを土台にするなら、まず押さえるべき実装上の事実は3つです。

Freeplane本体は Java 製で、UI は Swing、構成は OSGi ベースです。つまり、Webアプリのように内部ロジックを TypeScript で直接いじる前提ではなく、Java の既存モデルに乗るか、`.mm` ファイルを外部から読む・書くラッパーとして使うか、の二択になります。[GitHub+1](https://github.com/freeplane/freeplane)

保存形式は `.mm` の XML です。公式文書でも Freeplane の文書形式は XML と明記されており、XSD が参照用に案内されています。したがって、最初に把握すべきデータ構造は「アプリ内部クラス」より「`.mm` の XML スキーマ」です。ここを読めば、ノード、属性、スタイル、リンク、折り畳み、位置情報など、永続化される情報の範囲が分かります。[Freeplane Documentation](https://docs.freeplane.org/attic/old-mediawiki-content/Document_Format.html)

スクリプト API では、基本単位は node と map です。`node.parent`、`node.map.root`、`children` で木構造を辿れます。また Node API では、ノードは mind map に属し、親子関係、折り畳み状態、自由配置、可視性、属性、リンクなどを持ちます。さらに path でノードを引く仕組みや、global node、node alias もあります。したがって、内部概念としては「根付き木＋各ノードに多量の付随プロパティ」が中心です。[Freeplane Documentation+2Freeplane Documentation+2](https://docs.freeplane.org/scripting/Scripting.html)

M3E の観点から見ると、かなり相性が良い部分と、そのままでは弱い部分がはっきりしています。相性が良いのは、親子主構造、折り畳み、ノード属性、リンク、ローカルスクリプト、XML 永続化です。これは、あなたが整理済みの「主構造は親子」「Command で操作」「ドラッグ中は ViewState だけ更新して drop 時のみ確定」という方針と噛み合います。

DragOperate

M3E仕様設計書

逆に弱いのは、M3E が想定している scope 境界、alias を厳密な参照として扱うこと、帯域ごとの UI モード分離、Web 前提の局所再描画や ViewState 分離です。Freeplane は高機能ですが、思想は「高機能なデスクトップ・マインドマップ」であって、「個人オフライン思考OS」ではありません。したがって、Freeplane をそのまま改造するより、当面は `.mm` を外部フォーマット兼既成UIとして利用し、M3E のコアモデルは別に持つ方が安全です。

M3E仕様設計書

M3E仕様設計書

実装レベルで優先して見る順番は、次です。

1. `.mm` の XML サンプルを数個作って差分を見る。
2. ノードに何が保存されるかを整理する。
3. alias 相当、リンク、属性、自由配置、折り畳みの表現を確認する。
4. M3E の Node/Scope/Alias/Command にどう写像するかを決める。
5. Freeplane を「編集UI」として使うのか、「入出力フォーマット」として使うのかを切り分ける。

結論だけ言うと、Freeplane を使うなら、最初に理解すべきデータ構造は次の抽象です。
 `Map -> Node tree -> Node properties(attributes, style, link, fold, position, text/object)`
 この上に M3E 側で
 `Scope / Alias / Band / Command / ViewState`
 を外付けする設計が現実的です。[Freeplane Documentation+1](https://docs.freeplane.org/api/org/freeplane/api/NodeRO.html)

M3E仕様2

必要なら次に、Freeplane の `.mm` の最小サンプルを分解して、M3E の内部 JSON スキーマ案まで落として出します。