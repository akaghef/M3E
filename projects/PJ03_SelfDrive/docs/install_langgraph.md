---
pj_id: PJ03
doc_type: install-procedure
target: LangGraph (reference implementation)
status: executed
date: 2026-04-21
---

# LangGraph sandbox install 手順

## 目的

plan.md §流用方針 1 の外部ツール候補のうち **LangGraph を参考実装** として手元で読める・動かせる状態にする。採否判断（plan.md D1 の C 案）そのものは Gate 1 以降で別途行う。

## 前提

- OS: Windows 11, bash (Git Bash)
- Python: 3.14.4（`py --version` で確認済み）
- 配置場所: `projects/PJ03_SelfDrive/runtime/langgraph_sandbox/` （PJ ローカル、global Python を汚さない）

## 手順（再現用）

```bash
cd projects/PJ03_SelfDrive
mkdir -p runtime/langgraph_sandbox
cd runtime/langgraph_sandbox

# 1. venv 作成
py -m venv .venv

# 2. pip 更新
.venv/Scripts/python.exe -m pip install --upgrade pip

# 3. 本体 install（Anthropic 連携も同梱）
.venv/Scripts/python.exe -m pip install langgraph langchain-anthropic

# 4. smoke test
.venv/Scripts/python.exe smoke_test.py
# 期待出力:
#   n = 3
#   trace = ['gen', 'eval', 'gen', 'eval', 'gen', 'eval']
#   OK

# 5. requirements 固定
.venv/Scripts/python.exe -m pip freeze > requirements.txt
```

## 実行結果（2026-04-21）

- `langgraph==1.1.8`
- `langgraph-checkpoint==4.0.2`
- `langgraph-prebuilt==1.0.10`
- `langgraph-sdk==0.3.13`
- `langchain-core==1.3.0`
- `langchain-anthropic==1.4.1`
- `anthropic==0.96.0`
- `pydantic==2.13.3`
- 全 depedency インストール成功、smoke_test.py 通過（StateGraph + 条件分岐 + ループ + END）

## sandbox 構成

```
runtime/langgraph_sandbox/
├── .venv/            # gitignore 済み
├── .gitignore
├── requirements.txt  # 再現用 lock
└── smoke_test.py     # 最小 StateGraph 動作確認
```

## 付随 install（必要になれば）

| 用途 | パッケージ | 要否 |
|---|---|---|
| SQLite checkpoint 永続化 | `langgraph-checkpoint-sqlite` | Phase 1 で resume 比較検証するなら |
| Postgres checkpoint | `langgraph-checkpoint-postgres` | 当面不要 |
| LangGraph Studio (GUI debugger) | `langgraph-cli[inmem]` | 参考実装の読解を深めたければ |
| 出力検証 | `guardrails-ai` | evaluator 比較実験するなら（plan.md §1 Guardrails） |

## アンインストール

venv ごと削除するだけ。global 環境に影響なし。

```bash
rm -rf projects/PJ03_SelfDrive/runtime/langgraph_sandbox/.venv
```

## 次アクション

- `docs/external_tools_review.md` に LangGraph / Hermes / Guardrails の比較メモを記載（Decision memo 2 のドラフト）
- 実コード読解（採用判定の根拠作り）は sub-pj-do の別タスクとして pool。plan.md の D1 が決まるまで採用判定はしない。

## 参考 URL

- LangGraph docs: https://langchain-ai.github.io/langgraph/
- StateGraph API: https://langchain-ai.github.io/langgraph/reference/graphs/
- Checkpointer: https://langchain-ai.github.io/langgraph/concepts/persistence/
