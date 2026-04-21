---
pj_id: PJ03
doc_type: idea
status: draft
date: 2026-04-21
updated: 2026-04-21
---

# PJ03 Demo Skeleton

## 目的

完成品を見せるのではなく、PJ03 SelfDrive の価値がどこにあるかを短時間で伝える。
細部の UX や UI を固定せず、議論可能な骨格だけを提示する。

## 想定観衆と所要時間

- **想定観衆**: akaghef / 他 PJ reviewer / M3E 関心者（技術背景あり）
- **総所要**: 12–15 分（±3 分）+ 質疑 10 分
- **媒体**: ターミナル live demo + plan.md / retrospective.md の抜粋提示

## このデモで伝えること

1. M3E は静的 tree だけでなく、動的 workflow を扱う方向へ進んだ
2. workflow は `state / edge / checkpoint` を持ち、停止と再開の理由が明示される
3. 実行責務は reducer / orchestrator / clock / hook に分かれ、曖昧な一枚岩ではない
4. 最終的には `1 scope` の内部で workflow を扱う方向へ接続できる

## 事前準備チェックリスト（デモ 10 分前）

```bash
cd c:/Users/Akaghef/dev/prj/03_SelfDrive
git checkout prj/03_SelfDrive
cd beta
npm install --silent
npm run build:node
cd ..

# reducer / daemon / orchestrator / projector / test がすべて動くか確認
node beta/dist/node/checkpoint_restore_test.js    # PASS 9/9
node beta/dist/node/clock_resolver_test.js        # PASS 19 assertions
node beta/dist/node/clock_daemon_test.js          # PASS 5 tests
node beta/dist/node/workflow_orchestrator_test.js # PASS 5 tests
node beta/dist/node/workflow_scope_projector_test.js  # PASS 7 tests
```

もし 1 本でも落ちたら、demo 中止して原因を先に潰す（silent fallback 禁止の精神）。

