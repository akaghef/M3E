# ローカルファイルとの強い結合方式 -- 設計比較と推奨案

最終更新: 2026-04-10
ステータス: 設計提案（Akaghef による判断待ち → **Plan B 採用決定**）

---

## 1. 3つのアプローチ比較

### A. Mirror 方式（双方向リアルタイム同期）

既存設計 (`local_file_integration.md`) の Stage 2-5 の延長。

```
.md (Vault)  <-- SyncEngine -->  SQLite (M3E)
   正本1                            正本2
```

| 観点 | 評価 |
|------|------|
| アーキテクチャ | 2つの正本を持ち、SyncEngine で双方向同期。競合検出・解決が必要 |
| 実装コスト | **高**。SyncEngine, File Watcher, 競合解決 UI, 自己変更フィルタリング等の全スタックが必要 |
| データ安全性 | 中。2つの正本の乖離リスク。競合解決に失敗するとデータ損失の可能性 |
| Obsidian 体験 | 良い。両方で自由に編集でき、自動同期される |
| M3E 固有制約 | nodeType, collapsed, access 等の round-trip が困難。frontmatter 退避に限界あり |
| Cloud Sync 相性 | **複雑**。SQLite が正本の場合は既存 Cloud Sync がそのまま使える。しかし .md 側の変更がまず SQLite に入り、それから Cloud に行く二段階になる |
| Collab 相性 | 問題なし（SQLite 側で処理） |
| TCL 対応 | SQLite 側のモデル変更で対応可能 |
| リスク | 無限ループ（自己変更検出ミス）、mtime ベースの検出漏れ、OS 間挙動差異 |

### B. 単一正本方式（.md が唯一の正本）-- **採用**

```
.md (Vault)  <-- read/write -->  SQLite (キャッシュ/インデックス)
   唯一の正本                      派生データ
```

| 観点 | 評価 |
|------|------|
| アーキテクチャ | .md が唯一の正本。SQLite は構造キャッシュ・検索インデックスとしてのみ存在 |
| 実装コスト | **中**。SyncEngine が不要（同期ではなく読み書き）。競合解決も不要（正本が1つ） |
| データ安全性 | **高**。正本が1つなので乖離しない。SQLite が壊れても .md から再構築可能 |
| Obsidian 体験 | 最良。Obsidian で保存した瞬間に M3E に反映。M3E で編集した瞬間に .md に反映 |
| M3E 固有制約 | frontmatter に退避が必要だが「キャッシュだから完全 round-trip 不要」という割り切りが可能 |
| Cloud Sync 相性 | **要設計変更**（後述 Section 3） |
| Collab 相性 | **要設計変更**（後述 Section 4） |
| TCL 対応 | .md 内に TCL ブロックを埋め込む拡張が自然 |
| リスク | Cloud Sync/Collab の再設計コスト。大規模 vault でのパフォーマンス |

### C. Obsidian Plugin 方式

```
Obsidian  <-- Plugin API -->  M3E (embedded view)
  ホスト                        ゲスト
```

| 観点 | 評価 |
|------|------|
| アーキテクチャ | M3E を Obsidian プラグインとして組み込み。Obsidian API でファイルを読み書き |
| 実装コスト | **高**。Obsidian Plugin API の学習、M3E の browser コードを Obsidian View に移植 |
| データ安全性 | 高。Obsidian が管理するので安定 |
| Obsidian 体験 | 最良（Obsidian 内で完結） |
| M3E 固有制約 | Obsidian に**依存**してしまう。M3E を単体で使えなくなる |
| Cloud Sync 相性 | Obsidian Sync に依存するか、独自実装が必要 |
| Collab 相性 | Obsidian Live が必要。M3E 独自の Collab とは別系統 |
| TCL 対応 | Obsidian の CodeBlock API で表示は可能だが、実行環境の制約あり |
| リスク | **Obsidian ロックイン**。Obsidian 以外のエディタとは連携不能。Obsidian API の breaking change リスク |

### 比較サマリー

| 軸 | A. Mirror | B. 単一正本 | C. Plugin |
|----|-----------|-------------|-----------|
| 正本の数 | 2 | **1** | 1 (Obsidian) |
| 実装コスト | 高 | **中** | 高 |
| 競合リスク | 中~高 | **なし** | なし |
| Obsidian 非依存 | Yes | **Yes** | **No** |
| Cloud Sync 影響 | 小 | **中（要再設計）** | 大 |
| データ安全性 | 中 | **高** | 高 |

