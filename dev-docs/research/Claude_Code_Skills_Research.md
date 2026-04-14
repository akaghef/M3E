# Claude Code Skills & Subagents — M3E 適用調査

**Author**: team agent (research branch `research/claude-code-skills`)
**Date**: 2026-04-14
**Status**: research only — Red Team ロールの実装は行わない。最終判断は akaghef。
**Deliverable scope**: Skills システム把握 → M3E 現状との差分 → Red Team サブエージェント設計案 → 推奨アクション。

---

## 1. Claude Code Skills システム概観

### 1.1 ファイルレイアウト

```
.claude/skills/
└── <skill-name>/
    ├── SKILL.md           # YAML frontmatter + 本文（コアプロンプト）
    ├── references/        # 参照用 md（必要時に Claude が読み込む）
    ├── scripts/           # 実行可能スクリプト（python/bash 等）
    └── agents/            # スキルが使うサブエージェント定義（optional）
```

公式文書 ([code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills), [platform.claude.com/docs/en/agents-and-tools/agent-skills/overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)) によると、Skills は「ファイルシステムベースのプラガブル命令バンドル」で、以下3要素で構成する:

1. **SKILL.md** — コア指示。必須。
2. **references/** — 参照ドキュメント。SKILL.md から言及された時点で初めて読まれる。
3. **scripts/** — 実行コード。Bash/Python 等。

### 1.2 Frontmatter スキーマ

SKILL.md 先頭の `---` で囲まれた YAML。主要フィールド:

| key | 必須 | 説明 |
|-----|-----|-----|
| `name` | yes | スキル識別子（ディレクトリ名と一致推奨） |
| `description` | yes | トリガー判定に使われる短文。「When to trigger」を列挙 |
| `allowed-tools` | no | このスキルが使えるツールを絞る（セキュリティ境界） |
| `disable-model-invocation` | no | モデルからの自動呼び出しを禁止（手動 `/skill` のみ） |

参考: [Skill authoring best practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)。

### 1.3 Progressive Disclosure（段階的開示）

- 起動時には**フロントマターのみ**（name + description）が context に載る。
- Claude が「このスキルが該当する」と判定して初めて SKILL.md 本文全体がロードされる。
- さらに references/*.md は SKILL.md 内で言及された場合のみ読まれる。
- ベストプラクティス: **SKILL.md 本文は 500 行以下**。超える場合は references/ に分割する。

### 1.4 起動（Discovery & Trigger）

- `.claude/skills/*/SKILL.md` が自動スキャンされ、description がトリガー候補として LLM に提示される。
- ユーザ発話が description の「トリガー文言」と意味的に一致すると自動起動。
- `/skill-name` で明示起動も可能。
- GitHub Issue [#14882](https://github.com/anthropics/claude-code/issues/14882) にあるように、実装によってはフロントマター以外もロードされるケースが報告されているので、**本文の簡潔さ**は現実的にも効果がある。

---

## 2. M3E 現行スキルの棚卸しと評価

`.claude/skills/` 配下の現行スキル（22件）を frontmatter 品質・トリガー明瞭性・reference 活用・disclosure 最適性で評価する。

### 2.1 構造品質マトリクス

| Skill | frontmatter | trigger clarity | references/ | scripts/ | 備考 |
|-------|:-:|:-:|:-:|:-:|-----|
| `devM3E` | Good | A | ✅ 3件 | ✅ | `agents/` も持ち M3E 内で最も完成度が高い |
| `m3e-map` | Good | A | ✅ | — | description が英語・用途明確 |
| `setrole` | Good | A | — | — | 本文 160 行、references なしで収まっている |
| `canvas-protocol` | Good | A | — | — | reviews/Qn フォーマットの一次参照 |
| `intensive-develop` | Good | B | — | — | on/off トグル文言まで列挙していて良 |
| `pr-beta` / `pr-review` | Good | A | — | — | 対になる命名で discoverable |
| `launch-beta` / `launch-final` | Good | A | — | — | 軽量で disclosure 的に理想 |
| `m3e-scratch` / `tomd` | Good | A | — | — | 「メモ」「backlog」等の口語トリガーを網羅 |
| `beta-converse` / `majorupdate` | Good | B | — | — | 危険操作を含むが `allowed-tools` 絞りなし |
| `m3e-shortcuts` | Good | B | — | — | viewer.ts の keydown 変更が必要 |
| `map-update` | Good | B | — | — | 内容が `m3e-map` とやや重複（統合検討余地） |

凡例: Aクラス = トリガー句を複数列挙しており自動起動しやすい / Bクラス = 英語/日本語混在で若干曖昧。

### 2.2 強み

- **description に具体的なトリガー文言を列挙**するスタイルが全体に徹底されている（ベストプラクティス適合）。
- 日本語口語トリガー（「収束」「プールして」「メモっといて」）が自然言語判定で効くよう工夫されている。
- `devM3E` が `agents/` + `references/` + `scripts/` の3要素をフル活用しており、以降のスキル設計のリファレンスになる。

### 2.3 改善余地

1. **`allowed-tools` が未活用**。`beta-converse`, `majorupdate`, `launch-*` のような破壊的/昇格系は `Bash` 以外を絞る or `disable-model-invocation: true` で手動起動限定にすべき（誤発火リスク）。
2. **`references/` の活用が devM3E と m3e-map のみ**。例えば `pr-beta` は手順長めなのでチェックリストを references/ に分けると本文が軽量化する。
3. **`map-update` と `m3e-map` の境界**が文書上曖昧。map-update を m3e-map/references/ に吸収する整理が可能。
4. **英語/日本語の混在**。`m3e-map` は英語、他は日本語。多言語トリガーを維持するなら description に両言語のキーワードを入れる統一ルールがあると良い。
5. **`scripts/` の活用がほぼゼロ**。例: `pr-beta` の `gh pr create` テンプレを `scripts/create_pr.sh` 化するとスキル本文がスリム化する。

---

## 3. サブエージェント（`.claude/agents/*.md`）レビュー

### 3.1 現状

`.claude/agents/` には `visual.md` / `data.md` / `team.md` の 3 件。frontmatter は:

```yaml
---
name: team
description: Collaboration・Cloud Sync担当エージェント。collab.ts, cloud_sync.ts を中心に作業する。
isolation: worktree
---
```

共通構造: Bootstrap → Role テーブル → Task Discovery → Work Loop → Completion → Communication → Constraints。

### 3.2 Claude Code サブエージェント仕様との対応

公式 ([code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents), [docs.claude.com/en/docs/agent-sdk/subagents](https://docs.claude.com/en/docs/agent-sdk/subagents)) によるフロントマター利用可能フィールド:

`description`, `prompt`, `tools`, `disallowedTools`, `model`, `permissionMode`, `mcpServers`, `hooks`, `maxTurns`, `skills`, `initialPrompt`, `memory`, `effort`, `background`, `isolation`, `color`

M3E の現状は `name` / `description` / `isolation` のみ使用。**`tools` / `disallowedTools` / `permissionMode` が未設定**であり、全サブエージェントがフルツールセットで動いている。セキュリティ監査系エージェントには特にツール制限が重要。

### 3.3 新ロール追加のコンベンション（実行ガイド）

1. `.claude/agents/<role>.md` を作成（frontmatter + ロール本文）。
2. `.claude/skills/setrole/SKILL.md` のロールテーブル・マッピング表に追記。
3. ブランチ命名 `dev-<role>` を原則とし、`dev-beta` を親にする。
4. `AGENTS.md` / `dev-docs/00_Home/Worktree_Separation_Rules.md` にスコープを追記。
5. 既存 agent ファイルと同じ章立て（Bootstrap/Role/Task/Work Loop/Completion/Communication/Constraints）を踏襲。

---

## 4. Red Team ロール設計案（提案 — 未実装）

### 4.1 目的

Evolution Plan Day4 のセキュリティレビュー（CSRF / LAN 露出 / エージェント偽装 / 入力バリデーション / 公開 URL / Supabase RLS / API キー流出）を、レビュー専任のサブエージェントに切り出す。開発ロール（visual/data/team）が feature 実装に集中できるようにする。

### 4.2 スコープ

| 領域 | 調査内容 | 参照ドキュメント |
|------|---------|----------------|
| CSRF | `start_viewer.ts` のエンドポイント / origin 検証 / SameSite Cookie | `beta/src/node/start_viewer.ts`, `dev-docs/03_Spec/REST_API.md` |
| LAN 露出 | listen アドレス（0.0.0.0 vs 127.0.0.1）、ファイアウォール前提 | `beta/src/node/start_viewer.ts`, worktree 運用 |
| エージェント偽装 | collab の scope push における署名・トークン検証 | `beta/src/node/collab.ts`, `dev-docs/03_Spec/Team_Collaboration.md` |
| 入力バリデーション | REST API の body 検証、Command Panel 入力 | `dev-docs/06_Operations/Command_Panel_Security_Test_Cases.md` (CP-SEC-001〜) |
| 公開 URL | Cloud Sync / Share URL トークン強度、有効期限 | `beta/src/node/cloud_sync.ts` |
| Supabase RLS | `dev-docs/03_Spec/supabase_schema.sql` の policy 網羅性 | supabase_schema.sql |
| API キー流出 | `.env` / リポジトリ履歴 / ログ出力 / エラーメッセージ | `dev-docs/for-akaghef/db_tasks_checklist.md` |

### 4.3 ツール制限案（`tools` / `disallowedTools`）

read-only audit 前提で以下を推奨:

```yaml
tools: [Read, Grep, Glob, Bash, WebSearch]
disallowedTools: [Write, Edit, NotebookEdit]
```

Bash は `git`, `gh`, `npm audit`, `grep`, `curl` の read 系のみに限定したいが Claude Code 側では粒度制限不能。本文で**明示的に「Write/Edit 禁止、commit 禁止、設定変更禁止」を宣言**する。PR で fix 提案する方針（Q2 で決定）なら Write/Edit 許可に切り替え、ブランチ `dev-red` に限定する。

### 4.4 frontmatter 案

```yaml
---
name: red
description: |
  セキュリティ監査専任エージェント。CSRF、LAN露出、エージェント偽装、入力バリデーション、
  公開URL、Supabase RLS、APIキー流出経路を read-only で監査し、findings をレポートする。
  以下の場面でトリガー:
  - 「/setrole red」「セキュリティ監査」「レッドチーム」「脆弱性レビュー」と言われたとき
  - Day4 Evolution Plan のセキュリティ検討 4件を進めるとき
  - PR に対してセキュリティ観点のレビューが必要なとき
isolation: worktree
tools: [Read, Grep, Glob, Bash, WebSearch]
disallowedTools: [Write, Edit, NotebookEdit]
---
```

### 4.5 必要な reference ドキュメント

- `dev-docs/06_Operations/Command_Panel_Security_Test_Cases.md` （既存・CP-SEC-001〜のテストケース集）
- `dev-docs/03_Spec/supabase_schema.sql` （RLS policy）
- `dev-docs/03_Spec/Team_Collaboration.md` （scope push 設計）
- 新規: `dev-docs/02_Research/Security_Audit_Checklist.md` （Red Team 用チェックリスト — 別タスク）
- 外部: OWASP ASVS / MITRE ATT&CK（必要時 WebSearch）

### 4.6 トリガー条件

1. 明示起動: `/setrole red` or `@red` メンション。
2. PR description に `[security]` タグがある場合の自動レビュー（pr-review スキルから委譲）。
3. `Current_Status.md` の「セキュリティ検討 4 件 blocked」が ready に昇格した時。

### 4.7 成果物フォーマット

```
dev-docs/02_Research/security/
├── audit_<YYMMDD>_<domain>.md   # findings 本体（severity, evidence, repro, suggested fix）
└── summary_<YYMMDD>.md          # 総括 + 優先順位
```

finding は CVSS-lite 3段階（Critical / High / Medium）で rank、各項目に「evidence（ファイル:行）」「repro steps」「suggested fix」を必須とする。

---

## 5. 推奨アクション（3–5 項目）

1. **`.claude/agents/red.md` を作成**（4.4 のテンプレに沿う）。scope を Supabase RLS 単一ドメインに絞った MVP から始める（Q3 の回答次第）。
2. **`security-review` スキルを `.claude/skills/` 配下に追加**。red agent が呼ぶ共通手順（checklist 読み込み、findings 書き出し、severity 判定）をまとめる。references/ に OWASP マッピングを置く。
3. **既存スキルに `allowed-tools` を段階適用**。まず `beta-converse`, `majorupdate`, `launch-final` の3件に `disable-model-invocation: true` を付与し誤発火を防ぐ。
4. **`Command_Panel_Security_Test_Cases.md` を red agent の一次 reference に昇格**。red 起動時に最初に読み込ませるよう SKILL.md に明記。
5. **`map-update` を `m3e-map/references/update_patterns.md` に統合**。スキル数を減らし discovery ノイズを下げる（副次的改善）。

Day4 進行時の最小手順:
- 手順 A: akaghef が下記 Q1–Q3 に回答 → red agent 実装（1 PR）→ Supabase RLS 単一ドメイン audit → findings review → 次ドメイン着手。

---

## 6. 人間判断待ち Qn（tentative options — `selected="yes"` なし）

canvas 上での配置先: `ROOT/SYSTEM/DEV/reviews/Red Team Setup/`

### Q1: Red Team agent のワークツリーブランチ運用

- **option-a**: 常設 `dev-red` ブランチを持つ（他ロールと同じ運用、PR 履歴が溜まる）— *tentative*
- option-b: audit ごとに ad-hoc `audit/<YYMMDD>-<domain>` ブランチを切る（履歴は重くなるが isolation 強い）
- option-c: read-only なら worktree も不要、main/dev-beta から直接実行（ただし setrole の整合性が崩れる）

### Q2: Red Team の自律性レベル

- **option-a**: read-only audit のみ。findings は `dev-docs/02_Research/security/` に書き出すだけで PR は出さない — *tentative*
- option-b: findings と共に最小 fix PR を出せる（ただし security-critical のみ、dev-red ブランチ限定）
- option-c: 他ロールへの SendMessage で fix を委譲する（自分は PR 出さない）

### Q3: 初回 audit のスコープ

- option-a: フルスイープ（CSRF / LAN / 偽装 / バリデーション / 公開URL / RLS / APIキー の7ドメイン一括）
- **option-b**: Supabase RLS 単一ドメインから（最も影響範囲が明確で Todo Pool の blocked 項目に直結）— *tentative*
- option-c: Command Panel セキュリティ（既に test case が整備済み）から

---

## Sources

- [Extend Claude with skills - Claude Code Docs](https://code.claude.com/docs/en/skills)
- [Agent Skills Overview - Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Skill authoring best practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)
- [Create custom subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- [Subagents in the SDK - Claude Docs](https://docs.claude.com/en/docs/agent-sdk/subagents)
- [Claude Agent Skills: A First Principles Deep Dive (Lee Hanchung, 2025-10)](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)
- [Equipping agents for the real world with Agent Skills (Anthropic Engineering)](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [claude-code Issue #14882 — Skills progressive disclosure behavior](https://github.com/anthropics/claude-code/issues/14882)
- 内部: `dev-docs/06_Operations/Command_Panel_Security_Test_Cases.md`, `dev-docs/00_Home/Current_Status.md`, `.claude/agents/{visual,data,team}.md`, `.claude/skills/*/SKILL.md`
