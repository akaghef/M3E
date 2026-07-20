#!/usr/bin/env python3
"""Convert Mapify/XMind content.json into AppState-lite candidate tree.

This parser expects the common XMind JSON shape:
  [ { "rootTopic": { "id": ..., "title": ..., "children": { "attached": [...] } } } ]
"""
from __future__ import annotations
import argparse, json, re
from pathlib import Path


def safe_id(raw: str) -> str:
    return "xmind_" + re.sub(r"[^A-Za-z0-9_\-]", "_", raw or "node")


def walk(topic, parent_id, nodes):
    nid = safe_id(str(topic.get("id") or topic.get("title") or len(nodes)))
    children_topics = ((topic.get("children") or {}).get("attached") or [])
    child_ids = []
    nodes[nid] = {
        "id": nid,
        "text": str(topic.get("title") or "").strip(),
        "parentId": parent_id,
        "children": child_ids,
        "attributes": {
            "xmind:id": topic.get("id"),
            "xmind:class": topic.get("class"),
            "m3e:layout": topic.get("structureClass"),
            "collapsed": topic.get("topic-title-folding") not in (None, "unfolded")
        }
    }
    for ch in children_topics:
        cid = walk(ch, nid, nodes)
        child_ids.append(cid)
    return nid


def convert(content):
    sheet = content[0] if isinstance(content, list) else content
    root_topic = sheet.get("rootTopic") or sheet
    nodes = {}
    root_id = walk(root_topic, None, nodes)
    return {"rootId": root_id, "scopeId": "scope_from_xmind", "nodes": nodes}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("content_json", type=Path)
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()
    content = json.loads(args.content_json.read_text(encoding="utf-8"))
    appstate = convert(content)
    s = json.dumps(appstate, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        args.out.write_text(s, encoding="utf-8")
    else:
        print(s)

if __name__ == "__main__":
    main()
