# Freeplane Repository Structure Summary

## 概要

Freeplane のリポジトリは、単一アプリの小さなコードベースではなく、Gradle のマルチプロジェクト構成で組まれたデスクトップアプリケーション群として整理されている。  
中心には `freeplane` 本体があり、その周囲に API、フレームワーク、プラットフォーム補助、各種プラグイン、配布用スクリプトが配置されている。

この構成から読み取れるのは、Freeplane が「単なる Swing アプリ」ではなく、OSGi を前提にした拡張可能なアプリケーションとして育てられているということである。  
機能追加の多くは本体に直接埋め込むのではなく、`freeplane_plugin_*` 系モジュールに分かれている。

## ルートの見方

ルート直下には、ビルド設定、配布設定、モジュール群、CI 関連ファイルが並ぶ。

- `build.gradle`
- `settings.gradle`
- `*.dist.gradle`
- `freeplane/`
- `freeplane_api/`
- `freeplane_framework/`
- `freeplane_mac/`
- `freeplane_plugin_*`
- `freeplane_ant/`

`settings.gradle` に含まれているモジュールを見ると、このリポジトリが明確に「コア + API + フレームワーク + プラグイン + 補助モジュール」に分割されていることが分かる。

## 中核モジュール

### `freeplane/`

このディレクトリがアプリケーション本体である。  
UI、主要機能、画像やドキュメント、ライブラリ、アプリ本体のソースがここに集まっている。

主な下位構成は次の通り。

- `src/`: 本体ソース
- `lib/`: 本体が利用するライブラリ
- `doc/`: 本体寄りのドキュメント
- `images-src/`: 画像アセットの元データ

構造上は、ここがユーザーから見える Freeplane の中心である。

### `freeplane_api/`

このモジュールは公開 API の置き場として分離されている。  
Freeplane の内部実装と、外部拡張から触れさせたい契約面を切り分ける役割を持つ。

この分離は、プラグイン型アーキテクチャを維持する上で重要である。  
リポジトリの運用方針としても、公開 API は `freeplane_api` に置き、内部実装を不用意に漏らさないことが前提になっている。

### `freeplane_framework/`

このモジュールは実行基盤や配布基盤に近い責務を持っている。  
中には macOS バンドル、Windows アイコン、ポータブル版、インストーラ、補助スクリプトなど、アプリ本体というより「Freeplane を各環境で成立させるための足回り」が多く含まれる。

下位には以下のようなディレクトリがある。

- `mac-appbundler/`
- `windows-installer/`
- `windows-portable/`
- `portableApps/`
- `launch4j/`
- `script/`

このことから、`freeplane_framework` は UI 機能そのものではなく、配布・起動・実行環境対応を支える層として読むのが自然である。

## プラットフォーム補助

### `freeplane_mac/`

macOS 固有の補助モジュールである。  
本体とは別モジュールになっているため、OS 依存処理をアプリ本体から切り離していることが分かる。

### `freeplane_debughelper/`

これは開発・デバッグ支援寄りのモジュールで、`eclipse/` `idea/` `msdos/` `security/` などの補助ディレクトリを含む。  
日常のアプリ機能というより、開発環境やデバッグ、補助起動に関わるものとして読むべき領域である。

## プラグイン群

Freeplane の機能拡張は `freeplane_plugin_*` という独立モジュールで表現されている。  
現時点で確認できるものには以下がある。

- `freeplane_plugin_ai`
- `freeplane_plugin_bugreport`
- `freeplane_plugin_codeexplorer`
- `freeplane_plugin_formula`
- `freeplane_plugin_jsyntaxpane`
- `freeplane_plugin_latex`
- `freeplane_plugin_markdown`
- `freeplane_plugin_openmaps`
- `freeplane_plugin_script`
- `freeplane_plugin_svg`

この並びから、Freeplane の拡張点はかなり広い。  
数式、LaTeX、Markdown、スクリプト、SVG、地図、AI といった追加機能を本体に直結させず、モジュール境界で管理している。

