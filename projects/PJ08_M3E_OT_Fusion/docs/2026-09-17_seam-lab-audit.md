**Seam Labは、文面上は「責務を独立して検証し、その同じ実装を製品へ接続するための小アプリ」です。現状は、製品接続済みのseam、部分接続のseam、別作業ツリーに留まる試作が混在しています。**

以下では、【文面】＝文書・会話に書かれた要求や判断、【実装】＝今回ソースで確認した状態、【推論】＝私の評価、と分けます。文面に書かれた理想も、実現済みとは扱いません。今回はブラウザ・テストを実行していないため、動作合格の判定はしません。

「アプリに昇格」は、ここでは**M3Eの通常利用経路へ組み込まれること**として評価します。Labごとに独立製品として公開する、という決定は確認できませんでした。

**目的・思想**

【文面】[Development System](/Users/nisimoriyuuya/dev/M3E/docs/06_Operations/Development_System.md:35)に、次の思想が明示されています。

- **責務と入出力を型で固定する。** 「描画を直す」ではなく、配置・ノード描画・接続点・操作など、変更対象を一義的に指定できるようにする。
- **Labと製品が同じ実装を参照する。** Labだけの再実装を成功させても製品の保証にはならない。
- **そのseamを唯一の経路にする。** 既存helperや共有状態を直接触る迂回経路を残さず、依存検査・型検査・テストで再結合を防ぐ。
- **人間の確認を知覚に集中させる。** 配置・見た目・操作感はLabで確認し、状態変換や不変条件は機械テストに任せる。最後に統合状態を確認する。

【文面】さらに[UI Seam Integration Contract](/Users/nisimoriyuuya/dev/M3E/docs/03_Spec/UI_Seam_Integration_Contract.md:14)は、個別機能が良くても、統合するとキーボード・focus・選択・描画順・保存・undoを奪い合って壊れる問題を扱っています。**Seamは画面部品ではなく責任境界**であり、共有資源への読み書き・占有・解除まで契約する、という考えです。ただし、この文書自身の状態は **Draft canonical contract** です。

【推論】したがって本来の成果物は、Labの画面だけではありません。**型付き契約、共通実装、独立評価面、製品への接続、迂回防止の仕組み**が揃って初めて、この思想が成立します。

**どういうseamがあり、どこまで進んでいるか**

まず、既存M3E側です。

| seam／責務 | 【文面】目指している境界 | 【実装】確認できた段階 | 足りない面・昇格していない部分 |
|---|---|---|---|
| **Layout** | 可視グラフ＋ノード寸法 → 配置結果 | 共通`layout_port`、Layout Lab、通常Viewer・routing scopeからの呼び出しがある。実サーバーを使うcomposition testも存在 | ノード寸法の測定はViewer側。**これは入力契約上ただちに違反ではない**が、測定・描画との全体整合までLayout Lab単独では保証しない |
| **EdgePort／EdgeRoute** | 親子関係・分岐方向・矩形 → 接続点と経路 | 共通実装、Lab、Viewerの親子edge、段階ナビゲーションに接続。実サーバーcomposition testも存在 | GraphLinkの幾何処理は別途Viewerに残る。**親子edge seamの未実装というより、GraphLink側が別責務として残っている** |
| **NodeDraw** | 位置確定済みノード → ノード単体のSVG | 共通`renderNode`をNode LabとViewerが使用 | Viewerの`drawNode()`にはedge生成、folder preview、特殊component、再帰が残る。基本fragmentの接続は済んでいるが、描画全体の責任整理は未完。現行content型ではAgent Cardの多段情報を表せない |
| **Progressive Navigation** | ナビゲーション木＋測定値＋viewport → 配置・親子edge・overflow | 共通`pn_layout`をLabと製品Workbenchが使用 | **Lab止まりではない。製品Workbenchには接続済み。** map-backed model、名称整合、実サーバーcompositionは仕様上の後続項目 |
| **Disperse／力学配置** | グループ・関係・寸法 → 自由配置／力学配置 | sharedにWebCola実装がある。一方、通常Viewerは`subtype: "scatter"`を指定し、アニメーションはViewer内の別シミュレーションを使う | **力学そのものは存在するが、配置計算と対話的シミュレーションが一本化されていない。** OTの調整→再加熱→収束停止も共通seamとして接続されていない |
| **resolveVisible／deriveRenderGraph／command** | 可視範囲解決／描画用データ導出／状態変更 | 開発体制文書に独立したdata seamとして列挙されている | 文書が描く一連の独立境界・共通契約としては確認できない。処理自体が存在しない、という意味ではない |
| **操作状態・保存のseam** | selection、drag-node、edge-label-edit、scope-navigation、keyboard-command、render-surface、persistence-bridge | 統合契約文書に責務・共有資源・目標ownerが定義されている | 現在の`dev-beta`では、そこで指定する`SelectionStore`・`InteractionArbiter`等や、契約／資源競合検査コマンドを確認できない。**設計文面が実装より先行** |

