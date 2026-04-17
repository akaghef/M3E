# Phase 2: Session — セッション開始 / 作業 / 終了

日常の作業サイクル。Gate 2 通過済みの plan.md に従って task を消化する。
全体像は `references/overview.md` を参照。

## いつ入るか

- 「セッション開始」「今日の作業開始」+ PJ名
- 「セッション終了」「作業おわり」「ハンドオフ」+ PJ名
- `/sub-pj start` または `/sub-pj end`

---

## start — セッション開始

### PJ の特定

1. 引数があればそれを使う
2. なければブランチ名 `prj/{NN}_{Name}` から推定
3. 推定できなければユーザーに聞く

### フロー

1. PJ の README を読む（PJ の現在地）
2. plan.md を読む（Phase 設計・進捗ログ・直近タスク）
3. README / plan.md に `runtime_opt_out` があるか確認
4. opt-out でなければ、3-view runtime を開いて状態を読む
   - Progress Board
   - Review
   - Active Workspace
5. 前回のセッション終了ハンドオフを確認（plan.md 進捗ログ末尾）
6. **plan 乖離チェック**: 現在の状態が plan.md の前提と矛盾していないか確認。矛盾があれば先にユーザーに報告しろ
7. 今日着手する task を提示

### 出力フォーマット

```
## PJ{NN}_{Name} — Session Start

**Phase**: {現在の Phase}
**前回の作業**: {進捗ログの直近エントリ}
**Runtime**: {3-view runtime の map/scope、または opt-out}

**今日着手する task**:
1. {plan.md の次の未完了 task}
2. {その次}

**ブロッカー / plan 乖離**: {あれば}

{ブロッカーがなければ最初の task から自動で着手する}
```

### runtime を読むときの原則

- Progress Board を **開始点の正本** として扱え
- Review に open Q があるなら、task 着手前に review が律速か確認しろ
- Active Workspace は drill-down 用であり、Board / Review の根拠を辿るために使え
- runtime が存在しないのに opt-out も無い場合は、plan 乖離として先に報告しろ

---

## work — 作業サイクル（自動運転）

**原則: task 完了 → 次の task へ自動で進め。人間の介入を待つな。**

```
次の未完了 task を取る
  → 実行
  → 完了判定（protocol §7: commit + 進捗ログ + map status）
  → 次の task へ（自動）
```

### 止めていいのは以下だけ（protocol §4 エスカレーション基準）

- **Phase 遷移判定** — 全 task 完了を検出したら報告。勝手に遷移するな
- **環境・前提の崩壊** — ツール不在・依存停止など、回避策が大幅な遠回りになる場合
- **スコープ逸脱** — plan.md の範囲を明らかに超える判断が必要な場合

それ以外は止まるな。判断に迷ったら §6 資源管理の判断負債ルール（reviews/Qn に pool、tentative default で進行）。

### 作業中の記録

protocol §6（資源管理）のレジストリに従え。各資源を正本の置き場所に記録しろ。
sub-agent 委任ルールは plan.md の運用ルールに従え（PJ 固有）。

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
