"""Minimal StateGraph smoke test — confirm langgraph import + compile + invoke."""
from typing import TypedDict
from langgraph.graph import StateGraph, START, END


class S(TypedDict):
    n: int
    trace: list[str]


def gen(s: S) -> S:
    return {"n": s["n"] + 1, "trace": s["trace"] + ["gen"]}


def eval_(s: S) -> S:
    return {"n": s["n"], "trace": s["trace"] + ["eval"]}


def route(s: S) -> str:
    return "done" if s["n"] >= 3 else "gen"


g = StateGraph(S)
g.add_node("gen", gen)
g.add_node("eval", eval_)
g.add_edge(START, "gen")
g.add_edge("gen", "eval")
g.add_conditional_edges("eval", route, {"gen": "gen", "done": END})

app = g.compile()
result = app.invoke({"n": 0, "trace": []})
print("n =", result["n"])
print("trace =", result["trace"])
assert result["n"] == 3
assert result["trace"] == ["gen", "eval", "gen", "eval", "gen", "eval"]
print("OK")
