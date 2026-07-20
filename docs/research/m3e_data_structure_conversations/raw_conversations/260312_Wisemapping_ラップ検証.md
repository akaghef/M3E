---
title: "Wisemapping ラップ検証"
created: 2026-03-12 10:30:05
updated: 2026-03-12 10:44:45
tags:
  - chatgpt
  - conversation
---
# Wisemapping ラップ検証

<sub>2026-03-12</sub>

---

**User**: <sub>2026-03-12 10:30</sub>

Wisemappingでラップ or UI, source code借用が現実的か検証

はい。端的に列挙すると、次です。

**1. 境界の切り方**

- 何を既存アプリに任せ、何を外側で持つか
- 正本データがどちらにあるか
- 編集主体が既存アプリか、ラッパーか

**2. 連携方式**

- ファイル連携
- クリップボード連携
- プラグイン
- スクリプトAPI
- UI自動操作
- プロセス間通信
- どの方式が最小コストで壊れにくいか

**3. データモデル対応**

- ノード型の対応
- 親子関係
- 順序
- 属性
- リンク
- 折り畳み
- 位置情報
- スタイル
- IDの永続性
- 既存アプリの概念と自前概念の差分
 M3E側では一意ID、単一スコープ所属、alias制約が中核なので、ここが最重要です。

M3E仕様設計書

**4. 失われる情報**

- 既存形式へ保存すると落ちる情報
- 逆変換できない情報
- 表示専用情報と構造情報の混同
- M3E固有概念を埋め込めるか

**5. ID・参照整合性**

- ノード改名で参照が壊れないか
- 移動・削除時の参照更新
- aliasの参照先保証
- 重複生成の防止
 あなたの仕様では alias 参照整合性は必須です。

M3E仕様設計書

**6. スコープ境界**

- 既存アプリにスコープ概念があるか
- なければ疑似的にどう表現するか
- 他スコープ露出をどう抑えるか
- scope単位で閉じる保存が可能か
 M3Eの差別化はスコープ境界と見えすぎ回避です。

M3E仕様設計書

**7. 操作反映方式**

- 即時反映か、提案して承認か
- 双方向同期か、片方向生成か
- 競合時にどちらを優先するか
- 自動修正を許すか

**8. Undo / Redo**

- どちらが履歴の正本か
- 外側変更を既存アプリのUndoに乗せられるか
- 乗せられないなら履歴を分離するか
- 差分表示をどう出すか
 M3Eはコマンドパターン前提なので、外部操作がそこに入らないと整合が崩れます。

**9. View と Model の分離**

- 見た目の一時状態をどこで持つか
- ドラッグ中プレビューをどこで表現するか
- drop時のみ確定できるか
 これはあなたの設計の核心です。

**10. イベント取得**

- ノード選択
- 編集開始・確定
- ドラッグ
- 折り畳み
- キー入力
- フォーカス変化
- これらを外から取れるか

**11. UI制約**

- 既存UIに依存しすぎないか
- 独自ショートカットを足せるか
- IME衝突を避けられるか
- モード遷移が読めるか
 UIの予測可能性とIME配慮は要件です。

M3E仕様設計書

**12. 同期粒度**

- ファイル全体
- スコープ単位
- ノード単位
- 差分単位
- 保存頻度
- 自動保存の責任分界

**13. 競合と原子性**

- ラッパー更新中にユーザーが編集したらどうするか
- 部分失敗時に巻き戻せるか
- 更新を原子的にできるか

**14. 破損耐性**

- 不正XMLや部分書き込みへの耐性
- バックアップ
- ジャーナル
- 復元導線
 消失防止は優先事項です。

M3E仕様設計書

**15. バージョン互換性**

- 既存アプリの更新で壊れないか
- ファイル形式変更に耐えられるか
- API廃止時の代替経路があるか
- 自前スキーマ移行を持つか
 version＋migration 前提が必要です。

**16. 性能**

