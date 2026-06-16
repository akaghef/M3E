# PJ03 から抽出: Gate integrity を高めるための未整理アイデア

PJ03 SelfDrive の全 Phase を 1 セッションで回した後の、本音ベースの反省から抽出。
retrospective_general.md に昇格したルール以外で、harness / 運用パターンとして
将来 PJ で試したい未確定のアイデアをプールする。

## 1. Pre-gate adversarial reviewer（穴探し subagent）

narrow Evaluator は task の done_when/eval_criteria しか見ない。
PJ03 の Gate 2 差戻（persistence gap + engine 過大評価 + pickNextTask FIFO など 8 点）は
全部 architecture integrity 層の問題で、narrow Evaluator では拾えなかった。

案:

- Gate readiness を emit する**前に**、独立 subagent を 1 本起動する
- prompt: 「あなたは厳しい外部 reviewer。この PJ の成果物で最も痛い穴を 3 つ挙げろ。
  SSOT 整合 / 責務境界 / naming ↔ 実体 / 永続化 / code-reachable の曖昧さ を特に見よ」
- この subagent の指摘を受けてから Gate readiness を書き直す or そのまま出す
- narrow Evaluator とは別 role として分離（Manager が verdict を混ぜない）

devM3E に入れるなら `sub-pj-plan` の Gate check 前 hook として候補。

## 2. Schema change と legacy deletion の同一 commit 強制

PJ03 Qn4 の核: T-1-8 で tasks.yaml schema を変更したが、旧前提の `migrate_checkpoints.ts` /
`strip_tasks_state.ts` / `add_task_fields.ts` を残した。Phase 2 kickoff で再実行し、
全 16 checkpoint の `state.kind` を undefined に潰した。

案:

- schema breaking change の commit で、対応する migration script / 旧フィールド参照が
  grep で見つからないことを pre-commit hook で assert
- 残す必要があるなら script 冒頭で `schema_version` を assert する pattern を強制
  ```ts
  if (CURRENT_SCHEMA_VERSION !== EXPECTED_LEGACY) {
    throw new Error(`this script only runs against schema ${EXPECTED_LEGACY}; current is ${CURRENT_SCHEMA_VERSION}`);
  }
  ```
- ルールとして `projects/retrospective_general.md` に登録済だが、機械検査への昇格は未

## 3. State × 責務レイヤ matrix を plan 段階で作る

PJ03 Phase 1 で pickNextTask が eval_pending を返さないバグが T-2-2 test で初露出。
9 state のうち「どれが orchestrator-driven / tick-driven / terminal / human-only か」を
最初から表にしていれば Phase 1 で回避できた。

pattern 案:

| state | reducer | tick (auto) | orchestrator (pickNext) | human | terminal |
|---|---|---|---|---|---|
| pending | ... | ... | ... | ... | ... |

この表を state machine を設計する task の done_when に入れる。PJ03 のように
「state 9 個」と宣言する直後に、各 state の責務担当を明示する。

## 4. Manager 自己監査: 推測 vs 確認

PJ03 中、以下の場面で推測で進めて後で rework/再作業になった:

- Gate 2 emit 時、「これで通る」と思い込みがあった → akaghef 8 点差戻
- 重複承認メッセージを「PJ 完了承認」と inferring → 確認すれば 5 秒
- demo_skeleton 詳細化で「想定観衆=akaghef」と仮定 → 本来聞くべき

pattern 案:

- Gate emit 前に「独立 reviewer が最も痛いと感じる穴は？」を 1 分自問
- ユーザーメッセージが 1 パッと解釈できない時（同内容の再送含む）、推測で進めず 10 秒で確認
- demo / 外部向け artifact を書く前に、想定観衆と所要時間を確認

これは harness というより Manager 運用規律。`.claude/skills/sub-pj/` 側に明示する候補。

## 5. Evaluator prompt での verdict 漏洩防止

PJ03 の Evaluator prompt で `Manager already verified X` と書いた。これは Manager の観察を
Evaluator に示唆してしまい、独立 verdict の価値を削る。

案:

- Evaluator prompt は「artifact path と contract だけ渡す」運用に固定
- Manager の smoke test 結果を渡したい場合は「stdout ログを渡す、解釈は Evaluator に任せる」
- 「Manager verified / confirmed」などの語を prompt から除外

`.claude/skills/sub-pj/phase/evaluator.md` の prompt template に書き込む候補。

## 6. 1 セッション複数 Phase の疲労管理

PJ03 は全 Phase を 1 セッションで回した。後半（Phase 2 end 〜 Phase 3）で pickNextTask bug や
Qn4 regression が出た。疲労由来の凡ミスの可能性が高い。

案:

- Phase gate ごとに自然な session break を挟む運用
- 1 セッションで 2 Phase 以上回すときは、後半 Phase で Evaluator を多めに回す
- compaction 直後は risky operation を避ける（migration 系は特に）

## 関連

- `projects/PJ03_SelfDrive/retrospective.md` — PJ03 固有の反省
- `projects/retrospective_general.md` — PJ03 から昇格済の 7 パターン
- `backlog/app-feature-gaps.md` §Workflow / Agent state — M3E 本体への機能要求

*2026-04-21*
