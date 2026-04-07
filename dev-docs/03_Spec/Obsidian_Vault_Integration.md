# Obsidian Vault 連携仕様（Import / Export）

最終更新: 2026-04-04

## 目的

Obsidian Vault（.md ファイル群）と M3E マップの双方向変換を定義する。

- **Import**: Vault → M3E マップ。AI で各 .md を tree 構造に変換
- **Export**: M3E マップ → Vault。tree 構造を .md に書き戻す

---

# Part 1: Import

## Import の目的

Obsidian Vault を M3E のマップ構造に変換する。
各 .md ファイルの内容を linear text として扱い、
既存の AI subagent インフラで小さなリクエストを逐次送って
マップ構造を漸進的に構築する。

## 基本方針

1. Vault のフォルダ構造 → M3E のツリー骨格（folder ノード）
2. 各 .md ファイル → folder ノード + AI で linear-to-tree 変換 → subtree
3. `[[wikilink]]` → folder alias（collapsed な「扉」として配置）
4. AI リクエストはファイル単位の小粒度。一括ではなく逐次処理
5. 全処理は server 側で完結。Browser は進捗表示と最終レビューのみ

## 前提

- Vault パスは server が読めるローカルパス
- 対象は `.md` ファイルのみ（画像等の添付ファイルは参照パスだけ保持）
- frontmatter (YAML) はノード attributes に変換
- AI は必須ではない — AI 無しでもフォルダ構造 + flat ノード化で最低限の取り込みが成立

---

## データフロー概要

```
┌─────────────────────────────────────────────┐
│ Browser                                      │
│                                               │
│  1. ユーザーが vault パスを指定               │
│  2. POST /api/vault/import { vaultPath }      │
│  3. SSE で進捗を受信                          │
│  4. 完了後: マップをロード & レビュー         │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│ Server: VaultImporter                        │
│                                               │
│  Phase A: Discovery                           │
│   └─ vault 内の .md を再帰列挙               │
│   └─ フォルダ階層を tree skeleton に変換      │
│                                               │
│  Phase B: Parse                               │
│   └─ 各 .md を frontmatter + body に分離     │
│   └─ [[wikilink]] を抽出・記録               │
│                                               │
│  Phase C: AI Transform (逐次)                 │
│   └─ 各ファイルの body を linear-to-tree へ   │
│   └─ 返却された tree 構造を skeleton に接続   │
│   └─ ファイルごとに SSE で進捗通知            │
│                                               │
│  Phase D: Link Resolution                     │
│   └─ [[wikilink]] → folder alias に変換       │
│   └─ 未解決リンクは broken alias として記録   │
│                                               │
│  Phase E: Persist                             │
│   └─ 完成した AppState を documentId で保存   │
└─────────────────────────────────────────────┘
```

---

## Phase A: Discovery（AI 不要）

### 入力
- `vaultPath: string` — Vault ルートの絶対パス

### 処理
1. `vaultPath` が存在し、ディレクトリであることを検証
2. 再帰的に `.md` ファイルを列挙（`.obsidian/`, `.trash/` を除外）
3. フォルダ階層を M3E ノードに変換:
   - Vault ルート → `rootId` ノード（text = Vault 名）
   - 各サブフォルダ → `nodeType: "folder"` ノード
   - 各 `.md` ファイル → `nodeType: "folder"` ノード（text = ファイル名から `.md` を除去。alias から scope-in できるよう folder にする）

### 出力
```typescript
interface VaultDiscoveryResult {
  rootId: string;
  nodes: Record<string, TreeNode>;       // skeleton ノード群
  fileEntries: VaultFileEntry[];          // 処理待ちファイル一覧
}

interface VaultFileEntry {
  relativePath: string;                   // "folder/subfolder/note.md"
  nodeId: string;                         // skeleton 内の対応ノード ID
  sizeBytes: number;
}
```

### 設計判断
- ファイル数上限: 500（超過時は警告 + 先頭 500 のみ処理）
- `.obsidian/` 等の設定ディレクトリは自動除外

---

## Phase B: Parse（AI 不要）

### 各ファイルに対して:

1. UTF-8 でファイルを読み込み
2. frontmatter（`---` で囲まれた YAML）を分離
3. `[[wikilink]]` と `[[wikilink|display text]]` を正規表現で抽出
4. Markdown 本文を `linearText` として保持

### 出力（VaultFileEntry を拡張）
```typescript
interface ParsedVaultFile extends VaultFileEntry {
  frontmatter: Record<string, string>;   // YAML key-value
  wikilinks: WikilinkRef[];              // 抽出された内部リンク
  linearText: string;                    // AI に渡す markdown 本文
  truncated: boolean;                    // 文字数超過で切り詰めた場合
}

interface WikilinkRef {
  target: string;         // "Other Note" or "folder/Other Note"
  displayText?: string;   // "|" 以降のテキスト
  lineNumber: number;
}
```

### 設計判断
- linearText 上限: 6000 文字/ファイル（AI トークン制御）
- frontmatter の tags, aliases は attributes に変換
- 画像リンク `![[image.png]]` は `[image: image.png]` テキストに置換

