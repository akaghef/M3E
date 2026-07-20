#!/usr/bin/env python3
"""Convert a relative WMF-H/MF-H fragment to a Rapid appendChildren delta.

The generation worker writes human-facing WMF-H only. This script is the
machine boundary that assigns node IDs and emits appendChildren-style JSON.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")


def parse_wmf_h(text: str) -> list[dict]:
    nodes: list[dict] = []
    stack: list[tuple[int, dict]] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line == "NEED_CONTEXT":
            if nodes:
                raise ValueError("NEED_CONTEXT cannot be mixed with headings")
            return []
        match = HEADING_RE.match(line)
        if not match:
            raise ValueError(f"Unsupported WMF-H line: {raw}")
        depth = len(match.group(1))
        label = match.group(2).strip()
        node = {"text": label, "children": []}
        while stack and stack[-1][0] >= depth:
            stack.pop()
        if stack:
            stack[-1][1]["children"].append(node)
        else:
            nodes.append(node)
        stack.append((depth, node))
    return nodes


def assign_ids(nodes: list[dict], prefix: str) -> list[dict]:
    counter = 0

    def visit(node: dict) -> dict:
        nonlocal counter
        counter += 1
        children = [visit(child) for child in node.get("children", [])]
        return {
            "id": f"{prefix}_{counter}",
            "text": node["text"],
            "children": children,
            "attributes": {},
        }

    return [visit(node) for node in nodes]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("wmf_h", type=Path)
    ap.add_argument("--parent-id", required=True)
    ap.add_argument("--op-id", default="RF1.expandSelectedNode")
    ap.add_argument("--id-prefix", default="wmfh")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    text = args.wmf_h.read_text(encoding="utf-8")
    parsed = parse_wmf_h(text)
    delta = {
        "opId": args.op_id,
        "selectedNodeId": args.parent_id,
        "source": "wmf_h_converter",
        "actions": [
            {
                "type": "appendChildren",
                "parentId": args.parent_id,
                "nodes": assign_ids(parsed, args.id_prefix),
            }
        ],
    }
    output = json.dumps(delta, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        args.out.write_text(output, encoding="utf-8")
    else:
        print(output, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
