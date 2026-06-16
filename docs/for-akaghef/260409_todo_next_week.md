# Akaghef TODO — 次週（~2026-04-16）

## 目標（自分で宣言したもの）
1. 25人が URL でマップを読める状態
2. 音声 → Flash → Rapid パイプライン動作
3. Deep との AI 比較が意味のある出力を返す

---

## Akaghef がやること

### 必須（エージェントにはできない）
- [ ] **Supabase Organization 作成** — https://supabase.com でチーム名の Organization を作成
- [ ] **Supabase Project 作成** — Organization 内に "m3e" プロジェクト作成（リージョン: Tokyo）
- [ ] **API キーを取得** — Settings > API Keys タブ（Legacy ではない方）から:
  - **Publishable key** (`sb_publishable_...`) をコピー ← ※ anon key はレガシー、新しい方を使う
  - **Project URL** をコピー
- [ ] **環境変数に設定** — `.env` に以下を書く:
  ```
  M3E_SUPABASE_URL=https://xxxxx.supabase.co
  M3E_SUPABASE_ANON_KEY=sb_publishable_xxxxx
  M3E_CLOUD_SYNC=1
  M3E_CLOUD_TRANSPORT=supabase
  ```
- [ ] **SQL Editor でスキーマ作成** — `docs/03_Spec/supabase_schema.sql` の内容をコピペ実行
- [ ] **チームメンバーに URL 共有** — ビューア URL を Slack 等で配布

### 判断が必要（エージェントが選択肢を用意する）
- [ ] **同時編集の競合解決方式** — CRDT / OT / branch 分離のどれを採用するか
- [ ] **音声入力の方式** — Web Speech API / Whisper API / 外部アプリ連携のどれか
- [ ] **read-only ビューの認証** — URL だけで見える（公開リンク）か、Supabase Auth 必須か

### やらなくていい（エージェントが自動でやる）
- SupabaseTransport の実装
- Supabase テーブル作成 SQL の生成
- viewer の read-only モード実装
- Flash の音声入力 UI
- AI 比較サブエージェントの改善
- テスト
- デプロイスクリプト

---

## エージェントの実装計画（次週分）

### Priority 1: 25人が URL で読める
| # | タスク | Agent | 所要 |
|---|--------|-------|------|
| 1 | SupabaseTransport 実装 | data | 中 |
| 2 | Supabase テーブル作成 SQL | data | 小 |
| 3 | viewer read-only モード | visual | 中 |
| 4 | URL 共有機能（公開リンク生成） | visual | 小 |

### Priority 2: 音声 → Flash → Rapid
| # | タスク | Agent | 所要 |
|---|--------|-------|------|
| 5 | Flash モードの UI 基盤 | visual | 大 |
| 6 | 音声入力（Web Speech API） | data2 | 中 |
| 7 | Flash → Rapid 変換（AI 構造化） | data | 中 |

### Priority 3: Deep との AI 比較
| # | タスク | Agent | 所要 |
|---|--------|-------|------|
| 8 | AI 比較サブエージェント改善 | data | 中 |
| 9 | 比較結果の表示 UI | visual | 中 |

---

## タイムライン案

| 日 | やること |
|----|---------|
| 4/10 (木) | Supabase アカウント作成 + エージェントが SupabaseTransport 実装 |
| 4/11 (金) | read-only ビューア完成 + URL 共有テスト |
| 4/12-13 (土日) | 音声入力 + Flash UI の基盤 |
| 4/14 (月) | Flash → Rapid 変換 + AI 比較改善 |
| 4/15 (火) | 統合テスト + バグ修正 |
| 4/16 (水) | **チームに展開** |