特に `freeplane_plugin_script` は M3E 観点でも重要で、既存アプリを直接改造せずに外側から振る舞いを足す余地を示している。

### テスト用プラグイン関連

- `freeplane_plugin_script_test`
- `freeplane_uitest`

これらは本番機能ではなく、スクリプトや UI の検証を支える補助領域と読める。

## 補助的モジュール

### `freeplane_ant/`

Gradle ベースのリポジトリでありながら、`freeplane_ant` も残っている。  
これは歴史的経緯や既存ビルド補助を支えるための領域と考えるのが自然で、完全に Gradle だけに一本化された単純構成ではないことを示している。

### `JOrtho_0.4_freeplane/`

外部コンポーネントを内包した専用モジュールである。  
名前から見ても、Freeplane 用に抱え込まれている依存コンポーネントとして扱われている。

## ビルドと配布の構造

リポジトリ直下には複数の配布用 Gradle ファイルがある。

- `dist.gradle`
- `src.dist.gradle`
- `mac.dist.gradle`
- `win.dist.gradle`
- `linux-packages.gradle`
- `bin.dist.gradle`

この構成は、単に `gradle build` するだけではなく、各 OS 向けの配布物生成まで強く意識したプロジェクトであることを示している。  
つまり Freeplane のリポジトリは、アプリ本体のソースコードだけではなく、配布パイプラインそのものを抱えた構成になっている。

## ドキュメントと運用補助

### `.github/`

Issue template や workflow があり、GitHub 上での運用ルールと CI がここに集まっている。

### `ai-specs/`

このディレクトリには、AI 支援作業向けの仕様やタスク管理用ファイルが置かれている。  
一般的なアプリ機能とは別で、リポジトリ運用や開発支援のためのメタ情報層と見てよい。

### `codesign/` と `debian-meta-data/`

これらは配布や署名、OS パッケージング寄りの補助ディレクトリである。  
Freeplane が複数プラットフォームへ実際に配布されるアプリケーションであることが、ここからも分かる。

## 構造として重要な読み方

Freeplane を読むときは、まず「本体アプリのコードを探す」のではなく、以下の層に分けて考えると把握しやすい。

1. `freeplane/` を本体アプリ層として読む
2. `freeplane_api/` を公開契約層として読む
3. `freeplane_framework/` を実行・配布基盤として読む
4. `freeplane_plugin_*` を拡張機能層として読む
5. `freeplane_mac/` などをプラットフォーム依存層として読む

この見方をすると、どこを読むべきかが目的ごとに切り分けやすくなる。  
たとえば UI 本体に興味があるなら `freeplane/src`、拡張可能性を知りたいなら `freeplane_api` と `freeplane_plugin_script`、配布構成を知りたいなら `freeplane_framework` と `*.dist.gradle` を見ればよい。

## M3E 観点での含意

M3E から見ると、Freeplane は単純な描画ライブラリではなく、既に完成度の高いデスクトップ思考ツール基盤である。  
そのため「全部を読む」よりも、「どこが思考構造本体で、どこが拡張境界か」を先に掴む方が重要になる。

最初に注目すべき候補は次の通りである。

- `freeplane/src`
- `freeplane_api/src`
- `freeplane_plugin_script/src`
- `freeplane_plugin_ai/src`
- `freeplane_framework/src`

この順で追えば、Freeplane を M3E の土台として使う際に、どの層へ乗るべきかを判断しやすい。

## 下位構造の概説

### `freeplane/src`

`freeplane/src` は、本体アプリケーションのリソースと実装が集まる最重要ディレクトリである。  
内部を見ると、これは単一の `main/java` だけではなく、`editor` `viewer` `external` `main` `test` に分かれている。

- `editor/resources`: エディタ側の画像、翻訳、Look and Feel、HTML、XML、XSLT など
- `viewer/resources`: ビューア側の画像、スタイル、翻訳、サウンドなど
- `external/resources`: 外部テンプレートや XML/XSLT などの補助資源
- `main/java`: 本体コード
- `test/java`: 本体テスト

