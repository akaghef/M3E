# オントロジーとデータ構造 -- NTT Data 解説からの知見

## 1. オントロジーの基本概念（NTT Data 記事要約）

### 1.1 オントロジーとは

オントロジーとは「対象世界をどのように捉えた（概念化した）かを記述するもの」であり、
知識の共有化・再利用の方法として IT 領域で活用される。
例えば「カレーは料理という上位概念に含まれ、作る手順は切る・焼く・煮るの順になる」
といった概念整理が、正確な伝達と知識共有を実現する。

NTT Data ではオントロジーを「モデル（設計図）」と位置づけ、
実際のデータはセマンティック（RDF ドキュメント）で実装される、と説明している。

### 1.2 構成要素

| 要素 | 説明 | OWL/RDF での表現 |
|------|------|-----------------|
| **Class（クラス）** | 概念の集合。「料理」「動物」など | `owl:Class` |
| **Instance（インスタンス）** | クラスに属する具体的な個体。「カレー」「柴犬」など | `rdf:type` で所属 |
| **ObjectProperty** | 個体同士の関係。「AはBの一部」など | `owl:ObjectProperty` |
| **DatatypeProperty** | 個体とリテラル値の関連。「名前=XX」など | `owl:DatatypeProperty` |
| **subClassOf** | クラス間の階層（is-a 関係）。「犬 is-a 動物」 | `rdfs:subClassOf` |
| **partOf** | 全体-部分関係。「タイヤ partOf 自転車」 | ObjectProperty で定義 |

### 1.3 オントロジーの分類体系パターン

1. **Taxonomy（分類階層）** -- is-a 関係によるクラスの木構造。最も基本的。
2. **Mereology（部分-全体）** -- part-of 関係。構造の分解・合成。
3. **関連関係（Association）** -- 任意の意味的関係。「AはBを使用する」「AはBに影響する」等。
4. **制約・ルール** -- OWL では `owl:Restriction` 等で表現。「すべてのXはYを持つ」等。

### 1.4 ナレッジグラフとの関係

NTT Data の DATA INSIGHT 記事によれば：
- **オントロジー** = クラスレベルの知識（設計図・スキーマ）
- **ナレッジグラフ** = オントロジー + Linked Data（インスタンスレベルの知識）
- ナレッジグラフは発生データに意味と関連を後付けし、異なる視点での仮説検証・試行錯誤を支える
- 視点を自在に変化させる「シングルビュー」の提供が核心的価値

---

## 2. M3E データモデルとの対応

### 2.1 現在の M3E データモデル概要

```typescript
// TreeNode: 親子ツリー構造の基本単位
interface TreeNode {
  id: string;
  parentId: string | null;
  children: string[];
  nodeType?: "text" | "image" | "folder" | "alias";
  text: string;
  attributes: Record<string, string>;  // 自由な key-value
  // ... details, note, link, etc.
}

// GraphLink: ノード間の横断的関係
interface GraphLink {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType?: string;  // 関係の種類（自由文字列）
  label?: string;
  direction?: "none" | "forward" | "backward" | "both";
  style?: "default" | "dashed" | "soft" | "emphasis";
}

// ThinkingMode: 帯域
type ThinkingMode = "flash" | "rapid" | "deep";
```

### 2.2 対応表

| オントロジー概念 | M3E の現在の対応 | ギャップ |
|-----------------|-----------------|---------|
| **Class** | `nodeType` (text/image/folder/alias) | 固定 4 種のみ。ユーザー定義のクラス概念がない |
| **Instance** | `TreeNode` 個々のノード | 十分に対応。各ノードが個体 |
| **subClassOf (is-a)** | `parentId` / `children` による親子関係 | 親子関係は「包含」であり、厳密な is-a ではない。ツリーは分類階層と構造階層が混在する |
| **ObjectProperty** | `GraphLink.relationType` | 自由文字列で柔軟だが、型やスキーマの制約がない |
| **DatatypeProperty** | `TreeNode.attributes` (Record<string, string>) | string 値のみ。型情報（数値・日付等）がない |
| **partOf** | 親子関係が暗黙的に part-of を兼ねる | is-a と part-of の区別がない。同じ parentId で両方を表現 |
| **Taxonomy** | フォルダ階層（scopeId による空間分割） | スコープ内では存在するが、スコープ横断の分類体系はない |
| **ナレッジグラフ** | `AppState.links` (GraphLink の集合) | ノードがスコープに閉じる傾向があり、グラフの横断的活用が限定的 |
| **オントロジー（スキーマ）** | 該当なし | M3E にはメタモデル（スキーマ定義）層がない |
| **Restriction / Rule** | 該当なし | 制約やルールの表現手段がない |

