"""M3E PN action LangGraph system.

This is the executable graph behind the abstract PN action system:

UI / active node
-> action contract
-> teacher or local generator
-> structured candidate
-> deterministic parse/diff/validate
-> M3E writeback/readback status

No live M3E or Mapify calls are made here. The graph models the control flow
and produces a deterministic write plan that a caller can hand to M3E APIs.

Run from repo root, after installing the existing sandbox requirements:

    projects/PJ03_SelfDrive/runtime/langgraph_sandbox/.venv/bin/python \
      projects/PJ03_SelfDrive/runtime/langgraph_lab/m3e_pn_action_graph.py
"""

from __future__ import annotations

import sys
from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph


RapidAction = Literal["detail", "examples", "classify", "related"]
SourceKind = Literal["mapify_teacher", "local_generator", "none"]
Route = Literal["has_active", "missing_active"]
CandidateRoute = Literal["mapify_teacher", "local_generator"]
ValidationRoute = Literal["valid", "reject"]


class PnActionState(TypedDict):
    workspace_id: str
    map_id: str
    scope_id: str
    active_node_id: str
    active_node_label: str
    action: RapidAction
    existing_children: list[str]
    source: SourceKind
    candidate_mfh: str
    candidate_labels: list[str]
    append_labels: list[str]
    merge_labels: list[str]
    rejected: bool
    errors: list[str]
    write_plan: dict
    status: str
    trace: list[str]


def resolve_active_node(state: PnActionState) -> PnActionState:
    active = state.get("active_node_id", "").strip()
    label = state.get("active_node_label", "").strip()
    trace = state["trace"] + [f"resolve_active_node: {'ok' if active and label else 'missing'}"]
    return {**state, "trace": trace}


def route_active_node(state: PnActionState) -> Route:
    if state.get("active_node_id", "").strip() and state.get("active_node_label", "").strip():
        return "has_active"
    return "missing_active"


def action_router(state: PnActionState) -> PnActionState:
    op_by_action = {
        "detail": "RF1.expandSelectedNode",
        "examples": "RF2.addExamples",
        "classify": "RF3.addSubtypes",
        "related": "RF6.addRelatedTopics",
    }
    op_id = op_by_action[state["action"]]
    return {
        **state,
        "write_plan": {**state["write_plan"], "opId": op_id, "action": state["action"]},
        "trace": state["trace"] + [f"action_router: {state['action']} -> {op_id}"],
    }


def policy_guardrails(state: PnActionState) -> PnActionState:
    errors = list(state["errors"])
    if state["action"] not in ("detail", "examples", "classify", "related"):
        errors.append(f"unsupported action: {state['action']}")
    return {
        **state,
        "errors": errors,
        "trace": state["trace"] + [
            "policy_guardrails: generator cannot mutate map; candidate must be structured"
        ],
    }


def choose_generation_source(state: PnActionState) -> CandidateRoute:
    return "mapify_teacher" if state["source"] == "mapify_teacher" else "local_generator"


def mapify_teacher_node(state: PnActionState) -> PnActionState:
    # Placeholder for a real Mapify/XMind teacher signal. It must return only
    # a structured candidate, never write directly to M3E.
    labels = ["爬虫類", "両生類", "無脊椎動物"] if state["action"] == "classify" else []
    mfh = "\n".join(f"# {label}" for label in labels)
    return {
        **state,
        "candidate_mfh": mfh,
        "trace": state["trace"] + [f"mapify_teacher: {len(labels)} candidate label(s)"],
    }


def local_generator_node(state: PnActionState) -> PnActionState:
    label = state["active_node_label"]
    action = state["action"]
    local_examples = {
        "菌類": {
            "examples": ["シイタケ", "酵母", "カビ"],
            "classify": ["担子菌類", "子嚢菌類", "接合菌類"],
            "related": ["胞子", "菌糸", "分解者"],
            "detail": ["光合成をしない", "胞子で増える", "菌糸を伸ばす"],
        },
        "魚類": {
            "examples": ["タイ", "フグ", "サケ"],
            "classify": ["硬骨魚類", "軟骨魚類"],
            "related": ["水圏", "漁業", "進化"],
            "detail": ["鰓呼吸", "水中生活", "変温動物"],
        },
    }
    labels = local_examples.get(label, {}).get(action, [])
    mfh = "\n".join(f"# {item}" for item in labels)
    errors = list(state["errors"])
    if not labels:
        errors.append(f"no grounded generator output for {label}/{action}")
    return {
        **state,
        "candidate_mfh": mfh,
        "errors": errors,
        "trace": state["trace"] + [f"local_generator: {len(labels)} candidate label(s)"],
    }


def parse_candidate(state: PnActionState) -> PnActionState:
    labels: list[str] = []
    for raw_line in state["candidate_mfh"].splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if not line.startswith("# "):
            return {
                **state,
                "errors": state["errors"] + [f"non MF-H line: {line}"],
                "trace": state["trace"] + ["parse_candidate: invalid MF-H"],
            }
        labels.append(line[2:].strip())
    return {
        **state,
        "candidate_labels": labels,
        "trace": state["trace"] + [f"parse_candidate: {len(labels)} label(s)"],
    }


