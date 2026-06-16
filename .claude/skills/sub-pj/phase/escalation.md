# Phase escalation — 止まっていい 3 条件

Manager が停止・ユーザー確認してよいのは **この 3 条件のみ**。
それ以外で止まったら本ルール違反。hook の Stop 検知に引っかかる。

---

## E1: Phase gate（Phase 遷移判定）

**発動**: `tasks.yaml` の現 Phase 全 task が `status: done`

**処理**:
1. `3_gate.md` のフォーマットで完了条件チェック表を出力
2. ユーザーに「Phase {N} → {N+1} に遷移しますか」と問う
3. **Claude は遷移を勝手に実行しない**。ユーザー承認後、README 進捗ログに記録 + 次 Phase の tasks.yaml を具体化

---

## E2: 環境崩壊（Environment break）

**発動条件**:
- 必須ツール（git / tsc / bash など）が不在・起動失敗
- 依存サービス（map サーバ / GitHub / Supabase など）が停止で回避策が大幅な遠回り
- ブランチ構造が壊れている（現ブランチが `prj/*` でも PJ ディレクトリが無い等）

**処理**: 症状・試した回避策・必要支援を 5 行で報告して stop。

**注意**: 軽微なエラー（1 コマンド失敗、typo）は E2 ではない。リトライして進め。

---

## E3: スコープ逸脱（Out-of-scope decision）

**発動条件**: 現タスクの完了に必要な判断が、`plan.md` の Vision セクション（問題・完了像・範囲外）を **明らかに** 超える

**処理**: 超過内容と選択肢 2-3 個を列挙してユーザーに判断を求める。

**注意**: 「plan.md に具体的な書き方は無いが、Vision と整合する」程度は E3 ではない。tentative default で進め、後で reviews/Qn_*.md に記録。

---

## §A. ambiguity pool 判例集（止まらず続行する型）

迷ったらこのパターンに当てはめて pool し、続行する。

| 迷いの種類 | tentative default | pool 先 |
|---|---|---|
| 命名で 2 案迷う（camelCase vs snake_case 等） | 既存 convention を grep して多数派 | `reviews/Qn_naming_{topic}.md` |
| 型定義の粒度（enum 7 種 vs 10 種） | plan.md に書かれた最小セット | `reviews/Qn_scope_{topic}.md` |
| ライブラリ選定（A vs B） | 既に依存に含まれる方 | `reviews/Qn_tech_{topic}.md` |
| UI 文言（英 vs 日） | protocol §10 言語ポリシーに従う | pool 不要（確定事項） |
| エラー処理の深さ | 境界のみ validate、内部は trust | `reviews/Qn_errhandling_{scope}.md` |
| テスト粒度（unit vs integration） | done_when に書かれた方、無ければ integration | `reviews/Qn_test_{target}.md` |
| コミット粒度（1 PR に N commit） | task = 1 commit 原則 | pool 不要 |
| ファイル配置（既存 dir vs 新設） | 既存 dir が類型あれば再利用 | `reviews/Qn_layout_{topic}.md` |
| ドキュメント更新範囲 | 変更した API の doc のみ | pool 不要 |
| Generator 再委譲 vs 自前実装 | 1 file 以下なら自前、跨ぐなら Generator | pool 不要 |

### pool の書式（`reviews/Qn_*.md`）

```markdown
---
blocker_for: null  # または T-N-M
status: pooled     # pooled | resolved
tentative_default: {選んだ方}
created: {YYYY-MM-DD}
---

# Q: {1 行で論点}

## Context
{なぜ迷ったか、2-3 行}

## Options
- A: {案 A}（pros / cons）
- B: {案 B}（pros / cons）

## Tentative decision
{A/B/...} を採用（理由: {既存 convention / plan.md 整合 / コスト最小 など}）

## User review note
{ユーザーが後で batch review するときの要点、1 行}
```

tentative default で進め、task 完了後にユーザーが batch review するときにここを読む。

---

## §B. 止まるな判例（これは E1-E3 ではない）

- ツール呼び出しが 1 回失敗 → リトライ / 別手段で試せ
- ファイル読み取りで期待と違う → 仕様を更新、続行
- lint / type check が軽微に fail → 修正して続行
- テストが 1 件 fail → 修正して続行、修正不能なら reviews に pool
- 「この実装方針で合ってますか？」と聞きたい衝動 → §A で pool
- 「確認取ってから進めます」と言いたい衝動 → **止めろ。進め**

---

## 参照

- resume 時の open review 処理: `resume.md` Step 5
- Stop hook の block 条件: `scripts/hooks/stop-check.sh`
- protocol 原典: `../protocol.md` §4
