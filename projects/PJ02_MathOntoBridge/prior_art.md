# PJ02 関連 既存考察の集約

PJ02 MathOntoBridge のビジョン策定に使う素材。
以下のファイルを要約せず原文のまま収録。

## 収録元

1. `docs/ideas/260409_typed_edges.md` — 親子エッジに型を持たせる設計案
2. `docs/ideas/260409_edge_typed_attributes.md` — edgeToParent 設計比較（案A/B/C）
3. `docs/research/ontology_data_structure.md` — オントロジーとデータ構造（NTT Data 知見）
4. `docs/research/ontology_scientific_research.md` — 競合調査 & M3E 差別化設計
5. `docs/ideas/260410_scalable_knowledge_base_vision.md` — スケーラブル知識ベースビジョン

---

# 1. 枝（エッジ）に型・属性を持たせる設計案

Source: `docs/ideas/260409_typed_edges.md`

Date: 2026-04-09
Status: idea
Origin: akaghef の発想 + NTT Data オントロジー解説からの知見

## 問題

現在の M3E では **親子エッジに情報がない**。

```
細胞 ──(?)──> 幹細胞      ← is-a? part-of? 区別できない
研究テーマ ──(?)──> 仮説H1  ← has-hypothesis? consists-of?
```

- `parentId` / `children[]` は構造のみで、関係の**意味**を持たない
- `GraphLink` は `relationType` を持つが、親子エッジとは別物
- オントロジーでは is-a と part-of は根本的に異なる関係

## 設計案

### 案 1: TreeNode に `edgeLabel` を追加（最小変更）

子ノード側に「親との関係の種類」を保持する。

```typescript
interface TreeNode {
  // ... 既存フィールド
  edgeLabel?: string;  // この子と親の関係の種類
  // 例: "is-a", "part-of", "has-step", "causes", ...
}
```

**メリット**:
- データモデルの変更が小さい（optional フィールド1つ追加）
- 既存データは `edgeLabel` なし → 従来通りの「無印の親子関係」
- ツリー構造を壊さない

**デメリット**:
- エッジの属性が1つ（ラベル）だけ。将来的に不足する可能性
- 親子関係の意味を**子ノード側**に持たせるのは概念的にやや不自然

### 案 2: TreeNode に `edgeAttributes` を追加（拡張性重視）

```typescript
interface TreeNode {
  // ... 既存フィールド
  edgeLabel?: string;                      // 関係の種類
  edgeAttributes?: Record<string, string>; // 関係の属性
}
```

```
例: 「幹細胞 is-a 細胞」+ 追加情報
  edgeLabel: "is-a"
  edgeAttributes: {
    "confidence": "0.95",
    "source": "doi:10.1234/...",
    "defined-by": "研究者A"
  }
```

**メリット**:
- ノードの attributes と対称的な設計（ノードにもエッジにも自由属性）
- confidence / temperature をエッジにも付けられる（信頼度の累積に不可欠）
- 将来の拡張に耐える

**デメリット**:
- データモデルの変更がやや大きい（2フィールド追加）
- レンダリングの複雑さが増す

### 案 3: 親子エッジを暗黙の GraphLink にする（統一モデル）

親子関係も GraphLink として明示的に表現する。

```typescript
// 親子関係が自動的に GraphLink を生成
// parentId: "cell" → children: ["stem-cell"]
// ↓ 暗黙的に以下が生成される
{
  sourceNodeId: "cell",
  targetNodeId: "stem-cell",
  relationType: "is-a",  // ユーザーが設定
  direction: "forward",
  isTreeEdge: true,       // 新フィールド: ツリーエッジであることを示す
}
```

**メリット**:
- エッジの型付けが GraphLink に統一される
- 一貫したモデル（全エッジが同じ型）

**デメリット**:
- ツリー構造と GraphLink の二重管理になるリスク
- 親子を変更するたびに GraphLink も同期が必要
- 実装の複雑さが大幅に増す

## 推奨: 案 2（edgeLabel + edgeAttributes）

**理由**:
1. ツリー構造を壊さない（parentId / children はそのまま）
2. ノードの attributes と対称的で直感的
3. 信頼度の累積に必要（エッジにも confidence を付けられる）
4. 案 1 では将来不足する。案 3 は複雑すぎる
5. F→R→D の昇格パスで、エッジの意味が段階的に明確になる:
   - Flash: edgeLabel なし（ただの並び）
   - Rapid: edgeLabel あり（フローの意味）
   - Deep: edgeLabel + edgeAttributes（信頼度付き関係）

## 表示への影響

