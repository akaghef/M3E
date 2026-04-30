# Hermes Agent セットアップ + M3E 運用ガイド

作成: 2026-04-29
目的: WSL2 上の Hermes Agent を、Bitwarden + DeepSeek + M3E I1/I2/I3 設計に合わせて運用可能な状態にする。

関連:
- `bitwarden_biometric_setup.md` — Windows Hello 経由の bw 解錠（PowerShell ルート）
- `idea/40_data/memory_architecture/02_hermes_integration_options.md` — I1/I2/I3 設計の正本
- `idea/40_data/memory_architecture/05_mvp_and_open_questions.md` — Wave 1〜4 ロードマップ

---

## 0. 現状（2026-04-29）

- Hermes インストール済み: `~/.hermes/` (WSL Ubuntu) — 4/28 付け
- バイナリ: `~/.local/bin/hermes` v0.11.0
- 状態: **94 commits behind** → `hermes update` 推奨
- 依存: Python 3.11.15 / Node v22.22.2 / uv / git すべて OK
- 未導入（任意・sudo要）: ripgrep, ffmpeg
- skills: 24 カテゴリ既収録（research, note-taking, mcp, dogfood, autonomous-ai-agents 他）
- cron/, hooks/: **空**（Wave 2 以降で実装）
- Ollama (Windows側): 稼働中、`gemma3:4b` 入り

## 1. 大原則（破ったら事故る）

- **M3E = canonical / Hermes = 揮発ワーカー**
- Deep ゾーンに直接書かない（必ず scratch → Qn settling 経由）
- `private/` 配下は Hermes の API スコープに含めない（D7 sensitive cone）
- Hermes の MEMORY.md / sessions DB は M3E map の **read-only mirror** 扱い
- gateway 経由入力は prompt injection 想定で防御層設計

## 2. 直近やること（30分コース）

### 2-1. 本体更新

```bash
wsl -d Ubuntu
hermes update
hermes config check
hermes doctor
```

### 2-2. Bitwarden CLI を WSL に導入

Windows 側に bw 入ってるはずだが、Hermes は WSL で動くので **WSL 内にも** 必要。

```bash
# WSL 内
sudo apt install -y nodejs npm
sudo npm install -g @bitwarden/cli
bw --version
bw login nabaemon@gmail.com
```

`bitwarden_biometric_setup.md` の PowerShell ルートと併用するなら、WSL 側は通常 `bw unlock --raw` で OK。
WSL から Windows Credential Manager を直接読むのは煩雑なので、Hermes 用は **別 session** として運用する方が単純。

### 2-3. vault エントリ準備

note 記事のベストプラクティスに沿って **use-case フォルダ** で整理：

| folder | item 名 | 中身 |
|---|---|---|
| `LLM API Keys` | `DeepSeek API` | password field に `sk-...` |
| `LLM API Keys` | `Anthropic API` | password field に `sk-ant-...` |
| `LLM API Keys` | `OpenRouter API` | password field に `sk-or-...` |
| `Hermes Gateways` | `Discord Bot Token` | （Stage 1 で使う） |
| `M3E Infra` | `Supabase URL+Key` | （cloud sync 既存） |

password field の方が API 設定の標準なので、note の中身ではなく password に格納推奨。
（取り出しは `bw get password "<name>" --session $BW_SESSION`）

### 2-4. 起動 wrapper を `~/.bashrc` へ

```bash
# ~/.bashrc 末尾に追記

# bw session 維持
bw-session() {
  if [ -z "$BW_SESSION" ] || ! bw status --session "$BW_SESSION" 2>/dev/null | grep -q '"status":"unlocked"'; then
    export BW_SESSION="$(bw unlock --raw)" || return 1
  fi
}

bw-pw() { bw-session && bw get password "$1" --session "$BW_SESSION"; }

# Hermes + DeepSeek 起動
hermes-bw() {
  bw-session || return 1
  export DEEPSEEK_API_KEY="$(bw-pw 'DeepSeek API')"
  export ANTHROPIC_API_KEY="$(bw-pw 'Anthropic API')"
  hermes "$@"
  unset DEEPSEEK_API_KEY ANTHROPIC_API_KEY
}

alias hermes-lock='bw lock; unset BW_SESSION'
```

source 後：

```bash
source ~/.bashrc
hermes-bw --tui
```

### 2-5. プロバイダ選択

初回チャット起動前に：

```bash
hermes model
# → DeepSeek を選択（または "Custom OpenAI-compatible" で base_url 直指定）
# → model: deepseek-chat（V3.2、通常用途）
# → reasoning 用途なら deepseek-reasoner（R1）
```

または config 直書き：

```bash
hermes config set MODEL deepseek-chat
hermes config set OPENAI_BASE_URL https://api.deepseek.com/v1
# OPENAI_API_KEY は wrapper の env で注入済み
```

## 3. フォルダ封じ込め（推奨）

Hermes はデフォルトで **ホーム全体に書ける**。M3E 作業は Docker backend に閉じる。

### 3-1. Docker backend

```yaml
# ~/.hermes/config.yaml
worktree: true
terminal:
  backend: docker
  cwd: /workspace
  docker_volumes:
    - "/home/akaghef/dev/M3E:/workspace"
    # 履歴解析時のみ追加（読み取り専用）:
    # - "/mnt/c/Users/Akaghef/.claude/projects/C--Users-Akaghef-dev-M3E:/history:ro"
```

これで agent から見えるのは `/workspace` のみ。`~/.hermes/.env` も他プロジェクトも touchable でなくなる。

### 3-2. 軽量代替（Docker 入れたくない時）

