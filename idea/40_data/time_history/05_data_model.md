# 05 — データモデル / 履歴ストア / 既存資産接続

I1〜I5 を支える **履歴ストア** の設計論点。
既存 backup.ts / audit_log.ts に何を足すと 5 機能を満たせるか。
**実装はしない**、データ構造の選択肢を並べる。

## Dm1. 既存資産の整理

| 既存 | 何を保持 | 粒度 | 容量目安 |
|---|---|---|---|
| backup.ts | DB 全体スナップショット | 1h × 10 世代（粗）| 1 世代 = DB サイズ |
| audit_log.ts | 操作イベント | 操作単位（密）| ring 500 + JSONL 永続 |

→ **粗 + 密のハイブリッド** が既に揃っている。
   I1〜I5 用の追加レイヤを足せば最小コストで実装可能。

## Dm2. 5 機能と必要データの対応

| 機能 | 必要データ | 既存で足りる？ |
|---|---|---|
| I1 タイムトラベル（粗）| backup snapshot | ◎ |
| I1 タイムトラベル（細）| snapshot + audit | △（補間ロジック要） |
| I2 What-if | 現在 snapshot + 仮想差分 | ○（仮想差分ストア要） |
| I3 Diff アニメ | 連続 snapshot or audit リプレイ | ○（既存資産で MVP 可） |
| I4 忘却 | ノード最終操作タイムスタンプ | △（メタ追加要） |
| I5 AI 要約 | audit + ノード text 履歴 | △（テキスト diff 要） |

## Dm3. 履歴の保持戦略の選択肢

### Dm3.1 スナップショット中心

- **Dm3.1.A** 1h ごとに全 DB を保存（既存 backup.ts）
- **Dm3.1.B** 1d ごとに 1 世代、長期保管
- **Dm3.1.C** ユーザー操作で手動スナップショット

**良い点**: 復元が単純（コピー戻し）
**悪い点**: 解像度粗い、ストレージ重い

### Dm3.2 イベントログ中心

- **Dm3.2.A** 全操作を JSONL に append（既存 audit_log.ts）
- **Dm3.2.B** イベントから任意時点を再構築（リプレイ）

**良い点**: 任意秒単位の再現可能、軽量
**悪い点**: リプレイコスト、初期状態が必要

### Dm3.3 ハイブリッド（推し）

- 粗いスナップショット（1h）+ 細かい操作ログ（audit）
- 任意時点 = 直前 snapshot をロード → そこから audit を順次適用
- "checkpoint" 概念

→ Git の **packfile + delta** に近い構造。

### Dm3.4 ノード単位履歴（追加レイヤ）

- 各ノードの text 変更を **diff 形式** で保持
- 1 ノードの過去版だけ高速参照可能
- I1.F（ノード単位タイムトラベル）と I5（ノード履歴要約）に効く

## Dm4. データ構造の選択肢

### Dm4.A SQLite テーブル拡張

```sql
-- 既存 nodes テーブル + 履歴テーブル追加案
CREATE TABLE node_history (
  node_id TEXT,
  timestamp TEXT,
  field TEXT,         -- 'text' | 'parent' | 'pos'
  old_value TEXT,
  new_value TEXT
);
```

良い点: 既存 SQLite と統合、検索可能
悪い点: スキーマ変更コスト

### Dm4.B JSONL 拡張（audit_log.ts と同形式）

```jsonl
{"ts":"...","type":"node_text_diff","nodeId":"n123","diff":"..."}
```

良い点: 既存 audit と同じパターン、移行楽
悪い点: 検索性低い

### Dm4.C 別 DB（履歴専用）

- 履歴を別 SQLite に分離
- メイン DB を軽く保つ

良い点: メイン DB がスリム
悪い点: 同期コスト、整合性問題

### Dm4.D Git ベース履歴

- マップ全体を git repo として管理
- commit = snapshot
- branch = what-if

良い点: 既存ツール（git diff, log, branch）流用
悪い点: 複雑、ユーザー視点で git の概念を出してしまう

## Dm5. 仮想差分（What-if 用）

I2 What-if は **元 DB を変えずに仮想差分を保持** する必要:

| ID | 案 | 説明 |
|---|---|---|
| Dm5.A | メモリ上の差分オブジェクト | リロードで消える、軽量 |
| Dm5.B | 別ファイル（whatif_<name>.sqlite） | 永続、命名管理 |
| Dm5.C | 元 DB に "branch_id" カラム追加 | 同 DB、tag で分離 |
| Dm5.D | overlay レイヤー（diff 集合）| 現在 + 差分の合成 |

