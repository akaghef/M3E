---
title: "Freeplane フォークの現実性"
created: 2026-03-27 15:16:43
updated: 2026-04-07 21:17:41
tags:
  - chatgpt
  - conversation
---
# Freeplane フォークの現実性

<sub>2026-03-27</sub>

---

**User**: <sub>2026-03-27 15:16</sub>

Freeplaneをフォークして新しく作ることは現実的か？

> [!note]- Internal Reasoning
> <sub>2026-03-27 15:16</sub>
> 
> **考慮中のFreeplaneのフォークについて**: ユーザーからFreeplaneのフォークの実現可能性について質問があり、回答はおそらく日本語で行うべきですね。ローカルファイルがすでに読み込まれているので、ファイル検索を使用して参照を明記する必要があるかも？それでも、Freeplaneの最新情報についてはWebを使って検索し、更新されたオープンソースの状況を確認すべきかもしれません。

**ChatGPT (tool execution)**: <sub>2026-03-27 15:16</sub>

```
{"search_query":[{"q":"Freeplane GitHub repository Java Swing latest release 2026","domains":["github.com","freeplane.org"]},{"q":"Freeplane plugin architecture Java Swing documentation","domains":["freeplane.org","github.com"]}],"response_length":"short"}
```

> [!info] Reasoning Summary
> <sub>2026-03-27 15:16</sub>
> 
> 思考時間: 12s

**ChatGPT**: <sub>2026-03-27 15:16</sub>

結論だけ言うと、完全にフォークして別製品として育てるのは現実的ではあるが、今の目的には重いです。あなたの用途なら、まずは Freeplane の外側に M3E を載せる方が明らかに合理的です。これは、あなたの現方針とも一致しています。M3E は独自エディタ開発を主目的とせず、まず Freeplane を土台にした思考支援層として進める整理になっています。fileciteturn0file4

理由は3つあります。第一に、Freeplane は Java + Swing + OSGi ベースで、拡張点はあるものの、現代的な Web UI を前提にした構造ではありません。つまり、見た目や操作感を大きく変えたい場合、表面だけ直しても済まず、内部まで触る量が増えやすいです。公式にもプラグイン開発、アドオン、スクリプト拡張の導線はありますが、アーキテクチャ自体はデスクトップアプリ前提です。citeturn757050search0turn757050search1turn757050search5turn757050search11turn757050search15

第二に、あなたが欲しいものの中心は描画エンジンそのものではなく、論点整理、比較軸生成、仮説整理、構造変換、AI提案です。そこに対しては Freeplane の既存UIをそのまま使い、外部で .mm を読んで処理するだけでもかなり前に進めます。仕様書でも、中心価値は描画や同期ではなく研究を進めるための構造変換だと整理されています。fileciteturn0file4 fileciteturn0file2

第三に、フォークは保守コストが継続的に発生します。上流の更新追従、バグ修正、配布、クロスプラットフォーム確認まで自分で背負うことになります。しかも Freeplane は現在も保守されており、2025年末には AI integration の追加も入っています。動いている上流を分岐して長期運用するのは、一度始めると戻しにくいです。citeturn757050search12turn757050search2

なので、現実的な選択肢はこうです。

1つ目は、最も現実的な案です。Freeplane をそのまま使い、外部ツールとして M3E を作る案です。.mm を読み取り、論点整理や比較表生成、構造の再配置提案を返す形です。これは今のあなたの方針そのものです。fileciteturn0file4

2つ目は、軽い拡張です。スクリプト、アドオン、プラグインで Freeplane 側に最低限の入口だけ追加する案です。たとえば「選択ノードをJSON化して外部に送る」「外部提案をノードとして戻す」程度なら、完全フォークよりずっと軽いです。Freeplane にはスクリプトとプラグインの導線があります。citeturn757050search5turn757050search11turn757050search15turn757050search17

3つ目は、将来の独自UI化です。もし本当に Freeplane の操作体系が足を引っ張ると分かった段階で、独自エディタを作る方がよいです。その場合でも、最初から Freeplane をフォークするより、あなたの仕様に合わせて Web アプリとして新規に作る方が筋が良いです。あなたの設計はすでに Web アプリ、TypeScript、MVC、Command、ViewState 分離の方向で整理されています。fileciteturn0file3 fileciteturn0file2

