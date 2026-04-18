# Phase 2: Session — 自走ループ

日常の作業サイクル。
Gate 2 通過後は、`tasks.yaml` を正本として **決定論的ループ** で task を消化する。

## いつ入るか

- 「セッション開始」「今日の作業開始」+ PJ名
- 「セッション終了」「作業おわり」「ハンドオフ」+ PJ名
- `/sub-pj start` または `/sub-pj end`

---

## Core Terms

- `Generator`: 実装・詳細化を行う subagent
- `Evaluator`: `done_when` / `eval_criteria` を検証する独立 subagent
- `round`: Generator -> Evaluator の 1 往復

---

## start — セッション開始

### PJ の特定

1. 引数があればそれを使う
2. なければブランチ名 `prj/{NN}_{Name}` から推定
3. 推定できなければユーザーに聞く

### フロー

1. PJ の README を読む（PJ の現在地）
2. plan.md を読む（Phase 設計・進捗ログ・直近タスク）
3. `resume-cheatsheet.md` を読む
4. `tasks.yaml` を読む
5. README / plan.md に `runtime_opt_out` があるか確認
6. opt-out でなければ、runtime を開いて状態を読む
   - Progress Board
   - Evaluation Board（存在する場合）
   - Review
   - Active Workspace
7. 前回のセッション終了ハンドオフを確認（plan.md 進捗ログ末尾）
8. **plan 乖離チェック**: 現在の状態が plan.md の前提と矛盾していないか確認。矛盾があれば先にユーザーに報告しろ
9. 今日着手する task を提示

### 出力フォーマット

```
## PJ{NN}_{Name} — Session Start

**Phase**: {現在の Phase}
**前回の作業**: {進捗ログの直近エントリ}
**Runtime**: {runtime の map/scope、または opt-out}

**今日着手する task**:
1. {plan.md の次の未完了 task}
2. {その次}

**ブロッカー / plan 乖離**: {あれば}

{ブロッカーがなければ tasks.yaml の先頭 task から自動で着手する}
```

### runtime を読むときの原則

- Progress Board を **開始点の正本** として扱え
- Evaluation Board がある場合、直前 round の fail / feedback を先に読む
- Review に open Q があるなら、task 着手前に review が律速か確認しろ
- Active Workspace は drill-down 用であり、Board / Review の根拠を辿るために使え
- runtime が存在しないのに opt-out も無い場合は、plan 乖離として先に報告しろ

---

## work — 決定論的ループ

**原則: task 完了 → 次の task へ自動で進め。人間の介入を待つな。**

```
(1) resume-cheatsheet.md を読む
(2) Progress Board の Agent Status を working に
(3) tasks.yaml から次 task を取る
(4) Generator を起動、または軽微 task なら自前で実行
(5) DONE 報告を受領
(6) eval_required を判定
    - true  -> Evaluator を起動
    - false -> Manager が objective check
(7) VERDICT 分岐
    - pass -> status: done, commit, resume-cheatsheet 再生成
    - fail -> round += 1, last_feedback 更新, round_max 未満なら再実行
            -> round_max 到達なら blocked + reviews に pool
(8) 次 task へ
```

### task 選定

優先順:

1. `status: in_progress`
2. `status: pending`
3. 全 done なら E1（Phase gate）

### Generator 起動規則

- 1 file / 小変更 / 明確 task は自前実行でもよい
- それ以外は `generator.md` に従って Generator に委譲しろ

### Evaluator 起動規則

- `eval_required: true` の task は必ず `evaluator.md` に従って Evaluator を起動
- Manager は quality judgment をしない
- `eval_required: false` の task だけ、Manager が `done_when` の objective check をしてよい

### fail 時の round 処理

- `last_feedback` に Evaluator の具体 feedback を保存
- `round += 1`
- `round <= round_max` なら Generator に戻す
- `round > round_max` なら `status: blocked` として `reviews/` に pool

### board writeback

可能なら毎 round 後に:

- Progress Board: `pending / in_progress / done / blocked`
- Evaluation Board: latest verdict / failed criterion / feedback
- Review: blocker になった Q

を更新しろ。

### 止めていいのは以下だけ（protocol §4 エスカレーション基準）

- **Phase 遷移判定** — 全 task 完了を検出したら報告。勝手に遷移するな
- **環境・前提の崩壊** — ツール不在・依存停止など、回避策が大幅な遠回りになる場合
- **スコープ逸脱** — plan.md の範囲を明らかに超える判断が必要な場合

それ以外は止まるな。判断に迷ったら §6 資源管理の判断負債ルール（reviews/Qn に pool、tentative default で進行）。

### 作業中の記録

protocol §6（資源管理）のレジストリに従え。各資源を正本の置き場所に記録しろ。
sub-agent 委任ルールは `generator.md` / `evaluator.md` と plan.md の運用ルールに従え。

---

## end — セッション終了ハンドオフ

### フロー

1. 未コミットの変更がないか確認（git status）
2. ハンドオフ報告を生成
3. plan.md の進捗ログを更新
4. マップの Agent Status を更新（サーバー起動中のみ）

### 出力フォーマット

```
## PJ{NN}_{Name} — Session End

### 1. 何を変更したか
- {変更内容}

### 2. 何を検証したか
- {検証内容}

### 3. 次の具体 task
- {plan.md の次の未完了 task 1 つ}

### 未解決
- {ambiguity pool に積んだもの、あれば}
```

### 自動追記

plan.md の進捗ログに:
```
- {今日}: {1行サマリー}
```

### compaction 保全

セッション中に compaction が起きた場合、直後に以下を plan.md 進捗ログに追記しろ:

```
- {今日} [compaction]: {ここまでの作業サマリー。次に何をすべきか}
```

これにより、次の start で文脈を復元できる。