### 2.3 M3E の強みと特徴

- **ツリー + グラフのハイブリッド**: 親子構造（TreeNode）と横断リンク（GraphLink）の二層構造は、オントロジーの is-a 階層とアソシエーション関係の分離に近い
- **attributes の柔軟性**: Record<string, string> は DatatypeProperty の簡易版として機能している
- **スコープによる空間分割**: folder ノードがスコープ境界を作り、関心事ごとの知識空間を分離できる
- **ThinkingMode**: Flash/Rapid/Deep の帯域概念は、同一データを異なる密度で扱う仕組みとして独自

---

## 3. Deep モードへの設計提案

### 3.1 Deep モードの現在の位置づけ（仕様設計書より）

- 「完成物ではなく変化し続ける設計図として構造を扱う」
- 外部 AI 用コンテクスト生成、差分比較、抽象化が主機能
- Rapid との差は「表示密度・読解密度」として段階的に調整

### 3.2 オントロジー知見からの提案

#### 提案 A: relationType のボキャブラリ定義

現状の `GraphLink.relationType` は自由文字列だが、Deep モードでは以下の標準関係型を
ボキャブラリとして提供することで、構造の意味解釈を強化できる。

```
推奨ボキャブラリ（案）:
  "is-a"       -- 分類階層（犬 is-a 動物）
  "part-of"    -- 部分-全体（タイヤ part-of 自転車）
  "depends-on" -- 依存関係
  "causes"     -- 因果関係
  "related-to" -- 一般的関連（フォールバック）
  "contradicts"-- 矛盾・対立
  "implements" -- 実装関係
  "refines"    -- 詳細化
```

**実装への影響**: `relationType` は既に string なので、UI 上で候補リストを提示するだけで実現可能。データモデルの変更は不要。

#### 提案 B: attributes への型ヒント付与

Deep モードでは attributes の値に意味を持たせたい場面が増える。
現状の `Record<string, string>` を活かしつつ、キー命名規約で型を暗示する方法を検討できる。

```
例:
  "type:status" → "active"        -- 列挙型
  "num:priority" → "3"            -- 数値型
  "date:deadline" → "2026-04-15"  -- 日付型
  "ref:related-doc" → "{nodeId}"  -- ノード参照型
```

**実装への影響**: データモデル変更なし。Deep モードの表示ロジックでプレフィックスを解釈。

#### 提案 C: メタノード（スキーマノード）の導入

オントロジーにおける「クラス定義」に相当する特殊ノードを Deep モードで導入する構想。
通常のノードがインスタンスであるのに対し、メタノードは「このスコープ内のノードはこういう構造を持つ」というテンプレートを定義する。

```
例: スコープ「プロジェクト管理」のメタノード
  nodeType: "meta" (新規追加)
  text: "タスク"
  attributes: {
    "schema:status": "todo|doing|done",
    "schema:priority": "number",
    "schema:assignee": "string"
  }
```

**実装への影響**: NodeType の拡張が必要。Deep モード専用機能として段階的に導入可能。
**注意**: これは設計判断が大きいため、manager への確認が必須。

#### 提案 D: Deep モードでのグラフ可視化強化

オントロジーの本質は「関係の可視化」にある。Deep モードでは：
- GraphLink を第一級の可視要素として扱い、関係のラベル・方向を常に表示
- relationType に応じたビジュアル分類（色・線種の自動割当）
- 「このノードに繋がる全関係」の俯瞰ビュー（ナレッジグラフ的視点）

**実装への影響**: 主に viewer.ts の描画ロジック変更。データモデル変更は不要だが、GraphLinkStyle の拡張は検討の余地あり。

#### 提案 E: 親子エッジへの型/属性付与（追加提案）

**問題**: 現在の M3E では親子エッジ（parentId / children[]）に一切のメタデータがない。
ツリー上で「細胞 -> 幹細胞」の関係が is-a なのか part-of なのか、データとして区別できない。
オントロジーではエッジの種類こそが知識の本質であり、これは Deep モード実現の根本的障壁。