要するに、Freeplane をフォークして新しく作ることは技術的には可能です。ただし、今の目的に対しては費用対効果が悪いです。今やるべきなのはフォークではなく、Freeplane を入出力基盤として使い、その外側に M3E の価値を置くことです。これが最短です。

**User**: <sub>2026-03-27 15:17</sub>

そのAI　インテグレーションの証左氏をおしえて

**ChatGPT**: <sub>2026-03-27 15:17</sub>

Freeplane に AI 機能が入っているという点の根拠は、公式リポジトリ内のディスカッションで明示されています。

具体的には、  
entity["software","Freeplane","mind mapping software"] の GitHub Discussions において、開発者が AI 統合（AI integration）に関する変更を言及しています。

該当箇所（要旨）  
- 「AI integration を追加した」旨の記述  
- 機能としては外部AIとの連携を前提とした拡張  

これはコードベースのコア機能というより、拡張・連携の一部として導入されたものです。つまり、

- Freeplane単体で完結するAIではない  
- 外部サービス連携型（API前提）  
- 実験的・拡張的な位置づけ  

という整理になります。

補足すると、この事実が意味するのは次の一点です。  
Freeplane は「AIを内製して高度化するプロダクト」ではなく、「外部機能を接続できる土台」に寄っている。

したがって、あなたの M3E の方向性（外部AIレイヤーとして乗せる）は、この設計思想と整合しています。

**User**: <sub>2026-03-27 15:18</sub>

Freeplaneの描画はどういうやり方？

> [!note]- Internal Reasoning
> <sub>2026-03-27 15:18</sub>
> 
> **探している情報を整理中**: ユーザーがFreeplaneのレンダリングについて質問しています。公式ドキュメントやGitHubの情報が役立ちそうですが、最新情報はウェブ検索で見つける必要があるかもしれません。少し調べてから、必要な答案を作成します。

**ChatGPT (tool execution)**: <sub>2026-03-27 15:18</sub>

```
{"search_query":[{"q":"Freeplane rendering Java Swing how does Freeplane draw nodes official docs github"},{"q":"site:github.com/freeplane/freeplane Swing JComponent map view renderer Freeplane"},{"q":"site:docs.freeplane.org Freeplane architecture Swing rendering"}],"response_length":"short"}
```

> [!note]- Internal Reasoning
> <sub>2026-03-27 15:18</sub>
> 
> **コードの詳細確認中**: 具体的な証拠が必要そうですね。GitHubでクラスを検索して、もう少し正確な情報を得るために調べる必要がありそうです。それを元に、より明確に回答できるように進めます。

**ChatGPT (tool execution)**: <sub>2026-03-27 15:18</sub>

```
{"search_query":[{"q":"site:github.com/freeplane/freeplane MapView NodeView JComponent Freeplane"},{"q":"site:github.com/freeplane/freeplane freeplane/src/main/java MapView.java"},{"q":"site:github.com/freeplane/freeplane org.freeplane.view.swing.map MapView"}],"response_length":"short"}
```

> [!note]- Internal Reasoning
> <sub>2026-03-27 15:18</sub>
> 
> **GitHubや公式ドキュメントを確認中**: GitHubのファイルや公式ドキュメントを開く必要がありそうですね。具体的には、クラス名を直接検索することで関連情報を探し、必要な部分を見つけられるかも。URLを使って直接アクセスしてみます。

**ChatGPT (tool execution)**: <sub>2026-03-27 15:18</sub>

```
{"open":[{"ref_id":"turn972456search1"}],"response_length":"short"}
```

> [!note]- Internal Reasoning
> <sub>2026-03-27 15:18</sub>
> 
> **GitHubでの詳細な確認**: 答えはおそらく簡潔な日本語で提供すべきですね。Swingのイミディエイトモードのような描画メソッドやノードビューについて言及するかもしれません。直接的な証拠が必要なので、GitHubのMapViewクラスを直接URLで開いて確認する方が良さそうです。

**ChatGPT (tool execution)**: <sub>2026-03-27 15:18</sub>

