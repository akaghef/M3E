"""DeepSeek + LangGraph integration smoke — single-node StateGraph that calls DeepSeek.

Confirms:
  - secrets.get_secret("deepseek") path
  - langchain-openai ChatOpenAI driving DeepSeek (OpenAI-compatible endpoint)
  - LangGraph StateGraph wiring with one LLM node
  - End-to-end invoke returns a non-empty assistant message

Run:
    ./projects/PJ04_MermaidSystemLangGraph/scripts/with-keys.sh \
        python projects/PJ04_MermaidSystemLangGraph/runtime/langgraph_sandbox/deepseek_langgraph_smoke.py

This is the LangGraph layer of the walking skeleton:
    map -> GraphSpec -> compile_to_StateGraph -> invoke -> result
where this file fakes the compile step with a hand-written StateGraph.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import TypedDict

_PJ04_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_PJ04_ROOT))

from runtime.bridge.secrets import get_secret  # noqa: E402

try:
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
    from langgraph.graph import StateGraph, START, END
except ImportError as e:
    print(f"missing dep: {e}. run: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(2)


class S(TypedDict):
    prompt: str
    reply: str


def llm_node(state: S) -> S:
    api_key = get_secret("deepseek")
    llm = ChatOpenAI(
        model="deepseek-chat",
        api_key=api_key,
        base_url="https://api.deepseek.com",
        temperature=0,
    )
    msg = llm.invoke([
        SystemMessage(content="Reply in one short sentence."),
        HumanMessage(content=state["prompt"]),
    ])
    assert isinstance(msg, AIMessage)
    return {"prompt": state["prompt"], "reply": msg.content or ""}


def build_graph():
    g = StateGraph(S)
    g.add_node("llm", llm_node)
    g.add_edge(START, "llm")
    g.add_edge("llm", END)
    return g.compile()


def main() -> int:
    app = build_graph()
    result = app.invoke({"prompt": "Say hello from PJ04 walking skeleton.", "reply": ""})
    reply = result.get("reply", "")
    print("reply:", reply)
    if not reply.strip():
        print("FAIL: empty reply", file=sys.stderr)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