- 大規模マップ読込
- 差分計算コスト
- 起動時間
- 再描画頻度
- 監視方式の負荷
- 外部AI処理の待ち時間

**17. セキュリティ**

- ローカルファイル権限
- 外部プロセス起動権限
- スクリプト実行の危険
- 任意コード実行の境界
- AI送信範囲の明示
 AI連携は送信範囲明示と最小化が必要です。

M3E仕様設計書

**18. ライセンス・配布**

- 既存アプリのライセンス適合
- フォーク可否
- バンドル配布可否
- 商用利用可否
- プラグイン配布条件

**19. OS依存**

- Macで安定するか
- パス表現
- ウィンドウ制御
- 文字入力
- ファイル監視
- Java実行環境依存

**20. テスト性**

- ヘッドレスで検証できるか
- サンプルデータで往復試験できるか
- 差分テストできるか
- 壊れやすい境界を自動試験できるか

**21. 将来の置換可能性**

依存部分を薄く保てるか
- 別アプリへ載せ替え可能か
- ラッパー層を抽象化できるか

**22. プロダクト方針との整合**

- ラッパーで本当に検証したい価値に近づくか
- UI基盤ではなく思考支援の検証に集中できるか
 あなたの現方針ではここが最重要です。土台であり、本体ではありません。


実務上は、まず次の4分類で整理すると十分です。
 **連携方式 / データ対応 / 整合性 / 保守性**
 この4つで落ちる案は早めに捨ててよいです。

> [!note]- Internal Reasoning
> <sub>2026-03-12 10:30</sub>
> 
> **ファイル検索の必要性**: ユーザーがM3E仕様設計書を参照しているので、ファイル検索を使用する必要がありそうです。また、Wisemappingに関する最新情報もウェブで調べる必要がありそうです。さらに、Wisemappingのライセンスやスキルに関して調査する価値がありそうです。まずはアップロードされたファイルを調べます。

> [!note]- Internal Reasoning
> <sub>2026-03-12 10:30</sub>
> 
> **Wisemappingの最新情報を調べる**: Wisemappingに関する最新情報をウェブで調べる必要があります。具体的な要件や更新された内容があるかどうかを確認して、正確な情報をお届けできるようにします。

**ChatGPT (tool execution)**: <sub>2026-03-12 10:30</sub>

```
{"search_query":[{"q":"WiseMapping GitHub license React Spring Boot REST API self hosted offline import export Freeplane XMind 2026"},{"q":"WiseMapping official features import export Freeplane XMind API self hosted 2026"},{"q":"GitHub WiseMapping mind map open source React Spring Boot license 2026"}],"response_length":"short"}
```

> [!note]- Internal Reasoning
> <sub>2026-03-12 10:30</sub>
> 
> **ライセンスとAPI関連の調査**: ユーザーが求めているのは、オープンライセンスやAPIに関する具体的な情報のようです。GitHubのREADMEなど、関連するドキュメントを調べて、具体的な利用規約や開放的な情報を確認する必要がありそうです。

**ChatGPT (tool execution)**: <sub>2026-03-12 10:30</sub>

```
{"open":[{"ref_id":"turn679876search0"},{"ref_id":"turn679876search4"},{"ref_id":"turn679876search5"}],"response_length":"short"}
```

> [!note]- Internal Reasoning
> <sub>2026-03-12 10:30</sub>
> 
> **ライセンスに関する調査**: オープンライセンスについて、特にAGPL（Affero General Public License）を調べる必要がありそうです。オープンページ内でライセンスの詳細を探して、適用されるライセンス情報を確認すべきですね。

**ChatGPT (tool execution)**: <sub>2026-03-12 10:30</sub>

```
{"find":[{"ref_id":"turn583718view0","pattern":"License"},{"ref_id":"turn583718view1","pattern":"License"}],"response_length":"short"}
```

