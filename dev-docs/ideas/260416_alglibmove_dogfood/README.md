---
date: 2026-04-16
topic: AlgLibMove 初期 2 セッション（2026-04-15〜04-16）の dogfood snapshot
status: frozen snapshot (原本は別所で更新継続)
---

# AlgLibMove Dogfood Snapshot — 2026-04-16

このフォルダは AlgLibMove PJ の**最初の 2 セッション**で得られた
設計文書 + 実働ログ + 反省 + 実行計画を、その時点のまま凍結した snapshot。

M3E 本体の開発チーム（akaghef の別 session、sub-agent、Codex 含む）が、
**この時点の知見を自己完結的に受け取れる**ことが目的。

## 背景

- 2026-04-15 kickoff。MATLAB の `AkaghefAlgebra` を Julia に移植する PJ として始動
- 同時に M3E（scope / Rapid-Deep / link-alias）の dogfood を意図
- 2026-04-16 夜、sub-agent one-shot で Sweedler / CGA / Taft + Heisenberg double の Julia 実装 + verify 21 tests が **190/190 green** で完走
- その後の反省会で **M3E 本体への機能要求 21 件 + 運用規範 20 件以上**が噴出
- 実態として「AkaghefAlgebra 移植」より「M3E 機能発掘」のほうが主産物になった

この逆転が本 snapshot の最大の発見。

## 読む順

1. **plan.md** — PJ 計画（2026-04-15 時点）。前提仮説 A→B→C→D 直列 / 世界モデル=主成果物 を含む（§4.1-4.2 で一部崩壊、未更新）
2. **timeline_2026-04-15.md** — 実働ログ（kickoff 全日）。どの agent に何分使ったかの実データ
3. **dogfood_reflection.md** — 反省の網羅ダンプ（9 節、50+ 項目）。本 snapshot の中核
4. **action_plan_map_and_ops.md** — §1-2 (map 構造・運用) の 24 項目実行計画
5. **action_plan_agent_conv_tools.md** — §3-5 (agent・仮説・tool) の 15 項目
6. **action_plan_features_and_pj.md** — §6-7 (M3E 機能要求・PJ 宿題) の 21+ 項目、beta/src/ への module 目星付き
7. **codex_review_request.md** — Julia 実装の数学的正しさレビュー依頼文（Codex 向け）
8. **design_integrity_review.md** — 設計整合性レビュー

## 主要な発見（TL;DR）

### D-first が通った
world_model → design → code の A→B→C→D 直列仮説を前提としていたが、well-documented な数学領域では sub-agent が D-first（map 無視、MATLAB 参照最小、文献知識から直接）でも verify green まで到達できた。plan.md の前提は要更新。

### マップが review 用途に使えなかった
最大の狙いが「マップでレビューする」だったが、情報粒度の噛み合わせが悪く機能しなかった。原因は以下の layered な欠落:
- authoring 粒度 ≠ review 粒度
- viewer-context 依存の visibility model 不在
- 表 / グラフ / swim-lane などの projection 不在
- alias の SSOT 性が未達（バグ疑い）
- 視覚階層（importance / status / recency）ゼロ
- オントロジー手法（class/instance / inverse link / axiom constraint）未活用

### M3E の課題 = 認知補助層の欠落
データ層（tree + link + attribute）は動くが、**人間の認知に合わせて加工する層**が無い。
「書ける・読める・リンクできる」で MVP が止まり、「考えられる・振り返れる・俯瞰できる」に届いていない。

詳細は dogfood_reflection.md §0（根源認識）。

## 原本との関係

本 snapshot は以下のファイルのコピー（2026-04-16 時点で凍結）:

| snapshot | 原本 |
|---|---|
| plan.md | `dev-docs/projects/AlgLibMove/plan.md` |
| timeline_2026-04-15.md | `dev-docs/projects/AlgLibMove/timeline_2026-04-15.md` |
| dogfood_reflection.md | `backlog/dogfood_reflection_2026-04-16.md` |
| action_plan_map_and_ops.md | `backlog/action_plan_map_and_ops.md` |
| action_plan_agent_conv_tools.md | `backlog/action_plan_agent_conv_tools.md` |
| action_plan_features_and_pj.md | `backlog/action_plan_features_and_pj.md` |
| codex_review_request.md | `backlog/codex_review_request_hopf_hd.md` |
| design_integrity_review.md | `backlog/design_integrity_review_hopf_hd.md` |

原本は PJ 進行に伴い更新される。本 snapshot は**この時点の認識**を凍結する目的で作成。
以降の更新は原本側で行い、本フォルダは historical reference として保持する。

## 次のアクション候補（snapshot 外）

- action_plan 3 種から高優先項目を M3E 本体 feat/ branch に投入
- plan.md の前提仮説を更新（§4.1-4.2）
- alias バグ検証（§6.1 最優先）
- 本 snapshot の発見を M3E 本体の roadmap にマージ