---

## Phase C: AI Transform（逐次 — 既存 subagent 再利用）

### 戦略: ファイル単位の小粒度リクエスト

各 `ParsedVaultFile` に対して既存の `linear-to-tree` subagent を呼ぶ。

```typescript
// 各ファイルに対して:
const result = await runLinearTransform({
  direction: "linear-to-tree",
  sourceText: parsedFile.linearText,
  scopeRootId: parsedFile.nodeId,
  scopeLabel: parsedFile.relativePath,
  instruction: VAULT_IMPORT_INSTRUCTION,  // Obsidian 用の追加指示
  modelAlias: request.modelAlias ?? null,
});
```

### VAULT_IMPORT_INSTRUCTION（既定値）

```
You are converting an Obsidian markdown note into an M3E tree structure.
Return an indented outline where each line is a node.
Top-level headings (# ## ###) become parent nodes.
Bullet points and paragraphs under headings become child nodes.
Keep node text concise (under 80 chars). Move long content to a "details:" annotation.
Preserve the semantic hierarchy of the original document.
Format: indented plain text, 2 spaces per level.
```

### AI 結果の統合

1. AI が返した indented text を parse して TreeNode 群に変換
2. 各ノードの `parentId` を skeleton 側の placeholder ノードに接続
3. placeholder ノードの `children` を更新

```
Vault Root (folder)
├── folder-A (folder)
│   ├── note-1 (placeholder → AI で展開)
│   │   ├── Heading 1 (AI 生成)
│   │   │   ├── Point A
│   │   │   └── Point B
│   │   └── Heading 2
│   └── note-2
└── folder-B (folder)
    └── note-3
```

### AI fallback

AI が無効 or 失敗した場合:
- ファイル内容をそのまま placeholder ノードの `details` に格納
- ノード text はファイル名のまま
- 構造化は行わないが、データは失わない

### 進捗通知

各ファイル処理後に SSE イベントを送信:
```json
{
  "event": "vault-import-progress",
  "data": {
    "phase": "transform",
    "current": 12,
    "total": 45,
    "currentFile": "research/hypothesis-A.md",
    "status": "ok"
  }
}
```

---

## Phase D: Link Resolution（AI 不要）

### wikilink → Alias ノード変換

`[[wikilink]]` は M3E の folder alias に変換する。
alias は collapsed 状態ではただの「扉」であり、
scope in すればリンク先ノートの内容に入れる。
これは Obsidian でリンクをクリックして遷移する体験と一致する。

1. Phase B で抽出した `WikilinkRef` を走査
2. `target` をファイル名で全 `VaultFileEntry` と照合
   - 完全一致 → 確定リンク
   - ファイル名のみ一致（パス省略）→ 候補が 1 つなら確定、複数なら warning
   - 一致なし → broken alias として記録（`isBroken: true`, `targetSnapshotLabel` にリンクテキストを保持）
3. 確定リンクを alias ノードに変換し、リンク元ファイルノードの子として追加:

```typescript
const alias: TreeNode = {
  id: generateId(),
  parentId: sourceFileNodeId,        // wikilink が書かれたファイルのノード
  children: [],
  nodeType: "alias",
  text: "",                          // alias は target のラベルを継承
  collapsed: true,                   // 既定は collapsed = 閉じた扉
  details: "",
  note: "",
  attributes: {},
  link: "",
  targetNodeId: targetFileNodeId,    // リンク先ファイルのノード
  aliasLabel: ref.displayText || null,  // [[target|display]] の display 部分
  access: "read",
};
// sourceFileNode.children.push(alias.id);
```

### なぜ GraphLink ではなく Alias か

- folder alias は **collapsed/expanded を選べる**。これは「リンク先に入るかどうかをユーザーが選ぶ」という Obsidian の体験と同じ
- GraphLink はツリー外の補助線であり「眺めるだけ」。Obsidian のリンクは「入れる扉」なので alias が正しい
- collapsed alias は 1 行分のスペースしか取らない。量が多くても問題にならない

### alias 配置

各ファイルノードの子として、AI 生成 subtree の**後ろ**に alias 群をまとめて配置する:

```
note-A (file node)
├── Heading 1 (AI 生成)
│   ├── Point X
│   └── Point Y
├── Heading 2 (AI 生成)
├── → note-B (alias, collapsed)    ← [[note-B]] から生成
└── → note-C (alias, collapsed)    ← [[note-C]] から生成
```

### 出力
- 各ファイルノードに alias 子ノードを追加
- 未解決リンクは broken alias + `importResult.warnings` に記録

---

## Phase E: Persist

1. 完成した `AppState` を `SavedDoc` 形式に変換
2. `documentId` = `vault-{vaultDirName}` で SQLite に保存
3. Browser に完了通知 + documentId を返却

---

## API エンドポイント

### POST /api/vault/import

Import を開始する。レスポンスは SSE ストリーム。

