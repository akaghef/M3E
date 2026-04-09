# ローカルファイル連携設計

最終更新: 2026-04-09

## 1. 概要

M3E とローカルファイルシステム（Obsidian vault、Markdown フォルダ、プレーンテキスト等）の
双方向連携を実現するための設計。

現状の M3E は SQLite が正本であり、外部ファイルとのやり取りは
ワンショット Import/Export に限られる。本設計では、ファイル監視による
リアルタイム同期と定期同期を加え、M3E を「ローカルファイルの構造化ビュー」として
使えるようにする。

### 関連仕様

- `dev-docs/03_Spec/Obsidian_Vault_Integration.md` --- Import/Export/Vault Mount の仕様（spec-done）
- `dev-docs/03_Spec/Import_Export.md` --- 内部フォーマットと外部変換の全体方針
- `dev-docs/03_Spec/REST_API.md` --- 現行 REST API

### 前提

- Vault Mount 仕様（Part 3）で定義された `.md = 正本` モデルを基盤とする
- 本設計はそれを**汎化**し、Obsidian 以外のファイルソースにも適用できるフレームワークにする
- コード変更は本設計では行わない。実装は別タスクで進める

---

## 2. 同期モデルの比較

### 2.a ワンショット Import/Export（現在の仕様）

```
Vault ──copy──> M3E ──copy──> Vault
```

| 項目 | 評価 |
|------|------|
| 実装コスト | 低。既に仕様確定済み |
| データ安全性 | 高。正本が明確（Import 後は SQLite、Export 後は .md） |
| 鮮度 | 低。再 import しないと変更を取り込めない |
| 競合リスク | なし（接続が切れているため） |
| 適用場面 | 初回取り込み、最終書き出し、他ツールへの移行 |

### 2.b 定期同期（polling ベース）

```
Vault <──poll(interval)──> M3E
```

| 項目 | 評価 |
|------|------|
| 実装コスト | 中。mtime 比較 + 差分処理 |
| データ安全性 | 中。polling 間隔内の変更は検出できない |
| 鮮度 | 中。interval に依存（例: 30 秒〜5 分） |
| 競合リスク | 低〜中。interval が短いほど競合検出が早い |
| 適用場面 | バックグラウンド同期、CI/CD 的な定期取り込み |
| 依存ライブラリ | なし（`fs.stat` のみ） |

**実装方針:**
- `setInterval` で vault 内の全 `.md` の `mtime` を走査
- 前回チェック時点と比較し、変更があったファイルのみ再処理
- interval は設定可能（既定 60 秒）
- CPU 負荷を抑えるため、ファイル数 > 1000 の vault では interval 下限を 120 秒に

### 2.c リアルタイム同期（file watcher ベース）

```
Vault <──fs.watch / chokidar──> M3E
```

| 項目 | 評価 |
|------|------|
| 実装コスト | 高。watcher 管理、debounce、OS 差異への対処 |
| データ安全性 | 中。競合が起きうる |
| 鮮度 | 高。ファイル変更後数百 ms で検出 |
| 競合リスク | 中〜高。M3E と外部エディタの同時編集 |
| 適用場面 | Obsidian と M3E を並行利用するワークフロー |
| 依存ライブラリ | `chokidar`（推奨）or Node.js 組み込み `fs.watch` |

### 2.d 推奨: 段階的導入

```
Stage 1: ワンショット Import/Export        ← 仕様確定済み
Stage 2: Read-only Mount + polling         ← 本設計のスコープ
Stage 3: Read-only Mount + file watcher    ← 本設計のスコープ
Stage 4: Write-back Mount (on-save)        ← Vault Mount Stage 2
Stage 5: Live Sync (debounce + conflict)   ← Vault Mount Stage 3
```

---

## 3. ファイル監視（File Watcher）

### 3.a 技術選定

| 候補 | メリット | デメリット |
|------|---------|-----------|
| `fs.watch` (Node.js built-in) | 依存なし | OS ごとの挙動差異が大きい。Windows では recursive 対応だが Linux では非対応 |
| `chokidar` | クロスプラットフォーム安定、debounce 内蔵、glob 対応 | 追加依存。v3 → v4 で API 変更あり |
| `fs.watchFile` (polling) | 安定 | 高負荷。ファイル数が多いと非実用的 |

**推奨: `chokidar` v4**

