# Phase resume — セッション再開プロトコル（固定）

**このファイルは hook から強制的に読まれる。Manager は判断せずこの手順に従え。**

SessionStart hook / PostCompact hook は additionalContext で
「`.claude/skills/sub-pj/phase/resume.md` に従って再開しろ」を注入する。
Manager はその指示を受けたら、**以下 5 ステップを順番に実行する。分岐・判断は禁止**。

---

## Step 1 — 自 PJ の特定

1. `git branch --show-current` で現ブランチを取得
2. ブランチが `prj/{NN}_{Name}` 形式なら PJ ディレクトリは `projects/PJ{NN}_{Name}/`
3. 形式外なら **stop してユーザーに聞け**（これは E2 環境崩壊扱い）

## Step 2 — resume-cheatsheet.md を読む

`projects/PJ{NN}_{Name}/resume-cheatsheet.md` を Read。
このファイルは 30 行以内の 1 画面要約で、以下を含む:
- 現在 Phase
- 次 task ID
- open reviews 数
- 最新コミット hash
- Agent Status
- 「前セッションの最後にやったこと」1 行

ファイルが無い場合: PJ02 初期状態。Step 4 に飛べ（tasks.yaml から取得）。

## Step 3 — Progress Board 確認（map 起動中のみ）

M3E map サーバが起動していれば、PJ の `Progress Board` scope を読んで
Phase marker と Agent Status が resume-cheatsheet.md と一致するか確認する。

不一致があれば resume-cheatsheet.md を正として Progress Board を更新。
map サーバが起動していない場合: スキップ（resume-cheatsheet.md を正とする）。

## Step 4 — 次 task を決定

`projects/PJ{NN}_{Name}/tasks.yaml` を読み、以下の優先順で 1 件選ぶ:

1. `status: in_progress` のエントリ（前セッションで中断したもの） → これを再開
2. 無ければ `status: pending` の先頭（phase 昇順 → id 昇順）
3. すべて done なら **E1 Phase gate 到達**。ユーザーに「次 Phase 遷移しますか」と報告して stop

## Step 5 — open reviews のチェック

`projects/PJ{NN}_{Name}/reviews/` 配下の `Qn_*.md` で
`blocker_for: T-{task id}` が付いているものを探す。

該当する open review があれば:
- **Manager 自身が答えを決めて review にマーク**（tentative default 方式、`escalation.md` §A 参照）
- ユーザーに答えを聞くな。pool した時点で default は決まっている

該当なし、または review 処理完了したら Step 6 へ。

## Step 6 — 実行開始

`2_session.md` の **決定論的ループ** に入る。
`tasks.yaml` のエントリを Generator / Evaluator または自前実行で回す。

**止まっていいのは escalation.md の E1 / E2 / E3 のみ**。それ以外は pool して続行。

---

## 出力フォーマット（Step 1-5 完了時点で 1 回だけ emit）

```
## {PJ ID} — Session Resumed

**Phase**: {N} / **次 task**: {T-N-M} ({verb} {target})
**Open reviews**: {K} 件（処理済 / blocker なし）
**Agent Status**: working に遷移

→ 2_session.md ループに入る。
```

**この出力 1 回のみ**。以降はループに入り、task 消化の都度出力する（2_session.md §出力 参照）。

---

## 参照

- 止める判断: `escalation.md`（E1/E2/E3 のみ）
- ループ本体: `2_session.md`
- Generator 委譲: `generator.md`
- Evaluator 委譲: `evaluator.md`
- Task 仕様: `../protocol.md` §6.5
