# Hook Wiring — SessionStart / PostCompact / workflow_reducer 接続

- **status**: authoritative (T-2-3)
- **phase**: 2
- **referenced by**: legacy_asset_mapping.md（PostCompact/SessionStart hook の checkpoint role を更新）

## 配線構成

| hook | script | 追加動作 (T-2-3) |
|---|---|---|
| SessionStart | `scripts/hooks/session-start.sh` | reducer が build 済み + checkpoints/ 存在時、`workflow_cli --resume` を実行して additionalContext に embed |
| PostCompact | `scripts/hooks/post-compact.sh` | 同上（compaction 直後も checkpoint JSON から state dump） |
| UserPromptSubmit | `scripts/hooks/prompt-prj-check.sh` | prj/* branch 上での sub-pj-guard。既存、T-2-3 で変更なし |
| Stop | `scripts/hooks/stop-check.sh` | stop 前の writeback check。既存、T-2-3 で変更なし |

## 出力形式

SessionStart / PostCompact の additionalContext は次の 2 ブロック:

```
[sub-pj-resume] You are on prj/NN_Name. Follow .claude/skills/sub-pj/phase/resume.md ...

[workflow_reducer checkpoint]
RESUME: T-X-Y state=<kind> round=<n>/<max>
  last_feedback: <text | (none)>
  blocker: <text | (none)>
  escalation_kind: <E1/E2/E3 | (none)>
  wakeup_at: <ISO | (none)>
  expected next signal class: <signal hints>
```

compaction 後もこの 2 ブロックが復元されるので、Manager は instruction + checkpoint data の両方を一度に受け取る。

## silent fallback 方針

akaghef 指示「hook 失敗時に silent fallback せず明示 Error」。本実装では以下の分岐:

- `beta/dist/node/workflow_cli.js` が存在しない → `reducer_summary` 空のまま（build 未実行の正常ケース、failure ではない）
- `runtime/checkpoints/` が存在しない → 同上（新規 PJ で checkpoint 未生成の正常ケース）
- workflow_cli 実行が非 0 exit → エラーメッセージを additionalContext に embed（silent に消さない）

前 2 つは「意図された non-error path」（build しない PJ・checkpoint 不要 PJ を想定）。
最後の 1 つが hook 失敗で、そのときは `[workflow_cli --resume failed; fall back to manual resume]` 文字列が
context に入るので Manager が失敗を確実に検知する。

## narrative 保護

resume-cheatsheet.md は `<!-- runner-managed:begin -->...<!-- runner-managed:end -->` で囲われた block と、
その外の narrative section を持つ。hook は cheatsheet を直接書き換えない（regenerateCheatsheet は reducer 経由のみ）。
従って hook 実行で narrative が破壊されることはない。

## settings.json

`.claude/settings.local.json` に既配線済。T-2-3 で script 内容を更新したのみで、
hooks エントリの追加は不要。

```json
{
  "hooks": {
    "SessionStart": [{"matcher": "auto", "hooks": [{"type": "command", "command": "bash scripts/hooks/session-start.sh"}]}],
    "PostCompact":  [{"matcher": "auto", "hooks": [{"type": "command", "command": "bash scripts/hooks/post-compact.sh"}]}]
  }
}
```

## 動作確認

SessionStart hook を手動で起動し、additionalContext を dump:

```bash
bash scripts/hooks/session-start.sh | python -c "import json,sys; print(json.load(sys.stdin)['hookSpecificOutput']['additionalContext'])"
```

T-2-3 時点の smoke-test 結果: T-2-3 自身が in_progress 状態のときに script 実行、`RESUME: T-2-3 state=in_progress round=0/3` 含む 2 ブロックが正しく additionalContext に注入されることを確認。

## cross-reference

- `beta/src/node/workflow_cli.ts`: `--resume` 実装（reducer の pickNextTask + loadCheckpointState を使う）
- `projects/PJ03_SelfDrive/docs/resume_protocol.md`: resume protocol の全体像
- `projects/PJ03_SelfDrive/docs/reducer_responsibility.md`: reducer / orchestrator / daemon / CLI のレイヤ分離
