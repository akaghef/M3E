# Architecture Index

M3Eアーキテクチャ文書への索引。必要な判断のタイプに応じて該当文書を読む。

## 文書一覧

| 文書 | パス | 読むタイミング |
|------|------|--------------|
| MVC & Command | `dev-docs/04_Architecture/MVC_and_Command.md` | Model/View/Controller の責務境界やCommand パターンに関わる変更 |
| AI Infrastructure | `dev-docs/04_Architecture/AI_Infrastructure.md` | LLM連携、サブエージェント、Gateway設計 |
| Worktree Separation | `dev-docs/00_Home/Worktree_Separation_Rules.md` | ブランチ・worktree 運用の確認 |

## 主要パターン

### MVC + Command
- Model: `PersistedDocument`（immutable, versioned）
- ViewState: selection, viewport, current scope（ephemeral）
- Controller: input → Command
- Command: 変更操作（undo/redo対応必須）
- View: React UI + SVG レンダリングレイヤー

### AI連携
- Phase 1（現在）: 直接API呼び出し
- Phase 2（計画）: LiteLLM Gateway
- 原則: AI proposes, human confirms（自動書き込み禁止）
- スコープ境界: scopeId サブツリーのみをLLMに送信