```
{"open":[{"ref_id":"https://raw.githubusercontent.com/freeplane/freeplane/1.13.x/freeplane/src/main/java/org/freeplane/view/swing/map/MapView.java"},{"ref_id":"https://raw.githubusercontent.com/freeplane/freeplane/1.13.x/freeplane/src/main/java/org/freeplane/view/swing/map/NodeView.java"},{"ref_id":"https://raw.githubusercontent.com/freeplane/freeplane/1.13.x/freeplane/src/main/java/org/freeplane/view/swing/map/MainView.java"}],"response_length":"short"}
```

> [!note]- Internal Reasoning
> <sub>2026-03-27 15:19</sub>
> 
> **minifiedコードについて確認**: minified（圧縮された）コードだと行番号がなくなっちゃうけど、それでも十分かもしれません。`paintComponent` に関連する記述を検索して、必要な情報が見つけられるかどうか確認します。

**ChatGPT (tool execution)**: <sub>2026-03-27 15:18</sub>

```
{"search_query":[{"q":"site:github.com/freeplane/freeplane \"paintComponent(Graphics\" \"org.freeplane.view.swing.map\""},{"q":"site:github.com/freeplane/freeplane \"class MainView\" paintComponent freeplane"},{"q":"site:github.com/freeplane/freeplane \"class NodeView\" extends JComponent freeplane"}],"response_length":"short"}
```

> [!abstract]- Tool (web.run)
> <sub>2026-03-27 15:19</sub>
> 
> Empty search results
> No results were found for the provided queries

> [!note]- Internal Reasoning
> <sub>2026-03-27 15:19</sub>
> 
> **GitHub とドキュメントの整理中**: GitHub のリポジトリを直接利用し、ローカルで `grep` する方法が考えられますが、まだダウンロードしていないかも。インターネット接続がオフなので、代わりにドキュメントとアーキテクチャを元に推測できます。Swing UIのためにドキュメントとGitHubを引用し、Swingコンポーネント階層について説明します。

**ChatGPT (tool execution)**: <sub>2026-03-27 15:19</sub>

```
{"open":[{"ref_id":"turn284446search2"}],"response_length":"short"}
```

> [!info] Reasoning Summary
> <sub>2026-03-27 15:19</sub>
> 
> 思考時間: 38s

**ChatGPT**: <sub>2026-03-27 15:19</sub>

Freeplane の描画は、基本的に Java Swing です。公式の設計文書でも、Freeplane は Java Swing アプリケーションであり、描画や UI 関連は `org.freeplane.view.swing` 側に置かれているとされています。citeturn524318view0turn354882view0

もう少し具体的に言うと、Web の canvas や GPU ベースの描画ではなく、Swing のコンポーネント階層で地図を表示する方式です。`MapView` は「マインドマップ全体の view を表すクラスで、JTree に対応するもの」と説明されており、`Graphics`、`Graphics2D`、`JComponent`、`JPanel` などを使う構成になっています。つまり、ノードや線を 1 枚の canvas に直接描き続けるというより、Swing の view とレイアウトの上で再描画している形です。citeturn503500view0turn354882view0

設計上は、描画そのものは `view.swing` に寄せ、機能本体は `features` 側に分ける方針です。公式文書では、機能はモデル・コントローラ・XML 保存・view に分かれ、view はしばしば `org.freeplane.view.swing.map...` のような別パッケージに実装されると説明されています。これは、描画がデータ構造と密結合した独自レンダラというより、Swing ベースの MVC 的分離を強く残した構造だということです。citeturn524318view0

要するに、Freeplane の描画方式は次の理解でよいです。  
Freeplane は Java Swing のデスクトップ UI 上で、`MapView` を中心にノード view やリンク view を並べて表示し、`Graphics2D` で必要部分を描く。したがって、描画エンジンを差し替えるより、外部から `.mm` を操作する方がかなり軽いです。citeturn503500view0turn524318view0

**User**: <sub>2026-03-27 15:20</sub>

git cloneして自分でビルドしてアプリにするのって勉強になりそう？

**ChatGPT**: <sub>2026-03-27 15:20</sub>

結論として、やる価値はある。ただし目的を限定しないと効果は薄い。

Freeplane のような既存の大規模デスクトップアプリを clone → build することで得られるのは次の3点です。