def diff_planner(state: PnActionState) -> PnActionState:
    existing = {label.strip().casefold(): label for label in state["existing_children"]}
    append_labels: list[str] = []
    merge_labels: list[str] = []
    for label in state["candidate_labels"]:
        if label.casefold() in existing:
            merge_labels.append(existing[label.casefold()])
        else:
            append_labels.append(label)
    return {
        **state,
        "append_labels": append_labels,
        "merge_labels": merge_labels,
        "trace": state["trace"] + [
            f"diff_planner: append={len(append_labels)}, merge={len(merge_labels)}"
        ],
    }


def validator(state: PnActionState) -> PnActionState:
    errors = list(state["errors"])
    banned_fragments = ("具体例1", "具体例2", "小分類1", "関連概念1")
    for label in state["candidate_labels"]:
        if any(fragment in label for fragment in banned_fragments):
            errors.append(f"dummy label rejected: {label}")
        if label.lower() in {"note", "memo", "topic", "example"}:
            errors.append(f"meta label rejected: {label}")
    if not state["append_labels"] and not state["merge_labels"]:
        errors.append("candidate produced no actionable labels")
    rejected = bool(errors)
    return {
        **state,
        "errors": errors,
        "rejected": rejected,
        "trace": state["trace"] + [f"validator: {'reject' if rejected else 'valid'}"],
    }


def route_validation(state: PnActionState) -> ValidationRoute:
    return "reject" if state["rejected"] else "valid"


def build_write_plan(state: PnActionState) -> PnActionState:
    plan = {
        **state["write_plan"],
        "workspaceId": state["workspace_id"],
        "mapId": state["map_id"],
        "scopeId": state["scope_id"],
        "parentNodeId": state["active_node_id"],
        "parentLabel": state["active_node_label"],
        "appendMFH": "\n".join(f"# {label}" for label in state["append_labels"]),
        "appendLabels": state["append_labels"],
        "mergeLabels": state["merge_labels"],
    }
    return {
        **state,
        "write_plan": plan,
        "trace": state["trace"] + ["build_write_plan: ready for M3E API"],
    }


def readback_verify(state: PnActionState) -> PnActionState:
    # In production this node reads M3E after writeback and compares paths/order.
    return {
        **state,
        "status": (
            f"{state['action']} accepted: add {len(state['append_labels'])}, "
            f"merge {len(state['merge_labels'])}"
        ),
        "trace": state["trace"] + ["readback_verify: modeled success"],
    }


def reject_status(state: PnActionState) -> PnActionState:
    return {
        **state,
        "status": "rejected: " + " | ".join(state["errors"]),
        "trace": state["trace"] + ["reject_status: no writeback"],
    }


def missing_active_status(state: PnActionState) -> PnActionState:
    return {
        **state,
        "rejected": True,
        "errors": state["errors"] + ["select a node first"],
        "status": "Select a node first.",
        "trace": state["trace"] + ["missing_active_status"],
    }


def build_graph():
    graph = StateGraph(PnActionState)
    graph.add_node("resolve_active_node", resolve_active_node)
    graph.add_node("missing_active_status", missing_active_status)
    graph.add_node("action_router", action_router)
    graph.add_node("policy_guardrails", policy_guardrails)
    graph.add_node("mapify_teacher", mapify_teacher_node)
    graph.add_node("local_generator", local_generator_node)
    graph.add_node("parse_candidate", parse_candidate)
    graph.add_node("diff_planner", diff_planner)
    graph.add_node("validator", validator)
    graph.add_node("build_write_plan", build_write_plan)
    graph.add_node("readback_verify", readback_verify)
    graph.add_node("reject_status", reject_status)

    graph.add_edge(START, "resolve_active_node")
    graph.add_conditional_edges(
        "resolve_active_node",
        route_active_node,
        {"missing_active": "missing_active_status", "has_active": "action_router"},
    )
    graph.add_edge("missing_active_status", END)
    graph.add_edge("action_router", "policy_guardrails")
    graph.add_conditional_edges(
        "policy_guardrails",
        choose_generation_source,
        {"mapify_teacher": "mapify_teacher", "local_generator": "local_generator"},
    )
    graph.add_edge("mapify_teacher", "parse_candidate")
    graph.add_edge("local_generator", "parse_candidate")
    graph.add_edge("parse_candidate", "diff_planner")
    graph.add_edge("diff_planner", "validator")
    graph.add_conditional_edges(
        "validator",
        route_validation,
        {"reject": "reject_status", "valid": "build_write_plan"},
    )
    graph.add_edge("reject_status", END)
    graph.add_edge("build_write_plan", "readback_verify")
    graph.add_edge("readback_verify", END)
    return graph.compile()


def initial_state() -> PnActionState:
    return {
        "workspace_id": "ws_REMH1Z5TFA7S93R3HA0XK58JNR",
        "map_id": "codex-pn-verify-5",
        "scope_id": "n_scope",
        "active_node_id": "n_fungi",
        "active_node_label": "菌類",
        "action": "examples",
        "existing_children": ["シイタケ", "酵母"],
        "source": "local_generator",
        "candidate_mfh": "",
        "candidate_labels": [],
        "append_labels": [],
        "merge_labels": [],
        "rejected": False,
        "errors": [],
        "write_plan": {},
        "status": "",
        "trace": [],
    }


def main() -> None:
    app = build_graph()
    if "--mermaid" in sys.argv:
        print(app.get_graph().draw_mermaid())
        return
    result = app.invoke(initial_state())
    print("status:", result["status"])
    print("append:", result["append_labels"])
    print("merge:", result["merge_labels"])
    print("write_plan:", result["write_plan"])
    print("trace:")
    for item in result["trace"]:
        print("  -", item)


if __name__ == "__main__":
    main()