**Request:**
```json
{
  "vaultPath": "C:/Users/user/ObsidianVault",
  "documentId": "vault-my-research",
  "modelAlias": "chat.fast",
  "options": {
    "maxFiles": 500,
    "maxCharsPerFile": 6000,
    "skipAiTransform": false,
    "excludePatterns": ["templates/", "daily/"]
  }
}
```

**Response (SSE stream):**
```
event: vault-import-progress
data: {"phase":"discovery","total":45,"message":"Found 45 markdown files."}

event: vault-import-progress
data: {"phase":"transform","current":1,"total":45,"currentFile":"index.md","status":"ok"}

...

event: vault-import-progress
data: {"phase":"transform","current":45,"total":45,"currentFile":"last.md","status":"ok"}

event: vault-import-progress
data: {"phase":"links","aliasesCreated":38,"brokenAliases":3}

event: vault-import-complete
data: {"documentId":"vault-my-research","nodeCount":312,"aliasCount":38,"warnings":["..."]}
```

### GET /api/vault/import/status

進行中の import があれば現在の進捗を返す。

---

## Browser UI

### 起動フロー

1. ツールバーに "Import Vault" ボタン追加
2. クリック → モーダル or パネルで vault パスを入力
3. "Import" ボタン押下 → `POST /api/vault/import` を EventSource で受信
4. プログレスバー表示（current/total ファイル数）
5. 完了後: 自動的に新 document をロードして表示
6. 未解決リンク等の warnings があれば status bar に表示

### Undo

import はクリップ���ード貼り付けと同じ扱いで、「一括追加した」という 1 操作として記録する。

- import 開始前に空（または既存）document の state を `pushUndoSnapshot()` で 1 つ保存
- import 全体が完了した後の state が現在状態になる
- Ctrl+Z で import 前の状態に戻る（全ノード消去）
- import 前 snapshot は空 state なので deep clone のコストは実質ゼロ

### レビュー

import 結果のマップを通常のエディタで表示。
ユーザーは自由にノ��ド編集・再配置できる。

---

## indented text → TreeNode[] パーサー

AI が返す indented text を TreeNode に変換する server 側ユーティリティ。

```typescript
function parseIndentedTextToNodes(
  text: string,
  parentNodeId: string,
  generateId: () => string,
): TreeNode[] {
  // 各行のインデント深さを測定
  // depth 0 → parentNodeId の直接子
  // depth N → 直近の depth N-1 ノードの子
  // "details:" アノテーションがあれば node.details に格納
}
```

### パース規則

```
Line "  - Some text"
  → depth = 1 (2 spaces / 2)
  → text = "Some text"

Line "    details: Long explanation here"
  → 直前ノードの details に追記

Line "# Heading"
  → depth = 0, text = "Heading"

Line "## Subheading"
  → depth = 1, text = "Subheading"
```

このパーサーは `linear-to-tree` の AI 出力だけでなく、
将来の他の import 機能でも再利用できる汎用ユーティリティとする。

---

## Vault → M3E 構造マッピング

| Obsidian 概念 | M3E 対応 |
|--------------|---------|
| Vault ルートフォルダ | root ノード (`nodeType: "text"`) |
| サブフォルダ | folder ノード (`nodeType: "folder"`) |
| .md ファイル | folder ノード — AI 変換後は children を持つ subtree root。alias から scope-in 可能 |
| `# Heading` | AI が子ノードに変換 |
| 段落・箇条書き | AI が子ノードに変換 |
| frontmatter tags | `node.attributes.tags = "tag1, tag2"` |
| frontmatter aliases | `node.attributes.aliases = "alias1, alias2"` |
| `[[wikilink]]` | `nodeType: "alias"` — リンク先ファイルノードへの folder alias（collapsed） |
| `![[embed]]` | `nodeType: "alias"` — リンク先ファイルノードへの folder alias（**expanded**） |
| `![[image.png]]` | `node.attributes.image = "image.png"`（参照のみ） |

---

## 設計判断

### なぜファイル単位の小粒度 AI リクエストか

- Vault 全体を 1 リクエストで送るとトークン上限を超える
- ファイル単位なら 1 リクエスト = 数百〜数千トークンで収まる
- 途中失敗してもそのファイルだけ fallback すればよい
- 進捗表示が自然にできる

### なぜ既存の linear-to-tree を再利用するか

- 新しい subagent を作るより、instruction の調整で対応できる
- prompt の質を上げれば変換品質も上がる（独立改善可能）
- AI Common API 契約に完全に乗る

### AI 無しモード

- `options.skipAiTransform = true` で AI 変換をスキップ
- フォルダ構造 + ファイル名ノード + details にファイル内容を格納
- AI 基盤が未設定の環境でも最低限の import が成立

### セキュリティ: vaultPath 検証

- `vaultPath` は絶対パスのみ受理。相対パスや `..` を含むパスは拒否
- symlink は追跡しない（vault 外のファイルを読まない）
- vault 内のファイルのみ読み込み対象。`.obsidian/`, `.trash/` は自動除外
- ファイル内容は server 内で処理。Browser に生ファイル内容は送出しない

