# Import / Export 仕様

> **MVP 対応状況を含む。** 未実装のものは「未実装」と明記する。

---

## 全体方針

- M3E の正本は **SavedDoc JSON**（`version: 1`）とする
- 外部フォーマットは「入口・出口」であり、正本には常に M3E 形式に変換してから取り込む
- ラウンドトリップ（M3E → 外部 → M3E）で意味が保たれることを重視する
- 外部フォーマットで表現できない M3E 固有の概念（scope・alias 等）は、エクスポート時に落とすか属性として退避する

---

## フォーマット一覧

| フォーマット | Import | Export | 状態 |
|-------------|--------|--------|------|
| M3E SavedDoc JSON | ✅ | ✅ | 実装済み |
| SQLite（内部永続化） | ✅ | ✅ | 実装済み |
| Freeplane `.mm` | ✅ | ❌ | Import のみ実装済み |
| インデントテキスト | ❌ | ❌ | 未実装（将来対応候補） |
| Markdown | ❌ | ❌ | 未実装（将来対応候補） |

---

## 内部フォーマット

### SavedDoc JSON（`version: 1`）

M3E の正本フォーマット。ファイル保存・ブラウザダウンロード・SQLite 内部保存に使用する。

**スキーマ:**

```typescript
interface SavedDoc {
  version: 1
  savedAt: string        // ISO 8601 タイムスタンプ
  state: AppState
}

interface AppState {
  rootId: string
  selectedId?: string
  nodes: Record<string, TreeNode>
  links?: Record<string, GraphLink>
}

interface TreeNode {
  id: string
  parentId: string | null
  children: string[]     // 順序付き子 ID 配列
  text: string
  collapsed: boolean     // 折り畳み状態。PersistedDocument の一部として保存する
  details: string
  note: string
  attributes: Record<string, string>
  link: string
}

interface GraphLink {
  id: string
  sourceNodeId: string
  targetNodeId: string
  relationType?: string
  label?: string
  direction?: "none" | "forward" | "backward" | "both"
  style?: "default" | "dashed" | "soft" | "emphasis"
}
```

**保存・読み込みの動作:**

| 操作 | 動作 |
|------|------|
| ブラウザダウンロード | pretty-print JSON、ファイル名 `rapid-edited.json`（固定） |
| Node.js ファイル書き出し | `fs.writeFileSync` でUTF-8 pretty-print |
| 読み込み | `version === 1` と `state` の存在を検証後、モデル不変条件を再検証 |

**既知の制限:**
- ダウンロードファイル名が `rapid-edited.json` 固定（未改善）
- `selectedId` は保存されるが、読み込み後に UI に反映されるかは実装依存
- `links` は仕様追加済みだが Beta viewer/save-load では未実装

### Graph-level `Link` の保存方針

- `AppState.links` は graph-level relation line の保存先とする
- `TreeNode.link` は node-level の外部リンク属性として残す
- 両者を相互変換しない

**保存制約:**

- `sourceNodeId` / `targetNodeId` は実在ノードを指す必要がある
- self link は保存しない
- alias endpoint は Beta では未対応として保存拒否でよい
- node delete 時に endpoint を失う `Link` は同時削除する

---

### SQLite 内部永続化

`rapid-mvp.sqlite` に SavedDoc の JSON を列として格納する。
ファイル保存の代替ではなく、ブラウザリロード後も状態を維持するための層。

**スキーマ:**

```sql
CREATE TABLE documents (
  id       TEXT PRIMARY KEY,
  version  INTEGER NOT NULL,
  saved_at TEXT NOT NULL,
  state_json TEXT NOT NULL
)
```

**動作:**
- 保存: `INSERT ... ON CONFLICT DO UPDATE`（UPSERT）で冪等
- 読み込み: `state_json` をパースし、SavedDoc と同じ検証を適用
- JSON 形式は SavedDoc の `state` フィールドと同一

**データファイルの場所:** `mvp/data/rapid-mvp.sqlite`（`.gitignore` で除外）

---

## 外部フォーマット

### Freeplane `.mm`（Import のみ実装済み）

Freeplane の XML ベースのマインドマップ形式。

#### Import

**パース対象フィールド:**