理由:
- M3E の主要ターゲットは Windows だが、将来的に Linux/macOS も想定
- `fs.watch` の Windows 固有バグ（ファイル名の大文字小文字、短いファイル名）を回避
- vault 内の `.md` のみを対象とする glob フィルタが簡潔に書ける

### 3.b Watcher アーキテクチャ

```typescript
interface FileWatcherConfig {
  watchPath: string;            // 監視対象のルートパス
  include: string[];            // glob パターン（例: ["**/*.md"]）
  exclude: string[];            // 除外パターン（例: [".obsidian/**", ".trash/**"]）
  debounceMs: number;           // 変更検出後の待機時間（既定: 500ms）
  batchIntervalMs: number;      // バッチ処理の間隔（既定: 1000ms）
}
```

**処理フロー:**

```
chokidar event (add/change/unlink)
    ↓
debounce (500ms)
    ↓
batch collect (1000ms window)
    ↓
FileChangeEvent[] を生成
    ↓
SyncEngine に渡す
```

### 3.c FileChangeEvent

```typescript
interface FileChangeEvent {
  type: "add" | "change" | "unlink" | "addDir" | "unlinkDir";
  relativePath: string;       // vault root からの相対パス
  absolutePath: string;
  mtimeMs: number | null;     // unlink の場合 null
  sizeBytes: number | null;
}
```

### 3.d Watcher のライフサイクル

```
POST /api/vault/watch/start  →  Watcher 起動
                                   ↓
                              ファイル変更を検出
                                   ↓
                              SyncEngine が差分処理
                                   ↓
                              SSE で browser に通知
                                   ↓
POST /api/vault/watch/stop   →  Watcher 停止
```

- server 起動時に VaultMountConfig が存在し `watchEnabled: true` なら自動起動
- server 停止時に graceful shutdown（watcher.close()）
- watcher は documentId ごとに 1 インスタンス（同じ vault を二重監視しない）

---

## 4. 同期エンジン（SyncEngine）

### 4.a 責務

SyncEngine は File Watcher と M3E データモデルの間に立ち、
以下を処理する:

1. **Vault → M3E** (inbound): ファイル変更を TreeNode の差分操作に変換
2. **M3E → Vault** (outbound): TreeNode の変更を .md ファイルへの書き戻しに変換
3. **競合検出**: 同一ファイルに対する同時変更を検出し、解決戦略を適用

### 4.b 状態管理

```typescript
interface SyncState {
  documentId: string;
  vaultPath: string;
  mode: "import" | "export" | "mount";
  watcherStatus: "stopped" | "starting" | "running" | "error";
  lastSyncAt: string | null;          // ISO 8601
  fileStates: Record<string, VaultFileState>;  // relativePath → state
  pendingInbound: FileChangeEvent[];   // 未処理の inbound 変更
  pendingOutbound: OutboundChange[];   // 未処理の outbound 変更
  conflicts: SyncConflict[];           // 未解決の競合
}

interface VaultFileState {
  relativePath: string;
  mtimeMs: number;
  sizeBytes: number;
  contentHash: string;        // SHA-256 (hex)
  nodeId: string;             // 対応する M3E ノード ID
  lastSyncedAt: string;       // 最後に同期した時刻
  dirty: boolean;             // M3E 側で未保存の変更があるか
}
```

### 4.c Inbound フロー（Vault → M3E）

```
FileChangeEvent
    ↓
1. ファイル種別を判定 (.md, .txt, .csv, .json, etc.)
    ↓
2. FileAdapter でパース（後述 Section 7）
    ↓
3. 差分計算:
   - 新規ファイル → addNode + 子ノード群
   - 変更ファイル → editNode / reparentNode
   - 削除ファイル → deleteNode + alias を broken に
    ↓
4. RapidMvpModel に適用
    ↓
5. SQLite に保存
    ↓
6. SSE で browser に通知
    ↓
7. SyncState.fileStates を更新
```

### 4.d Outbound フロー（M3E → Vault）

```
M3E での編集操作（editNode, addNode, deleteNode, etc.）
    ↓
1. 変更されたノードの所属ファイルを特定
    ↓
2. WriteBackPolicy に従い書き戻しを判定
   - on-save: 保存操作時のみ
   - debounce: 編集後 N ms 待機
   - on-edit: 即座
    ↓
3. FileAdapter で .md に変換（tree-to-linear）
    ↓
4. ファイルに書き出し
    ↓
5. SyncState.fileStates を更新（mtime 更新）
    ↓
6. Watcher の自己変更フィルタリング（自分の書き込みを無視）
```