### Rapid モード
- 親子エッジのラベルをベジェ曲線の中間点に小さく表示
- edgeLabel がある場合のみ（ない場合は現在通り無印）

### Deep モード
- 親子エッジのラベルを常時表示
- ノード選択時に edgeAttributes をパネルに表示
- relationType に応じたエッジ色の自動割当

## ボキャブラリ候補

```
is-a          分類階層（犬 is-a 動物）
part-of       部分-全体（タイヤ part-of 自転車）
has-step      手順（調理 has-step 切る）
causes        因果関係
depends-on    依存関係
contradicts   矛盾・対立
supports      支持・根拠
refines       詳細化
implements    実装
example-of    例示
```

## 次のアクション

1. manager 判断: 案 2 を採用するか
2. 採用する場合: `beta/src/shared/types.ts` の TreeNode に `edgeLabel?` と `edgeAttributes?` を追加
3. viewer.ts でエッジラベルのレンダリングを実装（Deep モード優先）
4. ボキャブラリの候補リストを UI に組み込み

---

# 2. 親子エッジに型/属性を持たせる設計案

Source: `docs/ideas/260409_edge_typed_attributes.md`

## Why

現在の M3E では、親子エッジ（parentId / children[]）にはいかなるメタデータもない。
ツリー上で「細胞 -> 幹細胞」が is-a なのか part-of なのか、データとして区別できない。

一方 GraphLink には relationType, label, direction, style が既にある。
つまり M3E には「情報を持つエッジ（GraphLink）」と「情報を持たないエッジ（親子）」の二重構造がある。

オントロジーでは、エッジの種類こそが知識の本質である:
- is-a（分類）: 犬 is-a 動物
- part-of（構成）: エンジン part-of 自動車
- causes（因果）: 加熱 causes 膨張
- depends-on（依存）: モジュールA depends-on モジュールB

これらを区別できなければ、Deep モードでの「体系的知識の構造化」は実現できない。

## 設計案の比較

### 案 A: TreeNode に edgeToParent フィールドを追加

子ノード側に「親への接続情報」を持たせる。

```typescript
interface TreeNode {
  // ... 既存フィールド
  edgeToParent?: {
    type?: string;        // "is-a" | "part-of" | "causes" | ... 
    label?: string;       // 表示ラベル（typeと異なる場合）
    attributes?: Record<string, string>;  // 追加メタデータ
  };
}
```

**利点**:
- 既存の parentId / children[] 構造を壊さない
- TreeNode の JSON 構造にオプショナルに追加するだけ
- validate() への影響が最小限（edgeToParent は任意フィールド）
- ツリー描画時にエッジ情報を即座に参照できる（子ノードを読めばエッジ情報もある）
- 保存/復元の整合性が parentId と一体化しているため壊れにくい

**欠点**:
- 親子エッジと GraphLink が別体系のまま（二重構造の解消にならない）
- reparentNode() で edgeToParent の引き継ぎ/リセット判断が必要
- 「エッジ」という独立エンティティではなく、ノードの付属情報にとどまる

**影響コード**: rapid_mvp.ts の addNode(), reparentNode(), validate(), _normalizeNode()

### 案 B: 親子エッジを GraphLink に統一

親子関係も GraphLink で表現し、parentId / children[] は GraphLink から導出する。

```typescript
// TreeNode から parentId, children を除去し、GraphLink で表現
interface GraphLink {
  id: string;
  sourceNodeId: string;    // 親
  targetNodeId: string;    // 子
  relationType?: string;   // "child" | "is-a" | "part-of" | ...
  label?: string;
  direction?: LinkDirection;
  style?: LinkStyle;
  attributes?: Record<string, string>;
  isStructural?: boolean;  // true = ツリー構造を形成するエッジ
}
```

**利点**:
- エッジの統一モデル。全エッジが同じデータ構造を持つ
- オントロジー的に最も正しい（関係は全てエッジ）
- GraphLink の既存機能（relationType, label, style）が親子にも適用される

**欠点**:
- **破壊的変更**: 既存の parentId / children[] に依存するコードが全面改修
- ツリー順序（children の配列順）を GraphLink でどう表現するか（order フィールド追加が必要）
- パフォーマンス: 子ノード一覧取得が O(1) 配列参照から O(n) リンク走査になる
- viewer.ts のツリーレイアウトが parentId / children 前提で構築されている
- validate() の整合性チェックが根本的に再設計

**影響コード**: types.ts, rapid_mvp.ts, collab.ts, viewer.ts の全面改修

### 案 C: ハイブリッド（推奨）

parentId / children[] はそのまま維持し、親子エッジの意味情報は「暗黙的 GraphLink」として自動生成/管理する。

