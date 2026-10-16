# M3E plugin for Claude Code

Claude Code（デスクトップの Code タブと CLI）から M3E MCP を使うためのパッケージ。
MCP サーバーとフックの実体は `plugins/m3e/scripts/`（Codex 版と共通）で、ここには
Claude Code 用の manifest・フック定義・起動口（`scripts/run.mjs`）だけを置く。

Claude Code はプラグインをキャッシュへ複製するため、`run.mjs` は
`M3E_HOME/mcp-client.json` の `repoRoot`（または `M3E_REPO_ROOT`）にある
`plugins/m3e/scripts/` を実行する。Codex 版の `hooks/hooks.json` は Codex の信頼
済み定義なので変更しない。

## 導入

前提：通常 Beta が起動済みで、`scripts/mcp/configure-plugin.mjs` による接続設定が
あること（Codex 版と共通）。

```sh
claude plugin marketplace add /path/to/M3E
claude plugin install m3e@m3e-local
```

Claude Code 側のマーケットプレイス定義はリポジトリ直下の `.claude-plugin/marketplace.json`。
Codex は `.agents/plugins/marketplace.json` を先に読むため影響しない。

## ホスト差

| 項目 | Codex | Claude Code |
| --- | --- | --- |
| manifest | `plugins/m3e/.codex-plugin/plugin.json` | `plugins/m3e-claude/.claude-plugin/plugin.json` |
| ツール名 | `mcp__m3e__m3e_create` など | `mcp__plugin_m3e_m3e__m3e_create` など |
| フックの変数 | `${PLUGIN_ROOT}` | `${CLAUDE_PLUGIN_ROOT}` |
| PostToolUse の結果 | `tool_response.structuredContent` | `tool_response` が JSON 文字列（`hook.mjs` が両方を読む） |

`-p`（非対話）実行は 1 回ごとに `SessionEnd` が走り、参加中の Context を離脱する。
`--resume` で再開した -p 実行は前回の Context を引き継がない。