### 再 import

- 同じ `documentId` で再 import した場合、既存 document を**上書き**する
- 上書き前に既存 state を undo snapshot として保存（Ctrl+Z で旧 import に戻れる）
- 別名で import したい場合は `documentId` を変える

### 並行リクエスト制御

- デフォルトは逐次（1 ファイルずつ）
- `options.concurrency = 3` で最大 3 並列まで許容
- rate limit 対策として 1 リクエストごとに 200ms の最低間隔

---

## 実装対象ファイル

| ファイル | 内容 |
|---------|------|
| `beta/src/node/vault_importer.ts` | **新規** — Phase A-E の全ロジック |
| `beta/src/node/indented_text_parser.ts` | **新規** — indented text → TreeNode[] パーサー |
| `beta/src/node/start_viewer.ts` | SSE endpoint `/api/vault/import` の追加 |
| `beta/src/shared/types.ts` | VaultImportRequest / VaultImportProgress 型追加 |
| `beta/src/browser/viewer.ts` | Import UI (モーダル + プログレスバー) |
| `beta/viewer.html` | Import モーダル HTML |
| `beta/prompts/vault-import/instruction.txt` | Obsidian 用の linear-to-tree 追加指示 |

---

---
---

# Part 2: Export

## Export の目的

M3E のマップ構造を Obsidian Vault（.md ファイル群）として書き出す。
Import の逆変換であり、M3E 上の編集結果を Obsidian に持ち帰れるようにする。

## 基本方針

1. folder ノード → Obsidian のサブフォルダ or .md ファイル
2. 各ファイルノードの subtree → AI で tree-to-linear 変換 → Markdown 本文
3. alias ノード → `[[wikilink]]` として Markdown に埋め込み
4. AI リクエストはファイル単位の小粒度（Import と同じ）
5. 既存 Vault への上書き export と、新規 Vault への export の両方をサポート

## 前提

- 出力先は server が書き込めるローカルパス
- AI は必須ではない — AI 無しでもインデントテキストでの export が成立
- M3E 固有概念（scope 境界、alias metadata）は frontmatter に退避

---

## データフロー概要

```
┌─────────────────────────────────────────────┐
│ Browser                                      │
│                                               │
│  1. ユーザーが出力先パスを指定                │
│  2. POST /api/vault/export { outputPath }     │
│  3. SSE で進捗を受信                          │
│  4. 完了後: 結果サマリーを表示                │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│ Server: VaultExporter                        │
│                                               │
│  Phase A: Structure Analysis                  │
│   └─ ツリーを走査し folder/file を判別        │
│   └─ 出力ファイル一覧を決定                   │
│                                               │
│  Phase B: AI Transform (逐次)                 │
│   └─ 各ファイルノードの subtree を             │
│      tree-to-linear で Markdown に変換        │
│   └─ ファイルごとに SSE で進捗通知            │
│                                               │
│  Phase C: Alias → Wikilink 埋め込み           │
│   └─ alias を [[wikilink]] に変換             │
│   └─ broken alias は <!-- broken --> コメント │
│                                               │
│  Phase D: Frontmatter 生成                    │
│   └─ node.attributes → YAML frontmatter      │
│   └─ M3E 固有メタデータを m3e: 名前空間で退避│
│                                               │
│  Phase E: Write                               │
│   └─ フォルダ作成 + .md ファイル書き出し      │
└─────────────────────────────────────────────┘
```

---

## Phase A: Structure Analysis

### ノード種別の判別

Import 時のマッピングを逆引きして、どのノードがフォルダでどのノードが .md ファイルに対応するかを決定する。

| M3E ノード | Export 先 | 判別条件 |
|-----------|----------|---------|
| root ノード | Vault ルートフォルダ | `parentId === null` |
| folder ノード（子に folder/file を持つ） | サブフォルダ | `nodeType === "folder"` かつ子に folder ノードがある |
| folder ノード（子が全て text） | .md ファイル | `nodeType === "folder"` かつ子が全て text/alias |
| text ノード（root 直下） | .md ファイル | root の直接子で `nodeType === "text"` |
| alias ノード | 出力しない（親ファイルの wikilink として埋め込み） | `nodeType === "alias"` |

### 簡易判別ルール

Import 由来の document なら `node.attributes["m3e:source"]` で元パスを保持できる。
それがない場合のヒューリスティック:

- **フォルダ判定**: 子に folder ノードを 1 つ以上持つ folder → サブフォルダ
- **ファイル判定**: それ以外の folder、または root 直下の text ノード → .md ファイル

### 出力

```typescript
interface ExportFileEntry {
  nodeId: string;
  outputPath: string;            // "subfolder/note-name.md"
  childNodeIds: string[];        // subtree 内の text ノード（alias 除く）
  aliasNodeIds: string[];        // subtree 内の alias ノード
}

interface ExportPlan {
  outputRoot: string;            // Vault 出力先の絶対パス
  folders: string[];             // 作成するサブフォルダ一覧
  files: ExportFileEntry[];      // 書き出すファイル一覧
}
```

