---
name: sub-pj
description: |
  sub-PJ（M3E内のサブプロジェクト）のライフサイクル全体を管理するスキル。
  立ち上げ（kickoff）からセッション開始/終了、Phase遷移、反省まで。
  以下の場面でトリガーする:
  - 「新しいPJを立ち上げる」「PJ作る」「sub-pj kickoff」と言われたとき
  - 「PJセッション開始」「今日の作業開始」+ PJ名と言われたとき
  - 「Phase遷移」「ゲート確認」「次のPhaseに進めるか」と言われたとき
  - 「セッション終了」「ハンドオフ」「作業おわり」+ PJ名と言われたとき
  - 「振り返り」「反省」「retrospective」と言われたとき
  - 「plan作って」「計画を詰めよう」と言われたとき
  - 「/sub-pj」と直接呼ばれたとき
---

# sub-pj — Sub-Project Lifecycle Manager

sub-PJ の立ち上げから完了までを phase ベースで管理する。

## PJ ライフサイクル

```
 0_kickoff ──→ 1_planning ──→ 2_session ←──→ 3_gate
                                                 │
                                                 ↓
                                            4_complete
```

| Phase | 状態 | いつ入るか |
|-------|------|-----------|
| **0 kickoff** | PJ が存在しない | 「新しい PJ」「立ち上げ」 |
| **1 planning** | README/plan.md が骨格のみ | kickoff 直後、または plan の詳細化指示時 |
| **2 session** | 日常の作業サイクル | セッション開始/終了 |
| **3 gate** | Phase 遷移の判定 | 「次の Phase に進めるか」 |
| **4 complete** | PJ 完了・振り返り | 全 Phase 完了時、または「振り返り」指示時 |

## サブコマンドと読むファイル

| コマンド | Phase | 読む L2 |
|----------|-------|---------|
| `/sub-pj kickoff` | 0 | `phase/0_kickoff.md` + `protocol.md` |
| `/sub-pj plan [PJ]` | 1 | `phase/1_planning.md` |
| `/sub-pj start [PJ]` | 2 | `phase/2_session.md` + `protocol.md` |
| `/sub-pj end [PJ]` | 2 | `phase/2_session.md` |
| `/sub-pj gate [PJ]` | 3 | `phase/3_gate.md` |
| `/sub-pj retro [PJ]` | 4 | `phase/4_complete.md` |
| `/sub-pj` | — | この SKILL.md → phase 推定 |

PJ名を省略 → ブランチ名 `prj/{NN}_{Name}` から推定。

## Progressive Disclosure

| 層 | ファイル | 読むタイミング |
|----|---------|--------------|
| **L1** | `SKILL.md` | 常に（phase ルーティング） |
| **L2** | `protocol.md` | phase 0, 2 で読む（PJ 遂行プロトコル正本） |
| **L2** | `phase/0_kickoff.md` | PJ 立ち上げ時 |
| **L2** | `phase/1_planning.md` | plan.md 肉付け時 |
| **L2** | `phase/2_session.md` | セッション開始/終了時 |
| **L2** | `phase/3_gate.md` | Phase 遷移判定時 |
| **L2** | `phase/4_complete.md` | PJ 完了・振り返り時 |
| **L3** | `references/overview.md` | 人間向け PJ ライフサイクル全体図 |
| **L3** | `references/facet/*.md` | facet タイプ別スコープ粒度・レイアウト |
| **L3** | `references/lessons.md` | plan 策定時・retro 時 |
| **L3** | `references/examples.md` | 新 PJ 設計の参考が必要な時 |

## Phase 推定（引数なし時）

1. PJ 特定 → README の `status` と plan.md の進捗ログを読む
2. README が存在しない → **phase 0**
3. plan.md の Phase 設計が骨格のみ → **phase 1**
4. ユーザー発言に「遷移」「gate」 → **phase 3**
5. ユーザー発言に「振り返り」「完了」 → **phase 4**
6. それ以外 → **phase 2**（デフォルト: 作業サイクル）

## 禁則

- Phase 遷移をユーザー承認なしに実行しない
- ビジョンを勝手に解釈・補足しない（不明瞭なら質問する）
- PJ 固有の深い内容をテンプレートで埋めない（対話で詰める）
- protocol.md を勝手に改訂しない（2 PJ 以上で検証されたパターンのみ、ユーザー承認後）