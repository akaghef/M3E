# Cloud Sync Conflict Resolution — 仕様書

## 目的

Cloud Sync で競合が発生した際に、GitHub の merge conflict resolution に相当する
ビジュアルな diff 表示とノード単位の選択的マージを提供する。

現在の「use-local / use-cloud」二択を廃止し、
ユーザーが変更内容を確認しながら node ごとに判断できるようにする。

## 設計判断サマリ

| 項目 | 決定 |
|---|---|
| diff 粒度 | node 単位 |
| マージ選択粒度 | node 単位（Git hunk 相当） |
| base 管理 | snapshot 保存（sync 成功時に IndexedDB へ保存） |
| 競合表示 | カードずらし重ね（z 軸を x,y に射影） |
| 非競合表示 | 薄いハイライト（自動マージ済み） |
| 操作方法 | マップ上直接 + サイドパネル、双方向同期 |

---

## 1. Git ワークフロー対応表

M3E の sync コマンドは Git のワークフローに対応させる。

### コマンド対応

| Git | M3E Sync | 説明 |
|---|---|---|
| `git fetch` | `sync fetch` | cloud の状態を取得（ローカル反映なし） |
| `git status` | `sync status` | local / cloud の差分サマリ表示 |
| `git diff` | `sync diff` | 3-way diff の詳細表示 |
| `git pull` | `sync pull` | fetch + auto-merge。競合あれば Merge Mode 突入 |
| `git push` | `sync push` | local → cloud へ反映 |
| `git push --force` | `sync push --force` | 競合を無視して上書き |
| `git merge --abort` | `sync abort` | Merge Mode を中止、元の状態に復帰 |
| `git add <file>` | node 選択（Use Local / Use Cloud） | 競合 node の解決をステージング |
| `git merge --continue` | `sync resolve` | 全競合の解決を確定、マージコミット |

### ワークフロー図

```
[通常状態]
    │
    ├── sync push ──→ 成功 → base snapshot 更新
    │                  │
    │                  └── 409 Conflict → [Merge Mode 突入]
    │
    ├── sync pull ──→ 競合なし → auto-merge → base snapshot 更新
    │                  │
    │                  └── 競合あり → [Merge Mode 突入]
    │
    v
[Merge Mode]
    │
    ├── 各 node の diff 表示（マップ + パネル）
    ├── node ごとに Use Local / Use Cloud を選択
    ├── 全競合 resolved → sync resolve で確定
    │
    ├── sync abort → Merge Mode 中止、変更前に復帰
    │
    └── 確定 → base snapshot 更新 → [通常状態] に復帰
```

---

## 2. 3-Way Diff エンジン

### 2.1 Base Snapshot 管理

sync 成功時（push 成功 / pull 成功 / resolve 成功）に
document 全体の JSON snapshot を IndexedDB に保存する。

```
IndexedDB: m3e-sync-base
  key:   docId
  value: { savedAt: string, state: AppState }
```

- 保持するのは最新 1 世代のみ
- base が存在しない場合（初回 sync）は 2-way diff にフォールバック

### 2.2 Diff 検出アルゴリズム

3 者（base / local / remote）を scope 単位で比較し、
node 単位の変更操作を分類する。

```typescript
interface NodeDiff {
  nodeId: string;
  scopeId: string;          // 導出値
  operation: 'create' | 'update' | 'move' | 'delete' | 'reorder';
  side: 'local' | 'remote' | 'both';
  conflicting: boolean;     // side=both かつ競合条件を満たす
  localValue?: Partial<MapNode>;   // local 側の変更後の値
  remoteValue?: Partial<MapNode>;  // remote 側の変更後の値
  baseValue?: Partial<MapNode>;    // base 時点の値
}
```

### 2.3 競合判定ルール（Cloud_Sync.md 準拠）

自動マージ可能：
- 片側のみ変更（side = local | remote）
- 両側変更だが変更 node 非重複
- 同一 node でも変更属性が独立（title vs color）

競合（conflicting = true）：
- 同一 node の同一属性を両側で更新
- delete と他操作の衝突
- 同一 node に対する move と move の衝突
- 同一 sibling 列に対する reorder の衝突
- alias target 整合性の破壊
- 自動統合後の cycle / 親子不整合

---

## 3. Merge Mode — ビジュアル仕様

### 3.1 モード遷移

Merge Mode は通常のマップ編集とは異なる専用モードである。