**推奨案（ハイブリッド方式）**: TreeNode に `edgeType?: string` を追加し、親への関係種別を保持する。
ツリー構造（parentId / children[]）はそのまま維持し、Deep モードでのみ edgeType を活用する。
グラフ可視化時には getAllEdges() ユーティリティで親子エッジも GraphLink として統一列挙する。

```typescript
interface TreeNode {
  // ... 既存フィールド
  edgeType?: string;  // "is-a" | "part-of" | "causes" | ...（親への関係種別）
}
```

この方式は Rapid モードに影響を与えず、既存データとの完全な後方互換性がある。

詳細な設計案は `dev-docs/ideas/260409_edge_typed_attributes.md` を参照。

### 3.3 段階的導入ロードマップ（案・改訂）

| Phase | 内容 | データモデル変更 |
|-------|------|-----------------|
| 0 | **親子エッジの型付け（edgeType）** | **TreeNode に edgeType?: string 追加** |
| 1 | relationType ボキャブラリの UI 候補提示 | なし |
| 2 | GraphLink の Deep モード可視化強化 | なし（Style 拡張は任意） |
| 3 | attributes 型ヒントの解釈・表示 | なし（規約ベース） |
| 4 | メタノード導入の設計検討 | NodeType 拡張（要判断） |

Phase 0 を最優先とする理由: エッジに意味がなければ、他の全てのオントロジー的機能が空回りする。

---

## 3.5 NTT Data 記事の詳細読解からの追加知見（2026-04-09 補完）

### 記事 1: [オントロジーで事象を読み解く、ナレッジグラフの効用と活用](https://www.nttdata.com/jp/ja/trends/data-insight/2020/0319/)

**核心的概念: 同一データに複数のオントロジーを適用**

> 「発生したデータに対して、意味と関連を**後付けする**」

例: 「荒木（30代男性）がプリキュアDVDを購入」
- オントロジー1: 「同一年代性別の顧客が同一商品を購買する」→ 30代男性にプリキュアをレコメンド（ミスマッチ）
- オントロジー2: 「扶養家族が同一商品を嗜好する」→ 女児扶養者にプリキュアをレコメンド（適切）

**M3E への含意:**
- M3E の ThinkingMode (Flash/Rapid/Deep) は「同一データに対する異なるビュー」。これはまさに **同一データに異なるオントロジーを適用する** のと同じ構造
- スコープ（folder）は「どのオントロジーを適用するか」の切替に相当する
- **枝の型（edgeType）が重要な理由**: オントロジーによって「購買する」「扶養する」「嗜好する」等のエッジの意味が変わる。エッジに型がなければ、異なるオントロジーの適用が表現できない

### 記事 2: [ヒトの思考ロジックをなぞらえる「ナレッジグラフ技術」](https://www.nttdata.com/jp/ja/trends/data-insight/2020/0608/)

**核心的概念: インスタンスとオントロジーの二層構造**

ナレッジグラフ = **インスタンス**（文書から抽出された実データ）+ **オントロジー**（概念体系）

体系化は4段階の半自動プロセス:
1. ドメインデータから情報を自動抽出
2. 業務固有の概念にマッピング
3. 人間による評価とフィードバック
4. 繰り返しによる精度向上

**2つのアプローチ:**
- **文脈依存型**: 関係を網羅的に抽出 → 意味を対応づけ（契約書リスクチェック等）
- **文脈独立型**: 概念に応じて情報を抽出 → 関係を判定（マニュアル検索等）

**M3E への含意:**
- M3E の **F→R→D 昇格パス** はこの体系化プロセスに対応:
  - Flash = インスタンスの自動抽出（生データ投入）
  - Rapid = 関係のマッピング（構造化）
  - Deep = 人間による評価 + AI フィードバック（体系化）
- 「人間の介入（ミクロな情報操作、構造のリファクタリング）」は NTT Data が言う「人間による評価とフィードバック」と同じ
- **edgeType は文脈依存型/文脈独立型の両方で不可欠**: 関係の意味（is-a, part-of, causes 等）がなければマッピングが成立しない

### 記事 3: [LLMとナレッジグラフが切り拓く、情報検索の新時代](https://www.nttdata.com/jp/ja/trends/data-insight/2024/1108/)

**核心的概念: Graph RAG**

従来の RAG は文書を小単位に分割して数値化（ベクトル化）するが、情報の断片化が問題。
**Graph RAG** は事前にドキュメントをナレッジグラフ化し、関係性を含めた検索を実現。

