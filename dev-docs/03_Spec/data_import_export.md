# Data & Import/Export 設計ドキュメント

最終更新: 2026-04-09

---

## 1. 現状把握

### 1.1 データモデル (`beta/src/shared/types.ts`)

- **TreeNode**: `id`, `parentId`, `children[]`, `nodeType` (text/image/folder/alias), `text`, `collapsed`, `details`, `note`, `attributes`, `link`, alias 系フィールド (`targetNodeId`, `aliasLabel`, `access`, `isBroken`)
- **GraphLink**: ノード間の補助線。`sourceNodeId`, `targetNodeId`, `relationType`, `label`, `direction`, `style`
- **AppState**: `rootId`, `nodes`, `links`, `linearNotesByScope`, `linearTextFontScale`, `linearPanelWidth`
- **SavedDoc**: `{ version: 1, savedAt, state: AppState }`

### 1.2 永続化 (`rapid_mvp.ts`)

| 方式 | メソッド | 状態 |
|------|---------|------|
| JSON ファイル | `saveToFile()` / `loadFromFile()` | done |
| SQLite | `saveToSqlite()` / `loadFromSqlite()` | done |

SQLite スキーマ: `documents` テーブル (`id TEXT PK`, `version INT`, `saved_at TEXT`, `state_json TEXT`)。
state 全体を 1 行の JSON として保存する blob 方式。

### 1.3 FreeMind .mm import (`viewer.ts` browser 側)

- `parseMmText(xmlText)`: DOMParser で XML をパースし、再帰的に TreeNode に変換
- 対応フィールド: `TEXT`, `RICHCONTENT` (NODE/DETAILS/NOTE), `FOLDED`, `LINK`, `attributes`
- ファイル入力イベントで `.mm` 拡張子を判定し `parseMmText()` → `loadPayload()` で適用
- 全処理がブラウザ側で完結（server API 不要）

### 1.4 Linear Text 変換 (`viewer.ts` + `linear_agent.ts`)

**ブラウザ側 (local, AI 不要)**:
- `buildLinearFromScope()`: scope 内ツリーを `"  ".repeat(depth) + "- " + label` + `note:` 行の indented text に変換
- `parseLinearText(text)`: indented text (2-space) を `LinearNodeDraft` ツリーにパース。tab 禁止、奇数スペース禁止
- `reconcileLinearSubtree()`: パース結果を既存ツリーに差分適用（既存ノード再利用、余剰削除）
- `markdownToLinearText()`: Markdown 見出し(`#`) → インデント深さ、リスト項目 → インデント深さ に変換して linear text 形式にする

**サーバー側 (AI, `linear_agent.ts`)**:
- OpenAI-compatible API 経由で `tree-to-linear` / `linear-to-tree` 変換
- AI subagent (`/api/ai/subagent/linear-transform`) として統合済み
- system prompt + direction prompt + user prompt (scope 情報含む) で LLM を呼び出す

### 1.5 Markdown import (`viewer.ts` browser 側)

- `.md` / `.markdown` ファイルを `markdownToLinearText()` で linear text に変換
- 変換結果は `linearNotesByScope` に格納（linear panel に表示）
- ツリー構造への直接変換ではなく、linear text 経由の間接 import

### 1.6 REST API エンドポイント (`start_viewer.ts`)

| エンドポイント | 用途 |
|-------------|------|
| `GET/POST /api/docs/:id` | document CRUD |
| `GET/POST /api/sync/{status,push,pull}/:id` | cloud sync |
| `GET /api/linear-transform/status` | Linear transform 状態確認 |
| `POST /api/linear-transform/convert` | Linear transform 実行 |
| `GET /api/ai/status` | AI 状態確認 |
| `POST /api/ai/subagent/:name` | AI subagent 実行 |
| `/api/collab/*` | collaboration |

---

## 2. 未着手タスク設計

### 2.a Linear <-> Tree L1 round-trip test (status: ready)

#### 目的

`buildLinearFromScope()` (tree -> linear) と `parseLinearText()` + `reconcileLinearSubtree()` (linear -> tree) の round-trip で構造が保存されることを検証する。

#### 現状の変換仕様

**tree -> linear** (`buildLinearFromScope`):
```
- RootLabel
  note: 
              <- 空行
  - Child1
    note: 
              <- 空行
    - Grandchild
      note: 
              <- 空行
```

**linear -> tree** (`parseLinearText`):
- 2-space インデントで深さを判定
- `- ` プレフィックスは認識しない（label の一部として扱う）
- `note:` 行もラベルとして扱う（特別なパース無し）
- 空行はスキップ

#### round-trip の問題点