**自己変更フィルタリング**は重要な実装ポイント:
M3E が書き出した .md の変更を watcher が検出してしまうと、
無限ループに陥る。対策:

```typescript
// 書き出し直後の mtime を記録し、watcher イベントで比較
const recentWrites = new Map<string, number>();  // relativePath → mtimeMs

function isOwnWrite(event: FileChangeEvent): boolean {
  const recorded = recentWrites.get(event.relativePath);
  if (recorded && event.mtimeMs && Math.abs(event.mtimeMs - recorded) < 1000) {
    recentWrites.delete(event.relativePath);
    return true;
  }
  return false;
}
```

---

## 5. 競合検出と解決

### 5.a 競合の定義

同一ファイルに対して、前回同期以降に M3E 側と Vault 側の**両方**で変更があった場合を競合とする。

```typescript
interface SyncConflict {
  id: string;
  relativePath: string;
  nodeId: string;
  detectedAt: string;
  m3eVersion: {
    content: string;            // M3E 側の tree-to-linear 結果
    modifiedAt: string;
  };
  vaultVersion: {
    content: string;            // .md ファイルの内容
    modifiedAt: string;
  };
  resolution: "pending" | "m3e-wins" | "vault-wins" | "manual-merge";
}
```

### 5.b 検出タイミング

| トリガー | 検出方法 |
|---------|---------|
| Watcher が変更検出 | `SyncState.fileStates[path].dirty === true` なら競合 |
| Outbound 書き出し前 | .md の mtime が `lastSyncedAt` より新しければ競合 |
| 手動同期実行時 | 全ファイルの mtime + contentHash を比較 |

### 5.c 解決戦略

| 戦略 | 動作 | 設定値 |
|------|------|--------|
| Vault 優先（既定） | Vault の内容で M3E を上書き。M3E の変更は undo stack に退避 | `"vault-wins"` |
| M3E 優先 | M3E の内容で .md を上書き | `"m3e-wins"` |
| 手動選択 | Browser に競合通知を表示。ユーザーがどちらを採用するか選択 | `"ask"` |
| タイムスタンプ優先 | 新しい方を採用 | `"newer-wins"` |

**初期実装では `"vault-wins"` を既定とし、`"ask"` をオプションで提供する。**

理由:
- Obsidian で直接編集するケースが最も多い
- M3E 側の変更は undo stack に退避するため、データは失われない
- `"ask"` は UI が必要だが、初期は SSE 通知 + status API で対応可能

### 5.d Browser への競合通知

```json
// SSE event
{
  "event": "vault-sync-conflict",
  "data": {
    "conflictId": "c_123",
    "relativePath": "research/hypothesis-A.md",
    "m3eModifiedAt": "2026-04-09T10:00:00Z",
    "vaultModifiedAt": "2026-04-09T10:01:30Z",
    "defaultResolution": "vault-wins"
  }
}
```

---

## 6. マッピングルール

### 6.a Obsidian Vault <-> M3E（Vault Mount 仕様を継承）

| Obsidian | M3E | 正本 | 備考 |
|----------|-----|------|------|
| Vault ルートフォルダ | root ノード | FS | |
| サブフォルダ | `nodeType: "folder"` | FS | |
| .md ファイル | `nodeType: "folder"` (children 付き) | **.md が正本** | folder にすることで scope-in 可能 |
| `# Heading` | text ノード (AI 変換) | SQLite cache | .md 変更時に再構造化 |
| 段落/箇条書き | text ノード (AI 変換) | SQLite cache | |
| frontmatter tags | `attributes.tags` | .md frontmatter | |
| frontmatter aliases | `attributes.aliases` | .md frontmatter | |
| `[[wikilink]]` | `nodeType: "alias"` (collapsed) | .md 内のリンク記述 | |
| `![[embed]]` | `nodeType: "alias"` (expanded) | .md 内のリンク記述 | |
| `![[image.png]]` | `attributes.image` | 参照パスのみ | |
| YAML frontmatter (other) | `attributes` | .md frontmatter | |

### 6.b 変更の粒度

| 粒度 | 説明 | 採用場面 |
|------|------|---------|
| ファイル単位 | .md ファイル 1 つを 1 つの同期単位とする | **初期実装で採用** |
| セクション単位 | Heading ごとに分割して差分検出 | 将来拡張（ソースマップ方式） |
| ノード単位 | 各 TreeNode を個別に同期 | 高精度だが AI 変換との整合が困難 |