| `.mm` の要素 | M3E の `TreeNode` フィールド | 備考 |
|-------------|---------------------------|------|
| `node TEXT` 属性 | `text` | 主テキスト |
| `node FOLDED` 属性 | `collapsed` | `"true"` → `true` |
| `node LINK` 属性 | `link` | 外部リンク URL |
| `richcontent TYPE="NODE"` | `text` | TEXT 属性がない場合のフォールバック |
| `richcontent TYPE="DETAILS"` | `details` | 詳細テキスト |
| `richcontent TYPE="NOTE"` | `note` | ノートテキスト |
| `attribute NAME VALUE` | `attributes[NAME]` | 任意キーバリュー |
| 子 `node` 要素 | `children`（再帰） | 順序を維持 |

**取り込まれないフィールド:**

| `.mm` の要素 | 理由 |
|-------------|------|
| スタイル・色・フォント | M3E は独自スタイルを持つ |
| `CREATED` / `MODIFIED` | M3E の ID に埋め込み済み（`n_<timestamp>_<rand>`） |
| アイコン | 未対応 |
| クラウド装飾 | 未対応 |
| エッジ形状 | 未対応 |

**取り込み後の ID 生成:**
- Freeplane の元 ID は使用しない
- M3E の `n_<timestamp>_<random>` 形式で新規 ID を生成する
- `savedAt` はパース実行時のタイムスタンプを使用

#### Export（未実装）

M3E → `.mm` のエクスポートは未実装。以下は将来の設計方針。

**M3E → `.mm` フィールドマッピング（設計案）:**

| M3E `TreeNode` フィールド | `.mm` の要素 | 備考 |
|--------------------------|-------------|------|
| `text` | `node TEXT` 属性 | |
| `collapsed` | `node FOLDED` 属性 | |
| `link` | `node LINK` 属性 | |
| `details` | `richcontent TYPE="DETAILS"` | |
| `note` | `richcontent TYPE="NOTE"` | |
| `attributes` | `attribute` 要素群 | |
| `children` 順序 | 子 `node` 要素の順序 | |

**M3E 固有概念の退避:**

| M3E の概念 | `.mm` への退避方法 |
|------------|-----------------|
| ノード type（`folder` 等） | `attribute NAME="m3e:type"` |
| alias の参照先 | `attribute NAME="m3e:alias-ref"` |
| scope 境界 | `folder` 型ノードは Freeplane のクラウドで表現（検討中） |
| graph-level `Link` | 未定義（Beta では未実装） |

---

## ラウンドトリップ保証

### M3E JSON → M3E JSON

すべてのフィールドが保持される。完全なラウンドトリップを保証する。

### Freeplane `.mm` → M3E JSON → Freeplane `.mm`

| フィールド | 往復後の状態 |
|-----------|------------|
| テキスト・構造 | 保持される |
| 折り畳み状態 | 保持される |
| details / note / attributes / link | 保持される |
| 元の Freeplane スタイル・色 | **失われる**（Import 時に破棄） |
| 元の Freeplane ノード ID | **失われる**（M3E ID に置き換え） |

---

## 将来対応候補

Linear <-> Tree 変換の詳細方針は `Linear_Tree_Conversion.md` を参照。

### インデントテキスト Import

```
研究テーマ
  観察事実
    収穫量が15%減少
    降水パターン変化
  仮説
    温度上昇が主因
```

貼り付けから直接ツリーを構築できる。`m3e.paste(text)` コマンドと連動。

### Markdown Import / Export

見出し階層（`#` `##` `###`）をツリー構造にマッピングする。
テキストノードのみ対応。`details` / `note` は Markdown のコードブロックや引用で退避する方向で検討。

---

## 関連文書

- データモデル不変条件: [./Data_Model.md](./Data_Model.md)
- Linear <-> Tree 変換仕様: [./Linear_Tree_Conversion.md](./Linear_Tree_Conversion.md)
- Freeplane マッピング方針: [../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md](../05_Freeplane_Integration/Freeplane_Data_Model_Mapping.md)
- カスタムエンジン採択: [../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md](../09_Decisions/ADR_003_Freeplane_Informed_Custom_Engine.md)
- SQLite 採択: [../09_Decisions/ADR_004_SQLite_For_Rapid_MVP.md](../09_Decisions/ADR_004_SQLite_For_Rapid_MVP.md)
- コマンド API: [./Command_Language.md](./Command_Language.md)