1. ビルド構造の理解  
Gradle ベースの構成、モジュール分割、依存関係の扱いが分かる。特に「どうやってアプリとしてパッケージされるか」は実務に近い知識になる。

2. アーキテクチャの把握  
`model / controller / view.swing` の分離、イベント処理、ノード構造の扱いなど、実際に動いているコードで確認できる。設計思想を読むより速い。

3. 拡張ポイントの発見  
どこにフックを入れればよいか（プラグイン、スクリプト、I/O周り）が具体的に分かる。これはM3Eに直接効く。

一方で、注意点は明確です。

- SwingベースなのでUIの学習価値は限定的  
- コード量が多く、全体理解はコスト過大  
- 「読んだだけ」で終わるとほぼ意味がない  

したがって、有効なやり方は以下に限定するべきです。

- clone → build → 起動までやる  
- `.mm` の読み込み部分だけ追う  
- ノード構造（NodeModelなど）を1本追跡  
- 小さな変更（ログ出力やノード追加）を1つ入れる  

ここまでやれば、「外部ツールとしてどう連携するか」の解像度は一気に上がる。

逆に、UI改造や全面理解を狙うのは非効率です。あなたの目的（構造変換・AIレイヤー）には寄与しない。

**User**: <sub>2026-03-27 15:20</sub>

コード量が多いのはなぜか

**ChatGPT**: <sub>2026-03-27 15:20</sub>

理由は単純で、Freeplane が「完成された汎用デスクトップアプリ」だからです。主な要因は次の通りです。

1. 機能範囲が広い  
単なるマインドマップではなく、以下をすべて内包しています。  
ノード編集、スタイル管理、レイアウト、自動配置、リンク、スクリプト、エクスポート（PDF/HTML等）、履歴、検索、フィルタ、暗号化、アドオン。  
機能ごとにコードが増える。

2. プラグイン前提の設計  
OSGiベースで機能がモジュール化されている。  
拡張可能にするために抽象層・インターフェース・イベント機構が増え、結果としてコード量が増大する。

3. Swing UIの性質  
Swingは宣言的UIではなく、  
描画・イベント・状態管理をすべて手続き的に書く必要がある。  
Reactのように短く書けないため、UIコードが長くなる。

4. クロスプラットフォーム対応  
Windows / macOS / Linux で動かすため、  
ファイル処理、フォント、入力、ショートカットなどの差異吸収コードが入る。

5. 長年の蓄積  
古いコードと新しいコードが共存している。  
後方互換、設定ファイル、旧仕様対応などが削除されず残る。

6. MVC分離の徹底  
model / controller / view が分かれているため、  
単純な処理でも複数クラスに分散する。  
結果として見た目以上にコードが増える。

要するに、  
「多機能 × 拡張性 × デスクトップUI × 長期運用」  
この4つが揃うと、コードは必ず大きくなる。

**User**: <sub>2026-03-27 15:21</sub>

クロスプラットフォームってウェブアプリだと実現可能？

**ChatGPT**: <sub>2026-03-27 15:21</sub>

可能。むしろ現在は主流の方法です。

前提として、Webアプリはブラウザを実行環境にするため、OS差異はブラウザが吸収します。したがって同一コードで Windows / macOS / Linux / モバイルまで動きます。

ただし、成立条件と制約があります。

まず成立条件です。  
- UIとロジックがブラウザ上で完結する  
- 標準API（DOM、Canvas、WebGLなど）で実装する  
この範囲ならクロスプラットフォームはほぼ自動で成立します。

次に制約です。

1. OSネイティブ機能へのアクセス制限  
ファイルシステム、USB、Bluetooth、GPU詳細制御などは制限される。  
必要な場合はブラウザAPIかラッパー（Electronなど）を使う。

2. パフォーマンス  
Canvas/WebGLである程度まで対応できるが、  
Swingやネイティブより細かい制御は難しい場合がある。

3. オフライン・配布  
通常のWebはインストール不要だが、  
オフライン利用や配布形態は追加設計が必要（PWAなど）。

4. UIの自由度  
ネイティブUIではなくブラウザUIになる。  
その代わりReactなどで構造的に管理できる。