---

## 2. 推奨案: Plan B（単一正本方式）

**理由:**

1. **競合が構造的に発生しない**。M3E の最大の差別化要素は「思考の構造化」であり、その構造データの整合性を最優先すべき。2つの正本を持つ Mirror 方式は競合の温床になる

2. **SQLite 再構築可能性**。キャッシュが壊れても .md 群から完全に再構築できる。これはユーザーにとって「データは .md にある」という安心感を与える

3. **Obsidian 非依存**。Plugin 方式は Obsidian ロックインを生む。M3E は Obsidian 以外の Markdown エディタ（VS Code, Typora, Logseq）とも連携できるべき

4. **実装のシンプルさ**。SyncEngine, 競合検出, 解決 UI が不要。読み書きの直接操作だけで済む

**トレードオフ（受容する制約）:**

- Cloud Sync の同期対象を .md ベースに変更する必要がある
- Collab（リアルタイム共同編集）は .md ファイルへの concurrent write が課題
- .md frontmatter に M3E メタデータを退避する必要があるが、完全 round-trip は諦める（キャッシュだから）

---

## 3. Plan B 詳細設計

### 3.1 アーキテクチャ概要

```
┌─────────────────────────────────────────────────┐
│  .md ファイル群（Vault / 任意フォルダ）         │
│  = 唯一の正本                                    │
│                                                  │
│  research/                                       │
│  ├── hypothesis-A.md     (frontmatter + body)    │
│  ├── experiment-1.md                             │
│  └── notes/                                      │
│      └── daily-log.md                            │
└──────────┬──────────────────────┬────────────────┘
           │ read                 │ write
           ▼                     ▲
┌──────────────────────────────────────────────────┐
│  FileBinding Layer (新規)                        │
│                                                  │
│  BindingManager                                  │
│  ├── FileReader: .md → TreeNode[] 変換           │
│  ├── FileWriter: TreeNode[] → .md 書き出し       │
│  ├── FileWatcher: 外部変更の検出                 │
│  └── CacheInvalidator: SQLite キャッシュ更新     │
└──────────┬──────────────────────┬────────────────┘
           │ cache write         │ cache read
           ▼                     ▲
┌──────────────────────────────────────────────────┐
│  SQLite (キャッシュ/インデックス)                │
│                                                  │
│  - TreeNode のフラット化した構造                  │
│  - 検索用インデックス（全文検索等）               │
│  - ノード間の参照関係（alias 解決用）             │
│  - AI 構造化結果のキャッシュ                      │
│  - 表示状態（collapsed, viewport 等）             │
└──────────────────────────────────────────────────┘
```

### 3.2 .md ファイルフォーマット

各 .md ファイルは以下の構造を持つ:

```markdown
---
m3e:
  nodeId: "n_1234_abc"
  nodeType: "folder"
  collapsed: false
  children-order:
    - "n_child1"
    - "n_child2"
tags:
  - hypothesis
  - biology
aliases:
  - "仮説A"
---

# Hypothesis A

## Background

Some background text here...

## Key Points

- Point 1
- Point 2

## Related

- [[experiment-1]]
- [[daily-log]]
```

**設計判断:**

| データ | 格納先 | 理由 |
|--------|--------|------|
| ノードテキスト | Markdown 本文 | 人間可読性のため |
| nodeType | frontmatter `m3e:nodeType` | .md からの復元に必要 |
| nodeId | frontmatter `m3e:nodeId` | ノード同一性の追跡に必要 |
| collapsed | frontmatter `m3e:collapsed` | 表示状態。なくても復元可能（デフォルト false） |
| children 順序 | frontmatter `m3e:children-order` | 兄弟順序の保持。なければファイル内出現順 |
| details | Markdown 本文内の blockquote or section | 長文は本文に混ぜる |
| note | frontmatter `m3e:note` or 本文末尾 | 内部メモ |
| attributes | frontmatter のトップレベル | tags, aliases は Obsidian 互換 |
| link | frontmatter `m3e:link` | URL リンク |
| alias 参照 | `[[wikilink]]` | Obsidian 互換のリンク記法 |

### 3.3 フォルダ構造 = ツリー構造