```typescript
// TreeNode: 構造は変えない
interface TreeNode {
  // ... 既存フィールドそのまま
  edgeType?: string;  // 親への関係種別（ショートカット参照）
}

// GraphLink: 親子エッジも含む統一クエリ対象
interface GraphLink {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType?: string;
  label?: string;
  direction?: LinkDirection;
  style?: LinkStyle;
  attributes?: Record<string, string>;  // NEW: エッジ属性
  structural?: boolean;                  // NEW: true = 親子エッジ由来
}
```

動作:
1. **ツリー操作は parentId / children[] で行う**（既存コードそのまま）
2. **Deep モードでエッジ情報が必要な場面では、TreeNode.edgeType を参照**
3. **グラフ可視化時は、親子エッジも GraphLink として列挙する関数を提供**
4. GraphLink に `structural: true` フラグで親子由来かどうかを区別

```typescript
// 親子エッジを GraphLink として列挙するユーティリティ
function getAllEdges(state: AppState): GraphLink[] {
  const structuralLinks: GraphLink[] = [];
  for (const node of Object.values(state.nodes)) {
    if (node.parentId) {
      structuralLinks.push({
        id: `structural_${node.id}`,
        sourceNodeId: node.parentId,
        targetNodeId: node.id,
        relationType: node.edgeType ?? "child",
        structural: true,
      });
    }
  }
  const graphLinks = Object.values(state.links ?? {});
  return [...structuralLinks, ...graphLinks];
}
```

**利点**:
- 既存コードへの影響が最小限（TreeNode に edgeType? を追加するだけ）
- 段階的導入が可能（edgeType 未設定なら従来通り）
- Deep モードでは getAllEdges() でオントロジー的な統一ビューを提供
- validate() への影響が軽微
- Rapid モードは何も変わらない

**欠点**:
- 二重構造が完全には解消されない（ただし実用上は問題ない）
- structural な GraphLink はリアルタイム生成であり、永続化されない

**影響コード**: types.ts に edgeType? 追加、rapid_mvp.ts に edgeType 対応、新規ユーティリティ関数

## 推奨: 案 C（ハイブリッド）

### 理由

1. **M3E の設計思想との整合**: Rapid モードは軽快な操作が命。親子構造を GraphLink に統一すると、全操作が重くなる。案 C なら Rapid は何も変わらず、Deep でだけ拡張機能が有効になる
2. **段階的導入**: edgeType はオプショナルなので、既存データとの完全な後方互換性がある
3. **オントロジー的正しさ**: getAllEdges() を通せば、全エッジを統一的に扱える。Deep モードの「体系的知識」ビューでこれを活用する
4. **実装コスト**: types.ts に 1 フィールド追加 + ユーティリティ関数 1 つで最小限の実装が可能

### 具体例: 「細胞 -> 幹細胞」問題の解決

```
Before (現在):
  TreeNode "細胞" { children: ["幹細胞のid"] }
  TreeNode "幹細胞" { parentId: "細胞のid" }
  → is-a なのか part-of なのか不明

After (案C適用後):
  TreeNode "細胞" { children: ["幹細胞のid"] }
  TreeNode "幹細胞" { parentId: "細胞のid", edgeType: "is-a" }
  → 「幹細胞 is-a 細胞」であることが明示

  TreeNode "細胞" { children: ["核のid"] }
  TreeNode "核" { parentId: "細胞のid", edgeType: "part-of" }
  → 「核 part-of 細胞」であることが明示
```

### edgeType の推奨ボキャブラリ

| edgeType | 意味 | 例 |
|----------|------|-----|
| (未設定/null) | 従来通りの親子関係 | 通常の箇条書き |
| `"is-a"` | 分類（子は親の種類） | 幹細胞 is-a 細胞 |
| `"part-of"` | 構成（子は親の部分） | エンジン part-of 自動車 |
| `"has"` | 所有・保持 | 人 has 名前 |
| `"causes"` | 因果 | 加熱 causes 膨張 |
| `"depends-on"` | 依存 | モジュールA depends-on B |
| `"implements"` | 実装 | 関数X implements インタフェースY |
| `"example-of"` | 例示 | カレー example-of 料理 |
| `"refines"` | 詳細化 | 詳細設計 refines 概要設計 |

UI では自由入力も許可しつつ、候補リストとしてこれらを提示する。

## Open Questions