現在の `buildLinearFromScope()` は `"- "` プレフィックス + `"note: "` 行 + 空行を出力するが、`parseLinearText()` はこれらを独立ノードとして解釈する。つまり **round-trip は現状では壊れる**。

テスト設計時に以下を明確にする必要がある:

1. `buildLinearFromScope()` の出力形式を `parseLinearText()` が正しくパースできるよう調整するか
2. あるいは、round-trip は「pure indented text」（`- ` や `note:` 行なし）を前提とするか

#### テストケース定義

| # | ケース | 入力ツリー | 検証内容 |
|---|-------|-----------|---------|
| 1 | 単一ルート | `Root` (children: []) | round-trip 後も children が空 |
| 2 | 1階層 | `Root -> [A, B, C]` | 子の順序が保存される |
| 3 | 深いネスト | `Root -> A -> B -> C -> D` (depth 4) | 全階層が保存される |
| 4 | 幅広 | `Root -> [A1..A10]` | 10 兄弟が全て保存される |
| 5 | 混合 | 深さ・幅が混在したツリー | 構造完全一致 |
| 6 | 特殊文字 | `text` に `"`, `\n`, `<`, 日本語 | テキストが保存される |
| 7 | 空テキスト | `text: ""` のノード | `(empty)` にフォールバック |

#### 実装方針

- テストファイル: `beta/tests/unit/linear_roundtrip.test.js`
- `RapidMvpModel` でツリーを構築 → `buildLinearFromScope()` 相当のロジック → `parseLinearText()` → 構造比較
- browser 依存の `buildLinearFromScope()` は直接呼べないため、同等ロジックをテストヘルパーとして抽出するか、shared に移動する必要がある
- **設計判断が必要**: `buildLinearFromScope` / `parseLinearText` を `shared/` に切り出すかどうか

#### 依存関係

なし。単独で着手可能。

---

### 2.b Markdown export/import (status: planned)

#### 目的

M3E ツリーと Markdown の双方向変換。Obsidian vault 連携の基盤にもなる。

#### 現状

- **import**: `markdownToLinearText()` が browser 側にある。`# Heading` → インデント、リスト → インデントの簡易変換のみ。ツリーへの直接変換ではなく、linear text 経由
- **export**: 未実装

#### Markdown export 変換ルール

```
TreeNode (depth=0) -> # Heading 1
TreeNode (depth=1) -> ## Heading 2
TreeNode (depth=2) -> ### Heading 3
TreeNode (depth=3+) -> - bullet (with indentation)
```

| TreeNode フィールド | Markdown 出力 |
|--------------------|--------------|
| `text` | 見出し or 箇条書きのテキスト |
| `details` | text の直後に段落として出力 |
| `note` | `> ` blockquote として出力 |
| `attributes` | YAML frontmatter（root ノードのみ）or inline metadata |
| `link` | `[text](link)` 形式 |
| `nodeType: "alias"` | `[[target.text]]` (wikilink) |
| `nodeType: "folder"` | `# text` + 子ノードを再帰 |
| GraphLink | export しない（Markdown に自然な対応物がない） |

#### Markdown import 変換ルール

既存の `markdownToLinearText()` を拡張:

1. YAML frontmatter → root ノードの `attributes` に変換
2. `# Heading` → depth 0 ノード、`##` → depth 1、...
3. リスト項目 (`- `, `* `, `1. `) → 子ノード（インデントで深さ判定）
4. 段落テキスト → 直前の見出しノードの `details` に格納
5. `> blockquote` → 直前ノードの `note` に格納
6. `[[wikilink]]` → 検出して記録（alias 変換は Obsidian import 側の責務）

#### 実装方針

- `beta/src/shared/markdown_converter.ts` (新規): `treeToMarkdown()`, `markdownToTree()` を shared に配置
- browser/node 両方から使えるよう DOM 非依存で実装
- 既存の `markdownToLinearText()` は互換性のため残すが、新関数を推奨パスとする

#### 依存関係

- Linear round-trip test (2.a) で shared への切り出しパターンが確立されるとスムーズ
- Obsidian vault write (2.c) の基盤

---

### 2.c Obsidian vault write (status: idea)

#### 目的

M3E マップを Obsidian Vault（.md ファイル群 + フォルダ構造）として書き出す。Import (5-phase, spec-done) の逆変換。

#### 既存仕様の確認

`dev-docs/03_Spec/Obsidian_Vault_Integration.md` Part 2 に Export の詳細仕様が定義済み。以下は仕様書の要約と補足。

#### 変換ルール