```
Vault Root/                      →  rootId ノード
├── folder-A/                    →  nodeType: "folder"
│   ├── _folder.md               →  folder-A ノード自体の属性
│   ├── note-1.md                →  folder-A の子ノード
│   └── note-2.md                →  folder-A の子ノード
├── folder-B/                    →  nodeType: "folder"
│   └── nested/                  →  nodeType: "folder"（ネスト）
│       └── deep-note.md
└── standalone.md                →  root 直下の子ノード
```

**_folder.md の役割:**
- フォルダ自体のメタデータ（名前、属性、children 順序）を格納
- フォルダが M3E の folder ノードに対応することを示す
- 省略された場合はフォルダ名をノード text とし、children 順序はアルファベット順

```yaml
# _folder.md の例
---
m3e:
  nodeId: "n_folder_a"
  nodeType: "folder"
  children-order:
    - "note-1"     # ファイル名（拡張子なし）で指定
    - "note-2"
---

Folder A の説明テキスト
```

### 3.4 M3E 編集 → .md 書き込みフロー

```
Browser: ユーザーがノード編集
    ↓
Server: RapidMvpModel で変更を受理
    ↓
BindingManager.writeBack(changedNodeIds)
    ↓
1. 変更されたノードの所属ファイルを特定
   - nodeId → filePath のマッピング（SQLite キャッシュ）
    ↓
2. FileWriter で .md を再生成
   - tree-to-md: ノードの subtree を Markdown に変換
   - frontmatter 更新
    ↓
3. ファイルに書き出し（fs.writeFile）
    ↓
4. FileWatcher の自己変更フィルタに登録
   - recentWrites.set(filePath, Date.now())
    ↓
5. SQLite キャッシュも更新（mtime, contentHash）
```

**書き込みタイミング:**

| ポリシー | 動作 | 推奨場面 |
|---------|------|---------|
| `on-edit` (即座) | 各編集操作ごとに即座に .md 書き込み | **初期実装で採用** |
| `on-save` | Ctrl+S 操作時のみ書き込み | 大量編集時のパフォーマンス最適化 |
| `debounce` | 最後の編集から N ms 後に書き込み | バランス型（将来検討） |

`on-edit` を初期実装で採用する理由:
- 正本が .md なので、M3E での変更は即座にファイルに反映されるべき
- ユーザーが M3E を閉じても .md にはデータが残っている安心感
- パフォーマンス問題が出たら debounce に切り替え可能

### 3.5 外部編集 → キャッシュ更新フロー

```
Obsidian/VS Code: ユーザーが .md を編集・保存
    ↓
FileWatcher (chokidar): change イベント検出
    ↓
自己変更フィルタ: recentWrites に一致？ → Yes: 無視
                                          → No: 続行
    ↓
debounce (500ms): 連続変更をまとめる
    ↓
FileReader.parse(filePath)
    ↓
1. frontmatter をパース → メタデータ取得
2. Markdown 本文をパース → テキスト取得
3. [[wikilink]] を抽出 → alias 参照更新
    ↓
CacheInvalidator.update(nodeId, parsedResult)
    ↓
1. SQLite の該当ノードを更新
2. RapidMvpModel の in-memory state を更新
    ↓
SSE で Browser に通知
    ↓
Browser: 表示を更新
```

### 3.6 AI 構造化のキャッシュ戦略

.md 本文から M3E のツリー構造への変換に AI を使う場合:

```
.md 変更検出
    ↓
contentHash を比較
    ↓
ハッシュが同じ → キャッシュ使用（何もしない）
ハッシュが異なる → 変更差分を計算
    ↓
差分が小さい（< 20% の行変更）
    → テキスト差分のみ反映。ツリー構造は維持
    → AI 再構造化はスキップ
    ↓
差分が大きい（>= 20% の行変更）
    → AI 再構造化を実行
    → ただし前回の構造をヒントとして与える
```

**判断根拠:** 毎回 AI を呼ぶとコスト・レイテンシが問題になる。多くの編集は「テキストの微修正」であり、ツリー構造は変わらない。

### 3.7 .md が正本のときの SQLite の役割

| 役割 | 内容 | 再構築可能？ |
|------|------|------------|
| 構造キャッシュ | TreeNode のフラット化。nodeId, parentId, children | **Yes** -- .md + フォルダ構造から |
| 検索インデックス | 全文検索、属性フィルタ | **Yes** -- .md から再インデックス |
| AI 構造化キャッシュ | .md 本文 → subtree の変換結果 | **Yes** -- AI 再実行で（コスト発生） |
| alias 解決テーブル | wikilink → targetNodeId の解決済みマッピング | **Yes** -- .md の wikilink から |
| 表示状態 | collapsed, viewport, 選択状態 | **部分的** -- frontmatter に退避した分のみ |
| undo/redo 履歴 | 操作履歴スタック | **No** -- SQLite 固有（消えても致命的でない） |
| Cloud Sync メタ | baseVersion, syncedAt | SQLite 固有（Cloud Sync 設計次第） |

