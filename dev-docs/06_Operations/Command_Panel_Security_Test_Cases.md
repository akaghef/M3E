# Command Panel Security Test Cases

## 目的

`Command_Language.md` の Security Model 受け入れ条件を、実装前から検証可能なテストケースとして固定する。

## 対象

- 将来実装される Command Panel 実行系
- ブラウザコンソール実行系は対象外（現時点の機能外）

## 判定ルール

- `PASS`: 実行が許可され、期待結果を返す
- `REJECT`: 実行前に拒否される（fail-closed）
- `ABORT`: 実行中に安全装置で停止する

## MUST 受け入れケース

### CP-SEC-001: `window` 参照の拒否

- Input:
  - `window.location.href`
- Expected:
  - `REJECT`
  - エラー種別: `ForbiddenGlobalAccess`

### CP-SEC-002: `document` 参照の拒否

- Input:
  - `document.cookie`
- Expected:
  - `REJECT`
  - エラー種別: `ForbiddenGlobalAccess`

### CP-SEC-003: `fetch` 呼び出しの拒否

- Input:
  - `fetch("https://example.com")`
- Expected:
  - `REJECT`
  - エラー種別: `NetworkAccessDenied`

### CP-SEC-004: `Function` 経由実行の拒否

- Input:
  - `Function("return m3e.root")()`
- Expected:
  - `REJECT`
  - エラー種別: `DynamicCodeExecutionDenied`

### CP-SEC-005: `eval` 文字列実行の拒否

- Input:
  - `eval("m3e.add(m3e.root, 'x')")`
- Expected:
  - `REJECT`
  - エラー種別: `DynamicCodeExecutionDenied`

### CP-SEC-006: 非許可 API 呼び出しの拒否

- Input:
  - `m3e.__internalDebugDump()`
- Expected:
  - `REJECT`
  - エラー種別: `ForbiddenApiCall`

### CP-SEC-007: 許可 API の実行（読み取り）

- Input:
  - `m3e.tree()`
- Expected:
  - `PASS`
  - 監査ログに `api=tree`, `result=success` が記録される

### CP-SEC-008: 許可 API の実行（書き込み、承認必須）

- Input:
  - `m3e.add(m3e.root, "新規ノード")`
- Expected:
  - 承認前: `REJECT` ではなく `PendingApproval`
  - 承認後: `PASS`
  - 監査ログに `api=add`, `targetCount=1` が記録される

### CP-SEC-009: 失敗時 fail-closed

- Input:
  - AST 解析不能な入力（例: `m3e.add(`）
- Expected:
  - `REJECT`
  - 変更件数が 0 のまま

### CP-SEC-010: 入力全文の既定非保存

- Precondition:
  - 監査ログ設定はデフォルト
- Input:
  - `m3e.findAll("仮説")`
- Expected:
  - ログには API 名、対象件数、結果のみ保存
  - 生入力文字列は保存されない

## SHOULD ケース（推奨）

### CP-SEC-101: 実行時間上限

- Input:
  - 長時間ループを含む入力
- Expected:
  - `ABORT`
  - エラー種別: `ExecutionTimeLimitExceeded`

### CP-SEC-102: 変更件数上限

- Input:
  - `replaceAll` で大規模更新
- Expected:
  - 上限超過時は `PendingApproval` または `ABORT`

## 実装メモ

- 受け入れテストは Unit（AST 検証） + Integration（コマンド実行境界）で分離する。
- エラー種別は UI 表示文言と分け、機械判定可能なコード値を持つ。
- CI では最低限 `CP-SEC-001` から `CP-SEC-010` を必須化する。

## 関連

- `../03_Spec/Command_Language.md` Security Model
- `./Test_and_CICD_Guide.md`