1. **edgeType の表示**: Deep モードでエッジラベルをどう可視化するか（線上テキスト？色分け？アイコン？）-- visual チームとの相談が必要
2. **reparentNode 時の edgeType**: 移動先でも edgeType を引き継ぐか、リセットするか
3. **GraphLink.attributes の追加**: GraphLink にも attributes を追加するか（案 C では構造的 GraphLink は仮想的なので、実体のある GraphLink にも attributes があると統一感が出る）
4. **edgeType vs edgeToParent**: 単一の string で十分か、オブジェクト（案 A の edgeToParent）にすべきか。最初は string で始めて、必要なら拡張する方針を推奨

## Next Action

1. manager に本設計案をレビュー依頼
2. 承認後、types.ts に `edgeType?: string` を追加（最小変更）
3. rapid_mvp.ts の addNode / reparentNode に edgeType 対応を追加
4. validate() に edgeType のバリデーション追加（任意: 既知ボキャブラリかどうかの警告）
5. getAllEdges() ユーティリティを shared/ に追加
6. Deep モードの UI 設計は visual チームと連携

---

# 3. オントロジーとデータ構造 -- NTT Data 解説からの知見

Source: `docs/research/ontology_data_structure.md`

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

詳細な設計案は `docs/ideas/260409_edge_typed_attributes.md` を参照。

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

---

# 4. オントロジー x 科学研究 — 競合調査 & M3E 差別化設計

Source: `docs/research/ontology_scientific_research.md`

作成日: 2026-04-09
作成者: data agent
ステータス: 初版（Web検索未使用、既存知識ベース）

---

## 1. 競合・類似サービス調査

### 1.1 オントロジーエディタ / ナレッジグラフツール

| ツール | 概要 | 科学研究適合度 | 弱点 |
|--------|------|---------------|------|
| **Protege** (Stanford) | OWL/RDF オントロジーエディタのデファクト標準。Java デスクトップ + WebProtege (クラウド版) | 高 — 生物医学オントロジー構築で広く使用 | UI が専門家向け。思考過程の記録には不向き。ツリーではなくクラス階層が主構造。編集体験が重い |
| **WebVOWL** | OWL オントロジーの可視化ツール (Web) | 中 — 閲覧専用、編集不可 | 可視化のみ。構築・編集機能なし |
| **TopBraid Composer** (商用) | エンタープライズ向け RDF/OWL エディタ + SHACL | 中 — 企業のナレッジグラフ管理向け | 高額ライセンス。個人研究者には過剰。クラウド依存 |
| **Neo4j / Cytoscape** | グラフDB + 可視化 | 中 — データ分析には強い | プログラミング必須。思考の構造化ツールではない |
| **Obsidian + Dataview** | Markdown ベースの PKM + グラフビュー | 中 — 学術ユーザー多い | グラフはフラット（階層構造弱い）。オントロジー的な型定義なし |

### 1.2 科学研究向けナレッジマネジメント

| ツール | 概要 | 科学研究適合度 | 弱点 |
|--------|------|---------------|------|
| **ResearchSpace** (British Museum 発) | Linked Data ベースの研究プラットフォーム | 高 — CIDOC-CRM オントロジー統合 | 人文系に特化。自然科学の仮説-実験ワークフロー未対応。セットアップが重い |
| **Semantic Scholar** (AI2) | AI 駆動の論文検索・推薦 | 高 — 論文発見に特化 | 検索ツールであり構造化ツールではない。自分の思考を整理する機能なし |
| **Connected Papers** | 論文間の引用関係グラフ | 中 — 文献調査に有用 | 閲覧専用。自分のノートや仮説を追加できない |
| **Zotero + ZotFile** | 文献管理 + PDF 注釈 | 高 — 文献管理のデファクト | 文献管理に特化。思考の構造化は範囲外 |
| **Roam Research** | バックリンク型アウトライナー | 中 — 学術ユーザーあり | ツリーよりもフラットなページ群。オフライン弱い。クラウド依存。開発停滞気味 |
| **Logseq** | Roam 代替のオープンソース版 | 中 — ローカルファースト | 同上（フラット構造中心）。オントロジー的な型付けなし |

### 1.3 マインドマップ / アウトライナー（学術用途）

| ツール | 概要 | 科学研究適合度 | 弱点 |
|--------|------|---------------|------|
| **Freeplane** | Java ベースのマインドマップ。学術利用実績あり | 中 — ツリー構造は強い | UI が古い。コラボなし。属性はあるが自由度低い。API 弱い |
| **XMind** | 商用マインドマップ | 低 — 汎用向け | 科学研究特化機能なし。クラウド依存。拡張性なし |
| **Scapple** (Literature & Latte) | 自由配置型のアイデアボード | 低 — 構造が弱い | ツリー構造なし。整理よりブレスト向け |
| **Docear** (SciPlore) | 文献統合型マインドマップ | 高 — PDF 注釈とマップ連動 | **開発終了**。Java 依存。Web 対応なし |
| **VUE** (Tufts University) | コンセプトマップツール | 中 — 学術開発 | **開発停滞**。Java 依存 |

