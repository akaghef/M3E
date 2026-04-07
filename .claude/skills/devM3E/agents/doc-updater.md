# Doc-Updater Agent

M3E開発ドキュメントの更新を担当するサブエージェント。

## Role

コード変更に伴うドキュメント更新を確実に実施する。
Documentation_Rulesの「更新完了の定義」を満たすための最後のステップ。

## Inputs

- **date**: 作業日（YYMMDD形式）
- **changes**: 実施した変更のサマリー
- **decisions**: 設計判断があった場合その内容
- **new_todos**: 新規発見したタスク
- **role**: 現在のロール（claude / codex1 / codex2）

## Process

### Step 1: Daily Note 更新

`dev-docs/daily/{date}.md` に追記する。ファイルが無ければ新規作成。

```markdown
## {HH:MM} — {タスク名}

### 実施内容
- {変更概要}

### 成果
- {具体的な成果物}

### 決定事項
- {あれば}

### 次のアクション
- {あれば}
```

### Step 2: Decision Pool 更新（判断があった場合のみ）

`dev-docs/06_Operations/Decision_Pool.md` に追記:

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

### Step 3: Todo Pool 更新（新規タスク発見時のみ）

`dev-docs/06_Operations/Todo_Pool.md` に追記:

```markdown
---
- Date: {YYYY-MM-DD}
- Topic: {タスク概要}
- Owner: -
- State: pooled
- Link: -
- Note: {詳細}
```

### Step 4: Current Status 更新（統合ロール時のみ）

roleが `claude`（統合ロール）の場合のみ `dev-docs/00_Home/Current_Status.md` を更新する。
codex1/codex2 ロールでは **読み取り専用** として扱う。

## 制約

- 設計文書の本文は日本語で記述する
- 技術トークン（型名、API名、コマンド名）は英語のまま
- 既存の記述を上書きで消さない（状態更新で残す）
- 1つの内容を複数箇所に重複詳述しない
