#!/usr/bin/env python3
"""Apply a Rapid delta to AppState-lite for offline model-diff checks."""
from __future__ import annotations
import argparse, json, copy
from pathlib import Path


def apply_delta(tree, delta):
    out = copy.deepcopy(tree)
    nodes = out["nodes"]
    for action in delta.get("actions", []):
        typ = action.get("type")
        if typ == "appendChildren":
            parent = action["parentId"]
            if parent not in nodes:
                raise KeyError(f"parent not found: {parent}")
            for n in action.get("nodes", []):
                nid = n["id"]
                node = {
                    "id": nid,
                    "text": n.get("text", ""),
                    "parentId": parent,
                    "children": list(n.get("children", [])),
                    "attributes": dict(n.get("attributes", {}))
                }
                nodes[nid] = node
                nodes[parent].setdefault("children", []).append(nid)
        else:
            raise NotImplementedError(f"Unsupported delta action: {typ}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("appstate", type=Path)
    ap.add_argument("delta", type=Path)
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()
    tree = json.loads(args.appstate.read_text(encoding="utf-8"))
    delta = json.loads(args.delta.read_text(encoding="utf-8"))
    out = apply_delta(tree, delta)
    s = json.dumps(out, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        args.out.write_text(s, encoding="utf-8")
    else:
        print(s)

if __name__ == "__main__":
    main()