### 1.4 科学オントロジー管理基盤

| ツール | 概要 | 科学研究適合度 | 弱点 |
|--------|------|---------------|------|
| **OBO Foundry** | 生物医学オントロジーの標準リポジトリ | 高 — Gene Ontology 等を管理 | オントロジー定義の管理基盤であり、個人の思考ツールではない |
| **BioPortal** (NCBO) | 生物医学オントロジーの検索・閲覧ポータル | 高 — 用語検索に有用 | 閲覧・検索専用。自分のオントロジーを構築する場ではない |
| **OLS** (EMBL-EBI) | Ontology Lookup Service | 高 — 用語参照 | 同上 |

### 1.5 Web 検索による補完調査（2026-04-09）

#### 既存競合の最新動向

**Tana — 最大の競合に浮上**
- 2025年2月に $25M 調達。待機リスト 160K+
- 2026年3月: **2製品に分裂** — 新しい「Tana」（コラボ + agentic work 向けナレッジグラフ）と「Tana Outliner」（既存のアウトライナー）
- 新 Tana は fine-grained access control、LaTeX / math blocks、リビジョン履歴（semantic diff）を搭載
- **M3E との競合度: 高（Deep 領域）** — Supertags による型付きノード + AI + チームコラボ。ただしクラウド依存、ローカルファースト不可

**Heptabase — 学術ユーザーに浸透**
- ビジュアルカード + 無限キャンバス + bidirectional links。研究者・学生向けに学術ワークフローと citation support を提供
- ロードマップ（2025年10月更新）: 「AI にナレッジベース全体をコンテキストとして質問」機能を開発中
- **M3E との競合度: 中（Flash + Deep 領域）** — ビジュアル思考は強いがグラフ構造の多様性とツリー階層が弱い

**Roam Research — 衰退中だが存命**
- 月間アクティブ約100万。ピーク時のハイプは消失。2026年現在も運営中だが開発ペースは鈍化
- **M3E との競合度: 低** — 脅威ではない

#### AI × 科学研究ツール（新規カテゴリ）

| ツール | 概要 | 競合領域 | M3E との差異 |
|--------|------|---------|-------------|
| **Elicit** | 138M+ 論文へのアクセス。2026年3月に Research Agents + API 公開 | Deep（文献調査） | 論文検索・要約に特化。思考の構造化機能なし |
| **scienceOS** | 230M+ 論文ベースの AI 研究ツール。論文と対話 | Deep（文献調査） | 同上。入力（論文）の管理であり構造化出力なし |
| **Google AI Co-Scientist** | Gemini 2.0 ベース。仮説生成、実験プロトコル設計 | Deep（仮説生成） | 強力だが Google 内部ツール。ユーザーの知識体系を構築する場ではない |
| **NotebookLM** | Google の AI 研究パートナー。2026年: infographic 生成、cinematic video、Gemini 統合、EPUB 対応 | Flash + Deep | ソース要約に強い。しかし**構造化・階層化・グラフリンクなし**。ノートブック = フラットなソース集合 |
| **Consensus** | 科学論文からのエビデンスベース回答エンジン | Deep（検索） | 検索ツール。思考構造化なし |
| **SciSpace** | 280M 論文、文献検索〜原稿ドラフトまでの AI Super Agent | Deep（文献〜執筆） | ワークフロー自動化。しかし知識の永続的構造化なし |

**発見**: AI 研究ツールは**論文の検索・要約・生成**に集中。「研究者自身の思考を構造化し、累積的に育てる」ツールは依然として空白。

#### ダイアグラム / ホワイトボード（Rapid 領域）

| ツール | 最新動向 | 競合度 |
|--------|---------|--------|
| **Excalidraw** | GitHub 118K+ stars。手書き風ダイアグラム。AI prototyping デモ。OSS、活発 | 中（Rapid） — 図は描けるがノードにデータ（属性）を持てない |
| **tldraw** | GitHub 45K+ stars。computer.tldraw.com — Google 連携のマルチモーダル AI キャンバス。SDK として埋め込み可能 | 中（Rapid + Flash） — AI 連携は先進的だが知識構造化なし |

#### LLM × Knowledge Graph のアカデミックトレンド

