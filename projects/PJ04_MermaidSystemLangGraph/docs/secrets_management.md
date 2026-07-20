---
title: PJ04 Secrets Management (Bitwarden CLI)
pj: PJ04
status: canonical
date: 2026-04-29
---

# Secrets Management

## 0. 原則

API キーは **`.env` / shell rc / source code に書かない**。
Bitwarden vault に置き、必要時に `bw` CLI で取り出して **子プロセスの env だけ** に流す。

## 1. Vault 規約

| field | value |
|---|---|
| item name | `api/<service>` (例: `api/anthropic`, `api/deepseek`, `api/openai`) |
| password | API キー本体 (`sk-...`) |
| notes | model id, rate limit など |

新サービス追加 = vault に item 1 件追加するだけ。コードは変更不要。

## 2. 解決順序

`runtime/bridge/secrets.py` の `get_secret(service)` は次の順で解決:

1. 環境変数 `<SERVICE>_API_KEY` (例: `DEEPSEEK_API_KEY`)
2. Bitwarden vault の `api/<service>` の password field
3. `SecretNotFoundError`

env 優先なので、CI / 一時上書きは env で行える。

## 3. 使い方

### shell wrapper (推奨)

```bash
./projects/PJ04_MermaidSystemLangGraph/scripts/with-keys.sh \
    python projects/PJ04_MermaidSystemLangGraph/runtime/langgraph_sandbox/deepseek_smoke.py
```

- `BW_SESSION` 未設定なら自動で `bw unlock --raw`
- `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` を子プロセス env に export
- 親 shell は汚染されない

Windows (cmd / PowerShell から呼ぶ場合):
```cmd
projects\PJ04_MermaidSystemLangGraph\scripts\with-keys.cmd python ...
```

### Python から直接

```python
from runtime.bridge.secrets import get_secret
api_key = get_secret("deepseek")   # → DEEPSEEK_API_KEY or bw api/deepseek
```

`BW_SESSION` を予め env に入れておくこと (`with-keys.sh` 経由なら自動)。

## 4. 初回セットアップ

```bash
# 1. CLI install
npm i -g @bitwarden/cli         # or scoop install bitwarden-cli

# 2. login (1回)
bw login

# 3. unlock & session
export BW_SESSION="$(bw unlock --raw)"

# 4. 必要な item を vault に作る (Web Vault の方が楽)
#    api/anthropic, api/deepseek, ...
```

## 5. Lock / Logout

```bash
bw lock          # session 無効化、master password だけ再要求
bw logout        # 完全 logout
unset BW_SESSION
```

PC を離れる時は `bw lock` を癖にする。

## 6. CI / 自動化

machine account (API key login):

```bash
export BW_CLIENTID="user.xxx"
export BW_CLIENTSECRET="xxx"
bw login --apikey
export BW_SESSION="$(bw unlock --raw --passwordenv BW_PASSWORD)"
```

ただし通常 CI なら **GitHub Actions secrets** を直接 env に流す方が単純。Bitwarden は開発端末専用と割り切ってよい。

## 7. ガード

`.gitignore` で次を除外済:

- `*.bwjson`, `bw_export*.json`, `.bw_session` (bw export の生 JSON)
- `runtime/.venv/`, `__pycache__/`, `*.pyc`
- `runtime/traces/`, `runtime/checkpoints.sqlite` (実行成果物 / DB)

## 8. 不変式

- I-S1: API key は disk 上に平文存在しない (`.env` 禁止)
- I-S2: API key を env に流すのは子プロセスのみ。親 shell には残さない
- I-S3: 新サービス追加時、コード変更不要 (vault item 追加だけ)
- I-S4: env 優先 / vault fallback。CI / 一時上書きが効く

## 9. Biometric unlock (Windows Hello / 指紋)

`bw` CLI 単体は biometric 非対応。M3E では `with-keys-bio.ps1` で次の構成を取る:

```
[Windows Hello prompt]
        ↓ verified
[Credential Manager + DPAPI で BW_SESSION 復号]
        ↓ session 有効?
   yes → そのまま使う
   no  → bw unlock (master password 1回) → DPAPI で再暗号化保存
        ↓
[BW_SESSION + API キーを子プロセス env に注入 → exec]
```

### 使い方

```powershell
.\projects\PJ04_MermaidSystemLangGraph\scripts\with-keys-bio.ps1 `
    python projects\PJ04_MermaidSystemLangGraph\runtime\langgraph_sandbox\deepseek_smoke.py
```

session 失効・lock 後は自動で master password 1回再要求 → 以降また指紋だけで通る。

### Reset (cache 破棄)

```powershell
.\with-keys-bio.ps1 -Reset
```

### Storage 詳細

| 場所 | 内容 | 保護 |
|---|---|---|
| `HKCU:\Software\M3E\Secrets\M3E:BW_SESSION` | DPAPI暗号化 session token | Windows User scope (他ユーザは復号不可) |
| `cmdkey /generic:M3E:BW_SESSION` | metadata marker | `cmdkey /list` で可視 |

### 不変式 (追加)

- I-S5: master password / API key 自体は **DPAPI ストアにも保存しない**。session token のみ
- I-S6: session 失効検知 (`bw status` != `unlocked`) で自動再 unlock
- I-S7: `-Reset` で完全消去できる (PCを譲渡する前の手順)

### 制限

- WSL から呼ぶ場合は PowerShell wrapper が使えない → `with-keys.sh` (master password) にフォールバック
- multi-user PC では **各 Windows ユーザごとに別 cache** (DPAPI scope=CurrentUser)

## 10. 関連

- [`scripts/with-keys.sh`](../scripts/with-keys.sh) — bash wrapper (master password)
- [`scripts/with-keys.cmd`](../scripts/with-keys.cmd) — cmd wrapper (delegates to bash)
- [`scripts/with-keys-bio.ps1`](../scripts/with-keys-bio.ps1) — PowerShell wrapper (Windows Hello)
- [`runtime/bridge/secrets.py`](../runtime/bridge/secrets.py) — Python loader
- [`runtime/langgraph_sandbox/deepseek_smoke.py`](../runtime/langgraph_sandbox/deepseek_smoke.py) — DeepSeek 1 round-trip
- [`runtime/langgraph_sandbox/deepseek_langgraph_smoke.py`](../runtime/langgraph_sandbox/deepseek_langgraph_smoke.py) — DeepSeek + LangGraph 1 ノード
