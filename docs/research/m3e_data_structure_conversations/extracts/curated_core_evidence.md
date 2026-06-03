# Curated Core Evidence

M3Eデータ構造・通信形式を仕様化するとき、まず見るべき証跡だけを手で選んだもの。
全文は `../raw_conversations/`、自動抽出は `high_purity_evidence.md` と `high_value_evidence.md`。

## Topology JSON / Command Patch
- source: [raw](../raw_conversations/260425_LLMマインドマップトポロジ.md) `260425_LLMマインドマップトポロジ.md:5429-5434`

> L5429: 最終的な推奨は、入力は **Topology JSON**、出力は **Command Patch JSON** です。人間確認用にはIndented textを併記してもよいですが、LLMに厳密に理解させる正本はJSONです。インデントテキストは読みやすい一方で、同名ノード、alias、scope、非木Link、兄弟順、ID保持で曖昧になります。したがって、M3Eの標準プロンプトでは次の3点を固定するのがよいです。
> L5431: ```text
> L5432: 1. nodes は nodeId を正本とし、label は表示名にすぎない。
> L5433: 2. tree は parentId -> ordered childIds であり、唯一の主構造である。
> L5434: 3. links は補助関係であり、親子関係・scope所属・layoutを変更しない。

## TOON圧縮とM3E-TOON方言
- source: [raw](../raw_conversations/260425_LLMマインドマップトポロジ.md) `260425_LLMマインドマップトポロジ.md:5461-5488`

> L5461: はい、`"` はLLM入力ではかなり余計です。特にノード数が増えると、JSONは `"` `{}` `,` とキー名の反復でトークンを使います。最近よく言われているのは **TOON（Token-Oriented Object Notation）** です。公式リポジトリでは、JSONデータモデルを保ったまま、LLM入力向けにコンパクトで読みやすくする形式と説明されています。citeturn586589search15
> L5463: M3Eのトポロジなら、JSONよりこういう形式がよいです。
> L5465: ```text
> L5466: format: M3E.Topology.v1
> L5467: root: n0
> L5468: scope: n0
> L5470: nodes[4]{id,type,label}:
> L5471: n0,folder,研究計画
> L5472: n1,text,背景
> L5473: n2,text,課題
> L5474: n3,text,方法
> L5476: tree[4]{parent,children}:
> L5477: n0,n1|n2|n3
> L5478: n1,
> L5479: n2,
> L5480: n3,
> L5482: links[1]{id,source,target,relation}:
> L5483: l1,n2,n3,motivates
> L5484: ```
> L5486: これは、JSONよりLLM friendlyです。理由は、同じキーを各行で繰り返さず、`nodes[4]{id,type,label}` のように列定義を1回だけ書くからです。TOON系の記事では、JSONより30〜60%程度トークンを削れると説明されていますが、実際の削減率はノード数、ラベル長、tokenizerで変わります。citeturn586589search10turn586589search16
> L5488: ただし、M3E用途では純TOONをそのまま採るより、**M3E-TOON方言**として固定するのがよいです。特にマインドマップは木構造なので、`nodes` と `tree` を分ける。非木構造は `links` に分ける。これで主構造と補助線の混同を避けられます。

## JSON正本 / TOON通信 / 可変属性
- source: [raw](../raw_conversations/260425_LLMマインドマップトポロジ.md) `260425_LLMマインドマップトポロジ.md:5509-5525`

> L5509: 実用上の結論はこうです。保存・API・検証はJSON。LLMに渡すプロンプト内表現はTOON風の表形式。LLMから返させる変更は、同じくTOON風のCommand Patchにします。
> L5511: ```text
> L5512: commands[2]{op,node,parent,index,label}:
> L5513: addNode,n4,n2,0,評価指標
> L5514: reparentNode,n3,n2,1,
> L5515: ```
> L5517: つまり、**正本はJSON、LLM通信はTOON風、表示補助はインデントテキスト**が一番バランスがよいです。JSONを直接プロンプトに入れるのは、厳密ではありますが、M3Eのようにノード数が増える用途では無駄が大きいです。
> L5519: **User**: <sub>2026-04-25 10:15</sub>
> L5521: node, edge付加情報(可変)を含めたらどういう形式？
> L5523: **ChatGPT**: <sub>2026-04-25 10:15</sub>
> L5525: 可変属性まで入れるなら、列固定の表だけでは足りません。基本列はTOON風に圧縮し、可変属性は別表に逃がす形式が扱いやすいです。

## nodeAttrs / edgeAttrs / linkAttrs schema
- source: [raw](../raw_conversations/260425_LLMマインドマップトポロジ.md) `260425_LLMマインドマップトポロジ.md:5539-5655`

> L5539: format: M3E.TOON.v1
> L5540: root: n0
> L5541: scope: n0
> L5543: nodes[4]{id,type,label}:
> L5544: n0,folder,研究計画
> L5545: n1,text,背景
> L5546: n2,text,課題
> L5547: n3,text,方法
> L5549: tree[1]{parent,children}:
> L5550: n0,n1|n2|n3
> L5552: nodeAttrs[6]{id,key,value}:
> L5553: n0,band,Deep
> L5554: n0,status,active
> L5555: n1,source,paper:A
> L5556: n2,priority,high
> L5557: n2,confidence,0.7
> L5558: n3,owner,Subaru
> L5560: links[1]{id,source,target,type}:
> L5561: l1,n2,n3,motivates
> L5563: linkAttrs[4]{id,key,value}:
> L5564: l1,label,課題が方法を要請
> L5565: l1,confidence,0.8
> L5566: l1,style,dashed
> L5567: l1,visible,true
> L5568: ```
> L5570: この形式の利点は、**固定スキーマ部分と可変スキーマ部分を分けられる**ことです。`nodes` は最低限の識別と表示、`tree` は親子トポロジ、`nodeAttrs` は任意属性、`links` は非木関係、`linkAttrs` は非木関係の任意属性です。
> L5572: `edge` 付加情報を厳密に扱いたいなら、`tree` だけではなく `edges` を明示します。兄弟順や折り畳み、レイアウト補助、生成元などを辺に持たせたい場合はこちらです。
> L5574: ```text id="m3e-edge-attrs"
> L5575: format: M3E.TOON.v1
> L5576: root: n0
> L5578: nodes[4]{id,type,label}:
> L5579: n0,folder,研究計画
> L5580: n1,text,背景
> L5581: n2,text,課題
> L5582: n3,text,方法
> L5584: edges[3]{id,parent,child,order}:
> L5585: e1,n0,n1,0
> L5586: e2,n0,n2,1
> L5587: e3,n0,n3,2
> L5589: edgeAttrs[5]{id,key,value}:
> L5590: e1,collapsed,false
> L5591: e2,importance,0.9
> L5592: e2,createdBy,user
> L5593: e3,createdBy,ai
> L5594: e3,proposalId,p17
> L5596: links[1]{id,source,target,type}:
> L5597: l1,n2,n3,motivates
> L5599: linkAttrs[3]{id,key,value}:
> L5600: l1,confidence,0.8
> L5601: l1,direction,forward
> L5602: l1,style,dashed
> L5603: ```
> L5605: 実装上は、`tree` 方式と `edges` 方式のどちらかを正本にします。M3Eの主構造が木で、兄弟順が重要なら、**保存・検証では `edges`、LLM入力では `tree` に圧縮**がよいです。親付け替えでも `fromParent`, `toParent`, `fromIndex`, `toIndex` が必要になるので、順序を明示する設計と相性がよいです。ドラッグ確定時だけCommandを発行し、Modelが循環やscope制約を検証する設計とも合います。fileciteturn3file16
> L5607: さらに型を厳密にしたいなら、属性値に型列を足します。
> L5609: ```text id="m3e-typed-attrs"
> L5610: nodeAttrs[5]{id,key,type,value}:
> L5611: n2,priority,str,high
> L5612: n2,confidence,num,0.7
> L5613: n2,locked,bool,false
> L5614: n2,tags,list,research|topology|M3E
> L5615: n2,source,ref,paper:A
> L5616: ```
> L5618: この場合、LLMへの規則は短く固定します。
> L5620: ```text id="m3e-rules"
> L5621: rules:
> L5622: nodes は実体ノードの一覧
> L5623: edges は親子主構造
> L5624: links は非木関係
> L5625: nodeAttrs/edgeAttrs/linkAttrs は可変属性
> L5626: 同じ id,key が複数ある場合は後の行を優先
> L5627: list 値は | 区切り
> L5628: 空値は _ で表す
> L5629: ```
> L5631: 最終形としては、これが一番よいです。
> L5633: ```text id="m3e-final-format"
> L5634: format: M3E.TOON.v1
> L5635: root: n0
> L5636: scope: n0
> L5638: nodes[3]{id,type,label}:
> L5639: n0,folder,M3E
> L5640: n1,text,トポロジ表現
> L5641: n2,text,LLM入力形式
> L5643: edges[2]{id,parent,child,order}:
> L5644: e1,n0,n1,0
> L5645: e2,n0,n2,1
> L5647: links[1]{id,source,target,type}:
> L5648: l1,n1,n2,related
> L5650: nodeAttrs[3]{id,key,type,value}:
> L5651: n1,status,str,draft
> L5652: n1,confidence,num,0.8
> L5653: n2,tags,list,LLM|TOON|compression
> L5655: edgeAttrs[2]{id,key,type,value}:

## TOONを正本にしない判断
- source: [raw](../raw_conversations/260425_LLMマインドマップトポロジ.md) `260425_LLMマインドマップトポロジ.md:5790-5810`

> L5790: TOON<->JSONは少なくとも100%の厳密性と高速性が無いと破綻するよね。
> L5791: 木の部分的編集とか含めると大丈夫だろうか。
> L5793: **ChatGPT**: <sub>2026-04-25 10:17</sub>
> L5795: はい。**TOONを正本にすると破綻します。**
> L5796: TOONはLLM入出力用の圧縮ビューであって、保存形式・差分適用形式・検証対象の正本にしてはいけません。
> L5798: M3Eでは、正本は必ず JSON / SQLite 側の内部モデルに置き、TOONはその一時的な投影にするべきです。
> L5800: ```text
> L5801: JSON / SQLite 正本
> L5802: -> exportToToon(scope, options)
> L5803: -> LLM
> L5804: -> Command Patch
> L5805: -> validate
> L5806: -> Model.apply(command)
> L5807: -> JSON / SQLite 正本
> L5808: ```
> L5810: 重要なのは、**TOON <-> JSON の完全往復を要求しない設計**にすることです。

## MIOS layer split
- source: [raw](../raw_conversations/260425_MIOSMindmap_IO_Stack.md) `260425_MIOSMindmap_IO_Stack.md:17-27`

> L17: LLMでマインドマップ構造を扱う際、入力はTOONで効率化できるが、出力も同様に扱うと構造の厳密性が保証できないという問題がある。そこで、高知能のAI1がTOONを読み取り編集方針を生成し、軽量なAI2がそれを半プログラム化された編集要求として出力する役割分担を導入する。入出力はTOONベースの軽量形式で統一しつつ、内部ではその編集要求をCommandへ変換し、JSON正本に対して検証・修復を行う。APIとModelはAI2と一体となって、編集要求を安全な操作列へ落とし込み、validationに通るまで反復する。最終的に検証済みCommandのみが適用されることで、TOONの効率性とJSONの厳密性を両立しつつ、AIによる編集を安全に実現する。
> L19: 了解です。**AI2の Request Program Layer と API/Model の Validate/Repair Layer を合体**させるなら、AI2は単独の層ではなく、検証・修復ループの中に入る実行補助になります。つまり、AI1が方針を作り、AI2 + TypeScript API + Model が一体で「通るCommand」まで落とします。
> L21: | 層 | 名前 | 主体 | 実体 | 入力 | 出力 |
> L22: | --- | --- | --- | --- | --- | --- |
> L23: | 1 | Intent Layer | User | UI / 自然言語入力 | 操作意図・問題意識 | 自然言語の編集意図 |
> L24: | 2 | Planning Layer | AI1 高知能LLM | ChatGPT / Claude strong model | 編集意図 + TOON context | 編集方針・対象範囲・変更理由 |
> L25: | 3 | Program-Guard Layer | AI2 + API + Model | fast LLM + TypeScript EditRequestCompiler + CommandValidator | 編集方針 + TOON context + Model state | Validated Command / ValidationError |
> L26: | 4 | Commit Layer | User + Model | React diff UI + Model.apply | Validated Command + dry-run diff | Applied Change + Undo log |
> L27: | 5 | Persist Layer | Storage | SQLite / JSON | Applied Model state | PersistedDocument |

## Resolve / Compile / Validate / Repair
- source: [raw](../raw_conversations/260425_MIOSMindmap_IO_Stack.md) `260425_MIOSMindmap_IO_Stack.md:35-43`

> L35: | Resolve | TypeScript API | selector / label / nodeId / index を解決する |
> L36: | Compile | TypeScript API | 内部Commandへ変換する |
> L37: | Validate | Model | 循環、scope、alias、存在、順序を検査する |
> L38: | Repair | AI2 + API | ValidationErrorを受けて修復する |
> L40: 図ではこうです。
> L42: ```
> L43: User  ↓AI1 Planning  ↓AI2 + API + Model  Program → Resolve → Compile → Validate ↔ Repair  ↓User approval + Model.apply  ↓SQLite / JSON

