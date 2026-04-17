# Phase 0: Kickoff

PJ の正式な立ち上げ処理を行う。
全体像は `references/overview.md` を参照。

## 途中参入の判定

最初に以下を確認し、すでに進んでいる段階があればスキップしろ:

- idea/ にブレスト素材があるか → あれば読んで要約
- 前セッションで情報収集・Vision 決定が済んでいるか → ユーザーに聞け
- README + plan.md がすでに存在するか → `phase/1_planning.md` へ直行

## 手順

### 1. 採番

`backlog/meta-subpj-candidates.md` の PJ 表を読み、次の空き番号を決めろ。

### 2. ビジョン凝縮

ユーザーに以下を一度に聞け:

```
PJ{NN} の立ち上げを始めます。以下を教えてください:

1. **何が痛いか** — 今どんな問題があるか
2. **完了像** — 半年後にどうなっていれば成功か
3. **範囲外** — 明確にやらないこと

（ブレスト素材が idea/ にあれば、そのパスも教えてください）
（前セッションで調査済みの情報があれば、そのセッションも教えてください）
```

回答が曖昧なら「この解釈であっていますか」と確認しろ。勝手に補足するな。

### 3. ディレクトリとファイルを生成

以下をすべて作成しろ:

**ディレクトリ**: `projects/PJ{NN}_{Name}/`

**README.md** — 以下の frontmatter とセクションを含めろ:

```yaml
# frontmatter
pj_id: PJ{NN}
project: {Name}
date: {今日}
status: active
owner: akaghef
related: plan.md
```

必須セクション: Vision（問題・完了像・スコープ In/Out）、主成果物、メタ情報（PJ名・ブランチ・worktree・マップ・kickoff日・原典）、ドキュメント構成、役割分担、運用ルール要点、Future Work、進捗ログ。

役割分担テーブルには必ず「Phase 遷移判定 = 人間が◎、Claude は×」の行を入れろ。
「Claude が止まって確認すべき境界」を明記しろ。

M3E を実行画面に使う PJ は、README のメタ情報に **3-view runtime を正本として持つか** を必ず書け。
runtime を使わない場合のみ、README と plan.md の両方に
`runtime_opt_out: {理由}` を明記しろ。未記載なら runtime を使う前提で進めろ。

**plan.md** — 骨格のみ。以下のセクションを空で用意:

```yaml
# frontmatter
project: {Name}
date: {今日}
status: exploring
owner: akaghef
kickoff: {今日}
related: README.md
```

必須セクション: TL;DR、ゴールと成功基準（Must/Should/Nice）、スコープ（対象/非対象）、探索ログ（空）、Phase 設計（空）、実行計画（空）、進捗ログ。

status は `exploring` にしろ（まだ探索フェーズ）。

### 4. ブランチ作成

```bash
git checkout -b prj/{NN}_{Name} dev-beta
```

worktree が必要か（並列 PJ 時）はユーザーに確認しろ。

### 5. 登録

`backlog/meta-subpj-candidates.md` の PJ 表に新行を追加しろ。

### 6. 報告

以下を出力しろ:

```
PJ{NN}_{Name} を立ち上げました。

生成物:
- projects/PJ{NN}_{Name}/README.md
- projects/PJ{NN}_{Name}/plan.md（骨格のみ）
- ブランチ: prj/{NN}_{Name}

→ 次は /sub-pj plan で探索ループに入りましょう。
```