**SQLite 再構築コマンド:**

```
POST /api/vault/rebuild-cache
```

- vault 内の全 .md を再スキャン
- フォルダ構造からツリーを再構築
- frontmatter からメタデータを復元
- AI 構造化キャッシュは既定ではスキップ（オプトインで再実行）

---

## 4. Cloud Sync との組み合わせ

### 問題

現在の Cloud Sync は SQLite のデータを scope 単位で Supabase に push/pull する設計。
.md が正本になると、何を同期するかが変わる。

### 3つの選択肢

#### Option CS-1: .md ファイル自体を Cloud に同期

```
端末A: .md → (upload) → Cloud Storage (Supabase Storage / S3)
端末B: Cloud Storage → (download) → .md
```

- メリット: 正本が .md のまま。構造が明確
- デメリット: バイナリファイル同期になり、scope 単位の粒度が失われる。Supabase Storage のコスト
- 競合: ファイル単位の last-write-wins か、diff3 マージ

#### Option CS-2: SQLite キャッシュを Cloud に同期（現設計の維持）

```
端末A: .md → SQLite → (push) → Supabase
端末B: Supabase → (pull) → SQLite → .md
```

- メリット: 既存 Cloud Sync コードをほぼそのまま使える。scope 単位の粒度を維持
- デメリット: .md → SQLite → Cloud → SQLite → .md の二重変換。途中で情報が落ちるリスク
- 競合: 既存の scope 単位競合解決がそのまま使える

#### Option CS-3: 構造化データのみ Cloud 同期、.md は各端末ローカル

```
端末A: .md → TreeNode 差分 → (push) → Supabase
端末B: Supabase → (pull) → TreeNode 差分 → .md
```

- メリット: Cloud には構造データのみ送る（軽量）。.md の書式は各端末で自由
- デメリット: TreeNode → .md の変換が端末ごとに微妙に異なる可能性
- 競合: TreeNode 単位の競合解決

### 推奨: **CS-2（既存設計の維持）**

理由:
1. 既存の Cloud Sync 実装を壊さない
2. scope 単位の競合解決という M3E の強みを維持
3. `.md → SQLite` の変換は FileBinding Layer が担保するので、Cloud Sync はそのレイヤーを意識しなくてよい
4. 端末間での .md フォーマットの差異を吸収できる

**フロー:**

```
端末A:
  .md 編集 → FileBinding → SQLite キャッシュ更新 → Cloud Push (scope 単位)

端末B:
  Cloud Pull (scope 単位) → SQLite 更新 → FileBinding → .md 書き出し
```

注意点:
- Pull 後の .md 書き出しで、端末 B のローカル .md と競合する可能性がある
- これは「Cloud が .md より新しければ Cloud 優先で .md を上書き」で解決
- ユーザーが端末 B で未同期の編集をしていた場合は、通常の Cloud Sync 競合解決フローに乗せる

---

## 5. Collab（リアルタイム共同編集）との関係

### 問題

.md が正本の場合、リアルタイム共同編集は .md ファイルへの concurrent write になる。
これはファイルロックやマージの問題を引き起こす。

### 設計方針

**Collab 時は SQLite を一時的に正本に昇格させる。**

```
通常モード:    .md → SQLite (キャッシュ)    ← .md が正本
Collab モード: SQLite ← (CRDT/OT) → 他端末   ← SQLite が一時正本
               SQLite → .md (定期書き出し)
```

- Collab セッション開始時: .md の最新状態を SQLite に読み込み、SQLite を正本に切り替え
- Collab 中: 操作は SQLite 上で行い、他端末と同期
- Collab セッション終了時: SQLite の最終状態を .md に書き出し、.md 正本に戻す

**判断根拠:**
- ファイルベースの CRDT は研究段階であり、実用的な実装は存在しない
- SQLite ベースの OT/CRDT は既存の Collab 設計で計画済み
- 「通常は .md 正本、Collab 時だけ一時的に SQLite 正本」は実装が明快