- 突入条件: `sync pull` or `sync push` で競合検出時
- 退出条件: `sync resolve`（全競合解決後）or `sync abort`
- Merge Mode 中はノードの編集・追加・削除を禁止する（read-only + 選択のみ）
- ステータスバーに `MERGING (n/m resolved)` を常時表示

### 3.2 マップ上のビジュアル表現

#### 色分けルール

| 変更種別 | 色 | 透明度 |
|---|---|---|
| 追加（create） | 緑 `#22c55e` | 通常 or 薄（自動マージ時） |
| 削除（delete） | 赤 `#ef4444` | 取消線 + 薄 |
| 更新（update） | 黄 `#eab308` | 通常 |
| 移動（move） | 青 `#3b82f6` | 通常 |
| 競合（conflicting） | 赤枠 + グロー `#ef4444` | 通常 |
| 非競合（auto-merged） | 上記色の薄い版 | opacity 0.4 |

#### 競合 node のカードずらし表示

競合 node は local 版と cloud 版を**カードが少しずれて重なる**形で表示する。

```
         ┌──────────────┐
         │  Cloud 版     │  ← 右上にオフセット (+8px, -8px)
         │  "別の名前"    │     薄い青枠
    ┌────│──────────────┐│
    │  Lo│al 版          ││
    │  "新│い名前"       ├┘
    │              [✓]  │  ← 選択済みマーク
    └───────────────────┘
       赤枠（未解決時）→ 緑枠（解決済み）
```

- 未選択時: 赤グロー枠
- local 選択時: local カード前面、cloud カード薄く
- cloud 選択時: cloud カード前面、local カード薄く
- 選択済み: 枠が緑に変化

#### 削除 node の表示

- local で削除 / cloud で存続: node を取消線 + 赤で表示、cloud 版をゴースト表示
- cloud で削除 / local で存続: 同上逆

#### 非競合変更の表示

- 自動マージ済みの変更は**薄いハイライト**で表示（opacity 0.4）
- 色は変更種別に準ずる（薄い緑、薄い黄、薄い青）
- 操作不要だが、何が自動マージされたか視認可能

### 3.3 サイドパネル（Merge Resolution Panel）

既存の Linear パネル領域を Merge Mode 時に切り替えて使用する。

```
┌─────────────────────────┐
│ ☁ Merge Resolution      │
│ 3 conflicts / 5 changes │
│ ━━━━━━━━━━━━━━━━━━━━━━ │
│                          │
│ ⚡ CONFLICTS (3)         │
│                          │
│ ☐ NodeA — title          │
│   Local: "新しい名前"     │
│   Cloud: "別の名前"       │
│   [Use Local] [Use Cloud]│
│                          │
│ ☐ NodeD — existence      │
│   Local: deleted          │
│   Cloud: exists           │
│   [Delete] [Keep]         │
│                          │
│ ☐ NodeE — position       │
│   Local: parent=B         │
│   Cloud: parent=C         │
│   [Use Local] [Use Cloud]│
│                          │
│ ━━━━━━━━━━━━━━━━━━━━━━  │
│ ✅ AUTO-MERGED (2)       │
│                          │
│ ✓ NodeC — added (cloud)  │
│ ✓ NodeF — color (local)  │
│                          │
│ ━━━━━━━━━━━━━━━━━━━━━━  │
│ [Abort]     [Resolve ✓]  │
│             (0/3 done)   │
└─────────────────────────┘
```

#### パネル ↔ マップ 双方向同期

- パネルで node をクリック → マップがその node にパン＆ズーム
- マップで競合 node をクリック → パネルがスクロールしてその項目をハイライト
- パネルで Use Local/Cloud → マップのカード表示が即座に更新
- マップで競合カードをクリック → コンテキストメニューで Use Local/Cloud

### 3.4 操作フロー

1. 競合検出 → Merge Mode 突入
2. マップに色分け + カードずらし表示、パネルに競合リスト表示
3. ユーザーが各競合 node で local/cloud を選択
4. 全競合解決後、`[Resolve]` ボタンが有効化
5. Resolve クリック → post-merge validation（cycle, 親子整合性, alias 検証）
6. validation 成功 → マージ確定、base snapshot 更新
7. validation 失敗 → エラー表示、ユーザーに再選択を促す

---

## 4. API 拡張

### 4.1 新規エンドポイント

