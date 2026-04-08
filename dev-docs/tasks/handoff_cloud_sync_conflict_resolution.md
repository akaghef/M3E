# Handoff: Cloud Sync 競合解決 — Merge Mode 実装

- AssignedTo: codex2
- AssignedAt: 2026-04-08T16:00:00
- Branch: dev-data
- Priority: P1
- AssignedPC: any
- Supersedes: handoff_cloud_sync_conflict_ui.md（旧 codex1 向け簡易UI案。本タスクで置換）

## 概要

Cloud Sync 競合時に GitHub-like な diff 表示 + node 単位マージ選択を実装する。
現在の「use-local / use-cloud」二択を廃止し、Merge Mode を導入する。

## 仕様書

**必読**: `dev-docs/03_Spec/Cloud_Sync_Conflict_Resolution.md`

全設計判断・ビジュアル仕様・API 定義・データ構造が記載されている。
以下はその要約と実装上の注意点。

---

## 設計判断サマリ

| 項目 | 決定 |
|---|---|
| diff 粒度 | node 単位 |
| マージ選択粒度 | node 単位（Git hunk 相当） |
| base 管理 | snapshot 保存（sync 成功時に IndexedDB 1 エントリ） |
| 競合表示 | カードずらし重ね（z 軸を x,y に射影、+8px/-8px） |
| 非競合表示 | 薄いハイライト（opacity 0.4） |
| 操作 | マップ上直接 + サイドパネル、双方向同期 |

## 実装フェーズと作業順序

### Phase 1: 基盤（これを最初にやる）

**1-1. Base Snapshot 保存**

場所: `beta/src/browser/viewer.ts` の sync 関連関数

```
sync 成功時（push成功 / pull成功）に document state を IndexedDB に保存する。
```

- IndexedDB store: `m3e-sync-base`
- key: `docId`
- value: `{ savedAt: string, state: AppState }`
- 保持は最新 1 世代のみ（上書き）
- 既存の `saveDocToLocalDb` / `pushDocToCloud` / `pullDocFromCloud` の成功パスに追加

**1-2. sync fetch API**

場所: `beta/src/node/start_viewer.ts`

```
GET /api/sync/fetch/{docId}
```

pull と同じレスポンス形式だが、ローカルに反映しない（remote state の取得のみ）。
`handleSyncApi` に `case "fetch"` を追加。`parseSyncRoute` の正規表現も拡張。

**1-3. 3-Way Diff エンジン**

新規ファイル: `beta/src/shared/merge_diff.ts`

```typescript
interface NodeDiff {
  nodeId: string;
  scopeId: string;
  operation: 'create' | 'update' | 'move' | 'delete' | 'reorder';
  side: 'local' | 'remote' | 'both';
  conflicting: boolean;
  localValue?: Partial<MapNode>;
  remoteValue?: Partial<MapNode>;
  baseValue?: Partial<MapNode>;
}

function computeThreeWayDiff(base: AppState | null, local: AppState, remote: AppState): NodeDiff[]
```

アルゴリズム:
1. base/local/remote の全 node を Map<nodeId, MapNode> に展開
2. base→local の変更セット、base→remote の変更セットを算出
3. 両セットの nodeId 交差 → `side: 'both'`、さらに同一属性変更なら `conflicting: true`
4. base が null なら 2-way（local vs remote の直接比較）にフォールバック

競合判定ルール（仕様書 §2.3 参照）:
- 同一 node 同一属性の両側更新 → conflict
- delete vs 他操作 → conflict
- move vs move → conflict
- sibling reorder 衝突 → conflict

**1-4. MergeSession 管理**

場所: `beta/src/browser/viewer.ts` に state 追加

```typescript
interface MergeSession {
  docId: string;
  startedAt: string;
  base: AppState | null;
  local: AppState;
  remote: AppState;
  diffs: NodeDiff[];
  resolutions: Map<string, 'local' | 'remote'>;
  status: 'active' | 'resolved' | 'aborted';
}

let mergeSession: MergeSession | null = null;
```

突入: `pushDocToCloud` が 409 返却時、または `pullDocFromCloud` で競合検出時
退出: resolve（全競合解決後）または abort

---

### Phase 2: ビジュアル Merge Mode

**2-1. モード切替**

- `mergeSession !== null` 時に Merge Mode
- ノード編集・追加・削除を無効化（read-only）
- ステータスバーに `MERGING (n/m resolved)` 表示
- 既存の `cloudSyncBadgeEl` 周辺を拡張

**2-2. マップ上の色分け**

描画関数（`renderNode` 相当）に Merge Mode 用の分岐を追加:

| 変更種別 | 色 | 表現 |
|---|---|---|
| create | `#22c55e`（緑） | 通常 or 薄 |
| delete | `#ef4444`（赤） | 取消線 + 薄 |
| update | `#eab308`（黄） | 通常 |
| move | `#3b82f6`（青） | 通常 |
| conflict | `#ef4444` 赤枠グロー | 通常 |
| auto-merged | 上記色 opacity 0.4 | 薄い |

**2-3. 競合 node のカードずらし重ね表示**

競合 node の描画時:
- cloud 版を (+8px, -8px) オフセットで背面に描画（薄い青枠）
- local 版を通常位置で前面に描画
- 未解決: 赤グロー枠 / 解決済み: 緑枠
- 選択された側が前面、不採用側が opacity 低下

