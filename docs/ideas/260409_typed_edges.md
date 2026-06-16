# 枝（エッジ）に型・属性を持たせる設計案

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