---

## Phase B: AI Transform（逐次 — tree-to-linear 再利用）

各 `ExportFileEntry` に対して既存の `tree-to-linear` subagent を呼ぶ。

```typescript
const result = await runLinearTransform({
  direction: "tree-to-linear",
  sourceText: buildSubtreeOutline(fileEntry.nodeId),  // インデント形式の subtree
  scopeRootId: fileEntry.nodeId,
  scopeLabel: fileEntry.outputPath,
  instruction: VAULT_EXPORT_INSTRUCTION,
  modelAlias: request.modelAlias ?? null,
});
```

### VAULT_EXPORT_INSTRUCTION（既定値）

```
You are converting an M3E tree structure back into Obsidian-compatible Markdown.
Rules:
- Top-level children become # headings.
- Second-level children become ## headings.
- Third-level and deeper become bullet points with indentation.
- If a node has "details", include it as a paragraph under the heading/bullet.
- Preserve the semantic hierarchy.
- Output valid Markdown only.
```

### AI fallback

AI が無効 or 失敗した場合:
- subtree をインデント付きテキスト（`- ` 形式）としてそのまま出力
- 読めなくはないが、Markdown としての体裁は整わない

### `buildSubtreeOutline()` 関数

AI に渡すための subtree 直列化。Import 側の `parseIndentedTextToNodes()` の逆操作。

```typescript
function buildSubtreeOutline(nodeId: string, state: AppState): string {
  // nodeId の子を再帰的に走査
  // alias ノードはスキップ（Phase C で別途処理）
  // 各ノードをインデント付きで出力
  // node.details があれば "  details: ..." 行を追加
}
```

---

## Phase C: Alias → Wikilink 埋め込み

### 変換規則

| M3E alias | Markdown 出力 |
|-----------|--------------|
| alias (collapsed, `!isBroken`) | `[[target-node-name]]` |
| alias (expanded, `!isBroken`) | `![[target-node-name]]` |
| alias (`aliasLabel` あり) | `[[target-node-name\|aliasLabel]]` |
| broken alias | `<!-- broken link: targetSnapshotLabel -->` |

### 配置

Phase B で生成した Markdown 本文の**末尾**に、リンクセクションとして追加:

```markdown
## 本文の内容...

---

## Related
- [[note-B]]
- [[note-C]]
```

あるいは、AI 出力の自然な位置に `[[wikilink]]` を混ぜ込む方式も考えられるが、
初期実装ではファイル末尾にまとめる方が安全で確実。

### target ノード名の解決

alias の `targetNodeId` から target ノードを引き、そのノードの `text` をファイル名として使う。
サブフォルダ内のファイルの場合はパスを含める:

```typescript
function resolveWikilinkTarget(aliasNode: TreeNode, exportPlan: ExportPlan): string {
  const targetEntry = exportPlan.files.find(f => f.nodeId === aliasNode.targetNodeId);
  if (!targetEntry) return null;  // broken
  // "subfolder/note-name.md" → "subfolder/note-name" or "note-name"
  return targetEntry.outputPath.replace(/\.md$/, "");
}
```

---

## Phase D: Frontmatter 生成

### node.attributes → YAML frontmatter

```yaml
---
tags:
  - hypothesis
  - biology
aliases:
  - 仮説A
m3e:nodeId: "n_1234_abc"
m3e:source: "original-vault/research/hypothesis-A.md"
---
```

### 変換規則

| node.attributes キー | frontmatter | 備考 |
|---------------------|-------------|------|
| `tags` | `tags:` リスト | カンマ区切り → YAML リスト |
| `aliases` | `aliases:` リスト | Obsidian の alias 機能に対応 |
| `m3e:*` | そのまま保持 | M3E 固有メタデータの退避・復元用 |
| その他 | `attributes:` 以下にフラットに格納 | |

### M3E 固有メタデータ

re-import 時のラウンドトリップを支援するため、以下を `m3e:` 名前空間で退避:

- `m3e:nodeId` — 元ノード ID（re-import 時の差分検出用）
- `m3e:source` — Import 元の相対パス（あれば）
- `m3e:nodeType` — `folder` 等（Obsidian では表現できない概念の退避）

---

## Phase E: Write

### 処理

1. `outputPath` のルートディレクトリを作成（存在しなければ）
2. ExportPlan の `folders` を順に作成
3. 各 `ExportFileEntry` について:
   - frontmatter + Markdown 本文 + wikilink セクションを結合
   - UTF-8 で `.md` ファイルとして書き出し
4. SSE で進捗通知

### 上書き制御

| モード | 動作 |
|-------|------|
| `overwrite: true`（既定） | 既存ファイルを上書き |
| `overwrite: false` | 既存ファイルがあればスキップし warning |
| `clean: true` | 書き出し前に outputPath 内の .md を全削除（危険、確認必須） |

---

## Export API エンドポイント

### POST /api/vault/export

Export を開始する。レスポンスは SSE ストリーム。

