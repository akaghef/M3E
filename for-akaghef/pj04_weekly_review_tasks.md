# PJ04 WeeklyReview — 着手タスク一覧

作成: 2026-04-29
前提:
- LangGraph TS のネイティブ機能で十分（追加ライブラリは最小）
- API キーは **Bitwarden CLI (`bw`)** で管理。`.env` に平文置かない
- DeepSeek = Generator、Anthropic = Evaluator の二層構成を初期案とする

---

## A. PJ ガバナンス（最初にやる）

- [ ] `projects/PJ04_WeeklyReview/` 作成、`/sub-pj-plan` を回す
- [ ] `projects/META.md` に PJ04 登録
- [ ] `projects/deps.json` に PJ04 ノード追加（依存: なし）
- [ ] Gate 1 通過条件を `plan.md` に明記
  - 入力ソース確定（git log / map直近7日 / backlog mtime）
  - 出力スキーマ確定（テンプレツリー or フラット MD）
  - 合格基準（Evaluator 4軸: 網羅・嘘なし・簡潔・行動可能）
- [ ] Gate 2 通過条件を `runtime.md` に明記
  - dry-run で graph が通る
  - dummy 入力で Generator/Evaluator が JSON を返す
- [ ] クローズ条件を runtime.md に明記（暫定: 4週連続合格）
- [ ] 撤退条件を runtime.md に明記（DeepSeek 不安定 / コスト想定超 / Evaluator 機能せず）

---

## B. シークレット管理（Bitwarden CLI）

- [ ] `bw` インストール確認、`bw login` 済ませる
- [ ] Bitwarden vault に項目作成
  - `M3E/DEEPSEEK_API_KEY`
  - `M3E/ANTHROPIC_API_KEY`
- [ ] 起動時セッション解放スクリプト書く
  - `scripts/bw-session.sh` (or `.ps1`)
  - `bw unlock --raw` でセッショントークン取得 → `BW_SESSION` 環境変数にセット
- [ ] キー取得ヘルパ書く
  - `beta/src/node/secrets.ts`: `getSecret(name): string` を `bw get item M3E/<name> --session $BW_SESSION` から取る
  - 取得結果はプロセス内メモリのみ、ログに出さない
- [ ] `.env` 経由のキー読込は禁止のドキュメント化（runtime.md）
- [ ] CI / 自動実行用の方針メモ
  - ローカル手動運用なら `bw unlock` 都度入力でOK
  - cron 運用時は別途検討（Bitwarden Secrets Manager / OS keychain 等）
- [ ] `.gitignore` 確認: `.env`, `*.session`, `bw-*.json` を除外

---

## C. LLM 接続層

- [ ] `openai` SDK 追加（DeepSeek が OpenAI 互換のため）
  - `npm i openai` を `beta/package.json` に
- [ ] `@anthropic-ai/sdk` 追加（Evaluator 用）
- [ ] `beta/src/node/llm/provider.ts` 作成
  - 共通 interface: `call(messages, opts) -> {content, usage}`
  - DeepSeek 実装（baseURL=https://api.deepseek.com）
  - Anthropic 実装
- [ ] モデル選定を runtime.md に固定
  - Generator: `deepseek-chat` (V3) で開始、必要なら R1 検討
  - Evaluator: `claude-sonnet-4-6`
- [ ] リトライ・タイムアウト方針
  - 5xx は exponential backoff 3回
  - rate limit は 30s wait
- [ ] usage ロガー
  - 各 call の `prompt_tokens / completion_tokens / cost_estimate` を runs/ に記録

---

## D. LangGraph グラフ本体

- [ ] `npm i @langchain/langgraph @langchain/core` を beta/ に追加
- [ ] `projects/PJ04_WeeklyReview/src/state.ts`
  - `WeeklyInputs`, `EvalResult`, `Attempt` 型
  - Annotation Root 定義
- [ ] `src/graph.ts`
  - ノード: collect → generate → evaluate → (route) → write
  - conditional edge: pass → write、fail&attempts<3 → generate、fail&attempts>=3 → END
  - attempts カウンタの reducer
- [ ] dry-run モード
  - `--dry-run` で LLM 呼び出しを stub 化
  - graph トポロジだけ走らせて State 遷移を確認

---

## E. collect ノード

- [ ] `src/collect/git.ts`
  - `git log --since=7.days --pretty=...` を child_process で実行
  - merge / docs-only / fixup commit のフィルタルール（runtime.md に明記）
  - 47件 → 10〜15件に粗要約する圧縮ロジック
- [ ] `src/collect/map.ts`
  - `m3e-map.json` 読込（既存 API `/api/maps/` 経由 or 直接ファイル読み）
  - `updated_at` 直近7日のノード抽出
  - **要確認**: 全ノードに `updated_at` が入っているか実地検証
  - 入っていない場合は git blame ベース fallback を検討
- [ ] `src/collect/backlog.ts`
  - `backlog/*.md` を mtime で filter