| M3E | Vault |
|-----|-------|
| root ノード | Vault ルートフォルダ |
| `nodeType: "folder"` + 子に folder あり | サブフォルダ |
| `nodeType: "folder"` + 子が text/alias のみ | `.md` ファイル |
| text ノード (root 直下) | `.md` ファイル |
| alias (collapsed, valid) | `[[target-name]]` |
| alias (expanded, valid) | `![[target-name]]` |
| alias (broken) | `<!-- broken link: label -->` |
| `node.attributes` | YAML frontmatter |
| scope 境界 | `m3e:` 名前空間で frontmatter に退避 |

#### 5-phase 構成 (既存仕様)

1. **Structure Analysis**: ツリー走査 → folder/file 判別 → ExportPlan 生成
2. **AI Transform**: 各ファイルノードの subtree → `tree-to-linear` → Markdown 本文
3. **Alias -> Wikilink**: alias ノード → `[[wikilink]]` 変換、ファイル末尾に配置
4. **Frontmatter**: `node.attributes` → YAML frontmatter (`tags`, `aliases`, `m3e:*`)
5. **Write**: フォルダ作成 + `.md` ファイル書き出し

#### 補足設計メモ

- AI fallback: subtree をインデント付きテキストでそのまま出力（体裁は整わないがデータは失わない）
- 既存 Vault への上書き: `node.attributes["m3e:source"]` で元パスを保持していれば同一パスに上書き
- ファイル名サニタイズ: `node.text` から OS 禁止文字を除去、空白は `-` に置換

#### API エンドポイント

```
POST /api/vault/export
{
  "documentId": "...",
  "outputPath": "C:/Users/user/ExportedVault",
  "modelAlias": "chat.fast",
  "options": { "skipAiTransform": false }
}
```

レスポンスは SSE ストリームで進捗通知。

#### 実装対象ファイル

| ファイル | 内容 |
|---------|------|
| `beta/src/node/vault_exporter.ts` | 新規 — Phase A-E のロジック |
| `beta/src/node/start_viewer.ts` | `/api/vault/export` エンドポイント追加 |
| `beta/src/shared/types.ts` | `VaultExportRequest` / `VaultExportProgress` 型追加 |

#### 依存関係

- Markdown export (2.b): tree-to-markdown 変換ロジックを共有
- Obsidian vault import (spec-done): 逆変換の対称性を保つ必要あり
- `indented_text_parser.ts` (import 側で新規作成予定): buildSubtreeOutline の逆操作として必要

---

### 2.d Freeplane .mm export (status: idea)

#### 目的

M3E ツリーを Freeplane/FreeMind 互換の `.mm` XML として書き出す。既存の `.mm` import の逆変換。

#### 現在の import が対応するフィールド

| .mm 属性 | TreeNode フィールド | import 実装 |
|---------|-------------------|------------|
| `TEXT` | `text` | あり |
| `RICHCONTENT TYPE="NODE"` | `text` (fallback) | あり |
| `RICHCONTENT TYPE="DETAILS"` | `details` | あり |
| `RICHCONTENT TYPE="NOTE"` | `note` | あり |
| `FOLDED` | `collapsed` | あり |
| `LINK` | `link` | あり |
| `attributes > attribute` | `attributes[NAME] = VALUE` | あり |

#### export 変換ルール

```xml
<map version="freeplane 1.12.1">
  <node TEXT="Root Text" FOLDED="false">
    <richcontent TYPE="DETAILS"><html><body>details text</body></html></richcontent>
    <richcontent TYPE="NOTE"><html><body>note text</body></html></richcontent>
    <attribute_layout>
      <attribute NAME="key" VALUE="value"/>
    </attribute_layout>
    <node TEXT="Child 1" LINK="https://...">
      ...
    </node>
  </node>
</map>
```

| TreeNode フィールド | .mm XML |
|--------------------|---------|
| `text` | `TEXT` 属性 |
| `details` (非空) | `<richcontent TYPE="DETAILS">` |
| `note` (非空) | `<richcontent TYPE="NOTE">` |
| `collapsed` | `FOLDED="true"` |
| `link` (非空) | `LINK` 属性 |
| `attributes` | `<attribute NAME="..." VALUE="..."/>` |
| `children` | 子 `<node>` を再帰 |
| `nodeType: "alias"` | スキップ or `LINK` として target ノードの text を参照 |
| GraphLink | `.mm` に対応物なし。`<arrowlink>` として出力する案もあるが初期実装ではスキップ |

#### Freeplane 固有拡張

- `<richcontent>` の `<html><body>` ラップが必要
- Freeplane 1.12+ は `RICHCONTENT TYPE="DETAILS"` を標準サポート
- `<arrowlink DESTINATION="ID_xxx">` で GraphLink を表現可能（将来拡張）

#### 実装方針

- `beta/src/shared/mm_converter.ts` (新規): `treeToMm(state: AppState): string`
- browser 側で実行可能にする（export ダウンロードを browser で完結させるため）
- XML 組み立ては文字列テンプレート（DOMParser 不要）
- text のエスケープ: `<`, `>`, `&`, `"` を XML entity に変換