パターン定義の構造: **「誰が（主語）」「何をする（述語）」「何に対して（目的語）」** — これは RDF のトリプル（Subject-Predicate-Object）と同じ。

検証結果:
- リスク審査: 判定精度と理由出力精度が向上
- 企業関係抽出: 約73%の関係性を正確に抽出
- 課題: ナレッジグラフ構築コストが大きい、検索・回答に時間を要する

**M3E への含意:**
- M3E のツリー構造は**手動で構築されたナレッジグラフ**に近い。Graph RAG の「構築コスト問題」を人間の日常的な思考整理（Flash→Rapid→Deep）で解決するアプローチ
- **AI subagent の TCL 変換** はまさに「ナレッジグラフ ↔ 自然言語」の双方向変換
- **edgeType + relationType** があれば、M3E のデータを Graph RAG のソースとして直接利用可能
  - TreeNode のツリー = SPO トリプルの Subject-Object
  - edgeType / GraphLink.relationType = Predicate
  - attributes = プロパティ

### 3記事の総合的含意

| NTT Data の概念 | M3E の対応 | edgeType で得られるもの |
|-----------------|-----------|----------------------|
| オントロジー = 概念体系 | Deep モード | エッジの意味（is-a, part-of）が明示されることで体系が成立 |
| 同一データへの複数オントロジー適用 | ThinkingMode 切替 | エッジ型があれば異なるビューで異なる関係の強調が可能 |
| インスタンス + オントロジーの二層 | Flash(インスタンス) + Deep(概念) | エッジ型が昇格のシグナル（無印→型付き＝体系化済み） |
| Graph RAG の SPO トリプル | TreeNode + edgeType | M3E データがそのまま Graph RAG ソースになる |
| 体系化の半自動プロセス | F→R→D 昇格 + AI subagent | エッジ型の付与が「体系化完了」のインジケータ |

**結論: edgeType の導入は M3E のオントロジー的活用の最小必須条件であり、Graph RAG 連携への布石でもある。**

---

## 4. 参考 URL

### NTT Data 関連
- [オントロジー（用語解説）-- NTTデータ バリュー・エンジニア](https://www.nttdata-value.co.jp/glossary/ontology)
- [セマンティック（用語解説）-- NTTデータ バリュー・エンジニア](https://www.nttdata-value.co.jp/glossary/semantic)
- [FIBO（用語解説）-- NTTデータ バリュー・エンジニア](https://www.nttdata-value.co.jp/glossary/fibo)
- [オントロジーで事象を読み解く、ナレッジグラフの効用と活用 -- NTTデータ DATA INSIGHT](https://www.nttdata.com/jp/ja/trends/data-insight/2020/0319/)
- [ヒトの思考ロジックをなぞらえる「ナレッジグラフ技術」-- NTTデータ DATA INSIGHT](https://www.nttdata.com/jp/ja/trends/data-insight/2020/0608/)
- [LLMとナレッジグラフが切り拓く、情報検索の新時代 -- NTTデータ DATA INSIGHT](https://www.nttdata.com/jp/ja/trends/data-insight/2024/1108/)

### オントロジー技術仕様
- [ウェブのオントロジー言語OWL -- 神崎正英](https://kanzaki.com/docs/sw/webont-owl.html)
- [OWL Web Ontology Language Reference -- W3C](https://www.w3.org/TR/owl-ref/)
- [オントロジー (情報科学) -- Wikipedia](https://ja.wikipedia.org/wiki/%E3%82%AA%E3%83%B3%E3%83%88%E3%83%AD%E3%82%B8%E3%83%BC_(%E6%83%85%E5%A0%B1%E7%A7%91%E5%AD%A6))

### ナレッジグラフ・設計パターン
- [ナレッジグラフとは？-- リコー](https://promo.digital.ricoh.com/ai-for-work/column/detail013/)
- [知識グラフ入門：Neo4jとオントロジーの関係性 -- Qiita](https://qiita.com/Tadataka_Takahashi/items/2869cbc36be9ced9599a)
- [オントロジーことはじめ（概念入門）-- Qiita](https://qiita.com/mininobu/items/bce0e0ad97ed17e0aff2)
- [知識グラフとオントロジーによるAIシステムの開発 -- J-STAGE](https://www.jstage.jst.go.jp/article/essfr/18/2/18_123/_pdf/-char/ja)