**Request:**
```json
{
  "documentId": "vault-my-research",
  "outputPath": "C:/Users/user/ObsidianVault",
  "modelAlias": "chat.fast",
  "options": {
    "skipAiTransform": false,
    "overwrite": true,
    "clean": false,
    "excludeNodeIds": []
  }
}
```

**Response (SSE stream):**
```
event: vault-export-progress
data: {"phase":"analysis","fileCount":45,"folderCount":8}

event: vault-export-progress
data: {"phase":"transform","current":1,"total":45,"currentFile":"index.md","status":"ok"}

...

event: vault-export-progress
data: {"phase":"write","current":45,"total":45,"currentFile":"last.md"}

event: vault-export-complete
data: {"outputPath":"C:/Users/user/ObsidianVault","filesWritten":45,"warnings":[]}
```

---

## ラウンドトリップ保証

### Import → Export

| 要素 | 保持 | 備考 |
|------|------|------|
| フォルダ構造 | ✅ | folder ノード → サブフォルダ |
| ファイル名 | ✅ | ノード text → ファイル名 |
| Markdown 見出し構造 | ⚠️ | AI 変換の精度に依存 |
| `[[wikilink]]` | ✅ | alias → wikilink に復元 |
| frontmatter tags/aliases | ✅ | attributes 経由で往復 |
| Obsidian スタイル・プラグイン設定 | ❌ | M3E は `.obsidian/` を保持しない |
| 画像ファイル等のバイナリ | ❌ | 参照パスのみ保持。実体はコピーしない |

### AI 変換品質に関する注意

Import (linear-to-tree) と Export (tree-to-linear) は**可逆ではない**。
AI が Markdown → tree に変換する際に構造解釈が入るため、
Export で完全に元の Markdown を再現することは保証しない。

情報の**意味的な保持**は目指すが、**書式の完全再現**は非目標。

---

## Export の実装対象ファイル

| ファイル | 内容 |
|---------|------|
| `beta/src/node/vault_exporter.ts` | **新規** — Phase A-E の全ロジック |
| `beta/src/node/start_viewer.ts` | SSE endpoint `/api/vault/export` の追加 |
| `beta/src/shared/types.ts` | VaultExportRequest / VaultExportProgress 型追加 |
| `beta/src/browser/viewer.ts` | Export UI（パス指定 + プログレスバー） |
| `beta/viewer.html` | Export モーダル HTML |
| `beta/prompts/vault-export/instruction.txt` | tree-to-linear 用の Markdown 変換指示 |

---
---

# Part 3: Vault Mount（強結合モード）

## 思想

Part 1/2 の Import/Export は「コピーを渡す」モデル。
Vault Mount は **Vault そのものを M3E の document として直接マウントする**。

- .md ファイルがノードの正本
- M3E 上の編集は即座に .md に書き戻される
- Vault 側のファイル変更は M3E に反映される
- SQLite は**キャッシュ**であり正本ではない。正本は常に .md ファイル

```
Import/Export:  Vault ──copy──→ M3E ──copy──→ Vault
Vault Mount:    Vault ←──live──→ M3E（同一データの2つのビュー）
```

---

## データモデル

### Vault = Document

```typescript
interface VaultMountConfig {
  documentId: string;              // "vault:my-research"
  vaultPath: string;               // Vault ルートの絶対パス
  mode: "mount";                   // Import/Export と区別
  aiStructureCache: boolean;       // AI 変換結果をキャッシュするか
  watchEnabled: boolean;           // ファイル変更監視
}
```

### .md ファイル = folder ノード（正本）

| Vault 上の実体 | M3E ノード | 正本の所在 |
|---------------|-----------|-----------|
| サブフォルダ | `nodeType: "folder"` | ファイルシステム |
| .md ファイル | `nodeType: "folder"`（子を持つ） | **.md ファイルが正本** |
| .md 内の見出し・箇条書き | text ノード（AI 構造化） | SQLite キャッシュ（AI 変換結果） |
| `[[wikilink]]` | alias ノード | .md 内のリンク記述が正本 |

### 正本の分離

```
正本が .md ファイル:
  - ファイルの存在/不在
  - ファイル名（= ノード text）
  - Markdown 本文（= linear text）
  - frontmatter
  - [[wikilink]]

正本が SQLite キャッシュ:
  - AI が生成した subtree 構造（.md の構造化ビュー）
  - ノード間の親子関係の詳細
  - collapsed 状態等の UI state
```

つまり .md の**内容が変わったら AI 構造化をやり直す**。
キャッシュは捨てても .md から再構築できる。

---

## 読み込みフロー

### 初回マウント

```
1. vaultPath を指定
2. Phase A: Discovery（Part 1 と同じ — フォルダ/ファイル列挙）
3. Phase B: Parse（各 .md の frontmatter + wikilink + body 分離）
4. Phase C: AI Transform（各ファイルの body → tree 構造）
5. Phase D: Link Resolution（wikilink → alias）
6. キャッシュを SQLite に保存（documentId = "vault:xxx"）
7. VaultMountConfig を永続化
```

ここまでは Part 1 Import と**完全に同じ処理**。
違いは、この後 Vault との接続が切れないこと。