直接の根拠は、[ViewerのLayout接続](/Users/nisimoriyuuya/dev/M3E/beta/src/browser/viewer.ts:7530)、[NodeDraw接続と残存処理](/Users/nisimoriyuuya/dev/M3E/beta/src/browser/viewer.ts:8282)、[Workbenchのナビゲーション接続](/Users/nisimoriyuuya/dev/M3E/beta/src/browser/workbench-ui.tsx:1093)、[sharedの力学配置](/Users/nisimoriyuuya/dev/M3E/beta/src/shared/disperse_layout.ts:179)、[Viewer側のアニメーション](/Users/nisimoriyuuya/dev/M3E/beta/src/browser/viewer.ts:7414)です。

【実装】依存境界の強制が全くないわけではありません。[dependency-cruiser設定](/Users/nisimoriyuuya/dev/M3E/beta/dependency-cruiser.config.cjs:1)にはLab→browser依存禁止、段階ナビゲーションのedge迂回禁止などがあり、CIにも依存・重複検査が組み込まれています。**純粋な描画・配置境界の強制は進んでいる一方、共有操作状態の所有権まで含む強制は未整備**、という区別が必要です。

次に、OT統合・周辺のLabです。これらは現在の`dev-beta`へ統合された状態とは区別します。

| Lab／seam | 【文面・実装】現在あるもの | 足りない面・製品への未接続部分 |
|---|---|---|
| **OT Surface Overview** | DECK／NETWORK、選択、hover、履歴切替、力学、parameter調整、Resetを含む依存一式の切り出し。個別portrait・詳細panelは除外する責務定義 | **全体像という大きな単位での切り出し**。力学・selection等が個別のM3E型付きseamになったわけではない。fixture駆動で、M3E mapへの接続はない |
| **OT Agent Detail** | 単一AI agentのmetadata、summary、History／Output、sparkline、開閉操作。OverviewのDOM・力学を読まない切り出し | fixtureの単体詳細。役割保存などの書き込みは拒否。M3Eノード選択・hoverから開く製品経路には未接続 |
| **Agent Card** | 別作業ツリーに`AgentCardData`とrenderer。AI agent／human、Role、名前、メッセージ、経過時間、状態、表示詳細度などを持つ | Node Labから使用されるが、製品browserからの利用は確認できない。通常ノード描画契約・永続データとの接続がない |
| **Viewer Panel Lab** | meta、entity list、Markdown preview、local files、conflict、v4の各panelをfixtureで操作する実装 | Lab内に独自状態・処理を持つ。Markdown rendererの共有はあるが、panel群全体で「Labと製品が同じ責務実装を参照する」状態にはなっていない |
| **Orchestration Board** | 別作業ツリーに契約YAML、runtime observation、API／Server-Sent Events、Viewerの`board`フラグ接続 | **単なる静的Labより進んでいる**が、`dev-beta`未統合。契約上もread-only boardであり、通常mapへのデータ統合とは別。製品全体の操作・保存との統合完了を意味しない |

