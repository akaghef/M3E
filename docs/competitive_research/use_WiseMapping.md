結論だけ先に言うと、**WiseMappingは「そのままラップしてM3Eを成立させる」には弱いが、**
 **「既存UIを土台に短期検証する」か「描画・編集層だけ借りる」なら現実的**です。
 ただし、**M3Eの中核である一意ID・単一スコープ所属・alias整合性をWiseMappingの正本に置くのは非推奨**です。

M3E仕様設計書

M3E仕様設計書

理由は明確です。あなたの仕様では、実体ノードは単一スコープに属し、他スコープからはaliasでのみ参照し、参照整合性を壊さないことが必須です。さらにUndo/Redoはコマンドパターン前提で、ViewStateとModelを分離したい。

M3E仕様設計書

M3E仕様設計書

M3E仕様2

 一方でWiseMappingは、マインドマップ編集・共有・入出力・REST API・自前ホストには強いですが、公開されている説明上はM3Eのような**明示的なスコープ境界**や**aliasを中核にしたモデル**は前提にしていません。Import/ExportやREST APIはありますが、それは連携の土台であって、M3Eの制約をそのまま満たすものではありません。[GitHub](https://github.com/wisemapping/wisemapping-open-source)

したがって、現実的な選択肢は3つです。

**1. UIラップ**
 これは中程度に現実的です。WiseMappingは現在、フロントエンドが分離されており、`Web2D`、`Mindplot`、`Editor`、`Webapp` という構成です。つまり、描画・編集まわりを部分利用しやすい形にはなっています。[GitHub](https://github.com/wisemapping/wisemapping-frontend)
 さらに公式のオープンソース版はREST APIを持ち、自前ホスト可能です。ローカル開発手順も整理されています。[GitHub](https://github.com/wisemapping/wisemapping-open-source)
 このため、**WiseMappingを外側から使い、M3E側が提案生成・差分提示・承認フローを持つ**形は成立しやすいです。これは、あなたがFreeplaneについて書いている「土台の外側で思考支援を行う」という方針にも近いです。

freeplane利用について

ただし弱点もあります。
 UIラップでは、Undo/Redoの正本がWiseMapping側になります。あなたの仕様は「すべての変更をコマンドとして記録し、Undo/Redo整合性を担保する」思想なので、外側から差し込む変更がその履歴に自然に乗らないと設計が濁ります。

M3E仕様設計書

 また、IME、フォーカス、編集開始・確定、ドラッグ中プレビューなどは、あなたがかなり厳密に制御したい部分です。WiseMappingの既存操作系に寄せると、ここは自由度が下がります。

M3E仕様設計書

DragOperate

**2. source code借用・フォーク**
 これは**最も現実的**です。特にフロントエンド側です。理由は、WiseMappingのフロントエンドが編集ライブラリとReactラッパーに分かれているからです。`Mindplot` と `Web2D` を参考にしつつ、M3EのModel/Command/ViewState設計に合わせて再構成しやすいです。[GitHub](https://github.com/wisemapping/wisemapping-frontend)
 この場合、**正本データはM3EのJSON/内部モデルに置き、WiseMapping由来コードはView/Editor層だけ借りる**のがよいです。あなたの仕様でも保存・復元・移行の基礎はJSONで持つ想定ですし、スキーマ version＋migration 前提です。

M3E仕様設計書

M3E仕様設計書

ただし、ここで最大の注意点は**ライセンス**です。WiseMappingは一般的なApache 2.0そのものではなく、**WiseMapping Public/Open License 1.0**で、公式説明では「各ページに Powered by WiseMapping 表示とリンクを残す」追加要件があります。改変や商用利用自体は可能と説明されていますが、ブランド表示義務があるため、**単純な無名フォークや完全ホワイトラベル製品には向きません**。[WiseMapping+2GitHub+2](https://www.wisemapping.com/opensource/license?utm_source=chatgpt.com)
 したがって、source code借用をするなら、**派生元表示を許容するか、法的確認のうえ許諾を取る**前提です。

**3. UI自動操作**
 これは非推奨です。
 理由は、あなたが重視しているのがスコープ境界、alias整合性、Undo/Redo、IME安定性、ドラッグ中はViewStateだけ更新してdrop時のみ確定、というかなり厳密な制御だからです。UI自動操作では、この手の境界が最も壊れやすいです。

DragOperate

DragOperate

 既存アプリ更新でも壊れますし、イベント取得も不安定です。短期デモ以外では避けるべきです。

現時点の実務判断を4分類で言うと、こうです。

**連携方式**
 最有力は「フォーク/部分借用」。次点で「REST API＋外部提案層」。UI自動操作は捨ててよいです。WiseMappingはREST APIと自前ホストがあるため、外部連携自体はしやすいです。[GitHub](https://github.com/wisemapping/wisemapping-open-source)

**データ対応**
 M3Eの中核制約とはずれます。WiseMappingのマップを正本にすると、単一スコープ所属やalias禁止則などを後付け検査する必要が出ます。あなたの仕様ではここが最重要なので、**正本はM3E側**がよいです。

M3E仕様設計書

**整合性**
 Undo/Redo、差分、alias参照更新、scope閉包性を考えると、外側から既存アプリを操る方式は弱いです。コマンドパターン前提の内部モデルを持つべきです。

M3E仕様設計書

M3E仕様2

**保守性**
 フロントエンド分離は好材料です。加えて、2026年時点でWiseMappingはオープンソース本体、フロントエンド、デスクトップの3リポジトリが継続更新されています。デスクトップ版も新しく、ローカル保存型で、macOSを含むクロスプラットフォームを掲げています。[GitHub+1](https://github.com/wisemapping)
 この点は以前の「オフライン弱い」という見立てより改善しています。現在は公式にデスクトップ版があります。[GitHub+1](https://github.com/wisemapping/wisemapping-desktop?utm_source=chatgpt.com)

最終判定です。

**Wisemappingでラップ**
 限定的に現実的です。
 短期検証で、既存編集UIを使いながら外側でAI提案・論点整理・自然言語化を載せる用途なら成立します。
 ただし、M3E本体の検証対象を**思考支援**に限定する場合に限ります。

**UI借用**
 現実的です。
 ただし「UIだけ借りる」のではなく、**描画・編集ライブラリを参考実装として取り込み、M3EのModelを自前で持つ**形がよいです。

**source code借用**
 かなり現実的です。
 ただしライセンス上、Powered by WiseMapping 条項を前提に扱う必要があります。完全に自社独自製品の顔で出したいなら障害になります。[WiseMapping+1](https://www.wisemapping.com/opensource/license?utm_source=chatgpt.com)

**推奨方針**
 最も筋がよいのは、
 **「M3Eの正本モデルは自前」「WiseMappingのfrontendはView/Editor層の参考または部分流用」「既存アプリを正本にしない」**
 です。
 これなら、あなたの仕様で最重要の scope / alias / ID / command を守れます。

M3E仕様設計書

M3E仕様2

必要なら次に、**Wisemapping案を Freeplane案 と同じ評価軸で表に落として、Go / No-Go 判定**まで書きます。