端末は 2 つ用意:
- 左: コマンド実行
- 右: plan.md / retrospective.md / docs/*.md を即座に開ける状態

## デモの骨格

### Part 1: 問題の提示（2 分）

短くこれだけ言う:

- 以前は `tasks.yaml + hooks + resume-cheatsheet` が散在していた
- 停止理由と resume 起点が曖昧だった
- M3E の tree と agent workflow がまだ噛み合っていなかった

**見せるファイル**（スクロールで一瞥だけ）:

- `tasks_v1_friction.yaml.bak`（旧 friction-harness フレーム、参考）
- `projects/PJ03_SelfDrive/reviews/Qn3_gate2_rework.md`（何を直したかの原典）

**一言メッセージ**: 「初期の PJ03 自身が『状態管理が散らかっていて再開理由が曖昧』という問題の当事者だった」。

### Part 2: 最小解法（3 分）

見せる対象:

- **9 state**: `docs/workflow_state_set.md` の表を 10 秒映す
- **17 edges**: `docs/workflow_edges.md` の表を 10 秒映す
- **checkpoint JSON**: `runtime/checkpoints/T-3-4.json` を cat
- **reducer / CLI レイヤ図**: `docs/reducer_responsibility.md` のレイヤ図を指差す

**実行**:

```bash
cat projects/PJ03_SelfDrive/runtime/checkpoints/T-3-4.json
# -> schema_version / task_id / updated_at / state {kind, round, ..., escalation_kind, wakeup_at, failure_reason}
```

**一言メッセージ**: 「state は 9 個で打ち止め。edge は表で全部列挙済。checkpoint JSON が machine SSOT、tasks.yaml は人間契約。責務が混ざらない」。

ここで重要なのは、内部実装の細部ではなく「責務が分かれた」こと。

### Part 3: 実演の核（5–6 分）

1 task を 1 本だけ扱う。**推奨シナリオ: dogfood_run_02 の sleeping シナリオ**。live で再現性が高く、Clock injection の価値も伝わる。

```bash
# PJ03 全体の現状 inspect
node beta/dist/node/workflow_cli.js \
  --tasks projects/PJ03_SelfDrive/tasks.yaml \
  --runtime projects/PJ03_SelfDrive/runtime \
  --inspect
# -> T-0-1..T-3-4 すべて done。全 25 task が確定状態 (20 秒)

# 1 task を synthetic runtime に取り出して sleeping を実演
node beta/dist/node/dogfood_run_02.js
# -> 3 scenarios（sleeping E08→E09、escalated E10→E12 via review resolved、failed E17）が 10 秒で走る
```

**見せる流れ（stdout を指差しながら）**:

1. `E08 in_progress → sleeping` — task が wakeup_at を保存して停止
2. `advance clock 16 min`（AdvanceableClock）— 時刻条件を決定論的に再現できる点を強調
3. `E09 sleeping → ready` — clock.now() >= wakeup_at で自動復帰、wakeup_at は null にクリア
4. `E10 → escalated` で escalationKind=E2 が保存される
5. review の status を resolved に書き換える → 次の tick で E12 escalated → ready が自動発火
6. `E17 → failed` で failure_reason が保存され terminal

**バックアップ plan**: dogfood_run_02 が落ちたら、代わりに `--demo` モード（synthetic、30 行以内）で done / blocked だけ見せる。

```bash
node beta/dist/node/workflow_cli.js --demo  # 旧 runner の demo、fallback 用
```

**一言メッセージ**: 「止まる理由は checkpoint に残る。時刻・レビュー解決・人間判断、どの条件で復帰するかが runtime で観測可能」。

「止まる」「理由が残る」「再開できる」の 3 点が伝われば十分。他は削ってよい。

### Part 4: M3E 接続の示唆（2 分）

最後に、これは単独 CLI デモではなく、将来的には `1 scope` 内に次を投影できると示す:

- workflow summary
- current state
- next transition
- blocked reason

**実行**:

```bash
# PJ03 自身を scope 投影した snapshot
cat projects/PJ03_SelfDrive/artifacts/workflow_scope_snapshot.json | head -40
# -> rootId / nodes / root.attributes.workflow.count.done=23 ...

# 読むべきは root.text のサマリ 1 行
python -c "import json; d=json.load(open('projects/PJ03_SelfDrive/artifacts/workflow_scope_snapshot.json')); print(d['nodes']['root']['text'])"
# -> "PJ03 Workflow Snapshot — done=25 (total 25)"
```

**一言メッセージ**:

- 「AppState shape でそのまま map に載る形で出す」
- 「projection は片方向。map から reducer には戻さない（SSOT 侵害禁止）」
- 「UI 描画は別 PJ。本 PJ はデータモデルまで」

ここは完成 UI を見せなくてよい。「scope に載ると何が嬉しいか」を言語化するだけで足りる。

## あえて詰めないこと

- UI 詳細
- viewer 上の正確な配置
- 実 Anthropic API 接続
- 並列 multi-task 実行
- LangGraph 採用可否の最終判断

このデモは、完成形の提案ではなく筋の良い骨組みを見せるもの。

## その場で詰めてもよい論点（質疑想定）

| 論点 | 想定回答の核 | 参照 |
|---|---|---|
| `sleeping` と `escalated` どっちを見せるか | time-based なので sleeping が絵になりやすい。escalated は Part 3 流れで同じ dogfood 内で 2 本目に見せられる | dogfood_run_02.md |
| reducer/CLI をどこまで内部公開するか | 型（workflow_types.ts）は公開、reducer 内部関数は beta 内、CLI は外 | reducer_responsibility.md |
| scope への統合を projection として見せるか、将来像の言葉だけに留めるか | Part 4 で snapshot JSON を 10 秒映す。実 viewer は別 PJ と明言 | m3e_scope_integration.md |
| filesystem-anchored facet を先に説明するか | 不要。`workflow.*` prefix isolation を 1 行だけ言えば足りる | m3e_scope_integration.md §facet 共存 |
| LangGraph はどこに消えた？ | Phase 0 で比較検討、独自 9 state + 17 edge に絞った経緯あり。sandbox は runtime/langgraph_sandbox/ | external_tools_review.md |
| Gate 2 差戻の話をするか | 時間があれば 1 分だけ紹介（SSOT 宣言 vs 永続化のズレが主因）。手短に retrospective.md を指す | retrospective.md § Phase 1.5 |

## 質疑対応のための sheet

聞かれやすい順:

1. 「なぜ 9 state？」→ 停止理由 taxonomy + 実稼働分類から定義。`stop_reason_taxonomy.md` の 4 問 rubric
2. 「round_max は何？」→ Evaluator fail retry 上限。E06/E07 で決まる
3. 「Generator / Evaluator は誰が動かす？」→ SubagentAdapter interface。実装は本 PJ 外
4. 「hook が落ちたら？」→ silent fallback 禁止。context に `[workflow_cli --resume failed]` が見える
5. 「projection は書き戻さない？」→ one-way 設計。双方向は debt 起点
6. 「M3E 本体との統合はいつ？」→ 別 PJ として backlog にあり（app-feature-gaps.md §Workflow / Agent state）

## 失敗時の撤退 plan

- Part 2 で build 失敗 → scripts/hooks/session-start.sh の stdout を映すだけで責務分離を説明
- Part 3 で dogfood_02 失敗 → 事前キャプチャのログを slides で映す（`dogfood_run_02.md` に全 stdout を引用済）
- Part 4 で snapshot 失敗 → snapshot.json を単純に cat
- 全部失敗 → plan.md の Phase 3 結論表 + retrospective.md 抜粋で言葉のみ

## 時間配分（目安）

| Part | 所要 | 累計 |
|---|---|---|
| 1 問題提示 | 2 分 | 2 分 |
| 2 最小解法 | 3 分 | 5 分 |
| 3 実演の核 | 5–6 分 | 10–11 分 |
| 4 M3E 接続 | 2 分 | 12–13 分 |
| 質疑 | 10 分 | 22–23 分 |

## 一言でいうと

「PJ03 は workflow 完成品のデモではなく、M3E が動的 workflow を scope 内で扱うための骨格が成立したことを示すデモ」である。

## 参照（本 idea を作る元ソース）

- `projects/PJ03_SelfDrive/plan.md` §成功基準 / §Phase 3 結論
- `projects/PJ03_SelfDrive/retrospective.md` §1 行サマリ / § Phase 別
- `projects/PJ03_SelfDrive/docs/workflow_state_set.md` / `workflow_edges.md`
- `projects/PJ03_SelfDrive/docs/reducer_responsibility.md`（レイヤ図）
- `projects/PJ03_SelfDrive/docs/m3e_scope_integration.md`
- `projects/PJ03_SelfDrive/artifacts/dogfood_run_02.md`（sleeping/escalated/failed の live 出力例）
- `projects/PJ03_SelfDrive/artifacts/dogfood_run_03.md`（scope projection 例）
- `projects/PJ03_SelfDrive/artifacts/workflow_scope_snapshot.json`
