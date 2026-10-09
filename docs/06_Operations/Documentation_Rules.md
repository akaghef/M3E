# Documentation Rules

最終更新: 2026-06-27

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
   - Claude Director: intent 分解、Codex handoff、worktree 管理と本流への反映、レビュー、必要時の `Current_Status.md` 更新
   - Codex worker: 実装、仕様書き、調査、検証、必要な map / task 状態更新
5. 実装・既存文書・共有正典への競合可能な書き込みはCodex task worktreeで分離する。`docs/ideas/`への一意な新規append-only bundleは、既存本文を変更せず親READMEと生成indexだけを更新する場合、primary checkoutへ直接stowしてよい

Claude sub-agent worker (`manage` / `visual` / `data` / `team`) は廃止済み。

## LLM Wiki 型の文書整理

`docs/` 全体は [LLM_Wiki_Schema.md](./LLM_Wiki_Schema.md) に従って、次の 3 layer として扱う。

1. Source Layer: `ideas/`, `research/`, `daily/`, `for-akaghef/`, `legacy/`, `competitive_research/`
2. Canonical Layer: `00_Home/`, `01_Vision/`, `03_Spec/`, `04_Architecture/`, `06_Operations/`, `09_Decisions/`
3. Navigation Layer: `index.md`, `log.md`, `_generated/`

整理は原則として非破壊に行う。既存文書を一括移動・削除・リネームせず、まず `docs/index.md` と `docs/log.md` で横断性を作る。索引 coverage は次で確認する。

```bash
node scripts/ops/check-docs-index.mjs --check
```

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

- path: `$HOME/dev/M3E-worktrees/<task>`
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

### Append-only idea stow

新しい外部サービス調査、比較、未採用idea、evidence bundleは、配置先が明確で既存ファイルを競合編集しない場合、`docs/ideas/`配下へ直接追加できる。worktreeを必須にするのは書き込み一般ではなく、実装、既存内容の上書き・再編、共有正典への昇格、または同時編集競合の可能性である。

直接stow時も以下は必須:

- primary checkoutのbranch / dirty state確認
- unique targetとoverwrite不在の確認
- public-safe確認
- 親READMEの最小リンク追加
- `node scripts/ops/check-docs-index.mjs --write` と `--check`
- `git diff --check`

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

## 更新完了の定義・ブランチ運用・統合

[Worktree Separation Rules](Worktree_Separation_Rules.md) を正本とする。
担当 AI が検証、commit、本流 dev-beta への統合、push、必要な通常 Beta 反映と対象操作の確認まで担当する。PR は任意。文書・指示変更は正本とミラーの整合検証を行い、稼働反映は対象外にできる。
coordination に影響する task/map 状態は更新し、戦略が変わる時だけ Current_Status を更新する。他者の未コミット作業をまとめて commit しない。途中段階は進行中として報告する。

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