- [ ] `src/collect/privacy.ts`
  - 機密タグ付きノード（`attributes.privacy=secret` 等）を除外
  - 除外フィルタの定義は `policy_privacy.md` と整合
- [ ] Provenance 記法を runtime.md に固定
  - 例: `commit:983ca2a`, `map:DEV/Agent_Status`, `backlog:pj-vision-100.md`

---

## F. テンプレツリー機構（採用判断後）

判断: PJ04 内で先行実装、汎化は2例目（月次レビュー等）が出た時。

- [ ] テンプレ node の attribute schema を Glossary.md に登録
  - `src` (例: `git_log` / `map` / `backlog` / `mixed`)
  - `max` (出力項目数上限)
  - `prompt` (per-section instruction)
  - `style` (`bullet` / `paragraph` / `table`)
  - `auto_expand` (子ノード動的生成可否)
  - `from_template` (出力側がテンプレを参照)
- [ ] `templates/weekly_review/` を map に作成
  - 子: ハイライト / 進んだPJ / 詰まり / 来週の候補
  - 各 attribute セット
- [ ] `src/template/loader.ts`
  - map から template ツリー読込 → 内部表現に変換
- [ ] `src/template/render.ts`
  - per-node attribute → prompt 文字列組み立て
- [ ] `src/template/assemble.ts`
  - section 結果をテンプレ構造に戻す reducer
- [ ] viewer 側の `[type=template]` 表示（visual ロール案件、別タスクで切る）

---

## G. Generator / Evaluator

- [ ] `prompts/generator.md`（system prompt + user template）
  - 入力素材ブロックの formatting ルール
  - 出力フォーマット指定（テンプレツリー方式なら per-section）
- [ ] `prompts/evaluator.md`
  - 4軸（網羅・factuality・簡潔・行動可能）
  - JSON schema を明示: `{pass, axes:{...}, reasons:[...]}`
  - **fresh context**: Generator のやりとりを渡さず、素材+draft のみで判定
- [ ] Evaluator の rule 層（LLM 前段）
  - 素材に存在しない固有名詞・PJ番号・日付の文字列マッチで先に弾く
- [ ] JSON parse fallback
  - parse 失敗時は1回再試行、2回失敗で attempt 失敗扱い

---

## H. write ノード・出力

- [ ] `logs/weekly/` ディレクトリ作成、`.gitkeep`
- [ ] ファイル命名規約を runtime.md に明記（暫定: `YYYY-MM-DD_Wxx.md`）
- [ ] テンプレツリー方式採用時: map への書き戻し
  - `/api/maps/` 経由で `logs/weekly/Wxx/` ノード生成
  - 各葉に `content` と `source` 属性
  - Markdown はツリー → MD レンダラで派生生成
- [ ] 冪等性方針
  - 同週2回目: `Wxx_v2.md` として残す（上書きしない）
- [ ] runs/ ログ
  - `runs/<ISO timestamp>.json`: 全 attempt の draft + 評価 + usage

---

## I. 運用・観測

- [ ] CLI: `npm run pj04 -- --week W17 [--dry-run]`
- [ ] 失敗通知
  - 3回 fail で map の `reviews/Qn` に自動起票（暫定）
- [ ] スケジューラ判断保留
  - 最初は手動実行、3〜4回安定したら Windows Task Scheduler 検討
- [ ] コスト集計スクリプト
  - `scripts/pj04-cost.mjs`: runs/*.json から月次 $ 集計
- [ ] failure rate / 合格回数の集計
  - `scripts/pj04-stats.mjs`: 4週連続合格判定

---

## J. 確認事項（akaghef 判断待ち）

- [ ] DeepSeek にどこまでデータを送るか（map 全部 OK か、機密タグ除外で十分か）
- [ ] テンプレツリー方式を初手から採用するか、フラット MD で動かしてから移行するか
- [ ] PJ04 のコード配置: `projects/PJ04_WeeklyReview/src/` 単独 or `beta/src/node/pj04/` 配下
- [ ] Bitwarden の運用形態: 都度 `bw unlock` で十分か、Secrets Manager 検討するか

---

## 推奨着手順序

1. **A** PJ ガバナンス（半日）
2. **B** Bitwarden 整備（半日）→ ここで API キーが揃う
3. **C** LLM 接続層 + dry-run で疎通確認（半日）
4. **D** LangGraph グラフ骨格（dummy ノード）（半日）
5. **E** collect 最小実装（git log + map のみ、backlog は後）（1日）
6. **G** プロンプト初版 + Evaluator JSON（1日）
7. **H** write 最小（フラット MD のみ、テンプレツリーは後）（半日）
8. ここで **初回 1 ループ実行**。akaghef レビュー
9. **F** テンプレツリー機構（運用1〜2回後の判断で着手）

Must だけ潰せば 4〜5 営業日で初回ループ到達の見積もり。