根拠：[OTの責務・依存境界](/Users/nisimoriyuuya/dev/M3E-worktrees/ot-component-seam-labs/beta/src/labs/ot/README.md:3)、[Agent Card契約](/Users/nisimoriyuuya/dev/M3E-worktrees/agent-card-lab/beta/src/shared/agent_card.ts:1)、[Viewer Panel Lab](/Users/nisimoriyuuya/dev/M3E-worktrees/viewer-panel-seam-lab/beta/src/labs/viewer/viewer-panel-seam-lab.ts:1)、[Orchestration Board契約](/Users/nisimoriyuuya/dev/M3E-worktrees/orchestration-board-seam/docs/03_Spec/UI_Seams/orchestration-board.yaml:1)。

OTの現行READMEは、**旧7断片routeを削除して2責務にした**と明記しています。したがって「7個の独立seamが完成している」とは言えません。また、同READMEはブラウザ検証を未実行と記録しており、今回も再実行していません。

なお、主ブランチのLab一覧にある **Runtime Boardは静的データのデモ**で、Orchestration Board seamではないことが[一覧自身に明記](/Users/nisimoriyuuya/dev/M3E/beta/src/labs/index.html:196)されています。Agent Orrery mockとPJ08の`screen01.html`も、画面・操作案としては存在しますが、通常M3Eへの統合実装とは区別すべきです。

**Claudeで詰めた内容と、まだ決まっていない内容**

【文面：会話】9月15日の[Claude原文](/Users/nisimoriyuuya/.claude/projects/-Users-nisimoriyuuya-dev-M3E/b42b2149-877f-4255-b707-0135682679d0.jsonl:431)では、主に次が整理されています。

- 基本NodeDrawの語彙とAgent Cardの必要情報が合っていない。
- GraphLinkに`relationType`欄はあるが、型ごとの表示・操作へ接続されていない。
- 一般ノードのhover詳細、GraphLinkからmail履歴を開く製品経路がない。
- 描画境界を先に整えるか、データ契約を先に整えるか、最小fixtureで見える機能を先に通すか、という3案が残る。

これは**障壁の分析と選択肢の提示**です。その発言だけを、採用済み実装方針とは扱えません。保存予定とされた`docs/barriers.md`も、現在のPJ08には見当たりません。

また、Claudeの「`relationType`は型ではなく表示テキスト」という表現は強すぎます。【実装】正確には、**関係種別を保存できる文字列fieldは存在するが、確認したViewer消費側では主にラベル・集約キーに使われ、意味ごとの振る舞いが実装されていない**、です。

【推論】アプリへの昇格を止めている主要な不足は、次の3点です。

1. **描画とデータの接続不足。** Cardや詳細画面があっても、通常mapから何を渡すか、外部観測と人間の編集をどう区別するかが製品経路として繋がっていない。
2. **操作責任の接続不足。** 単体のhover・drag・parameter調整が動いても、M3Eのselection・camera・undo・保存と共存する契約が不足している。
3. **完了状態の記録不足。** 基本4seamのtask checkboxは全て未完了のまま、コードは先行している。逆に、OTの一部は未commit差分を含む別作業ツリーにあり、文書やmockの存在だけでは統合済みと判断できない。

文書には既に「seam完成」「Beta統合完了」「既定有効化・旧経路除去まで完了」という[異なる完了条件](/Users/nisimoriyuuya/dev/M3E/docs/03_Spec/UI_Seam_Integration_Contract.md:351)があります。**現状を「Seam Lab段階で全部停止」と一括りにするのも、「Labがあるから統合可能」とするのも不正確**です。基本4seamは製品へ部分的に到達し、OT側は評価用の切り出しと製品データ・操作への接続の間に残っています。

調査範囲：現在の`dev-beta`、関連5作業ツリー、特定済みClaude Code会話1件。会話のJSON解析エラーは0件。ChatGPT保管庫・会話全件の再検索はしていません。ファイル変更なし。

<oai-mem-citation>
<citation_entries>
MEMORY.md:188-198|note=[Seam Labの依存一式と単体検証と製品統合を区別する既存判断を調査の入口に使用]
</citation_entries>
<rollout_ids>
01a09b76-df5a-7220-a68b-b520c39e8479
</rollout_ids>
</oai-mem-citation>
