---
source: chat turn 2026-04-20 (PJ03 kickoff session)
purpose: sub-pj protocol の全体フローをおさらい。PJ03 が自動化対象とする流れそのもの
---

# sub-pj 進行フロー 全体像

## 5 Phase の流れ

```
Phase 0  Kickoff       →  skeleton 1-shot 生成（← PJ03 はここ完了）
Phase 1  Planning      →  探索ループ + Gate 1 (戦略) + Gate 2 (実行計画)
Phase 2  Session       →  決定論的ループ（Generator→Evaluator→writeback）
Phase 3  Gate          →  Phase 遷移判定（plan.md の Phase 0→1, 1→2...）
Phase 4  Complete      →  retrospective, 一般教訓抽出, PJ クローズ
```

**注意**: protocol 上の「Phase」は sub-pj skill の phase（0-4）と、plan.md 内の「Phase 0/1/2...」（PJ 固有のマイルストーン）の **2 層** がある。混同するな。

---

## Phase 0: Kickoff（`sub-pj-plan`）

1-shot で skeleton を作る。対話ループに入らない。

生成物: README / plan.md / tasks.yaml / resume-cheatsheet / runtime/README / reviews/Qn_initial / retrospective、ブランチ `prj/{NN}_{Name}`、レジストリ登録。

**完了条件**: 上記ファイルが揃い、ブランチ切られた状態。

---

## Phase 1: Planning（`sub-pj-plan` 続き）

plan.md を **探索ループ** で詳細化し、2 つの gate を通す。

### 探索ループ（順序固定でない）

- 情報収集 → 探索ログに記録
- 対象理解（必須情報セクションを埋める）
- 戦略立案（メイン/サブプラン形式）
- 技術選定サーチ
- task ブレスト

### ★ Gate 1: 戦略決定

揃えるもの:
- Vision 明確
- 方針が 1 つに絞られている
- 技術選定完了
- task 洗い出し済み
- 作業者向け必須情報

→ plan.md の「確定事項」に記録、ユーザー承認。

### Gate 1 後の実行計画策定

1. task 依存関係 → 実行順序
2. Phase 設計（PJ 固有の Phase 0, 1, 2...）
3. Phase 0 の着手手順（時間見積もり付き）
4. facet 設計（map 使う PJ のみ）
5. 運用ルール
6. runtime readiness（3-view or `runtime_opt_out`）
7. facet bootstrap 設計

### ★ Gate 2: 実行計画確定

Phase 設計・着手手順・facet・runtime・bootstrap が決まっていることを確認し、plan.md status を `exploring → ready` に。map 初期化して `sub-pj-do` へ handoff。

---

## Phase 2: Session（`sub-pj-do`）

Gate 2 通過後の日常サイクル。**ここが自走の本体**。

### start

README → plan.md → resume-cheatsheet → tasks.yaml → runtime の順に読み、今日着手する task を提示。**plan 乖離があれば先に報告**。

### work — 決定論的ループ

```
(1) resume-cheatsheet 読む
(2) Agent Status = working
(3) tasks.yaml から次 task（in_progress → pending の順）
(4) Generator 起動 or 軽微なら自前
(5) DONE 報告
(6) eval_required 判定
    true  → Evaluator 起動
    false → Manager が objective check
(7) VERDICT
    pass → done, commit, resume-cheatsheet 再生成
    fail → round+=1, feedback 保存
         → round_max 未満: Generator に戻す
         → round_max 到達: blocked + reviews に pool
(8) 次 task へ自動遷移
```

**止めていいのは E1/E2/E3 のみ**（後述）。それ以外は進め。

### end

git status 確認 → ハンドオフ報告（変更/検証/次 task/未解決）→ plan.md 進捗ログ追記。

---

## Phase 3: Gate — Phase 遷移判定（`/sub-pj gate`）

plan.md の Phase 完了条件を検証。
- 条件チェック表を出す
- ユーザーに遷移可否を問う
- **Claude は勝手に遷移しない**
- 承認後: 進捗ログ記録 → 次 Phase の tasks.yaml 具体化 → facet/scope 未作成なら初期化 → resume-cheatsheet 再生成

---

## Phase 4: Complete（`/sub-pj retro`）

全 Phase 完了 or 意図的中断時。
1. retrospective.md に個別反省
2. projects/retrospective_general.md に一般教訓抽出
3. protocol.md 昇格候補を提案（2 PJ 以上で確認されたパターンのみ）
4. README status を `done` に、レジストリ更新

---

## エスカレーション 3 条件（止まっていいのはこれだけ）

| | 発動 | 処理 |
|---|---|---|
| **E1** Phase gate | tasks.yaml の現 Phase 全 done | 完了条件チェック表 → ユーザー判断 |
| **E2** 環境崩壊 | 必須ツール不在 / 依存サービス停止 / ブランチ構造壊れ | 症状・試した回避策・必要支援を 5 行で stop |
| **E3** スコープ逸脱 | plan.md Vision を **明らかに** 超える判断が必要 | 超過内容 + 選択肢 2-3 個を提示 |

### 止まるな判例（E1-E3 ではない）

- ツール呼び出し 1 回失敗 → リトライ
- lint / test 軽微 fail → 修正して続行
- 命名・粒度・ライブラリ選定で迷う → `reviews/Qn_*.md` に tentative default で pool して続行
- 「確認取りたい」衝動 → **進め**

---

## PJ03 の現在地（2026-04-20 時点）

- **Phase 0 (kickoff)**: 完了
- **Phase 1 (planning)**: 次にやること
  - 探索ループ or 直接 Gate 1 チェック
  - または（PJ03 の性質上）探索が薄く済むので、**plan.md の Phase 0 の tasks.yaml（T-0-1〜T-0-5）をそのまま実行して摩擦実測してから Gate 1** という手もある

### 進め方の選択肢

- **A**: `/sub-pj plan` で Gate 1 readiness 対話 → 戦略を詰める
- **B**: `/sub-pj-do` で T-0-1 から着手 → 摩擦実測データを先に作る（この PJ 自体が dogfood なので実データ先行が整合する）