→ **Dm5.D overlay** が技術的に筋が良いが、Dm5.A から始めて MVP 化が現実的。

## Dm6. パフォーマンス論点

### Dm6.1 スナップショット間隔

- **Dm6.1.A** 1h（既存）— 細かい復元には粗い
- **Dm6.1.B** 10min — リプレイコスト下がる
- **Dm6.1.C** イベント駆動（重要操作後に snapshot）— 賢い
- **Dm6.1.D** ユーザー裁量

### Dm6.2 世代数

- **Dm6.2.A** 10（既存）— 短期（10h）しか戻れない
- **Dm6.2.B** 100 — 4 日分（1h × 24 × 4）
- **Dm6.2.C** 階層管理（直近 24h は 1h、それ以前は 1d など）
- **Dm6.2.D** 無制限 + 圧縮

### Dm6.3 audit ログのサイズ

- 既存: JSONL 永続化
- 1 年で 1〜10MB 想定（操作 1 万件 × 1KB 程度）
- 検索・要約で全読みは可能、ただし AI 送信時はトリミング必要

## Dm7. テキスト diff の方式

I5 AI 要約と I1 ノード単位タイムトラベルに必要:

| ID | 方式 | 良い点 | 悪い点 |
|---|---|---|---|
| Dm7.A | 全文保存（旧／新） | 単純 | 容量大 |
| Dm7.B | 文字単位 diff（diff-match-patch） | 容量小 | 適用コスト |
| Dm7.C | 行単位 diff | 中庸 | 短文に弱い |
| Dm7.D | 単語単位 diff | 視覚化に強い | 容量中 |
| Dm7.E | "重要編集だけ保存" | 軽い | "重要" 判定要 |

→ MVP は Dm7.A 全文、長期的に Dm7.B か Dm7.D。

## Dm8. 互換性論点

### Dm8.1 既存マップとの互換

- 過去マップ（backup 既存 10 世代）は **そのまま I1 で使える**
- audit_log の過去ログも **そのまま I3 リプレイ素材**
- → **既存ユーザーが何もしなくても I1/I3 が動く** のが強み

### Dm8.2 マップ移行（import/export）

- マップを export する時、履歴も同梱するか／本体だけか
- import 時、履歴は破棄か継承か
- → ユーザー選択可にするのが安全

### Dm8.3 同じワークスペース内の複数マップ

- workspace 単位で履歴ストア統合？それとも map 単位？
- → map 単位（既存 backup.ts に合わせる）が筋

## Dm9. メタ情報の追加

I4 / I5 のために各ノードに足したいメタ:

| ID | メタ | 用途 |
|---|---|---|
| Dm9.a | last_accessed_at | I4 忘却条件 |
| Dm9.b | access_count | I4 忘却条件 |
| Dm9.c | created_at | I1 タイムトラベル UX |
| Dm9.d | last_edited_at | 既存にあるはず |
| Dm9.e | summary_cache | I5 要約のキャッシュ |
| Dm9.f | pin_no_forget | I4 忘却対象外フラグ |
| Dm9.g | event_tag | "査読" "会議" 等のイベント名（TT5.c） |

## Dm10. ストレージ容量見積り（参考）

| 項目 | サイズ感 |
|---|---|
| マップ DB（中規模 200 ノード）| ~500KB |
| backup × 10 世代 | ~5MB |
| audit_log（1 年）| ~5MB |
| node_history（テキスト diff）| ~2MB |
| 仮想 what-if 1 件 | ~500KB |
| 合計（中規模、1 年運用）| ~15〜20MB |

→ ローカル運用前提なら問題なし。クラウド同期時のみ要検討。

## Dm11. 既存資産との具体的接続点

### Dm11.A backup.ts に追加したいフック

- スナップショット作成時に **メタ情報**（イベントタグ、ユーザーラベル）追加
- 世代管理を **階層化**（直近密、過去疎）
- ユーザー手動 "checkpoint" コマンド

### Dm11.B audit_log.ts に追加したい操作型

- 既存: add / edit / delete / move
- 追加候補: link_add / link_remove / text_diff / status_change / tag_change

### Dm11.C 新モジュール案

- `history_store.ts` — Dm3.3 ハイブリッド統合 API
- `text_diff.ts` — Dm7 のテキスト diff
- `whatif_overlay.ts` — Dm5.D 仮想差分
- `forget_meta.ts` — Dm9 のメタ更新

→ これらの新規モジュール案は **MVP の章で深掘り**。