> [!note]- Internal Reasoning
> <sub>2026-03-12 10:30</sub>
> 
> **Wisemappingのライセンステキストを調査**: Wisemappingのオープンライセンスについて、制限事項を調べるためにライセンステキストを確認する必要がありそうです。検索を使って、ライセンスの詳細や利用条件を調べ、その制約がどのようなものかを明確にするべきですね。

**ChatGPT (tool execution)**: <sub>2026-03-12 10:30</sub>

```
{"search_query":[{"q":"\"WiseMapping Open License\" Version 1.0 restrictions commercial SaaS source available"},{"q":"site:github.com/wisemapping/wisemapping-open-source LICENSE.md \"WiseMapping Open License\""}],"response_length":"short"}
```

> [!note]- Internal Reasoning
> <sub>2026-03-12 10:30</sub>
> 
> **デスクトップリポジトリとAPIドキュメントの確認**: デスクトップアプリケーションのインストール方法について調べる必要がありそうです。特にローカル環境でのインストールや設定方法について、デスクトップリポジトリとAPIドキュメントを確認して、手順を確認するべきですね。

**ChatGPT (tool execution)**: <sub>2026-03-12 10:30</sub>

```
{"search_query":[{"q":"site:github.com/wisemapping/wisemapping-desktop WiseMapping desktop local installation offline Electron 2026"},{"q":"WiseMapping desktop repository README offline local installation"}],"response_length":"short"}
```

> [!info] Reasoning Summary
> <sub>2026-03-12 10:30</sub>
> 
> 思考時間: 36s

**ChatGPT**: <sub>2026-03-12 10:30</sub>

結論だけ先に言うと、**WiseMappingは「そのままラップしてM3Eを成立させる」には弱いが、**  
**「既存UIを土台に短期検証する」か「描画・編集層だけ借りる」なら現実的**です。  
ただし、**M3Eの中核である一意ID・単一スコープ所属・alias整合性をWiseMappingの正本に置くのは非推奨**です。fileciteturn0file3L1-L20 fileciteturn0file2L1-L7

理由は明確です。あなたの仕様では、実体ノードは単一スコープに属し、他スコープからはaliasでのみ参照し、参照整合性を壊さないことが必須です。さらにUndo/Redoはコマンドパターン前提で、ViewStateとModelを分離したい。fileciteturn0file3L1-L20 fileciteturn0file4L1-L20 fileciteturn0file5L1-L19  
一方でWiseMappingは、マインドマップ編集・共有・入出力・REST API・自前ホストには強いですが、公開されている説明上はM3Eのような**明示的なスコープ境界**や**aliasを中核にしたモデル**は前提にしていません。Import/ExportやREST APIはありますが、それは連携の土台であって、M3Eの制約をそのまま満たすものではありません。citeturn583718view0

したがって、現実的な選択肢は3つです。

**1. UIラップ**  
これは中程度に現実的です。WiseMappingは現在、フロントエンドが分離されており、`Web2D`、`Mindplot`、`Editor`、`Webapp` という構成です。つまり、描画・編集まわりを部分利用しやすい形にはなっています。citeturn583718view1  
さらに公式のオープンソース版はREST APIを持ち、自前ホスト可能です。ローカル開発手順も整理されています。citeturn583718view0  
このため、**WiseMappingを外側から使い、M3E側が提案生成・差分提示・承認フローを持つ**形は成立しやすいです。これは、あなたがFreeplaneについて書いている「土台の外側で思考支援を行う」という方針にも近いです。fileciteturn0file6L1-L10

ただし弱点もあります。  
UIラップでは、Undo/Redoの正本がWiseMapping側になります。あなたの仕様は「すべての変更をコマンドとして記録し、Undo/Redo整合性を担保する」思想なので、外側から差し込む変更がその履歴に自然に乗らないと設計が濁ります。fileciteturn0file0L1-L10  
また、IME、フォーカス、編集開始・確定、ドラッグ中プレビューなどは、あなたがかなり厳密に制御したい部分です。WiseMappingの既存操作系に寄せると、ここは自由度が下がります。fileciteturn0file1L1-L12 fileciteturn0file7L1-L23

