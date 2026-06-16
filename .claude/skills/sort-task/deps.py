#!/usr/bin/env python3
"""Task dependency graph tool. Reasons over projects/deps.json.

Usage:
    python .claude/skills/sort-task/deps.py <command> [args] [--json]

Queries (open tasks only, except 'info'):
    sort                     priority-weighted topological order
    layers                   parallel execution layers (L0, L1, ...)
    critical                 critical path (longest dependency chain)
    ready                    tasks whose predecessors are all closed
    blockers <id>            open ancestors of <id>
    unblocks <id>            descendants of <id>
    info <id>                node details (always JSON)
    check                    validate (no cycles, known states)

Mutations:
    add <id> [--title T] [--state S] [--priority N]
    dep <from> <to>          add edge (from must precede to)
    rm-dep <from> <to>
    state <id> <new_state>   draft|active|gated|todo|done|cancelled
    rm <id>

Edge convention: [A, B] means A must be done before B.
"""
import json
import sys
from pathlib import Path

try:
    import networkx as nx
except ImportError:
    sys.stderr.write("networkx not installed. Run: python -m pip install networkx\n")
    sys.exit(2)

ROOT = Path(__file__).resolve().parents[3]
DEPS_PATH = ROOT / "projects" / "deps.json"

DONE_STATES = {"done", "cancelled"}
OPEN_STATES = {"draft", "active", "gated", "todo"}


def load():
    G = nx.DiGraph()
    if not DEPS_PATH.exists():
        return G
    data = json.loads(DEPS_PATH.read_text(encoding="utf-8"))
    for t in data.get("tasks", []):
        tid = t["id"]
        attrs = {k: v for k, v in t.items() if k != "id"}
        G.add_node(tid, **attrs)
    for src, dst in data.get("deps", []):
        if src not in G:
            G.add_node(src)
        if dst not in G:
            G.add_node(dst)
        G.add_edge(src, dst)
    return G


def save(G):
    tasks = [{"id": n, **dict(G.nodes[n])} for n in sorted(G.nodes)]
    deps = sorted([[s, t] for s, t in G.edges])
    data = {"tasks": tasks, "deps": deps}
    DEPS_PATH.parent.mkdir(parents=True, exist_ok=True)
    DEPS_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def is_open(G, n):
    return G.nodes[n].get("state", "draft") not in DONE_STATES


def open_subgraph(G):
    return G.subgraph([n for n in G.nodes if is_open(G, n)]).copy()


def longest_depth(G):
    """Longest outgoing path length (edges) from each node within G."""
    depth = {}
    for n in reversed(list(nx.topological_sort(G))):
        succs = list(G.successors(n))
        depth[n] = (max(depth[s] for s in succs) + 1) if succs else 0
    return depth


def compute_scores(G):
    depth = longest_depth(G) if G.number_of_nodes() else {}
    scores = {}
    for n in G.nodes:
        unblock = len(nx.descendants(G, n))
        prio = G.nodes[n].get("priority", 0) or 0
        scores[n] = 2 * unblock + depth.get(n, 0) + prio
    return scores


def emit_ids(ids, G, args):
    if args.get("json"):
        print(json.dumps(
            [{"id": n, **dict(G.nodes[n])} for n in ids],
            ensure_ascii=False,
        ))
    else:
        for n in ids:
            print(n)


def die(msg, code=1):
    sys.stderr.write(msg + "\n")
    sys.exit(code)


# --- Commands ---
def cmd_sort(args, G):
    S = open_subgraph(G)
    if not nx.is_directed_acyclic_graph(S):
        die("cycle detected in open subgraph")
    scores = compute_scores(S)
    order = list(nx.lexicographical_topological_sort(
        S, key=lambda n: (-scores[n], n)
    ))
    emit_ids(order, G, args)


def cmd_layers(args, G):
    S = open_subgraph(G)
    if not nx.is_directed_acyclic_graph(S):
        die("cycle detected in open subgraph")
    scores = compute_scores(S)
    layers = [
        sorted(layer, key=lambda n: (-scores[n], n))
        for layer in nx.topological_generations(S)
    ]
    if args.get("json"):
        print(json.dumps(layers, ensure_ascii=False))
    else:
        for i, layer in enumerate(layers):
            print(f"L{i}: " + " ".join(layer))


def cmd_critical(args, G):
    S = open_subgraph(G)
    if S.number_of_nodes() == 0:
        return
    if not nx.is_directed_acyclic_graph(S):
        die("cycle detected in open subgraph")
    path = nx.dag_longest_path(S)
    emit_ids(path, G, args)


def cmd_ready(args, G):
    ids = [
        n for n in G.nodes
        if is_open(G, n)
        and all(not is_open(G, p) for p in G.predecessors(n))
    ]
    S = open_subgraph(G)
    scores = compute_scores(S) if S.number_of_nodes() else {}
    ids.sort(key=lambda n: (-scores.get(n, 0), n))
    emit_ids(ids, G, args)