**ファイル単位を採用する理由:**
- .md ファイルが正本であり、ファイル全体の mtime で変更検出できる
- AI 構造化はファイル単位で実行される
- セクション単位/ノード単位は、AI 変換時のソースマップが必要で複雑

### 6.c M3E 固有メタデータの退避

Export 時に .md の frontmatter に退避し、re-import 時に復元する:

```yaml
---
m3e:nodeId: "n_1234_abc"
m3e:source: "research/hypothesis-A.md"
m3e:nodeType: "folder"
m3e:lastSyncedAt: "2026-04-09T10:00:00Z"
m3e:contentHash: "a1b2c3..."
---
```

---

## 7. FileAdapter（ファイル種別ごとの変換）

### 7.a アダプタインターフェース

```typescript
interface FileAdapter {
  /** このアダプタが処理できるファイル拡張子 */
  extensions: string[];

  /** ファイル内容を TreeNode の subtree に変換 */
  parse(content: string, options: ParseOptions): ParseResult;

  /** TreeNode の subtree をファイル内容に変換 */
  serialize(nodes: TreeNode[], options: SerializeOptions): string;

  /** 差分検出（オプション。未実装なら全体再パースにフォールバック） */
  diff?(oldContent: string, newContent: string): FileDiff[];
}

interface ParseOptions {
  parentNodeId: string;
  generateId: () => string;
  aiEnabled: boolean;
  modelAlias?: string;
}

interface ParseResult {
  nodes: TreeNode[];
  wikilinks: WikilinkRef[];
  metadata: Record<string, string>;   // frontmatter 等
}
```

### 7.b Obsidian Markdown アダプタ

Vault Integration 仕様の Phase B (Parse) をそのまま実装する。

- frontmatter (YAML) → `attributes`
- `[[wikilink]]` → WikilinkRef として抽出
- Markdown 本文 → AI linear-to-tree で構造化（fallback: flat テキスト）
- 画像リンク `![[image.png]]` → `attributes.image`

### 7.c プレーンテキスト (.txt) アダプタ

```
入力: .txt ファイルの内容
変換: ファイル全体を 1 つの text ノードの `details` に格納
      ファイル名をノード text にする
```

- AI 有効時: テキストを linear-to-tree で構造化（Markdown アダプタと同じ）
- AI 無効時: 1 ノード（text = ファイル名, details = ファイル全体）

### 7.d Markdown (.md, 非 Obsidian) アダプタ

Obsidian アダプタのサブセット:
- frontmatter 処理は同じ
- `[[wikilink]]` は処理しない（`[text](url)` は `link` フィールドに変換）
- それ以外は同じ

### 7.e CSV アダプタ

```
入力: CSV ファイル
変換:
  - ヘッダ行 → 属性名
  - 各データ行 → 1 つの text ノード
  - ファイル → folder ノード（text = ファイル名）
```

```typescript
// 例: people.csv
// name, role, team
// Alice, Engineer, Backend
// Bob, Designer, Frontend

// 変換結果:
// people (folder)
// ├── Alice (text, attributes: { role: "Engineer", team: "Backend" })
// └── Bob (text, attributes: { role: "Designer", team: "Frontend" })
```

### 7.f JSON アダプタ

```
入力: JSON ファイル
変換:
  - オブジェクトの各キー → text ノード (text = key, details = value)
  - 配列の各要素 → text ノード (text = index or value)
  - ネスト → 親子関係
  - ファイル → folder ノード（text = ファイル名）
```

JSON は再帰構造を自然にツリーに変換できるため、AI 不要。

---

## 8. API 設計

### 8.a 新規エンドポイント

既存の Vault Mount API（`Obsidian_Vault_Integration.md` Part 3）を拡張し、
汎用ファイル連携エンドポイントとする。

#### `POST /api/vault/watch`

ファイル監視の開始。

```json
// Request
{
  "documentId": "vault:my-research",
  "vaultPath": "C:/Users/user/ObsidianVault",
  "options": {
    "include": ["**/*.md"],
    "exclude": [".obsidian/**", ".trash/**", "node_modules/**"],
    "debounceMs": 500,
    "conflictStrategy": "vault-wins"
  }
}

// Response
{
  "ok": true,
  "watcherId": "w_abc123",
  "documentId": "vault:my-research",
  "watchPath": "C:/Users/user/ObsidianVault",
  "fileCount": 45,
  "status": "running"
}
```

#### `DELETE /api/vault/watch`