**2. source code借用・フォーク**  
これは**最も現実的**です。特にフロントエンド側です。理由は、WiseMappingのフロントエンドが編集ライブラリとReactラッパーに分かれているからです。`Mindplot` と `Web2D` を参考にしつつ、M3EのModel/Command/ViewState設計に合わせて再構成しやすいです。citeturn583718view1  
この場合、**正本データはM3EのJSON/内部モデルに置き、WiseMapping由来コードはView/Editor層だけ借りる**のがよいです。あなたの仕様でも保存・復元・移行の基礎はJSONで持つ想定ですし、スキーマ version＋migration 前提です。fileciteturn0file0L11-L20 fileciteturn0file4L1-L10

ただし、ここで最大の注意点は**ライセンス**です。WiseMappingは一般的なApache 2.0そのものではなく、**WiseMapping Public/Open License 1.0**で、公式説明では「各ページに Powered by WiseMapping 表示とリンクを残す」追加要件があります。改変や商用利用自体は可能と説明されていますが、ブランド表示義務があるため、**単純な無名フォークや完全ホワイトラベル製品には向きません**。citeturn670944search0turn605691view0turn605691view1  
したがって、source code借用をするなら、**派生元表示を許容するか、法的確認のうえ許諾を取る**前提です。

**3. UI自動操作**  
これは非推奨です。  
理由は、あなたが重視しているのがスコープ境界、alias整合性、Undo/Redo、IME安定性、ドラッグ中はViewStateだけ更新してdrop時のみ確定、というかなり厳密な制御だからです。UI自動操作では、この手の境界が最も壊れやすいです。fileciteturn0file7L1-L23 fileciteturn0file9L1-L11  
既存アプリ更新でも壊れますし、イベント取得も不安定です。短期デモ以外では避けるべきです。

現時点の実務判断を4分類で言うと、こうです。

**連携方式**  
最有力は「フォーク/部分借用」。次点で「REST API＋外部提案層」。UI自動操作は捨ててよいです。WiseMappingはREST APIと自前ホストがあるため、外部連携自体はしやすいです。citeturn583718view0

**データ対応**  
M3Eの中核制約とはずれます。WiseMappingのマップを正本にすると、単一スコープ所属やalias禁止則などを後付け検査する必要が出ます。あなたの仕様ではここが最重要なので、**正本はM3E側**がよいです。fileciteturn0file3L1-L20

**整合性**  
Undo/Redo、差分、alias参照更新、scope閉包性を考えると、外側から既存アプリを操る方式は弱いです。コマンドパターン前提の内部モデルを持つべきです。fileciteturn0file4L11-L20 fileciteturn0file5L1-L19

**保守性**  
フロントエンド分離は好材料です。加えて、2026年時点でWiseMappingはオープンソース本体、フロントエンド、デスクトップの3リポジトリが継続更新されています。デスクトップ版も新しく、ローカル保存型で、macOSを含むクロスプラットフォームを掲げています。citeturn583718view2turn544974search0  
この点は以前の「オフライン弱い」という見立てより改善しています。現在は公式にデスクトップ版があります。citeturn544974search0turn544974search1

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
ただしライセンス上、Powered by WiseMapping 条項を前提に扱う必要があります。完全に自社独自製品の顔で出したいなら障害になります。citeturn670944search0turn605691view0

**推奨方針**  
最も筋がよいのは、  
**「M3Eの正本モデルは自前」「WiseMappingのfrontendはView/Editor層の参考または部分流用」「既存アプリを正本にしない」**  
です。  
これなら、あなたの仕様で最重要の scope / alias / ID / command を守れます。fileciteturn0file3L1-L20 fileciteturn0file5L1-L19

必要なら次に、**Wisemapping案を Freeplane案 と同じ評価軸で表に落として、Go / No-Go 判定**まで書きます。

