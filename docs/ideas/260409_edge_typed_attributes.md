# 親子エッジに型/属性を持たせる設計案

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