### Collab 中の外部編集

Collab セッション中に Obsidian で .md を編集した場合:
- FileWatcher が検出 → 「Collab セッション中のため無視」通知を表示
- Collab 終了後に .md を上書きするため、Collab 中の外部編集は失われる
- これはユーザーに明示する（「Collab 中は Obsidian での編集を控えてください」）

---

## 6. M3E 固有概念のマッピング詳細

### 6.1 ツリー構造 → フォルダ/ファイル

| M3E 概念 | .md 表現 | 備考 |
|---------|---------|------|
| root ノード | Vault ルートフォルダ | `_folder.md` に root メタデータ |
| folder ノード | サブフォルダ + `_folder.md` | scope 境界 = フォルダ境界 |
| text ノード（浅い） | .md ファイル | 子のない text は 1 ファイル |
| text ノード（深い subtree） | .md ファイル内のセクション | AI 構造化の結果は 1 ファイル内に展開 |
| alias ノード | `[[wikilink]]` | collapsed = `[[link]]`, expanded = `![[link]]` |
| image ノード | `![[image.png]]` + 画像ファイル | 画像は vault 内に配置 |

### 6.2 エイリアス（参照ノード）

```markdown
## Related

- [[target-note]]          ← collapsed alias (read)
- ![[embedded-note]]       ← expanded alias
- [[target|カスタム名]]    ← aliasLabel 付き
```

frontmatter での追加メタデータ:
```yaml
m3e:
  aliases-meta:
    - target: "target-note"
      access: "write"        # デフォルトは "read"
```

### 6.3 スコープ

スコープ = フォルダ。これは自然な対応:
- M3E で scope-in → フォルダに入る
- Obsidian でフォルダを開く → M3E の scope 表示と同等
- scope 境界が明確（フォルダ境界 = scope 境界）

### 6.4 GraphLink

GraphLink はノード間の補助線であり、.md の本文には自然に対応しない。

```yaml
# _folder.md の末尾に記録
m3e:
  links:
    - id: "link_1"
      source: "node-a"      # ファイル名 or nodeId
      target: "node-b"
      relationType: "causes"
      label: "原因"
      direction: "forward"
```

または、scope ルートの `_folder.md` にまとめて記録する。

### 6.5 TCL (Tree Compatible Language)

将来的に TCL 形式をサポートする場合、.md 内に fenced code block として埋め込む:

````markdown
```tcl
node "Hypothesis A" {
  type folder
  children {
    node "Background" { ... }
    node "Key Points" { ... }
  }
}
```
````

TCL ブロックがある .md は、AI 構造化をスキップし TCL パーサーで直接 TreeNode に変換する。

---

## 7. 実装 Phase

### Phase 0: 基盤準備（1-2 日）

**目標:** FileBinding Layer のインターフェース定義とテスト基盤

- `beta/src/node/file_binding.ts` (新規): BindingManager インターフェース
- `beta/src/node/md_reader.ts` (新規): .md → TreeNode[] パーサー
- `beta/src/node/md_writer.ts` (新規): TreeNode[] → .md シリアライザ
- `beta/src/shared/types.ts`: FileBindingConfig, BoundDocument 型追加
- テスト: .md ↔ TreeNode の round-trip テスト

### Phase 1: Read バインディング（2-3 日）

**目標:** .md フォルダを M3E で閲覧できる

- `BindingManager.mount(vaultPath)`: フォルダをスキャンし TreeNode に変換
- SQLite にキャッシュとして保存
- `POST /api/binding/mount` API
- `GET /api/binding/status` API
- Browser から mount を指定してマップ表示

### Phase 2: Write バインディング（2-3 日）

**目標:** M3E での編集が即座に .md に反映される

- `BindingManager.writeBack(nodeId)`: 変更ノードを .md に書き出し
- `RapidMvpModel` の editNode/addNode/deleteNode にフックを追加
- on-edit ポリシーで即座書き込み
- テスト: M3E 編集 → .md 内容確認

### Phase 3: FileWatcher（2-3 日）

**目標:** 外部エディタでの変更が M3E に自動反映

- `file_watcher.ts` (新規): chokidar ラッパー
- 自己変更フィルタリング
- debounce + batch 処理
- CacheInvalidator: SQLite + in-memory state 更新
- SSE で Browser に通知
- `package.json`: chokidar 依存追加

### Phase 4: Cloud Sync 統合（3-4 日）