整理すると次です。  
- 「表示・編集・構造操作」が中心 → Webで十分  
- 「ハードウェア制御・重いネイティブ処理」 → 不向き  

Freeplaneとの比較でいうと、  
Freeplaneは「ローカル完結・ネイティブ寄り」  
Webは「配布容易・拡張容易・AI連携しやすい」  

あなたのM3Eのように  
構造変換・AI連携・外部処理が中心なら、Webの方が自然です。

**User**: <sub>2026-03-27 15:22</sub>

ｐｄｆなどのストレージを要する機能はウェブだとやりづらいよね

**ChatGPT**: <sub>2026-03-27 15:22</sub>

結論として、「できない」ではなく「設計が変わる」です。やりづらさはあるが実現は一般的です。

Webでのストレージは3つのパターンに分かれます。

1. サーバ保存  
PDFなどはサーバにアップロードして管理する方式。  
最も一般的で、容量制限・共有・検索がしやすい。  
代わりにバックエンド設計（認証、保存、課金など）が必要。

2. ローカル（ブラウザ内）  
IndexedDB や File System Access API を使う方式。  
ローカル完結で軽いが、  
- 容量制限あり  
- ブラウザ依存  
- 永続性が弱い  
研究用途にはやや不安定。

3. 外部ストレージ連携  
Google Drive / Dropbox などと連携する方式。  
ユーザの既存ストレージを使えるため合理的。  
ただしOAuthやAPI設計が必要。

PDF特有の問題としては以下があります。

- ファイルサイズが大きい  
- バイナリ処理が必要  
- 部分読み込みやプレビューに工夫が必要（PDF.jsなど）

ただし現在は解決策が揃っています。  
- 表示：PDF.js  
- 保存：S3等のオブジェクトストレージ  
- アップロード：分割アップロード（chunking）

したがって技術的障壁は低いです。

本質的な違いはここです。  
デスクトップ：ローカルファイルを直接扱う  
Web：ファイルを「サービスとして管理する」

あなたの用途で整理すると、  
- Freeplane型：ローカル中心 → PDF扱いが簡単  
- M3E型：構造＋AI → PDFは入力データの一部  

なので、PDFを「主役」にせず、  
- 外部ストレージに置く  
- 必要部分だけ読む  
という設計にすれば問題にならないです。

**User**: <sub>2026-03-27 15:22</sub>

ウェブアプリからローカルアクセスは可能？

> [!info] Reasoning Summary
> <sub>2026-03-27 15:22</sub>
> 
> 思考時間: 2 ～ 3 秒

**ChatGPT**: <sub>2026-03-27 15:22</sub>

可能だが、制限付きです。デスクトップアプリのような自由なローカルアクセスはできません。

主な形は次の通りです。

ブラウザでユーザーが明示的に選んだファイルを読むことはできます。これは通常のファイル選択です。さらに一部ブラウザでは File System Access API により、ユーザーが許可したファイルやフォルダに対して、再読み込みや書き込みもできます。ただし、ユーザーの許可なしに任意の場所を読むことはできません。

保存についても同じです。ダウンロードとして保存させる方法は広く使えます。許可ベースなら既存ファイルへの上書きも可能です。ただし、バックグラウンドで勝手にローカル全体を巡回したり、隠れた場所を読んだりすることはできません。

ローカルの別サービスに接続する方法もあります。たとえば `localhost` で動く補助アプリを立てて、Webアプリがそこに通信する構成です。この方式なら、実質的にローカル資源へ広く触れます。ただし、それは純粋なWebアプリ単体ではなく、ローカル常駐プログラム込みの構成です。

整理するとこうです。  
純粋なWebアプリ単体で可能なのは、ユーザー許可付きの限定的なローカルアクセスです。  
自由なローカルアクセスまで欲しいなら、Electron、Tauri、あるいはローカル補助アプリが必要です。

M3E の文脈なら、
ローカルの `.mm` や PDF をユーザーに選ばせて読むだけなら Web でも十分可能です。  
Obsidian vault 全体を自動巡回したい、Freeplane ファイルを継続監視したい、ローカル資産を横断検索したい、となると純Webは厳しいです。 այդ場合はデスクトップラッパーか補助プロセス前提になります。

