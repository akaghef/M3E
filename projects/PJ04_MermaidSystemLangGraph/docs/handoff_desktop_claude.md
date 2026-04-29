---
title: PJ04 — Handoff to Desktop Claude (T-SEC-1 finalize + DeepSeek E2E)
pj: PJ04
status: handoff
date: 2026-04-29
audience: Claude Desktop (with computer-use / mouse + keyboard control)
predecessor: Claude Code (CLI session) — finished scaffolding, blocked on master-password input
---

# 引き継ぎ書 — Desktop Claude 向け

## 0. あなたの仕事 (1 行)

**Bitwarden vault に `api/deepseek` item を作り、master password で 1 回 unlock し、PJ04 の DeepSeek smoke を pass させて T-SEC-1 を done にする。**

CLI Claude では master password 入力プロンプトに対応できないため、Desktop Claude (computer-use, Windows Hello, GUI) に渡す。

---

## 1. 環境前提 (確認済み、変更不要)

| 項目 | 状態 |
|---|---|
| OS | Windows 11 Home |
| Working dir | `C:\Users\Akaghef\dev\prj\04_MermaidSystemLangGraph` |
| Branch | `prj/04_MermaidSystemLangGraph` (worktree) |
| Bitwarden CLI | `bw` v2026.2.0 / login済 / **status: locked** |
| Python | 3.14.4 |
| venv | `projects/PJ04_MermaidSystemLangGraph/runtime/.venv/` 構築済 |
| 依存 | langgraph 1.1.8 / langchain-openai 1.2.0 / openai 2.33.0 等 install 済 |
| LangGraph 単体 smoke | `smoke_test.py` → OK 確認済 |
| 配線 (key 無し) | `SecretNotFoundError` で正常停止確認済 |
| DeepSeek API key | **ユーザの手元にある (vault に未投入の可能性高)** |

---

## 2. ファイル地図

```
projects/PJ04_MermaidSystemLangGraph/
├─ docs/
│  ├─ secrets_management.md         ← 規約・不変式 I-S1〜I-S7
│  └─ handoff_desktop_claude.md     ← この文書
├─ scripts/
│  ├─ with-keys.sh                  ← bash wrapper (master password)
│  ├─ with-keys.cmd                 ← cmd wrapper (bash 呼び出し)
│  └─ with-keys-bio.ps1             ← PowerShell wrapper (Windows Hello)
├─ runtime/
│  ├─ .venv/                        ← Python 3.14.4 + 依存全部入り
│  ├─ bridge/
│  │  ├─ __init__.py
│  │  └─ secrets.py                 ← get_secret(service): env → bw → raise
│  └─ langgraph_sandbox/
│     ├─ requirements.txt
│     ├─ smoke_test.py              ← LangGraph 単体 (no key) ✅ pass済
│     ├─ deepseek_smoke.py          ← DeepSeek 1 round-trip (key 必須)
│     └─ deepseek_langgraph_smoke.py← LangGraph + DeepSeek 1 ノード (key 必須)
├─ tasks.yaml                        ← T-SEC-1: status=review
└─ resume-cheatsheet.md
```

---

## 3. やること (順番厳守)

### Step 1. Bitwarden Web Vault で API key item を登録 (5 分)

1. ブラウザで `https://vault.bitwarden.com` を開き login (ユーザ: `mech.pooh@gmail.com`)
2. 「+ New」→ Item type: **Login**
3. 入力:
   - **Name**: `api/deepseek`
   - **Username**: `deepseek` (任意、検索用)
   - **Password**: ユーザに DeepSeek API key (`sk-...`) を聞いて貼る
   - Notes: `model: deepseek-chat / endpoint: https://api.deepseek.com`
4. Save
5. (任意) `api/anthropic` も同じ要領で作る (Phase E で必要)

**重要**: API key 本体はユーザ手元にしかない。Desktop Claude は **必ずユーザに API key 値を尋ねる**。当てずっぽうの値を入れない。

### Step 2. Bitwarden CLI を unlock (1 分)

PowerShell または bash で:

```bash
bw sync                     # Web で作った item を反映
bw unlock                   # master password を入力 (ユーザに聞く)
# 出力された "export BW_SESSION=..." をそのまま実行
export BW_SESSION="<token>"
```

確認:
```bash
bw status
# {"status":"unlocked", ...} になっていればOK
bw get password api/deepseek
# sk-... が返ればOK
```

### Step 3. DeepSeek 1 round-trip smoke (2 分)

```bash
cd C:\Users\Akaghef\dev\prj\04_MermaidSystemLangGraph
./projects/PJ04_MermaidSystemLangGraph/scripts/with-keys.sh \
    ./projects/PJ04_MermaidSystemLangGraph/runtime/.venv/Scripts/python.exe \
    projects/PJ04_MermaidSystemLangGraph/runtime/langgraph_sandbox/deepseek_smoke.py
```

期待出力:
```
model: deepseek-chat
reply: <短い英文>
OK
```

失敗時の見方:
- `bw not found` → install 確認 (`winget list Bitwarden.CLI`)
- `BW_SESSION not set` → Step 2 やり直し
- `401 Unauthorized` → vault に登録した key が間違い、Step 1 で値再確認
- `Connection refused / timeout` → ネットワーク or DeepSeek 障害

### Step 4. LangGraph + DeepSeek smoke (2 分)

```bash
./projects/PJ04_MermaidSystemLangGraph/scripts/with-keys.sh \
    ./projects/PJ04_MermaidSystemLangGraph/runtime/.venv/Scripts/python.exe \
    projects/PJ04_MermaidSystemLangGraph/runtime/langgraph_sandbox/deepseek_langgraph_smoke.py
```