ファイル監視の停止。

```json
// Request
{
  "documentId": "vault:my-research"
}

// Response
{
  "ok": true,
  "documentId": "vault:my-research",
  "status": "stopped"
}
```

#### `POST /api/vault/sync`

手動同期のトリガー。

```json
// Request
{
  "documentId": "vault:my-research",
  "direction": "bidirectional",
  "force": false
}

// Response (SSE stream)
event: vault-sync-progress
data: {"phase":"scan","filesChanged":3,"filesAdded":1,"filesDeleted":0}

event: vault-sync-progress
data: {"phase":"process","current":1,"total":4,"file":"updated-note.md","action":"inbound"}

event: vault-sync-complete
data: {"ok":true,"inbound":3,"outbound":1,"conflicts":0,"duration":2340}
```

`direction` の値:
- `"vault-to-m3e"` --- Vault の変更のみ M3E に反映
- `"m3e-to-vault"` --- M3E の変更のみ Vault に書き戻し
- `"bidirectional"` --- 双方向

#### `GET /api/vault/status`

同期状態の確認。

```json
// Response
{
  "ok": true,
  "documentId": "vault:my-research",
  "vaultPath": "C:/Users/user/ObsidianVault",
  "mode": "mount",
  "watcherStatus": "running",
  "lastSyncAt": "2026-04-09T10:00:00Z",
  "fileCount": 45,
  "dirtyFiles": 2,
  "conflicts": 0,
  "pendingInbound": 1,
  "pendingOutbound": 0
}
```

#### `GET /api/vault/diff`

M3E と Vault の差分表示。

```json
// Response
{
  "ok": true,
  "documentId": "vault:my-research",
  "diff": [
    {
      "relativePath": "research/hypothesis-A.md",
      "status": "modified",
      "direction": "inbound",
      "vaultMtime": "2026-04-09T10:01:30Z",
      "m3eSyncedAt": "2026-04-09T10:00:00Z"
    },
    {
      "relativePath": "new-note.md",
      "status": "added",
      "direction": "inbound",
      "vaultMtime": "2026-04-09T10:02:00Z",
      "m3eSyncedAt": null
    },
    {
      "relativePath": "drafts/old-draft.md",
      "status": "modified",
      "direction": "outbound",
      "vaultMtime": "2026-04-09T09:00:00Z",
      "m3eSyncedAt": "2026-04-09T10:00:00Z"
    }
  ]
}
```

#### `POST /api/vault/conflict/resolve`

競合の手動解決。

```json
// Request
{
  "conflictId": "c_123",
  "resolution": "vault-wins"
}

// Response
{
  "ok": true,
  "conflictId": "c_123",
  "resolution": "vault-wins",
  "relativePath": "research/hypothesis-A.md"
}
```

### 8.b 汎用ファイルソース（Obsidian 以外）

Obsidian 以外のフォルダも同じ API 構造で扱えるようにする。
ファイルソース種別は `sourceType` で区別する。

```json
// POST /api/vault/mount (既存 API を拡張)
{
  "vaultPath": "C:/Users/user/notes",
  "documentId": "folder:my-notes",
  "sourceType": "markdown-folder",
  "options": {
    "include": ["**/*.md", "**/*.txt"],
    "watchEnabled": true
  }
}
```

| sourceType | 処理内容 |
|------------|---------|
| `"obsidian-vault"` | Obsidian 固有処理（wikilink、.obsidian/ 除外）。既定 |
| `"markdown-folder"` | 通常の Markdown フォルダ。wikilink は処理しない |
| `"text-folder"` | .txt ファイル群 |
| `"csv-folder"` | CSV ファイル群 |
| `"mixed"` | 拡張子に応じて適切な FileAdapter を自動選択 |

---

## 9. 実装計画

### Phase 1: SyncState + Diff（watcher なし）

手動トリガーでの差分検出と同期。

- `vault_sync.ts` (新規): SyncState 管理、diff 計算
- `start_viewer.ts`: `/api/vault/status`, `/api/vault/diff`, `/api/vault/sync` 追加
- `types.ts`: SyncState, VaultFileState 型追加

依存: Vault Mount 仕様の初回マウント（Phase A-E）が実装済みであること

### Phase 2: File Watcher + Inbound 同期

Vault 側の変更を自動検出して M3E に反映。

- `file_watcher.ts` (新規): chokidar ラッパー、FileChangeEvent 生成
- `vault_sync.ts`: inbound フロー実装
- `start_viewer.ts`: `/api/vault/watch` 追加
- `package.json`: `chokidar` 依存追加