```yaml
terminal:
  cwd: "/home/akaghef/dev/M3E"
```

これは「起動 cwd を固定」だけで、`cd ..` で外に出られる。**気休め**。

## 4. M3E ワークフロー上の位置づけ

`02_hermes_integration_options.md` の I1/I2/I3 に沿う。

### Stage 0（今すぐ）— 壁打ち相手のみ

```bash
hermes-bw --tui
```

Discord/cron 等は使わず、TUI でブレスト・要約・命名相手として使う。
結果採用なら **自分で M3E map に scratch 投入**（自動投入はまだ無し）。

### Stage 1（Wave 2 #4）— I1 Gateway scratch 入口

`hermes gateway setup` で Discord か Telegram 接続 → hook で `/api/maps/dev-beta` POST。

着手前に決める Qn 4 件（map の `reviews/` に起票）：
1. dedupe を Hermes 側 / M3E 側どっち
2. sender ごとに固定カテゴリ vs LLM 分類
3. 入力検閲（prompt injection）二重化するか
4. レート制限（暴走防止）

### Stage 2（Wave 3 #8）— I2 Cron janitor

`~/.hermes/cron/` に skill 配置。L2（提案のみ＝ reviews/Qn 起票）で慣らす。

候補：
- 朝の sort-task 相当（DAG 再計算）
- scratch カテゴリ整理 / overflow 検出
- dead-link / orphan ノード検出
- daily snapshot
- 週次 archive promotion

### Stage 3（Wave 4）— I3 Heavy worker

| Hermes skill | M3E 用途 |
|---|---|
| `research` | scratch 投入された問いを Tavily/Exa で深掘り |
| `note-taking` | 会話ログ → 構造化ノード |
| `diagramming` | 説明用 SVG 生成 |
| `mcp` | M3E REST を MCP 化、双方向 |

書き戻しは **scratch 直下のみ**。Deep には絶対直書きしない。

## 5. ネットワーク注意（WSL2 ↔ Windows）

M3E REST は Windows 側 `localhost:38482`。WSL から：

```bash
HOST_IP=$(ip route show | grep -i default | awk '{print $3}')
curl -sf http://$HOST_IP:38482/api/maps/dev-beta | head
```

到達不可なら：
- Windows Firewall 確認
- M3E 起動時 `0.0.0.0:38482` で listen
- `.wslconfig` の `localhostForwarding=true`（既定 ON）

Ollama も同じ要領（`HOST_IP:11434`）。

## 6. ローカル LLM フォールバック

API 障害時 / オフライン時用：

```bash
hermes config set OPENAI_BASE_URL "http://${HOST_IP}:11434/v1"
hermes config set OPENAI_API_KEY ollama
hermes config set MODEL gemma3:4b
```

→ 4B では設計議論は厳しい。本気で使うなら 7-14B クラスを Windows Ollama に追加：

```powershell
# Windows 側
ollama pull qwen2.5:7b      # 日本語強い
ollama pull llama3.1:8b
```

## 7. 性格固定（任意）

`~/.hermes/SOUL.md` を M3E 文脈に：

```markdown
# SOUL

You are Hermes, a volatile worker for M3E (graph-structured thinking tool).
M3E map is canonical; you are NOT.

Hard rules:
- Never write directly to Deep zone nodes. Always go via scratch + Qn settling.
- Never read or transmit `private/` cone contents.
- For ambiguous decisions, file a Qn under reviews/ rather than deciding.
- When you propose changes to canonical (axes, glossary, vision), output them as
  diff-style suggestions for human review, not direct writes.
```

## 8. セキュリティ前提

- Hermes の `terminal` ツールは agent から `env` 表示可能 → **注入する key は最小限**
- gateway 経由の入力は外部発の prompt → Stage 1 着手時に prompt injection 防御層設計
- Docker backend で `/workspace` 以外の host fs から隔離する
- `~/.hermes/.env` から bw 管理対象 key は削除（env 注入で代替）

## 9. メンテ

```bash
hermes update           # 本体更新（94 commits 追いつき必須）
hermes config check     # 設定検証
hermes config migrate   # スキーマ移行
hermes doctor           # 総合診断
hermes sessions list    # 過去セッション
hermes -c               # 直前会話再開
bw sync                 # vault 同期（週1）
```

## 10. やらない判断（明文化）

- M3E の skill を Hermes 全移植 → **二重保守地獄**
- Hermes MEMORY.md に M3E axes/glossary 全文 mirror → **1300 token 制約で破綻**、index のみ
- private/ ゾーンを Hermes API スコープに含める → **情報漏洩径路**
- Deep ノード直書き許可 → **Qn settling 機構の崩壊**
- Hermes を Claude Code の代替として M3E 実装の主力にする → **土俵が違う**、補助に留める

## 着手チェックリスト

- [ ] §2-1 `hermes update`（94 commits 追いつき）
- [ ] §2-2 WSL に bw CLI 導入 + login
- [ ] §2-3 vault に `LLM API Keys/DeepSeek API` エントリ作成
- [ ] §2-4 `hermes-bw` wrapper を `~/.bashrc` に追加
- [ ] §2-5 `hermes model` で DeepSeek 選択
- [ ] §3-1 Docker backend 設定（or §3-2 軽量版）
- [ ] §7 SOUL.md を M3E 文脈に書き換え
- [ ] §10 `~/.hermes/.env` から bw 管理 key を削除
- [ ] Stage 0 で TUI 起動して動作確認
- [ ] map の `reviews/` に Stage 1 着手前 Qn 4 件を起票
