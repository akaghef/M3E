#!/usr/bin/env python3
"""Project AppState-lite subtree to Markdown outline for Mapify outbound probing."""
from __future__ import annotations
import argparse, json
from pathlib import Path


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def emit(tree, node_id, depth=1, lines=None):
    if lines is None:
        lines = []
    node = tree["nodes"][node_id]
    label = str(node.get("text", "")).strip() or node_id
    if depth <= 6:
        lines.append("#" * depth + " " + label)
    else:
        lines.append("  " * (depth - 7) + "- " + label)
    for child in node.get("children", []):
        emit(tree, child, depth + 1, lines)
    return lines


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("appstate", type=Path)
    ap.add_argument("--root", default=None, help="Subtree root node ID. Defaults to appstate.rootId.")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()
    tree = load(args.appstate)
    root = args.root or tree["rootId"]
    md = "\n".join(emit(tree, root)) + "\n"
    if args.out:
        args.out.write_text(md, encoding="utf-8")
    else:
        print(md)

if __name__ == "__main__":
    main()
