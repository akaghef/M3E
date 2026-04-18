# Phase 0: Kickoff

PJ の正式立ち上げを **1-shot skeleton** で終わらせる。
探索ループの前に、実行に必要な骨格ファイルまで一括で作る。

## Core Terms

- `sprint contract`: `tasks.yaml` の 1 task。`done_when` / `eval_criteria` を持つ
- `Generator`: 実装・詳細化役
- `Evaluator`: 独立検証役

## 途中参入の判定

最初に以下を確認し、すでに生成済みなら `phase/1_planning.md` に送れ:

- README と plan.md が存在する
- PJ ディレクトリがある
- ブランチが `prj/{NN}_{Name}` に切られている

## 手順

### 1. 採番

`backlog/meta-subpj-candidates.md` の PJ 表を読み、次の空き番号を決めろ。

### 2. ビジョン凝縮

ユーザーに一度だけ聞く:

```
PJ{NN} を立ち上げます。以下を一度にください:

1. 何が痛いか
2. 完了像
3. 明示的な範囲外
```

必要なら 1 回だけ言い換え確認してよい。長い対話ループに入るな。

### 3. 生成物を一括作成

以下を同一セッションで作れ。

- `projects/PJ{NN}_{Name}/README.md`
- `projects/PJ{NN}_{Name}/plan.md`
- `projects/PJ{NN}_{Name}/tasks.yaml`
- `projects/PJ{NN}_{Name}/resume-cheatsheet.md`
- `projects/PJ{NN}_{Name}/reviews/Qn_initial.md`
- `projects/PJ{NN}_{Name}/runtime/README.md`
- `projects/PJ{NN}_{Name}/retrospective.md`

#### README.md

- Vision（問題 / 完了像 / In/Out）
- 主成果物
- メタ情報
- ドキュメント構成
- 役割分担
- 運用ルール要点
- Future Work
- 進捗ログ

役割分担には必ず:
- `Phase 遷移判定 = 人間が◎、Claude は×`
- `human outer loop / autonomous inner loop`

を含めろ。

#### plan.md

- `status: exploring`
- TL;DR
- ゴールと成功基準
- スコープ
- 探索ログ
- Phase 設計
- 実行計画
- 進捗ログ

#### tasks.yaml

最初の 3-6 task を sprint contract として切れ。
各 task は最低限:

- `id`
- `phase`
- `verb`
- `target`
- `done_when`
- `eval_required`
- `eval_criteria`
- `status`
- `round`
- `round_max`

を持て。

#### resume-cheatsheet.md

30 行以内で:
- 現在 Phase
- 次 task
- open reviews 数
- 最新コミット
- Agent Status
- 前セッションの最後にやったこと

を入れろ。

#### reviews/Qn_initial.md

初期の未決論点があるなら 1 件だけ作れ。
完全に明確なら不要だが、その場合でも `reviews/` ディレクトリは作る。

#### runtime/README.md

runtime を使う前提で:
- Progress Board
- Evaluation Board
- Review
- Active Workspace

の役割を書く。使わない場合のみ `runtime_opt_out` を README / plan.md 両方に書け。

#### retrospective.md

少なくとも以下の節を置け:
- 何がうまくいったか
- 何が詰まったか
- Evaluator が見逃したバグ
- 次 PJ へ持ち越す harness 改善

### 4. ブランチ作成

```bash
git checkout -b prj/{NN}_{Name} dev-beta
```

### 5. 登録

`backlog/meta-subpj-candidates.md` の PJ 表に新行を追加しろ。

### 6. 報告

以下を出力しろ:

```
PJ{NN}_{Name} を立ち上げました。

生成物:
- README.md
- plan.md
- tasks.yaml
- resume-cheatsheet.md
- runtime/README.md

→ 次は /sub-pj plan で Gate 1 / Gate 2 を詰めます。
```