## Model.apply唯一入口
- source: [raw](../raw_conversations/260304_MVC通信形式_Rapid.md) `260304_MVC通信形式_Rapid.md:1835-1843`

> L1835: (5) Controller → Service：reparentNode(A, toParent=P’, …) のユースケース呼び出し
> L1836: (6) Service：Command生成（例：ReparentNodeCommand(nodeId=A, fromParent=P, toParent=P’, fromIndex=i, toIndex=j)）
> L1837: (7) Service → Model：model.apply(command)（状態変更の入口はここ） fileciteturn1file0
> L1839: 5) Model.apply(command)（確定処理）
> L1840: (1) Model：制約検証（循環禁止、scope制約、alias制約など）
> L1841: (2) Model：状態更新（親をP→P’へ付け替え）
> L1842: (3) Model：undoStackへ積み、redoStackをクリア
> L1843: (4) Model → View：changed通知（購読しているViewへイベント送出） fileciteturn1file0

## JSON document model and SQLite priority
- source: [raw](../raw_conversations/260402_UIマトリクス視覚化.md) `260402_UIマトリクス視覚化.md:4847-4851`

> L4847: > 優先順位は以下とする。
> L4848: >
> L4849: > 1. 論理正本は JSON document model とする
> L4850: > 2. Rapid MVP の永続化実装は SQLite とする
> L4851: > 3. `.mm` は import/export 互換フォーマットとして維持する

