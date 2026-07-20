"""PJ03 LangGraph Lab (T-9-1) — Plan 4 Phase 4-0 actual import minimum

Generator -> Verifier -> Router 3-node StateGraph running on real LangGraph.
No Anthropic API calls (Plan 4 non-goal, deferred). Node callables are deterministic stubs.
But LangGraph StateGraph / compile / invoke / MemorySaver are real.

run:
    cd projects/PJ03_SelfDrive/runtime/langgraph_lab
    ../langgraph_sandbox/.venv/Scripts/python.exe pj03_lab.py

artifact tee:
    ../langgraph_sandbox/.venv/Scripts/python.exe pj03_lab.py > ../../artifacts/langgraph_run_01.log
"""

from __future__ import annotations

from typing import TypedDict, Literal
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver


class PJ03State(TypedDict):
    """LangGraph thread state for a PJ03 task.

    fields:
      kind        - task-level kind (matches reducer's WorkflowState.kind vocabulary)
      round       - verifier retry counter
      round_max   - contract upper bound
      feedback    - verifier's latest verdict text
      blocked     - round_max breach flag
      last_node   - id of the last executed node (graph position)
      trace       - execution trace for display
    """
    kind: Literal["pending", "ready", "in_progress", "verifier_pending", "done", "blocked"]
    round: int
    round_max: int
    feedback: str
    blocked: bool
    last_node: str
    trace: list[str]


def gen_node(state: PJ03State) -> PJ03State:
    return {
        **state,
        "kind": "verifier_pending",
        "last_node": "gen",
        "trace": state["trace"] + [f"gen#{state['round']}: produced artifact"],
    }


def verifier_node(state: PJ03State) -> PJ03State:
    passed = state["round"] >= 1
    return {
        **state,
        "last_node": "verifier",
        "feedback": f"criteria {'met' if passed else 'missing X'}",
        "trace": state["trace"] + [f"verifier#{state['round']}: {'pass' if passed else 'fail'}"],
    }


def router_node(state: PJ03State) -> PJ03State:
    return {
        **state,
        "last_node": "router",
        "trace": state["trace"] + [f"router#{state['round']}: check route"],
    }


def route_after_verifier(state: PJ03State) -> Literal["router"]:
    return "router"


def route_after_router(state: PJ03State) -> Literal["gen_loop", "end_pass", "end_block"]:
    passed = state["feedback"].endswith("met")
    if passed:
        return "end_pass"
    if state["round"] + 1 > state["round_max"]:
        return "end_block"
    return "gen_loop"


def retry_node(state: PJ03State) -> PJ03State:
    return {
        **state,
        "round": state["round"] + 1,
        "kind": "in_progress",
        "last_node": "retry",
        "trace": state["trace"] + [f"retry: round {state['round']} -> {state['round']+1}"],
    }


def end_pass_node(state: PJ03State) -> PJ03State:
    return {
        **state,
        "kind": "done",
        "last_node": "end_pass",
        "trace": state["trace"] + ["end_pass: kind -> done"],
    }


def end_block_node(state: PJ03State) -> PJ03State:
    return {
        **state,
        "kind": "blocked",
        "blocked": True,
        "last_node": "end_block",
        "trace": state["trace"] + ["end_block: kind -> blocked (round_max breach)"],
    }


def build_graph():
    g = StateGraph(PJ03State)
    g.add_node("gen", gen_node)
    g.add_node("verifier", verifier_node)
    g.add_node("router", router_node)
    g.add_node("retry", retry_node)
    g.add_node("end_pass", end_pass_node)
    g.add_node("end_block", end_block_node)

    g.add_edge(START, "gen")
    g.add_edge("gen", "verifier")
    g.add_conditional_edges("verifier", route_after_verifier, {"router": "router"})
    g.add_conditional_edges(
        "router",
        route_after_router,
        {"gen_loop": "retry", "end_pass": "end_pass", "end_block": "end_block"},
    )
    g.add_edge("retry", "gen")
    g.add_edge("end_pass", END)
    g.add_edge("end_block", END)

    checkpointer = MemorySaver()
    return g.compile(checkpointer=checkpointer), checkpointer


def scenario_happy(app, thread_id: str) -> PJ03State:
    """deterministic verifier: round=0 fail, round=1 pass -> done"""
    initial: PJ03State = {
        "kind": "in_progress",
        "round": 0,
        "round_max": 3,
        "feedback": "",
        "blocked": False,
        "last_node": "",
        "trace": [],
    }
    config = {"configurable": {"thread_id": thread_id}}
    return app.invoke(initial, config)


def scenario_block(app, thread_id: str) -> PJ03State:
    """round_max=0: first fail breaches immediately -> end_block"""
    initial: PJ03State = {
        "kind": "in_progress",
        "round": 0,
        "round_max": 0,
        "feedback": "",
        "blocked": False,
        "last_node": "",
        "trace": [],
    }
    config = {"configurable": {"thread_id": thread_id}}
    return app.invoke(initial, config)


def scenario_resume(app):
    """checkpoint persistence smoke via get_state() on same thread_id."""
    thread_id = "resume-demo"
    config = {"configurable": {"thread_id": thread_id}}
    initial: PJ03State = {
        "kind": "in_progress", "round": 0, "round_max": 3,
        "feedback": "", "blocked": False, "last_node": "", "trace": [],
    }
    first = app.invoke(initial, config)
    snapshot = app.get_state(config)
    return first, snapshot.values


def dump_state(label: str, s) -> None:
    if not isinstance(s, dict):
        return
    print(f"\n=== {label} ===")
    print(f"  kind: {s.get('kind')}")
    print(f"  round: {s.get('round')}/{s.get('round_max')}")
    print(f"  blocked: {s.get('blocked')}")
    print(f"  last_node: {s.get('last_node')}")
    print(f"  feedback: {s.get('feedback')!r}")
    print(f"  trace:")
    for t in s.get("trace", []):
        print(f"    - {t}")


def main() -> None:
    print("PJ03 LangGraph Lab -- Phase 4-0 actual import (T-9-1)")
    print("=" * 60)
    app, _ = build_graph()
    print("[lab] StateGraph compiled with MemorySaver checkpointer")
    print("[lab] nodes: gen / verifier / router / retry / end_pass / end_block")
    print("[lab] conditional edges: after verifier (->router), after router (->retry/end_pass/end_block)")

    print("\n" + "=" * 60)
    print("Scenario 1 -- happy path (verifier fail round 0, pass round 1)")
    print("=" * 60)
    final1 = scenario_happy(app, "thread-happy")
    dump_state("final", final1)
    assert final1["kind"] == "done", f"expected done, got {final1['kind']}"
    assert final1["round"] == 1, f"expected round=1, got {final1['round']}"

    print("\n" + "=" * 60)
    print("Scenario 2 -- blocked path (round_max=0, single fail breaches)")
    print("=" * 60)
    final2 = scenario_block(app, "thread-block")
    dump_state("final", final2)
    assert final2["kind"] == "blocked", f"expected blocked, got {final2['kind']}"
    assert final2["blocked"] is True

    print("\n" + "=" * 60)
    print("Scenario 3 -- checkpoint persistence (MemorySaver smoke)")
    print("=" * 60)
    first, restored = scenario_resume(app)
    dump_state("first invoke", first)
    dump_state("restored snapshot", restored)
    assert restored.get("kind") == first["kind"]
    assert restored.get("round") == first["round"]
    assert restored.get("trace") == first["trace"]

    print("\n" + "=" * 60)
    print("[lab] ALL SCENARIOS PASSED -- LangGraph runtime actually runs (not mock)")


if __name__ == "__main__":
    main()