### 再起動時

```
1. VaultMountConfig を読み込み
2. SQLite からキャッシュを読み込み
3. Vault 上の .md と突合:
   a. 変更なし → キャッシュをそのまま使う
   b. .md が更新されている → そのファイルだけ再パース + AI 再変換
   c. 新しい .md が追加 → 新規ノードとして追加
   d. .md が削除 → ノードを削除、参照 alias を broken に
4. 差分だけ処理してマップを表示
```

### 差分検出

```typescript
interface VaultFileState {
  relativePath: string;
  mtimeMs: number;           // ファイルの更新日時
  sizeBytes: number;
  contentHash?: string;      // オプション: SHA-256
}
```

再起動時に全 .md の `mtime` を走査し、キャッシュ時点と比較。
変更があったファイルだけ再処理する。ファイル数が多くても差分は小さい。

---

## 書き戻しフロー

### M3E での編集 → .md への反映

| M3E 上の操作 | .md への反映 |
|-------------|-------------|
| ノード text の編集 | 対応する見出し/箇条書きを更新 |
| ノード追加（子ノード） | .md 内に行追加 |
| ノード削除 | .md 内の対応行を削除 |
| ノード reparent（同一ファイル内） | .md 内の行移動 |
| ノード reparent（ファイル間） | 元 .md から行削除 + 先 .md に行追加 |
| ファイルノードの rename | .md ファイル名を変更 |
| フォルダノードの rename | フォルダ名を変更 |
| ファイルノードの削除 | .md ファイルを削除（確認必須） |
| alias の追加 | .md 内に `[[wikilink]]` を追記 |
| alias の削除 | .md 内の `[[wikilink]]` を除去 |

### 書き戻しの実装方式

**Option A: AI 逆変換** — subtree を tree-to-linear で Markdown に変換して .md 全体を上書き
- 確実だがファイル全体の書き換えになる
- AI の変換品質に書き戻しが依存する

**Option B: 行レベル差分** — 元の .md のどの行がどのノードに対応するかを記録し、差分だけ書き換え
- 精密だが、行とノードの対応づけ（ソースマップ）が必要
- AI 構造化時にソースマップを生成する必要がある

**推奨: Phase 1 は Option A、Phase 2 で Option B を検討**

初期実装では AI 逆変換による全体上書きで始め、
ユーザーが使いながら「ここは差分で済ませたい」という要望が出たら
ソースマップ方式に進化させる。

### 書き戻しタイミング

```typescript
interface WriteBackPolicy {
  trigger: "on-save" | "on-edit" | "debounce";
  debounceMs?: number;          // debounce の場合: 既定 2000ms
  confirmDestructive: boolean;  // ファイル削除時に確認
}
```

| ポリシー | 動作 | 適用場面 |
|---------|------|---------|
| `on-save` | 明示的な保存操作時のみ書き戻す | 安全重視。初期既定 |
| `on-edit` | 各編集操作の直後に即書き戻す | リアルタイム同期 |
| `debounce` | 編集後 N ms 無操作で書き戻す | M3E の autosave と同じ感覚 |

初期既定は `on-save`。ユーザーが信頼したら `debounce` に切り替え可能。

---

## ファイル監視（Vault → M3E）

### `fs.watch` による変更検出

```typescript
// vaultPath 以下を再帰監視
fs.watch(vaultPath, { recursive: true }, (event, filename) => {
  if (!filename?.endsWith(".md")) return;
  // debounce 後に再パース + AI 再変換（そのファイルだけ）
  // Browser に SSE で通知
});
```

### 競合解決

M3E で編集中のファイルが Vault 側でも変更された場合:

| 状態 | 動作 |
|------|------|
| M3E 側に未保存の変更なし | Vault の変更を取り込み、M3E を更新 |
| M3E 側に未保存の変更あり | **競合通知**を表示。ユーザーが選択: M3E 優先 / Vault 優先 / マージ |
| 両方同時に変更 | 競合通知。タイムスタンプが新しい方を既定提案 |

競合は稀であり、初期実装では「Vault 優先 + M3E の変更を undo stack に退避」で十分。

---

## キャッシュ管理

### SQLite キャッシュの役割

```
.md ファイル (正本)
    ↓ AI 構造化
SQLite キャッシュ (構造化ビュー)
    ↓ 読み込み
M3E viewer (表示・操作)
    ↓ 書き戻し
.md ファイル (正本)
```

キャッシュは .md のどの版を構造化したかを `mtimeMs` + `contentHash` で記録する。
キャッシュを全削除しても .md から再構築できる（AI コストはかかるが、データは失われない）。

### キャッシュ無効化

- `.md` の `mtime` がキャッシュ時点と異なる → 再構造化
- ユーザーが明示的に「再構造化」を要求 → 指定ファイル or 全体
- AI モデルを変更した → 全体再構造化（任意、品質が変わるため）

---

## Import/Export との関係