## SavedDoc JSON as canonical format
- source: [raw](../raw_conversations/260402_UIマトリクス視覚化.md) `260402_UIマトリクス視覚化.md:4926-4931`

> L4926: > ## 全体方針
> L4927: >
> L4928: > - M3E の正本は **SavedDoc JSON**（`version: 1`）とする
> L4929: > - 外部フォーマットは「入口・出口」であり、正本には常に M3E 形式に変換してから取り込む
> L4930: > - ラウンドトリップ（M3E → 外部 → M3E）で意味が保たれることを重視する
> L4931: > - 外部フォーマットで表現できない M3E 固有の概念（scope・alias 等）は、エクスポート時に落とすか属性として退避する

## SavedDoc schema evidence
- source: [raw](../raw_conversations/260405_M3E_vs_M3E.md) `260405_M3E_vs_M3E.md:3873-3886`

> L3873: > ## 内部フォーマット
> L3874: >
> L3875: > ### SavedDoc JSON（`version: 1`）
> L3876: >
> L3877: > M3E の正本フォーマット。ファイル保存・ブラウザダウンロード・SQLite 内部保存に使用する。
> L3878: >
> L3879: > **スキーマ:**
> L3880: >
> L3881: > ```typescript
> L3882: > interface SavedDoc {
> L3883: >   version: 1
> L3884: >   savedAt: string        // ISO 8601 タイムスタンプ
> L3885: >   state: AppState
> L3886: > }
