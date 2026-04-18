# Runtime Naming Ambiguity Closure Plan

2026-04-15 時点の命名整理メモ。  
ここでは「何が確定したか」と「どう改革するか」を分けて残す。

## 今回の会話で確定したこと

### 1. 概念階層

```text
ws > map > scope > node
```

- `scope` は M3E 固有概念として維持する
- `folder` は一般向け説明の補助語として使う
- 仕様語は `map` を使い、`doc` は実装互換名に下げる

### 2. 軸の分離

| 軸 | 確定内容 |
|---|---|
| owner | `akaghef` |
| data profile | `personal` |
| channel | `beta` / `final` |
| workspace | 永続データ実体。DB 単体ではなく運用一式のフォルダ |
| map | workspace 内の作業単位 |

### 3. workspace

| 項目 | 確定内容 |
|---|---|
| `wsId` | 内部識別子。`ws_<ULID>` |
| `wsLabel` | `Akaghef-personal` |
| 役割 | 保存先フォルダを一意に決める |
| 可視性 | ユーザーには `wsId` を基本見せない |

### 4. map

| 項目 | 確定内容 |
|---|---|
| `mapId` | 内部識別子。`map_<ULID>` |
| `mapLabel` | 表示名。変更可 |
| `mapSlug` | 固定の人間可読補助名 |
| 旧 `akaghef-beta` | 新仕様では `開発` map に相当 |

### 5. 初期標準 map

| 対象 | 初期 map |
|---|---|
| `Akaghef-personal` | `開発` (`beta-dev`), `研究` (`beta-research`) |
| 一般ユーザー向け final | `tutorial` のみ |

### 6. runtime 方針

| 項目 | 確定内容 |
|---|---|
| 開発標準チャネル | `beta=4173` |
| final の役割 | 配布・安定版確認 |
| workspace | `data.sqlite`, `backups/`, `audit/`, `cloud-sync/`, `conflict-backups/` を持つ |
| `seed` | release 用原本。runtime DB を自動上書きしない |

### 7. 互換方針

| 項目 | 確定内容 |
|---|---|
| 旧仕様バッファ | 作らない |
| 方針 | 互換レイヤーより、新仕様への全面書き換えを優先する |
| `docId` / `documentId` | 当面はコード・API 互換名として残してよい |

## 改革方針ダンプ

### A. 文書改革

| 対象 | 方針 |
|---|---|
| Glossary | `ws / map / scope / node` を SSOT として固定 |
| Data Runtime | `main / sandbox / akaghef-beta` 中心記述を外す |
| API 仕様 | 説明文は `map` 優先、実装互換名は注記で残す |
| UI/導入文書 | `folder` を補助語として使い、正規語は `scope` に維持 |

### B. runtime 改革

| 対象 | 方針 |
|---|---|
| 保存先決定 | `wsId -> workspaceDir` を機械解決する |
| workspace 表示 | `wsLabel` を表示し、`wsId` は隠す |
| map 表示 | `mapLabel` を表示し、`mapId` は内部で使う |
| map 補助名 | `mapSlug` は固定し、ログ・設定・補助表示に使う |

### C. 命名改革

| 旧 | 新 |
|---|---|
| `doc` | `map` |
| `akaghef-beta` | `開発` / `beta-dev` |
| `main` / `sandbox` | 新仕様の中心語から外す |
| 表示名と内部 ID の混同 | `label` と `id` を明確に分離 |

### D. 実装改革

| 対象 | 方針 |
|---|---|
| 設定 | `workspaceId`, `workspaceLabel`, `mapId`, `mapLabel`, `mapSlug`, `channel` を分離して保持 |
| 既存 API | 一気に壊さない。まず説明語彙と runtime モデルを揃える |
| 既存コード | `docId` は当面残し、段階的に `map` 語彙へ寄せる |

### E. テスト改革

| テスト | 合格条件 |
|---|---|
| workspace 解決 | 同じ `wsId` から常に同じ保存先が解決される |
| label 変更 | `wsLabel`, `mapLabel` を変えても内部 ID と保存先は不変 |
| map 固定属性 | `mapId` は不変、`mapSlug` は固定 |
| 初期生成 | Akaghef personal は `開発` / `研究`、final 配布は `tutorial` |
| channel 役割 | `beta=4173` を開発標準とし、final は配布・確認用途に留める |

## 作業順

1. SSOT 文書を更新する  
2. runtime spec を新モデルに揃える  
3. API と UI の語彙を `map` 基準に寄せる  
4. 設定と起動スクリプトを `wsId / mapId` モデルへ寄せる  
5. 受け入れテストを明文化してから実装を詰める