def cmd_blockers(args, G):
    tid = args["pos"][0]
    if tid not in G:
        die(f"unknown task {tid}")
    blocking = sorted(a for a in nx.ancestors(G, tid) if is_open(G, a))
    emit_ids(blocking, G, args)


def cmd_unblocks(args, G):
    tid = args["pos"][0]
    if tid not in G:
        die(f"unknown task {tid}")
    emit_ids(sorted(nx.descendants(G, tid)), G, args)


def cmd_info(args, G):
    tid = args["pos"][0]
    if tid not in G:
        die(f"unknown task {tid}")
    info = {
        "id": tid,
        **dict(G.nodes[tid]),
        "predecessors": sorted(G.predecessors(tid)),
        "successors": sorted(G.successors(tid)),
        "ancestors_count": len(nx.ancestors(G, tid)),
        "descendants_count": len(nx.descendants(G, tid)),
    }
    print(json.dumps(info, ensure_ascii=False, indent=2))


def cmd_check(args, G):
    issues = []
    if not nx.is_directed_acyclic_graph(G):
        cycles = list(nx.simple_cycles(G))
        issues.append(f"cycles: {cycles}")
    for n in G.nodes:
        state = G.nodes[n].get("state")
        if state is not None and state not in DONE_STATES | OPEN_STATES:
            issues.append(f"unknown state on {n}: {state}")
    if issues:
        for i in issues:
            print(i)
        sys.exit(1)
    print("ok")


def cmd_add(args, G):
    tid = args["pos"][0]
    if tid in G:
        die(f"{tid} exists")
    attrs = {"state": args.get("state") or "draft"}
    if args.get("title"):
        attrs["title"] = args["title"]
    if args.get("priority") is not None:
        attrs["priority"] = args["priority"]
    G.add_node(tid, **attrs)
    save(G)
    print(tid)


def cmd_dep(args, G):
    src, dst = args["pos"][0], args["pos"][1]
    for n in (src, dst):
        if n not in G:
            die(f"unknown task {n}")
    G.add_edge(src, dst)
    if not nx.is_directed_acyclic_graph(G):
        G.remove_edge(src, dst)
        die("edge would create cycle")
    save(G)
    print(f"{src} -> {dst}")


def cmd_rm_dep(args, G):
    src, dst = args["pos"][0], args["pos"][1]
    if not G.has_edge(src, dst):
        die(f"no edge {src} -> {dst}")
    G.remove_edge(src, dst)
    save(G)


def cmd_state(args, G):
    tid, new = args["pos"][0], args["pos"][1]
    if tid not in G:
        die(f"unknown task {tid}")
    G.nodes[tid]["state"] = new
    save(G)
    print(f"{tid}: {new}")


def cmd_rm(args, G):
    tid = args["pos"][0]
    if tid not in G:
        die(f"unknown task {tid}")
    G.remove_node(tid)
    save(G)


COMMANDS = {
    "sort": cmd_sort,
    "layers": cmd_layers,
    "critical": cmd_critical,
    "ready": cmd_ready,
    "blockers": cmd_blockers,
    "unblocks": cmd_unblocks,
    "info": cmd_info,
    "check": cmd_check,
    "add": cmd_add,
    "dep": cmd_dep,
    "rm-dep": cmd_rm_dep,
    "state": cmd_state,
    "rm": cmd_rm,
}

POSITIONAL = {
    "blockers": 1, "unblocks": 1, "info": 1,
    "add": 1, "dep": 2, "rm-dep": 2, "state": 2, "rm": 1,
}


def parse_args(argv):
    if not argv:
        sys.stderr.write(__doc__)
        sys.exit(0)
    cmd, rest = argv[0], argv[1:]
    args = {"pos": []}
    i = 0
    while i < len(rest):
        a = rest[i]
        if a == "--json":
            args["json"] = True
        elif a == "--title":
            args["title"] = rest[i + 1]
            i += 1
        elif a == "--state":
            args["state"] = rest[i + 1]
            i += 1
        elif a == "--priority":
            args["priority"] = int(rest[i + 1])
            i += 1
        else:
            args["pos"].append(a)
        i += 1
    return cmd, args


def main():
    cmd, args = parse_args(sys.argv[1:])
    if cmd not in COMMANDS:
        sys.stderr.write(f"unknown command: {cmd}\n{__doc__}")
        sys.exit(2)
    need = POSITIONAL.get(cmd, 0)
    if len(args["pos"]) < need:
        die(f"{cmd}: expected {need} positional arg(s), got {len(args['pos'])}", 2)
    G = load()
    COMMANDS[cmd](args, G)


if __name__ == "__main__":
    main()