```
GET /api/sync/fetch/{docId}
```
cloud の document を取得するが local には反映しない。
レスポンスは pull と同一形式。

```
POST /api/sync/resolve/{docId}
```
Merge Mode での解決結果を確定する。
リクエストボディにマージ後の document state を含む。

### 4.2 既存エンドポイント変更

`POST /api/sync/push/{docId}` — 変更なし
`POST /api/sync/pull/{docId}` — 変更なし（409 返却は従来通り）
`GET /api/sync/status/{docId}` — レスポンスに `baseSnapshot` の有無を追加

### 4.3 レスポンス拡張（status）

```json
{
  "enabled": true,
  "exists": true,
  "cloudSavedAt": "2026-04-08T12:00:00Z",
  "lastSyncedAt": "2026-04-08T11:00:00Z",
  "hasBaseSnapshot": true
}
```

---

## 5. データ構造

### 5.1 MergeSession

Merge Mode 中に保持する一時的なセッション状態。

```typescript
interface MergeSession {
  docId: string;
  startedAt: string;
  base: AppState | null;      // snapshot from IndexedDB
  local: AppState;            // current local state
  remote: AppState;           // fetched cloud state
  diffs: NodeDiff[];          // computed diff list
  resolutions: Map<string, 'local' | 'remote'>;  // nodeId → choice
  status: 'active' | 'resolved' | 'aborted';
}
```

### 5.2 Conflict Backup（Cloud_Sync.md 準拠）

resolve 確定時、不採用側の変更を backup として退避。

```typescript
interface ConflictBackup {
  resolvedAt: string;
  scopeId: string;
  baseVersion: string;
  adoptedSide: 'local' | 'remote';
  rejectedChanges: NodeDiff[];
}
```

IndexedDB `m3e-conflict-backups` に保存。直近 N 件保持。

---

## 6. キーボードショートカット（Merge Mode 専用）

| キー | アクション |
|---|---|
| `Tab` / `Shift+Tab` | 次 / 前の競合 node へジャンプ |
| `L` | 現在の競合を Use Local で解決 |
| `C` | 現在の競合を Use Cloud で解決 |
| `Enter` | Resolve（全解決後のみ有効） |
| `Escape` | Abort |

---

## 7. 実装フェーズ

### Phase 1: 基盤（最小 diff + snapshot）

- [ ] Base snapshot の IndexedDB 保存（sync 成功時）
- [ ] 3-way diff エンジン（node 単位の変更検出）
- [ ] `sync fetch` API 追加
- [ ] MergeSession のライフサイクル管理

### Phase 2: ビジュアル Merge Mode

- [ ] Merge Mode の状態遷移とモード切替
- [ ] マップ上の色分け表示（追加/削除/更新/移動）
- [ ] 競合 node のカードずらし重ね表示
- [ ] 非競合変更の薄いハイライト表示

### Phase 3: 操作 UI

- [ ] サイドパネル（Merge Resolution Panel）
- [ ] パネル ↔ マップ 双方向同期
- [ ] node 単位の Use Local / Use Cloud 選択
- [ ] Resolve / Abort フロー
- [ ] キーボードショートカット

### Phase 4: 堅牢性

- [ ] Post-merge validation（cycle, 親子整合性, alias）
- [ ] Conflict backup の保存と参照
- [ ] `sync resolve` API
- [ ] エッジケース: base なし時の 2-way fallback
- [ ] エッジケース: Merge Mode 中のブラウザリロード復帰

---

## 8. 既存仕様との関係

- **Cloud_Sync.md**: 本文書はその「将来拡張 > 競合内容のユーザー提示」を具体化したもの
- **scope 単位同期**: Cloud_Sync.md の scope 粒度方針と整合。diff は scope→node と掘り下げる
- **device priority**: 本仕様では device priority をデフォルト選択の hint として使用する
  （以前: 自動確定 → 今回: ユーザー選択のデフォルト値として提示）
- **Merge Mode は read-only**: 通常の Command パターン操作は Merge Mode 中は無効

---

## 関連文書

- [Cloud_Sync.md](./Cloud_Sync.md) — sync 全体戦略
- [Data_Model.md](./Data_Model.md) — node / scope / alias 構造
- [Scope_and_Alias.md](./Scope_and_Alias.md) — scope 境界と alias
- [REST_API.md](./REST_API.md) — API 仕様