- **Ontogenia (2025)**: Metacognitive Prompting でオントロジー自動生成。LLM が自己反省・構造修正しながらオントロジーを合成
- **KGL-LLM (Guo et al., 2025)**: 専用 Knowledge Graph Language で LLM-KG 統合。リアルタイムコンテキスト取得で補完エラー低減
- **TEXT2KG Workshop (2025)**: LLM によるテキスト→ナレッジグラフ生成の国際ワークショップ
- **TCL に直接対応する既存概念は見つからなかった**。KGL-LLM が最も近いが、M3E の TCL は「ツリー構造↔自然言語の双方向変換」であり、KG query language とは異なるアプローチ

---

## 2. ギャップ分析: 科学研究ワークフローへの適合度

科学研究の典型的ワークフロー:

```
問い設定 → 文献調査 → 仮説形成 → 実験設計 → データ収集 → 分析 → 考察 → 論文執筆
```

| ワークフロー段階 | 既存ツールのカバー状況 | 未充足の領域 |
|-----------------|----------------------|-------------|
| 問い設定 | マインドマップ（汎用）、Roam/Logseq（メモ） | **構造的な問い分解**を支援するツールがない |
| 文献調査 | Semantic Scholar, Connected Papers, Zotero | 十分にカバーされている |
| 仮説形成 | ほぼ未対応 | **仮説のツリー分解、前提条件の明示、反証可能性の構造化**が空白 |
| 実験設計 | 専用ツール (LabArchives 等) は存在するが思考構造と分離 | 仮説→実験→予測の**構造的接続**がない |
| データ収集/分析 | Jupyter, R, Python — 十分 | ツールは十分だが思考構造との統合がない |
| 考察 | 未対応 | **結果と仮説の対照、解釈の分岐の構造化**が空白 |
| 論文執筆 | LaTeX, Overleaf — 十分 | 構造化された思考から論文への**変換パス**がない |

### 核心的な発見

**「科学的思考の構造化」を主目的としたツールは存在しない。**

- オントロジーツール（Protege 等）は**用語体系の定義**に特化しており、研究プロセスの思考支援ではない
- PKM ツール（Obsidian, Roam 等）は**メモの蓄積と検索**に強いが、構造的な思考分解を強制しない
- マインドマップツール（Freeplane 等）は**構造は持つが科学研究の文法を知らない**
- 文献管理ツール（Zotero 等）は**入力（論文）の管理**であり、思考の出力を構造化しない

科学研究に必要なのは「用語体系を定義する」ことではなく「**研究思考を構造的に分解・追跡・比較する**」ことであり、このニッチは未充足である。

---

## 3. M3E の差別化ポイント

### M3E の既存の強み（データモデルから）

| 強み | 対応するデータモデル要素 |
|------|------------------------|
| **階層的思考構造** | `TreeNode` の parent-children ツリー |
| **自由属性定義** | `attributes: Record<string, string>` |
| **認知境界 (scope)** | `scopeId`, folder ノード |
| **参照構造 (alias)** | `nodeType: "alias"`, `targetNodeId` |
| **グラフリンク** | `GraphLink` (relationType, direction, style) |
| **ローカルファースト** | SQLite 永続化、オフライン動作 |
| **AI 提案モデル** | Subagent (proposal/direct-result), 人間承認フロー |
| **Linear 変換** | Tree <-> 自然言語の双方向変換 |

### 差別化の方向性

既存ツールが「用語定義」か「メモ蓄積」に留まる中、M3E は **「研究思考のランタイム」** として位置づけられる。

1. **構造が意味を持つ** — ツリーの配置自体が「分解」「比較」「前提-結論」などの意味を表現する
2. **ローカルファースト + AI 補助** — 機密研究データをクラウドに出さずに AI 支援を受けられる
3. **scope による認知負荷制御** — 研究の複雑さを管理可能な単位に分割できる
4. **属性自由定義でドメイン適応** — 生物学でも物理学でも、分野固有の属性を自由に追加できる

---

## 4. 具体的ユースケース提案

### UC1: 仮説ツリーによる研究設計

```
研究テーマ (root)
├── 背景
│   ├── 既知事実 A [attributes: {evidence: "strong", source: "doi:..."}]
│   ├── 既知事実 B
│   └── 未解決問題 [attributes: {type: "gap"}]
├── 仮説群 (scope)
│   ├── 仮説 H1 [attributes: {status: "testing", confidence: "medium"}]
│   │   ├── 前提条件 P1
│   │   ├── 予測: X が起きるはず
│   │   └── 反証条件: Y が観測されたら棄却
│   ├── 仮説 H2 (対立仮説)
│   │   └── ...
│   └── 仮説 H1 vs H2 比較 [GraphLink: H1 <-> H2, relationType: "competing"]
├── 実験設計 (scope)
│   ├── 実験 E1 → H1 を検証 [alias → H1]
│   └── 実験 E2 → H2 を検証 [alias → H2]
└── 結果・考察 (scope)
    ├── E1 結果 [attributes: {outcome: "支持", p-value: "0.003"}]
    └── 解釈の分岐
        ├── H1 支持の場合 → 次の研究課題
        └── H1 棄却の場合 → H2 の再検討
```