期待出力:
```
reply: <短い英文>
OK
```

これが通れば **walking skeleton の LLM 層が証明された** ことになる。

### Step 5. (Optional) Windows Hello wrapper の動作確認 (3 分)

```powershell
# PowerShell で
cd C:\Users\Akaghef\dev\prj\04_MermaidSystemLangGraph
.\projects\PJ04_MermaidSystemLangGraph\scripts\with-keys-bio.ps1 `
    .\projects\PJ04_MermaidSystemLangGraph\runtime\.venv\Scripts\python.exe `
    .\projects\PJ04_MermaidSystemLangGraph\runtime\langgraph_sandbox\deepseek_smoke.py
```

期待挙動:
1. Windows Hello プロンプトが出る (顔/指紋/PIN)
2. 認証OKなら、DPAPI に未cacheなので `bw unlock` (master password 1回) を要求
3. 以降、同じ wrapper で実行 → Windows Hello だけで通る (master password 不要)

うまく行かない場合の primary fallback は **Step 3 の bash wrapper**。bio wrapper は便利機能で、必須ではない。

### Step 6. tasks.yaml / resume-cheatsheet 更新

Step 3-4 が両方 pass したら:

`projects/PJ04_MermaidSystemLangGraph/tasks.yaml` の T-SEC-1 を:

```yaml
- id: T-SEC-1
  ...
  status: done
  round: 2
  last_feedback: "2026-04-29 (Desktop Claude): DeepSeek 1 round-trip + LangGraph integration smoke 両方 pass。bio wrapper も動作確認済 (任意)。walking skeleton の LLM 層 PoC 完了。"
```

`resume-cheatsheet.md` の "Recent additions (2026-04-29)" セクションに `T-SEC-1 done` を追記。

---

## 4. 触ってよいもの / だめなもの

### 触ってよい

- vault 内の item (Bitwarden GUI で作成・編集)
- `BW_SESSION` 環境変数 (取得・export)
- `tasks.yaml` の T-SEC-1 ブロックの `status` / `round` / `last_feedback`
- `resume-cheatsheet.md` の handoff 報告セクション
- DPAPI cache (`with-keys-bio.ps1 -Reset` で消去可)

### 触らない

- `secrets.py` のロジック (env → vault → raise の解決順序)
- `with-keys.sh` / `with-keys-bio.ps1` の主要 path (シンタックスチェック済)
- `runtime/.venv/` の中身 (再 install しない、必要なら一度消して再構築)
- 他 PJ (PJ01-PJ03) のファイル
- main / dev-beta ブランチ (このセッションは prj/04_MermaidSystemLangGraph worktree)

### 絶対やらない

- master password / API key を **map / git / log / chat 履歴** に書き残す
- `.env` ファイルを作る (規約違反 I-S1)
- `bw export` で vault を JSON dump して保持 (即削除)
- vault の API key を script 内にハードコード (規約違反 I-S1)

---

## 5. エスカレーション基準

次の場合のみユーザに止まって尋ねる (E1/E2/E3 相当):

- **E1**: vault item の API key が DeepSeek サーバから 401 を返し続ける (3 回試して同じなら止める)
- **E2**: `bw unlock` で master password が拒否され続ける (2 回試して同じなら止める)
- **E3**: スコープ外の作業を要求された場合 (例: 他 PJ の secrets を触れ、本体 dev-beta に commit しろ等)

それ以外は **判断保留せず実行**。曖昧点は `resume-cheatsheet.md` の最下部に「ambiguity pool」として書き残し、tentative default で進める (`sub-pj-guard` ポリシー)。

---

## 6. Git 取扱い

- このセッションの worktree は `C:\Users\Akaghef\dev\prj\04_MermaidSystemLangGraph` (branch: `prj/04_MermaidSystemLangGraph`)
- commit は **ユーザに明示的に許可を取ってから**。Desktop Claude が自動 commit はしない
- `.gitignore` で venv / cache / DPAPI artifact / bw export は除外済 (確認: `git status` でこれらが見えなければOK)
- push 禁止 (ユーザの明示指示なし)

---

## 7. 完了基準

- [ ] vault に `api/deepseek` 登録済
- [ ] `bw status` = `unlocked`
- [ ] `deepseek_smoke.py` が `OK` で終了
- [ ] `deepseek_langgraph_smoke.py` が `OK` で終了
- [ ] tasks.yaml の T-SEC-1 が `status: done`
- [ ] resume-cheatsheet.md に完了報告追記
- [ ] (任意) `with-keys-bio.ps1` で smoke が通り、master password 不要で再実行できる

---

## 8. 困ったら参照

- 規約全体: [secrets_management.md](secrets_management.md)
- T-SEC-1 受け入れ条件: [`tasks.yaml`](../tasks.yaml) の T-SEC-1 ブロック
- PJ04 全体目的: [`plan.md`](../plan.md) (Walking Skeleton 思想)
- 統合計画: [langgraph_integration_plan.md](langgraph_integration_plan.md)
- 既知の Q1-Q3 暫定決定: 同上 §4 (vault に隔離 / NDJSON trace)

---

## 9. 一行サマリ (Desktop Claude が最初に読む箇所)

> **vault に api/deepseek 登録 → `bw unlock` → `with-keys.sh` で 2 つの smoke を pass させ、tasks.yaml の T-SEC-1 を done にする。それ以外は触らない。**