---

### Phase 3: 操作 UI

**3-1. サイドパネル（Merge Resolution Panel）**

Linear パネル領域を Merge Mode 時に切り替え。

構成:
- ヘッダー: conflict 数 / total changes
- CONFLICTS セクション: 各競合 node に [Use Local] [Use Cloud] ボタン
- AUTO-MERGED セクション: 自動マージ済み変更のリスト（操作不要）
- フッター: [Abort] [Resolve] ボタン（Resolve は全解決後に有効化）

**3-2. パネル ↔ マップ 双方向同期**

- パネル node クリック → マップが `centerOnNode` でパン＆ズーム
- マップ競合 node クリック → パネルがスクロール + ハイライト
- 選択変更はどちらからでも即座に相互反映

**3-3. マップ上の直接操作**

- 競合 node クリック → コンテキストメニュー [Use Local | Use Cloud]
- 非競合 node クリック → 通常と同様（選択のみ、編集不可）

**3-4. キーボードショートカット**

| キー | アクション |
|---|---|
| `Tab` / `Shift+Tab` | 次/前の競合 node へジャンプ |
| `L` | Use Local |
| `C` | Use Cloud |
| `Enter` | Resolve |
| `Escape` | Abort |

---

### Phase 4: 堅牢性

**4-1. Post-Merge Validation**

resolve 確定前に検証:
- root 到達可能性
- cycle 禁止
- parentId/children 整合
- alias→alias 禁止
- broken alias 整合

失敗時: エラー表示 + 再選択を促す

**4-2. sync resolve API**

```
POST /api/sync/resolve/{docId}
Body: { state: AppState, savedAt: string }
```

マージ後の state を cloud に書き込み、base snapshot を更新。

**4-3. Conflict Backup**

resolve 確定時、不採用変更を IndexedDB `m3e-conflict-backups` に退避。

**4-4. エッジケース**

- base なし → 2-way diff フォールバック
- Merge Mode 中のブラウザリロード → mergeSession を sessionStorage に退避/復帰
- Merge Mode 中の sync push/pull → ブロック

---

## 触るファイル一覧

| ファイル | 変更内容 |
|---|---|
| `beta/src/shared/merge_diff.ts` | **新規** — 3-way diff エンジン |
| `beta/src/browser/viewer.ts` | Merge Mode state、UI、描画分岐、パネル、ショートカット |
| `beta/src/node/start_viewer.ts` | `sync fetch` / `sync resolve` API 追加 |
| `beta/src/node/cloud_sync.ts` | 変更なし（detectCloudConflict はそのまま利用） |
| `beta/src/shared/types.ts` | NodeDiff, MergeSession, ConflictBackup 型追加 |
| `beta/viewer.html` | Merge Resolution パネル DOM、ステータスバー拡張 |
| `beta/viewer.css` | 競合色分け、カードずらし、グロー、パネルスタイル |
| `beta/tests/unit/merge_diff.test.js` | **新規** — diff エンジンのユニットテスト |
| `beta/tests/unit/cloud_sync_api_integration.test.js` | fetch/resolve API テスト追加 |

## Spec References

- `dev-docs/03_Spec/Cloud_Sync_Conflict_Resolution.md` — **主仕様（必読）**
- `dev-docs/03_Spec/Cloud_Sync.md` — sync 全体戦略、競合判定ルール
- `dev-docs/03_Spec/Data_Model.md` — MapNode / scope / alias 構造
- `dev-docs/03_Spec/REST_API.md` — 既存 API 仕様

## Acceptance Criteria

- [ ] sync 成功時に base snapshot が IndexedDB に保存される
- [ ] `sync fetch` API が cloud document を返す（ローカル未反映）
- [ ] 3-way diff が node 単位の変更を正しく検出する
- [ ] 競合検出時に Merge Mode に突入し、通常編集が無効化される
- [ ] マップ上で変更 node が色分け表示される（緑/赤/黄/青）
- [ ] 競合 node がカードずらし重ねで表示される
- [ ] 非競合変更が薄いハイライトで表示される
- [ ] サイドパネルに競合リストが表示され、node ごとに Local/Cloud を選択できる
- [ ] パネル ↔ マップ の操作が双方向同期する
- [ ] 全競合解決後に Resolve で確定、base snapshot が更新される
- [ ] Abort で Merge Mode 前の状態に復帰する
- [ ] post-merge validation が cycle/親子不整合を検出する
- [ ] `npm --prefix beta run build` pass
- [ ] 新規テスト（merge_diff.test.js）pass
- [ ] 既存テスト regression なし

## Notes

- Phase 1→2→3→4 の順で段階実装すること。Phase 1 完了時点で中間レビュー推奨
- 既存の `cloudUseLocalBtn` / `cloudUseCloudBtn` は Phase 3 完了後に削除
- viewer.ts は巨大ファイル。Merge Mode 関連コードは可能なら関数を分離して見通しを保つ
- device priority は Merge Mode のデフォルト選択 hint として使用（自動確定はしない）

## Completion

タスク完了時:
1. 担当ブランチに commit + push
2. `/pr-beta` で dev-beta への PR を作成
3. このファイルの Acceptance Criteria にチェックを入れる