**目標:** .md バインディングと Cloud Sync が共存

- Cloud Pull → SQLite 更新 → .md 書き出しフロー
- .md 変更 → SQLite 更新 → Cloud Push フロー
- Collab モード切替（SQLite 一時正本化）
- `POST /api/binding/rebuild-cache` API

### Phase 5: 安定化と拡張（2-3 日）

**目標:** エッジケース対処、パフォーマンス最適化

- 大規模 vault（1000+ ファイル）のパフォーマンステスト
- ファイル名変更（rename）の追跡
- フォルダ移動の追跡
- AI 構造化キャッシュの差分判定ロジック
- エラーリカバリ（書き込み失敗、watcher エラー）

---

## 8. 実装対象ファイル一覧

| ファイル | Phase | 内容 |
|---------|-------|------|
| `beta/src/node/file_binding.ts` | 0 | **新規** -- BindingManager 本体 |
| `beta/src/node/md_reader.ts` | 0 | **新規** -- .md → TreeNode[] パーサー |
| `beta/src/node/md_writer.ts` | 0 | **新規** -- TreeNode[] → .md シリアライザ |
| `beta/src/node/file_watcher.ts` | 3 | **新規** -- chokidar ラッパー |
| `beta/src/node/start_viewer.ts` | 1-4 | API エンドポイント追加 |
| `beta/src/node/rapid_mvp.ts` | 2 | write-back フック追加 |
| `beta/src/shared/types.ts` | 0 | FileBindingConfig 等の型追加 |
| `docs/03_Spec/REST_API.md` | 1 | binding 系エンドポイント追記 |

---

## 9. 既存設計との関係

### local_file_integration.md との関係

既存の `local_file_integration.md` は Mirror 方式（Plan A）を前提とした設計。
Plan B 採用により、以下の部分は再利用し、それ以外は置き換える:

| 既存設計の項目 | Plan B での扱い |
|--------------|----------------|
| File Watcher (Section 3) | **再利用** -- chokidar の設定、debounce ロジックはそのまま使える |
| SyncEngine (Section 4) | **不要** -- 同期ではなく読み書きなので SyncEngine は要らない |
| 競合検出と解決 (Section 5) | **不要** -- 正本が1つなので競合しない |
| マッピングルール (Section 6) | **一部再利用** -- .md ↔ TreeNode の対応表は共通 |
| FileAdapter (Section 7) | **再利用** -- md_reader/md_writer の基盤として |
| API 設計 (Section 8) | **一部変更** -- mount/status は残すが sync 系は不要 |

### Obsidian_Vault_Integration.md との関係

Import/Export は Plan B でも残す:
- Import = 初回 mount 時のフォルダスキャン + AI 構造化
- Export = mount 解除時やバックアップ時の書き出し

Vault Mount (Part 3) は Plan B の核心と重なるため、本設計で置き換える。

---

## 10. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| 大規模 vault での性能 | 1000+ ファイルの初回スキャンが遅い | 差分スキャン（mtime 比較）で初回以降を高速化 |
| .md フォーマットの多様性 | Obsidian, Logseq, Typora で微妙に異なる | 厳密パースではなく寛容パースを採用 |
| frontmatter の情報量制限 | 全メタデータを退避しきれない | 重要でないメタデータはキャッシュのみに保持 |
| Collab 時の正本切替 | 切替タイミングのバグでデータ損失 | 切替前に .md のスナップショットを保存 |
| AI 構造化コスト | 大量ファイル変更時の API コスト | 差分ベースのスキップ判定（Section 3.6） |
| ファイルロック | Windows で他プロセスがファイルを掴んでいる | リトライ + ユーザー通知 |

---

## 11. 未決事項（Akaghef 判断待ち）

1. **書き込みタイミング**: `on-edit`（即座）で進めてよいか。パフォーマンス問題が出たら debounce に切り替える方針でよいか

2. **_folder.md の採用**: フォルダメタデータを `_folder.md` に保存する方式でよいか。代替案は `.m3e-config.json` のような隠しファイル

3. **Cloud Sync 方式**: CS-2（SQLite キャッシュ経由）で進めてよいか

4. **Collab 時の正本切替**: 「Collab 中は SQLite 正本」の方針でよいか

5. **AI 構造化の差分閾値**: 20% の行変更で AI 再実行というヒューリスティックの妥当性

6. **chokidar 依存**: beta/package.json への追加は許容されるか（既存設計からの継続課題）