### UC2: 系統的レビュー (Systematic Review) の構造化

```
レビュー (root)
├── リサーチクエスチョン (PICO形式)
│   ├── Population [attributes: {定義: "..."}]
│   ├── Intervention
│   ├── Comparison
│   └── Outcome
├── 検索戦略 (scope)
│   ├── DB: PubMed [attributes: {query: "...", hits: "1234"}]
│   ├── DB: Scopus
│   └── スクリーニング基準
├── 採択論文群 (scope)
│   ├── 論文 A [attributes: {year: "2024", quality: "high", n: "500"}]
│   │   ├── 主要結果
│   │   └── バイアスリスク
│   ├── 論文 B
│   └── ...
├── 統合分析 (scope)
│   ├── 論文 A の結果 [alias → 論文A/主要結果]
│   ├── 論文 B の結果 [alias → 論文B/主要結果]
│   └── メタ分析結果 [attributes: {effect_size: "0.45", CI: "0.2-0.7"}]
└── 結論 & 限界
```

### UC3: 研究室のオントロジー構築（ドメイン知識の体系化）

```
研究室オントロジー (root)
├── 概念体系 (scope)
│   ├── 上位概念: 細胞 [attributes: {type: "class"}]
│   │   ├── 幹細胞 [GraphLink → 細胞, relationType: "is-a"]
│   │   │   ├── ES細胞
│   │   │   └── iPS細胞
│   │   └── 体細胞
│   └── 上位概念: 分化
│       ├── 分化誘導 [GraphLink → 幹細胞, relationType: "acts-on"]
│       └── 脱分化
├── 実験プロトコル (scope)
│   ├── プロトコル P1: iPS 樹立 [alias → iPS細胞]
│   │   ├── Step 1: 山中因子導入
│   │   └── Step 2: コロニー選別
│   └── プロトコル P2
├── 研究プロジェクト群 (scope)
│   ├── PJ-2026-01 [attributes: {PI: "田中", status: "active"}]
│   │   ├── 使用概念 [alias → iPS細胞]
│   │   └── 使用プロトコル [alias → プロトコル P1]
│   └── PJ-2026-02
└── 用語辞典 (scope) — 新人教育用
    ├── iPS細胞 [alias → 概念体系/幹細胞/iPS細胞]
    └── ...
```

### UC4: 論文執筆の構造足場 (Scaffolding)

```
論文ドラフト (root)
├── Abstract (scope) [attributes: {word_limit: "250"}]
├── Introduction (scope)
│   ├── 背景 [alias → 研究設計/背景]
│   ├── 既存研究の限界 [alias → レビュー/結論]
│   └── 本研究の目的
├── Methods (scope)
│   └── 使用プロトコル [alias → オントロジー/プロトコル P1]
├── Results (scope)
│   └── 主要結果 [alias → 研究設計/結果]
├── Discussion (scope)
│   ├── 結果の解釈
│   ├── 限界
│   └── 将来の方向性
└── References
```

---

## 5. Flash / Rapid / Deep 軸での競合マッピング

### 5.1 M3E の3モード定義（最新）

| Mode | 本質 | 対象 | 科学研究での役割 |
|------|------|------|-----------------|
| **Flash** | マルチモーダル キャプチャ | 画像・音声・テキスト・スケッチ | 実験写真、ホワイトボードメモ、音声ブレスト、フィールドノート |
| **Rapid** | データフロー / 多様なグラフ構造 | フローチャート、ネットワーク図、因果図、シーケンス | 実験フロー、因果モデル、システム図、パイプライン設計 |
| **Deep** | 体系的知識 / オントロジー | 階層分類、属性定義、メタデータ付き知識体系 | 仮説ツリー、系統的レビュー、研究室オントロジー |

### 5.2 競合のマッピング（抜粋）

```
           Flash              Rapid              Deep
           (キャプチャ)       (グラフ構造)       (知識体系)
    ┌──────────────────┬──────────────────┬──────────────────┐
個  │ Apple Notes      │ draw.io          │ Obsidian         │
人  │ Heptabase        │ yEd              │ Logseq           │
    │ OneNote          │ Mermaid          │ Roam             │
    │                  │                  │ Tana             │
    │                  │                  │ Protege          │
    ├──────────────────┼──────────────────┼──────────────────┤
チ  │ Miro / FigJam    │ Lucidchart       │ WebProtege       │
ー  │ Notion           │ Kumu             │ Notion (DB)      │
ム  │                  │                  │                  │
    └──────────────────┴──────────────────┴──────────────────┘
                              ↑
                    ● M3E（3モード統合 + チーム）
                    同一 TreeNode データモデル上で
                    Flash ↔ Rapid ↔ Deep を横断
```