`main/java/org/freeplane` 以下は、さらに大きく 4 層に読める。

- `org.freeplane.core`: 共通基盤。`ui` `undo` `io` `resources` `util` など、アプリ全体の下支え
- `org.freeplane.features`: 機能別の本体ロジック
- `org.freeplane.main`: アプリ起動モードや OSGi 統合
- `org.freeplane.view.swing`: Swing ベースの表示と入力

`org.freeplane.features` は特に重要で、Freeplane の主要機能が機能単位で分割されている。  
たとえば `attribute` `clipboard` `export` `filter` `layout` `link` `map` `mapio` `mode` `note` `styles` `text` `ui` などが並んでおり、Freeplane の本体が「マップ構造を中心にした機能集合」として組まれていることが分かる。

中でも `org.freeplane.features.map` は読む価値が高い。  
ここには `MapController` `MapModel` `MapReader` `MapWriter` `NodeModel` `NodeBuilder` `FoldingController` `NodeMoveEvent` などがあり、ノードとマップの正本に近い層がここにあると考えられる。  
さらに `mindmapmode` には `MMapController` `NewChildAction` `NewSiblingAction` `DeleteAction` など、実際の編集操作に直結するクラスが置かれている。

表示側では `org.freeplane.view.swing.map` が中心で、`MapView` `NodeView` `MainView` `MindMapLayout` `MapScroller` `MapViewController` などが確認できる。  
この並びから、Freeplane の描画は Canvas ではなく Swing コンポーネントとレイアウト計算を積み重ねる方式で成立していることが読み取れる。  
入力側は `org.freeplane.view.swing.ui` に分かれ、`DefaultNodeKeyListener` `DefaultMapMouseListener` `DefaultNodeMouseMotionListener` `NodeDropUtils` などがあり、ビュー描画と入力処理が完全に同一クラスへ混在しないよう整理されている。

### `freeplane_api/src`

`freeplane_api/src` は公開 API の契約面をまとめたディレクトリで、構造はかなり平坦である。  
主に `src/main/java/org/freeplane/api` と `src/test/java/org/...` から成り、細かい実装パッケージに分割せず、型の一覧として API を提示する構成になっている。

ここに置かれている型は、Map/Node/Controller 周辺の公開契約を表すものが多い。

- `Map`, `MapRO`, `MindMap`, `MindMapRO`
- `Node`, `NodeRO`, `NodeGeometry`, `NodeStyle`
- `Controller`, `ControllerRO`
- `Link`, `Edge`, `Connector`
- `Attributes`, `Tags`, `Icons`
- `HeadlessLoader`, `HeadlessMapCreator`
- `Script`

`RO` 付きの型が多いことからも、読み取り専用インターフェースと更新可能インターフェースを意識して設計されている。  
これは拡張側から本体内部実装へ直接依存させず、機能境界を API として固定する意図が強い。

M3E 観点では、Freeplane のデータ構造を「外から安全に触る」入口としてまずここを見るのが自然である。  
特に `Node` `NodeRO` `Map` `Controller` `HeadlessLoader` 周辺は、統合可能性を判断する最初の対象になる。

### `freeplane_plugin_script/src`

`freeplane_plugin_script/src` は、Freeplane のスクリプト実行基盤をまとめたディレクトリである。  
構成は `src/main/java` `src/main/resources` `src/test/java` からなり、主パッケージは `org.freeplane.plugin.script` 配下に集約されている。

下位には次のような補助パッケージがある。

- `addons`
- `dependencies`
- `filter`
- `help`
- `proxy`

ただし実際の中核クラスの多くは、`org.freeplane.plugin.script` 直下に置かれている。  
代表例として次のようなクラスがある。