| | Import/Export | Vault Mount |
|---|---|---|
| 正本 | SQLite（M3E 内） | .md ファイル |
| Vault との関係 | コピーを受け渡し | ライブ接続 |
| 編集の反映先 | M3E 内のみ | .md に書き戻し |
| Vault 変更の検出 | なし（re-import が必要） | fs.watch で自動 |
| AI コスト | 初回 import 時のみ | 初回 + ファイル変更時 |
| オフライン耐性 | 完全（コピー済み） | .md 読み書きはオフライン可、AI 再構造化はオンライン必要 |

**Import は Vault Mount の初回処理と同じ**。
Import のコードはそのまま Mount の初期化に再利用できる。

---

## API エンドポイント

### POST /api/vault/mount

Vault をマウントする。初回は Import と同じ処理。

```json
{
  "vaultPath": "C:/Users/user/ObsidianVault",
  "documentId": "vault:my-research",
  "modelAlias": "chat.fast",
  "options": {
    "watchEnabled": true,
    "writeBackPolicy": "on-save",
    "aiStructureCache": true
  }
}
```

レスポンスは SSE（Import と同じ進捗ストリーム）。

### POST /api/vault/unmount

Vault を切り離す。キャッシュは残す（次回 mount 時に差分処理で高速復帰）。

### POST /api/vault/sync

手動で Vault ↔ M3E を同期する。

```json
{
  "documentId": "vault:my-research",
  "direction": "vault-to-m3e" | "m3e-to-vault" | "bidirectional"
}
```

### POST /api/vault/restructure

指定ファイルの AI 構造化をやり直す。

```json
{
  "documentId": "vault:my-research",
  "filePaths": ["research/hypothesis-A.md"],
  "modelAlias": "chat.fast"
}
```

---

## 実装段階

### Stage 1: Read-only Mount（Import + watch）

- Vault を mount して M3E で閲覧
- .md の変更を検出して自動反映
- M3E 上の編集は SQLite キャッシュにのみ保存（書き戻さない）
- 実質的には「ライブ Import」

### Stage 2: Write-back（on-save）

- M3E 上の編集を保存時に .md へ書き戻す
- AI 逆変換（tree-to-linear）で .md 全体を上書き
- ファイル/フォルダの追加・削除・リネームに対応

### Stage 3: Live Sync（debounce + conflict resolution）

- 編集の自動書き戻し
- 競合検出と解決 UI
- ソースマップ方式による行レベル差分書き戻し（Option B）

---

## 実装対象ファイル

| ファイル | 内容 |
|---------|------|
| `beta/src/node/vault_mount.ts` | **新規** — マウント管理、watch、同期ロジック |
| `beta/src/node/vault_importer.ts` | Import Phase A-E（Mount の初期化でも再利用） |
| `beta/src/node/vault_exporter.ts` | Export / Write-back ロジック |
| `beta/src/node/vault_diff.ts` | **新規** — 差分検出（mtime/hash 比較） |
| `beta/src/node/indented_text_parser.ts` | indented text ↔ TreeNode[] |
| `beta/src/node/start_viewer.ts` | mount/unmount/sync/restructure endpoint 追加 |
| `beta/src/shared/types.ts` | VaultMountConfig, WriteBackPolicy 等 |
| `beta/src/browser/viewer.ts` | Mount UI、競合通知、同期状態表示 |

---
---

# Part 4: 共通事項

## 全モード共通の実装対象ファイル

| ファイル | 内容 |
|---------|------|
| `beta/src/node/vault_importer.ts` | **新規** — Import Phase A-E（Mount 初期化でも利用） |
| `beta/src/node/vault_exporter.ts` | **新規** — Export Phase A-E（Write-back でも利用） |
| `beta/src/node/vault_mount.ts` | **新規** — Mount 管理、watch、sync |
| `beta/src/node/vault_diff.ts` | **新規** — 差分検出 |
| `beta/src/node/indented_text_parser.ts` | **新規** — indented text ↔ TreeNode[] の双方向変換 |
| `beta/src/node/start_viewer.ts` | SSE endpoint 追加 |
| `beta/src/shared/types.ts` | Vault 連携用の型定義追加 |
| `beta/src/browser/viewer.ts` | Import/Export/Mount UI |
| `beta/viewer.html` | モーダル HTML |
| `beta/prompts/vault-import/instruction.txt` | Import 用 AI 指示 |
| `beta/prompts/vault-export/instruction.txt` | Export 用 AI 指示 |

## 将来拡張

- **Canvas (.canvas) 対応**: Obsidian Canvas の JSON を import/export
- **AI による cross-file 構造提案**: mount 後に全体構造の改善を提案
- **プラグイン連携**: Obsidian コミュニティプラグインとの連携（Dataview 等）
- **複数 Vault 同時マウント**: 複数 Vault を別 scope としてマウント

---

## 関連文書

- 既存 linear-transform: `./Linear_Tree_Conversion.md`
- AI 共通 API: `./AI_Common_API.md`
- Data Model: `./Data_Model.md`
- Import/Export 仕様: `./Import_Export.md`
- Scope and Alias: `./Scope_and_Alias.md`