### Phase 3: Outbound 同期（Write-back）

M3E の変更を .md に書き戻し。

- `vault_sync.ts`: outbound フロー、自己変更フィルタリング
- `vault_exporter.ts`: 個別ファイルの書き戻しメソッド追加

### Phase 4: 競合検出と解決

- `vault_sync.ts`: 競合検出ロジック
- `start_viewer.ts`: `/api/vault/conflict/resolve` 追加
- Browser 側: 競合通知 UI（SSE 受信 + 解決アクション）

### Phase 5: FileAdapter 拡充

- `file_adapter_txt.ts` (新規): プレーンテキストアダプタ
- `file_adapter_csv.ts` (新規): CSV アダプタ
- `file_adapter_json.ts` (新規): JSON アダプタ
- `vault_sync.ts`: sourceType に応じたアダプタ切り替え

---

## 10. 実装対象ファイル（全体）

| ファイル | Phase | 内容 |
|---------|-------|------|
| `beta/src/node/vault_sync.ts` | 1 | **新規** --- SyncEngine 本体 |
| `beta/src/node/file_watcher.ts` | 2 | **新規** --- chokidar ラッパー |
| `beta/src/node/file_adapter.ts` | 1 | **新規** --- FileAdapter インターフェース + Obsidian MD アダプタ |
| `beta/src/node/file_adapter_txt.ts` | 5 | **新規** --- プレーンテキストアダプタ |
| `beta/src/node/file_adapter_csv.ts` | 5 | **新規** --- CSV アダプタ |
| `beta/src/node/file_adapter_json.ts` | 5 | **新規** --- JSON アダプタ |
| `beta/src/node/vault_importer.ts` | -- | Import (Vault Integration 仕様で定義済み) |
| `beta/src/node/vault_exporter.ts` | 3 | Export + 個別ファイル write-back |
| `beta/src/node/vault_mount.ts` | -- | Mount 管理 (Vault Integration 仕様で定義済み) |
| `beta/src/node/vault_diff.ts` | 1 | **新規** --- mtime/hash ベースの差分検出 |
| `beta/src/node/start_viewer.ts` | 1-4 | API エンドポイント追加 |
| `beta/src/shared/types.ts` | 1 | SyncState, FileAdapter 型追加 |
| `dev-docs/03_Spec/REST_API.md` | 1 | vault 系エンドポイントの追記 |

---

## 11. セキュリティ考慮事項

- `vaultPath` は絶対パスのみ。相対パスや `..` 含むパスは拒否
- symlink は追跡しない（vault 外への脱出防止）
- watcher は指定パス配下のみ。パス外のイベントは無視
- ファイル内容は server 内で処理。browser に生ファイルは送出しない
- `.env`, `.git/`, `node_modules/` は既定で除外
- 書き戻し時のファイル削除は `confirmDestructive: true`（既定）で確認必須

---

## 12. 未決事項（設計判断が必要）

以下は manager への相談が必要な項目:

1. **chokidar の依存追加**: beta/package.json への追加は許容されるか。
   代替として `fs.watch` で Windows 限定対応とする案もある

2. **AI 構造化のキャッシュ戦略**: ファイル変更時に毎回 AI を呼ぶとコスト高。
   「構造が大きく変わっていない場合はキャッシュを再利用」のヒューリスティックが要るか

3. **Write-back の AI 依存**: tree-to-linear で .md を再生成すると元の Markdown と
   書式が変わる。これをユーザーが受け入れるか。Option B（ソースマップ）の優先度

4. **複数 vault の同時マウント**: 1 document = 1 vault の制約でよいか。
   複数 vault を別 scope としてマウントする需要があるか

5. **polling vs watcher の既定**: 初期実装で watcher をデフォルトにするか、
   polling をデフォルトにして watcher をオプトインにするか

---

## 13. 関連文書

- `dev-docs/03_Spec/Obsidian_Vault_Integration.md` --- Import/Export/Vault Mount 仕様
- `dev-docs/03_Spec/Import_Export.md` --- フォーマット一覧と変換方針
- `dev-docs/03_Spec/REST_API.md` --- 現行 API 仕様
- `dev-docs/03_Spec/Data_Model.md` --- TreeNode, AppState のデータモデル
- `dev-docs/03_Spec/Cloud_Sync.md` --- Cloud Sync（参考: 競合検出パターン）