---

## 6. 結論と推奨アクション

### 仮説検証結果

**「科学研究にフォーカスした構造的思考ツールはない」→ 正しい。さらに、Flash/Rapid/Deep の3モード統合ツールは研究以外の領域でも存在しない。**

- Flash 領域: キャプチャツールは豊富だが**構造化への変換パス**がない
- Rapid 領域: ダイアグラムツールは**ノードにデータを載せられない**
- Deep 領域: 知識管理ツールは**多様なグラフレイアウト**に対応できない
- 全領域共通: **3モード間のデータ共有・変換**を提供するツールがない

### M3E の戦略的ポジション

```
    構造の厳密さ (Deep)
         ↑
 Protege ●
  Tana   ●
         |       ● M3E (3モード統合)
         |      /|\
         |     / | \
    ─────┼────/──┼──\────→ 表現の多様さ (Rapid)
         |  /    |   \
         |/     |    \
  Obsidian ●   ● draw.io
         |
  Miro ● ● Notion
         ↓
    素早さ・自由度 (Flash)
```

### 推奨アクション

1. **モード横断テンプレート** — Flash キャプチャ → Rapid 図 → Deep 体系 の変換パスを示すチュートリアル
2. **チーム scope 設計** — メンバーごとに異なるモードで同一スコープを開ける仕組み（collab.ts 拡張）
3. **Rapid のグラフレイアウト拡張** — 現在のツリーレイアウトに加え、フロー（左→右）、force-directed、因果ループの3種追加を検討
4. **属性・relationType プリセット** — 研究用（status, confidence, evidence）+ 汎用（priority, owner, due）
5. **Zotero / Jupyter 連携** — 文献管理・データ分析は外部に任せ、M3E は思考構造に集中する分業

---

# 5. スケーラブル知識ベース — M3E の根本ビジョン

Source: `docs/ideas/260410_scalable_knowledge_base_vision.md`

> 夢は出来たら人に語るようにしている。叶うので。
> — Akaghef, 2026-04-10

## コンセプト

**Miro × Obsidian × GitHub が融合した、科学用のナレッジベース**

## 問題意識

LLMやデータマネジメント全体が抱える問題として:

- 知識の蓄積は、日常〜局所推論レベルでは問題ない
- しかし **信頼性の累積ができない**（途中で破綻する）
- 故に **大域的なレベル（研究レベル）に外挿できない**
- これは CoT の文脈でも言われていたこと
- 適切なデータベースがあれば解決する

## 解決アプローチ

### データ構造・UXを工夫して、研究レベルまでスケーラブルな知識ベースを作る

- **信頼度・温度パラメータ付きアーキテクチャ**: 知識ベースを大域的レベルに外挿できるほどの信頼度を上げるには必須
- **人間の介入**: ミクロな情報操作、構造のリファクタリング。まだ2年くらい必要
- **TCL (Tree Compatible Language)**: 自然言語にプロトコルを定めて、フレームワークを統一。数学に限らず任意概念に適用

### 3バンド構造

| バンド | レベル | 特徴 |
|--------|--------|------|
| Flash | 日常 | マルチモーダルキャプチャ。構造は後付け |
| Rapid | 業務 | グラフ構造、チームCollab、AI連携 |
| Deep | 研究 | オントロジー、信頼度付き階層構造 |

### 市場ギャップ

- **オントロジー**: 業務ドメインではナレッジベースがほぼ完成。しかし理論系ドメインでは未充足
- **一気通貫UX**: 日常〜業務〜研究まで通貫 + LLM-friendly な知識ベースは **現状存在しない**

## 実現可能性

- Agent 開発で個人のパフォーマンスが 100 倍になる時代
- 今やらないと追い抜かれて飲まれる
- Claude の Skill としてマインドマップの読み書きが既に動いている
- 開発 PJ の揮発的ワーキング情報をマップ内で管理するパイプラインが出来上がりつつある
- 研究の包括パイプライン作成は 2 か月見込み

## 個人的目標

- 純粋数学と機械学習をブリッジできる人間になる
- 数学を TCL で再定義する
- Opus は TCL の設計が得意

## Source

Akaghef (@juvenile_crimes) Twitter thread, 2026-04-09

---

*集約日: 2026-04-17 PJ02 ビジョン策定用*