- `ScriptingEngine`
- `ScriptRunner`
- `ExecuteScriptAction`
- `GroovyScript`
- `GroovyShell`
- `ScriptContext`
- `ScriptSecurity`
- `ScriptingPolicy`
- `ScriptingPermissions`
- `ScriptEditor`
- `FormulaCache`
- `FormulaDependencies`

この構成から見えるのは、Freeplane のスクリプト機能が単なる「テキストを評価する窓」ではなく、実行、キャッシュ、依存管理、エディタ、権限制御、セキュリティ、数式評価まで含む独立サブシステムだということである。  
特に `ScriptSecurity` や `ScriptingPolicy` が明示的に存在するため、スクリプト実行をかなり真面目に管理している。

M3E 観点では、このモジュールは「外側から Freeplane に機能を足す」際のもっとも現実的な接点候補である。  
Freeplane 本体を書き換えずに、構造読解や補助操作を差し込めるかを考えるとき、最初に追うべき領域になる。

### `freeplane_plugin_ai/src`

`freeplane_plugin_ai/src` は、現在の Freeplane における AI 統合機能の本体である。  
構成は `bootstrap` `main` `test` に分かれ、`main/java/org/freeplane/plugin/ai` 以下に実装が広く展開されている。

主な下位パッケージは次の通りである。

- `chat`
- `chat/history`
- `edits`
- `maps`
- `mcpserver`
- `tools`
- `tools/connectors`
- `tools/content`
- `tools/create`
- `tools/delete`
- `tools/edit`
- `tools/move`
- `tools/read`
- `tools/search`
- `tools/selection`
- `tools/text`
- `tools/utilities`

`chat` には `AIChatPanel` `AIChatService` `AIModelCatalog` `AssistantProfileManagerDialog` `LiveChatSessionManager` などがあり、AI チャット UI、モデル選択、セッション管理、プロファイル管理まで含まれている。  
つまりこのプラグインは、単に API を叩くだけではなく、ユーザー対話の前面 UI をすでに持っている。

`edits` には `AIEdits` `AiEditsPersistenceBuilder` `ClearAiMarkersInMapAction` などがあり、AI 由来の編集状態やマーカー管理が独立して存在する。  
ここは M3E の「AI は提案であり差分が見えるべき」という観点と近い。

`maps` は Freeplane のマップモデルを AI 側へ橋渡しする層で、`MapModelProvider` などが置かれている。  
`mcpserver` には `ModelContextProtocolServer` などがあり、外部ツールプロトコルとの接続口がすでに実装されている。

最も重要なのは `tools` 系である。  
ここには Freeplane のマップに対して AI が何をできるかが、操作種別ごとに分かれている。

- `read`: ノード読取、子孫展開、コンテクスト取得
- `search`: 検索と概観取得
- `selection`: 選択ノード把握
- `create`: ノード生成
- `edit`: 内容編集
- `move`: ノード移動や summary 生成
- `delete`: ノード削除
- `content`: ノード内容の構造化表現
- `connectors`: コネクタ編集

このモジュールは、M3E の観点では非常に示唆的である。  
Freeplane 側が既に「AI が map を読む・探す・作る・動かす・編集する」ための粒度を道具箱として定義しているため、M3E が外側レイヤーとして載る場合にも、どの粒度で操作を分割すべきかの参考になる。

### `freeplane_framework/src`

`freeplane_framework/src` は見た目よりかなり薄く、主な Java 実装は `org.freeplane.launcher` に集中している。  
確認できる主要クラスは `Launcher` と `Utils` であり、アプリ本体ロジックではなく起動基盤として読むべきディレクトリである。

重要なのは、このモジュールの価値が `src/main/java` の行数ではなく、周辺の配布資産を束ねる位置にあるという点である。  
前述の `mac-appbundler` `windows-installer` `portableApps` `launch4j` などと合わせて、Freeplane を実際に配布可能なデスクトップアプリとして成立させる役割を持つ。

したがって `freeplane_framework/src` 単体だけを見ると薄く見えるが、リポジトリ構造全体では「起動・配布・梱包の中心」として理解するのが適切である。
