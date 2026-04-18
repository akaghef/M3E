# Phase 3: Gate — Phase 遷移チェック

Phase の完了条件を検証し、ユーザーに遷移判断を仰ぐ。

## いつ入るか

- 「次の Phase に進めるか」「遷移チェック」「gate」
- `/sub-pj gate`
- Phase の全タスクが完了したとき（Claude が自発的に提案してよい）

## フロー

```
1. plan.md の現 Phase の完了条件を読む
2. 各条件の達成状況を確認（進捗ログ、コミット、マップ等）
3. 判定結果を提示
4. ユーザーの承認を待つ（Claude は遷移を勝手に実行しない）
5. 承認後、必要なら runtime / facet を初期化して `do` に handoff する
```

## 出力フォーマット

```
## Phase Gate: Phase {N} → Phase {N+1}

### 完了条件チェック

| 条件 | 状態 | 根拠 |
|------|------|------|
| {条件1} | Done / Partial / Not started | {根拠} |
| {条件2} | Done / Partial / Not started | {根拠} |

### 判定

{全条件 Done なら}:
Phase {N} の完了条件を満たしています。Phase {N+1} に進みますか？

{未完了あれば}:
以下が未完了です:
- {条件X}: {何が足りないか}

Phase {N} を続行するか、条件を緩和して進むか、判断をお願いします。
```

## 遷移承認後の処理

ユーザーが「進む」と承認した場合:

1. README の進捗ログに `Phase {N} → {N+1}` を記録
2. plan.md の次 Phase タスクを具体化（ユーザーと対話）
3. マップの phase_marker を更新（マップがあれば）
4. `do` 開始に必要な facet / scope が未作成ならここで初期化する
5. `resume-cheatsheet.md` を再生成し、`sub-pj-do` へ handoff する

## 初期化の原則

- `do` に map 設計を持ち込むな
- gate を通したら、決めた facet に基づいて空の器を作ってから handoff しろ
- 最低限:
  - Progress Board
  - Review
  - Active Workspace
  - Evaluation Board（使う場合）
  - facet ごとの scope / anchor / exemplar

までを揃える

## 判断基準（protocol.md §5 より）

- Phase 遷移は **人間が判定** する。Claude は「遷移可能と思う」と報告するまで
- Phase 0 は「設計と最小検証」。完了条件は plan.md に PJ 固有で記載
- 条件を緩和して進む判断もユーザーの権限
