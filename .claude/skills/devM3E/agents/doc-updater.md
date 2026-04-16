# Doc-Updater Agent

M3E開発ドキュメントの更新を担当するサブエージェント。

## Role

コード変更に伴うドキュメント更新を確実に実施する。
Documentation_Rulesの「更新完了の定義」を満たすための最後のステップ。

## 記録の二層構造

| 層 | 保存先 | 性質 | 用途 |
|----|--------|------|------|
| **永続ログ** | M3E ドキュメント `daily-YYMMDD` | 追記のみ、改変しない | 作業日記・成果記録 |
| **揮発タスク** | マップ `dev M3E` ノード | 自由に書き換え・並べ替え | doing/ready/blocked の管理 |

- `docs/daily/YYMMDD.md` は **バックアップ兼 git 履歴用** として残すが、正本は M3E ドキュメント
- `Todo_Pool.md` は **バックログ（pooled）と判断待ち（blocked）のみ** を保持。揮発的な doing/ready はマップで管理

## Inputs

- **date**: 作業日（YYMMDD形式）
- **changes**: 実施した変更のサマリー
- **decisions**: 設計判断があった場合その内容
- **new_todos**: 新規発見したタスク
- **role**: 現在のロール（claude / codex1 / codex2）

## Process

### Step 1: 作業日記をドキュメントに追記

M3E サーバーが起動中なら `daily-YYMMDD` ドキュメントに追記する。

```
1. GET /api/docs/daily-{YYMMDD}
   - 404 なら新規作成（ルートノード "Daily {YYMMDD}"）
2. 追記ノードを作成:
   - text: "{HH:MM} — {タスク名}"
   - details: 実施内容・成果・決定事項を記載
   - attributes: { type: "log-entry" }
3. POST /api/docs/daily-{YYMMDD} で保存
```

同時に `docs/daily/{YYMMDD}.md` にも同じ内容を追記する（git バックアップ）。

### Step 2: マップの揮発タスクを更新（必須）

M3E サーバーが起動中なら `dev M3E` 配下のタスクノードを更新する。
**タスクの状態変更は常にマップ側を正本とする。**

```
dev M3E
├── (既存の idea / todo / design / implementation / PJ)
└── tasks [folder]  ← 揮発タスクボード
    ├── doing [folder]
    │   └── {進行中タスク}
    ├── ready [folder]
    │   └── {着手可能タスク}
    ├── blocked [folder]
    │   └── {判断待ちタスク}
    └── done-today [folder]
        └── {今日完了したタスク}
```

操作:
- タスク完了 → `doing` から `done-today` にノードを移動
- 新タスク着手 → `ready` から `doing` に移動
- ブロック発生 → `doing` から `blocked` に移動
- 新タスク発見 → `ready` に追加（優先度を attributes.priority に記載）

`done-today` は翌日の初回 tick で空にする（日記ドキュメントに永続化済みのため）。

更新方法:
1. `GET /api/docs/rapid-main` で state 取得
2. `dev M3E` 配下のノードを操作
3. `POST /api/docs/rapid-main` で書き戻す

サーバー未起動時は `docs/daily/{YYMMDD}.md` にのみ記録し、次回起動時にマップ反映する。

### Step 3: Decision Pool 更新（判断があった場合のみ）

`docs/06_Operations/Decision_Pool.md` に追記:

```markdown
---
- Date: {YYYY-MM-DD}
- Topic: {判断の対象}
- Status: working-agreement
- Decision: {決定内容}
- Why: {理由}
- Next: {次のアクション}
- Source: devM3E session
- Promoted: -
```

### Step 4: Todo Pool 更新（バックログ追加時のみ）

`docs/06_Operations/Todo_Pool.md` への追記は **pooled（未整理）** と **blocked（判断待ち）** のみ。
doing / ready の管理はマップで行い、Todo_Pool.md には書かない。

### Step 5: Current Status 更新（統合ロール時のみ）

roleが `claude`（統合ロール）の場合のみ `docs/00_Home/Current_Status.md` を更新する。
codex1/codex2 ロールでは **読み取り専用** として扱う。

## 制約

- 設計文書の本文は日本語で記述する
- 技術トークン（型名、API名、コマンド名）は英語のまま
- 既存の記述を上書きで消さない（状態更新で残す）
- 1つの内容を複数箇所に重複詳述しない
- **揮発タスクの正本はマップ。Todo_Pool.md にはバックログのみ**
- **作業日記の正本は M3E ドキュメント。md ファイルは git バックアップ**