#### 依存関係

なし。単独で着手可能。import が browser 側なので export も browser 側で OK。

---

### 2.e SQLite snapshot backup (status: idea)

#### 目的

SQLite データの自動バックアップ。データ損失防止。

#### 現在の SQLite 永続化の仕組み

- `RapidMvpModel.saveToSqlite()`: `documents` テーブルに UPSERT (`ON CONFLICT DO UPDATE`)
- `better-sqlite3` ライブラリ使用（同期 API、WAL モード未指定）
- DB パス: `DATA_DIR/M3E_dataV1.sqlite` (環境変数で変更可)
- document 単位の保存。1 ドキュメント = 1 行

#### snapshot の保存方式

**案 A: ファイルコピー方式** (推奨)

1. `.backup()` API (`better-sqlite3` の `db.backup()`) で hot backup
2. バックアップ先: `DATA_DIR/backups/M3E_dataV1_YYYYMMDD_HHmmss.sqlite`
3. WAL がある場合は `.backup()` が自動的に checkpoint してからコピー

**案 B: WAL checkpoint + ファイルコピー**

1. `PRAGMA wal_checkpoint(TRUNCATE)` で WAL を DB に統合
2. `fs.copyFileSync()` でコピー
3. `.backup()` が使えない環境のフォールバック

**案 C: JSON export**

1. 全 documents を読み出して JSON ファイルに書き出す
2. SQLite 固有の問題を回避できるが、大量データで遅い

推奨は **案 A** (`better-sqlite3` の `.backup()` が信頼性・速度ともに最良)。

#### 自動バックアップのタイミング

| トリガー | 条件 |
|---------|------|
| サーバー起動時 | 常に 1 つ作成 |
| 定期 (interval) | 1 時間ごと (環境変数 `M3E_BACKUP_INTERVAL_MS` で変更可) |
| document 保存時 | N 回保存ごと (既定: 50 回) |

#### 世代管理

- 最大保持数: 10 世代 (環境変数 `M3E_BACKUP_MAX_GENERATIONS` で変更可)
- FIFO: 最大数を超えたら最古のファイルを削除
- ファイル名のタイムスタンプでソート

#### 実装方針

- `beta/src/node/backup.ts` (新規): `createBackup()`, `pruneOldBackups()`, `startAutoBackup()`
- `start_viewer.ts` のサーバー起動時に `startAutoBackup()` を呼ぶ
- REST API は不要（自動実行のみ。将来的に手動トリガー API を追加する余地は残す）

#### 依存関係

なし。単独で着手可能。

---

## 3. 優先順位と依存関係

```
優先度高                                     優先度低
  |                                            |
  v                                            v

[2.a] Linear round-trip test (ready)
  |
  +--> [2.b] Markdown export/import (planned)
         |
         +--> [2.c] Obsidian vault write (idea)
                |
                +--> Obsidian vault import (spec-done, 実装待ち)

[2.d] Freeplane .mm export (idea)     -- 独立、いつでも着手可
[2.e] SQLite snapshot backup (idea)   -- 独立、いつでも着手可
```

### 推奨実行順序

| 順序 | タスク | 理由 |
|------|-------|------|
| 1 | **Linear round-trip test** | 既存コードの品質保証。shared 切り出しの先行実験 |
| 2 | **SQLite snapshot backup** | データ保全。独立タスクなので並行可 |
| 3 | **Freeplane .mm export** | 独立タスク。import の逆変換で設計がシンプル |
| 4 | **Markdown export/import** | Obsidian write の基盤。round-trip test の知見を活用 |
| 5 | **Obsidian vault write** | 最も複雑。Markdown export + vault import 仕様の両方が前提 |

### 並行作業の可能性

- [2.a] + [2.e] は完全に独立。同時進行可
- [2.d] も独立だが、browser ファイルを触るため visual ロールとの調整が必要
- [2.c] は [2.b] が完了してから着手が望ましい

---

## 4. 設計判断が必要な項目

以下は manager と確認すべき判断ポイント:

1. **`buildLinearFromScope` / `parseLinearText` の shared 切り出し**: browser 側のロジックを `shared/` に移動するか。round-trip test と Markdown 変換の両方に影響
2. **Freeplane export の実行場所**: browser 側 (ダウンロード完結) vs server 側 (API エンドポイント)。import が browser 側なので export も browser 側が自然だが、data ロールのスコープ外 (`browser/`) になる
3. **GraphLink の .mm export**: `<arrowlink>` として出力するか、スキップするか
4. **SQLite backup の `.backup()` 利用可否**: `better-sqlite3` のバージョンが `.backup()` をサポートしているか要確認
