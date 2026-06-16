# Documentation Rules

最終更新: 2026-06-14

## Language Policy

- 会話は英語を基本とする
- 設計・仕様・アーキテクチャ・ADR を含む `docs/` 配下の開発ドキュメント本文は日本語を基本とする
- コード識別子、ファイル名、API 名、型名、コマンド名などの技術トークンは英語のままでよい
- 会話が英語でも、設計判断を残す文書は日本語で記述する

## 目的

開発中の会話、試行、決定を散らさず保存し、あとで読んだときに「何が決まっていて、何がまだ決まっていないか」がすぐ分かる状態を保つ。

## 現在の運用スコープ

1. `Current_Status.md` は「今後数日の Strategy 断面」のみ保持する
2. 粗い TODO は `docs/06_Operations/Todo_Pool.md` にプールする
3. 日次ログ (`docs/daily/YYMMDD.md`) は必須更新対象から外す
4. 役割分担:
   - Claude Director: intent 分解、Codex handoff、worktree / PR 管理、レビュー、必要時の `Current_Status.md` 更新
   - Codex worker: 実装、仕様書き、調査、検証、必要な map / task 状態更新
5. 作業領域は Codex task worktree で分離し、同一ファイルの同時編集を避ける

Claude sub-agent worker (`manage` / `visual` / `data` / `team`) は廃止済み。

## セッション開始ゲート

セッション開始時に 1 回だけ context gate を実行する。

```bash
pwd
git status --short --branch
git branch --show-current
sed -n '1,220p' docs/00_Home/Agent_Brief.md
sed -n '1,220p' docs/00_Home/Current_Status.md
sed -n '1,220p' docs/00_Home/Glossary.md
```

Claude Director は加えて次を読む:

- `CLAUDE.md`
- `docs/06_Operations/Director_Playbook.md`

毎ステップで全ルールを再確認する運用はしない。開始時ゲート後は軽量チェックで継続する。

## Worktree Gate

Code-writing Codex tasks use:

- path: `$HOME/dev/M3E-<task>`
- branch: `codex/<task>`
- base: `dev-beta`
- helper: `scripts/ops/worktree.sh`

Before implementation dispatch:

```bash
git worktree list --porcelain
git branch --show-current
pwd
```

Primary checkout `$HOME/dev/M3E` is for Director coordination and operating-document maintenance. Product implementation happens in task worktrees.

## 仕様・設計フェーズでのテスト計画（MUST）

機能仕様 / 設計書を書く時点で**テスト計画も併記する**。実装に入ってからテストを考え始めない。

- `03_Spec/` の各 spec に「テスト観点」セクションを持つ
- 最低限: 正常系 / 境界 / 失敗系 の 3 観点を明示
- テストが不明瞭なまま実装タスクに分解しない。曖昧なら `reviews/Qn` 起票
- 実装完了 = テスト pass を含む（単体テスト・必要なら E2E）

## 基本原則

1. 会話で出た重要事項は、まず `06_Operations/Decision_Pool.md` に書く
2. 正式に採択した内容だけを `Spec` `Architecture` `ADR` に昇格させる
3. 仮決め、保留、検証待ちは正式文書に直接書き込まない
4. 1つの内容を複数箇所に重複して詳述しない
5. 正式文書へ反映したら、`Decision_Pool.md` に反映先を追記する
6. コミットメッセージ形式は `Commit_Message_Rules.md` に従う

## どこに何を書くか

### まず `Decision_Pool.md` に書くもの

- 会話中に決まった実装方針
- 比較して候補を絞った結果
- まだ確定ではないが、当面その前提で進める判断
- 保留事項、未解決事項、確認待ち
- ADR 化や Spec 化が必要な気付き

### 直接正式文書に書いてよいもの

- 既存方針と矛盾せず、内容の置き場所が明確な軽微な補足
- 明確に確定した仕様の追記
- 既存 ADR の決定に対する補足説明

### ADR にするもの

- 今後の実装や設計を継続的に縛る判断
- トレードオフがあり、採用理由を残す価値が高い判断
- 代替案を捨てた記録が必要な判断

## `Decision_Pool.md` の記法

各項目は次の形にそろえる。

- Date
- Topic
- Status
- Decision
- Why
- Next
- Source
- Promoted

`Status` は次のいずれかを使う。

- `proposed`
- `working-agreement`
- `accepted`
- `blocked`
- `superseded`

`Promoted` には、正式文書へ反映した先のパスを書く。未反映なら `-` にする。

## 更新完了の定義

M3E では、次を満たした時点を「更新完了」とする。

1. コードまたは文書の変更がコミットされている
2. code-writing Codex task では PR が `dev-beta` に作成されている
3. マップ (`DEV/strategy/` など) が現状を反映している（task が coordination state に影響する場合）
4. Claude Director は必要に応じて `00_Home/Current_Status.md` を更新する

この条件のうち必要項目が未実施なら、作業は「進行中」として扱う。

## ブランチ運用

- 新規作業ブランチは `codex/<task>` とする
- `codex/*` では、Codex は handoff scope 内で `add` / `commit` / `push` / PR 作成を実行してよい
- ただし次は明示確認が必要:
  - 履歴破壊操作 (`reset --hard`, 強制 push, 履歴書き換え)
  - `main` / release ブランチへの直接操作
  - 機密情報に関わる操作

## 統合フロー

1. Claude Director が task worktree と `codex/<task>` branch を用意する
2. Claude Director が Codex を dispatch する
3. Codex が変更・検証・commit・push・PR 作成を行う
4. Claude Director が PR を確認して `dev-beta` への merge / iterate / escalate を判断する
5. merge 後、Claude Director が task worktree を削除する

## 軽い担当ルール

- 会話で決まったことを反映する人が `Decision_Pool.md` を更新する
- 正式文書へ昇格した人が `Promoted` を埋める
- `Current_Status.md` には active な `S*`、Strategy 単位の progress / blocked / next だけを書く
- `Current_Status.md` に `P*`, `V*`, 具体 task, handoff 詳細を書かない
- 更新完了を宣言する人は、上記「更新完了の定義」を満たしていることを確認する

## 今の M3E での使い分け

- `SVG で先に作る` のような作業方針は、まず `Decision_Pool.md`
- `描画レイヤーはレイアウトと分離する` のような構造ルールは、固まったら `04_Architecture`
- `Freeplane first` のような大きな設計判断は `ADR`
