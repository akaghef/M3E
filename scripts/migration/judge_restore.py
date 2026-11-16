#!/usr/bin/env python3
"""Acceptance judge for the reverse conversion (snapshot -> current map shape).

Compares the restored rows with the original workspace SQLite (read-only),
allowing only the differences listed in section 4 of
.kiro/specs/rapid-persistence-redesign/snapshot-format.md. Shares no code with
the converter. Exit status: 0 when there are no problems, 1 otherwise.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import sqlite3
import sys

EDGE_LABEL = "m3e:edge-label"
NODE_DROPPED = {"scopeId", "aliasOf"}
TOP_DROPPED = {"selectedId", "scopeId", "savedAt"}
TOP_REBUILT = {"scopes"}


def new_id(prefix, ws, map_id, kind, seed):
    return prefix + hashlib.sha256(f"{ws}|{map_id}|{kind}|{seed}".encode("utf-8")).hexdigest()[:24]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True)
    parser.add_argument("--snapshot", required=True, help="used only for its idMap records")
    parser.add_argument("--restored", required=True, help="JSON written by the restore step")
    parser.add_argument("--workspace", required=True)
    args = parser.parse_args()
    ws = args.workspace

    idmap = collections.defaultdict(dict)
    with open(args.snapshot, encoding="utf-8") as handle:
        for line in handle:
            if '"idMap"' in line:
                rec = json.loads(line)
                if rec.get("kind") == "idMap":
                    idmap[(rec["recordKind"], rec["mapId"])][rec["oldId"]] = rec["newId"]

    restored_doc = json.load(open(args.restored, encoding="utf-8"))
    restored = {row["id"]: row for row in restored_doc["rows"]}

    con = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    problems = collections.Counter()
    samples = collections.defaultdict(list)

    def bad(rule, where, detail=""):
        problems[rule] += 1
        if len(samples[rule]) < 8:
            samples[rule].append(f"{where} {detail}".strip())

    count = 0
    for row in con.execute("select * from maps order by id"):
        count += 1
        map_id = row["id"]
        state = json.loads(row["state_json"])
        got_row = restored.get(map_id)
        if got_row is None:
            bad("map.missing", map_id)
            continue
        got = got_row["state"]
        for col in ("tags", "archived", "pinned", "source", "version", "saved_at"):
            if row[col] is not None and got_row.get(col) != row[col]:
                bad("row.column", map_id, col)

        nodes = state.get("nodes", {})
        nmap = idmap[("node", map_id)]
        nid = lambda old: nmap.get(old, old)  # noqa: E731
        root = state.get("rootId")
        if got.get("rootId") != nid(root):
            bad("rootId", map_id)

        # ---- nodes ----
        got_nodes = got.get("nodes", {})
        if len(got_nodes) != len(nodes):
            bad("nodes.count", map_id, f"{len(got_nodes)} vs {len(nodes)}")
        for old, node in nodes.items():
            where = f"{map_id}/{old}"
            g = got_nodes.get(nid(old))
            if g is None:
                bad("node.missing", where)
                continue
            want = {k: v for k, v in node.items() if k not in NODE_DROPPED and v is not None}
            want["id"] = nid(old)
            if want.get("parentId") is not None:
                want["parentId"] = nid(want["parentId"])
            else:
                want.pop("parentId", None)
            listed = []
            for c in node.get("children", []):
                if c in nodes and nodes[c].get("parentId") == old and c not in listed:
                    listed.append(c)
            unlisted = sorted(c for c, n in nodes.items() if n.get("parentId") == old and c not in listed)
            want["children"] = [nid(c) for c in listed + unlisted]
            node_type = node.get("nodeType")
            if node_type in (None, "leaf") or (node_type == "folder" and old == root):
                node_type = "text"
            want["nodeType"] = node_type
            want["attributes"] = {k: v for k, v in (node.get("attributes") or {}).items() if v is not None}
            if old == root or node.get("parentId") is None:
                want["attributes"].pop(EDGE_LABEL, None)
            elif want["attributes"].get(EDGE_LABEL) == "":
                want["attributes"].pop(EDGE_LABEL)
            if node.get("targetNodeId") is not None:
                want["targetNodeId"] = nid(node["targetNodeId"])
            if want.get("isBroken") is False:
                want.pop("isBroken")
            for key, default in (("collapsed", False), ("details", ""), ("note", ""), ("link", ""), ("text", "")):
                want.setdefault(key, default)
            g_cmp = dict(g)
            if g_cmp.get("parentId") is None:
                g_cmp.pop("parentId", None)
            if g_cmp.get("isBroken") is False:
                g_cmp.pop("isBroken")
            g_cmp.setdefault("attributes", {})
            if g_cmp != want:
                keys = sorted(k for k in set(g_cmp) | set(want) if g_cmp.get(k) != want.get(k))
                bad("node.diff", where, ",".join(keys))

        # ---- links ----
        lmap = idmap[("graphlink", map_id)]
        links = state.get("links") or {}
        got_links = got.get("links") or {}
        if len(got_links) != len(links):
            bad("links.count", map_id)
        for old, link in links.items():
            g = got_links.get(lmap.get(old, old))
            where = f"{map_id}/link/{old}"
            if g is None:
                bad("link.missing", where)
                continue
            want = {k: v for k, v in link.items() if v is not None}
            want["id"] = lmap.get(old, old)
            want["sourceNodeId"] = nid(link.get("sourceNodeId"))
            want["targetNodeId"] = nid(link.get("targetNodeId"))
            for port in ("sourcePort", "targetPort"):
                if want.get(port) == "auto":
                    want.pop(port)
            if "attributes" in want:
                want["attributes"] = {k: v for k, v in want["attributes"].items() if v is not None}
                if not want["attributes"]:
                    want.pop("attributes")
            g_cmp = {k: v for k, v in g.items() if not (k == "attributes" and not v)}
            if g_cmp != want:
                keys = sorted(k for k in set(g_cmp) | set(want) if g_cmp.get(k) != want.get(k))
                bad("link.diff", where, ",".join(keys))

        # ---- scopes kept, surfaces ----
        scope_roots = {old for old, n in nodes.items() if old == root or n.get("nodeType") == "folder"}

        def bare(key):
            return key[6:] if isinstance(key, str) and key.startswith("scope:") else key

        surfaces = state.get("surfaces") or {}
        got_surfaces = got.get("surfaces") or {}
        kept = {sid: s for sid, s in surfaces.items() if bare(s.get("scopeId", "")) in scope_roots}
        if len(got_surfaces) != len(kept):
            bad("surfaces.count", map_id, f"{len(got_surfaces)} vs {len(kept)}")
        for old_sid, surface in kept.items():
            sid = new_id("v_", ws, map_id, "surface", old_sid)
            g = got_surfaces.get(sid)
            where = f"{map_id}/surface/{old_sid}"
            if g is None:
                bad("surface.missing", where)
                continue
            if g.get("scopeId") != "scope:" + nid(bare(surface.get("scopeId"))):
                bad("surface.scope", where)
            for key in ("kind", "layout", "surfaceView"):
                if g.get(key) != surface.get(key):
                    bad("surface.field", where, key)
            want_views = {}
            for node_old, view in (surface.get("nodeViews") or {}).items():
                if node_old in nodes and isinstance(view, dict):
                    clean = {k: v for k, v in view.items() if v is not None}
                    if clean:
                        want_views[nid(node_old)] = clean
            if (g.get("nodeViews") or {}) != want_views:
                bad("surface.nodeViews", where)

        # ---- scopes rebuilt ----
        got_scopes = got.get("scopes") or {}
        if set(got_scopes) != {"scope:" + nid(r) for r in scope_roots}:
            bad("scopes.set", map_id)
        for old_root in scope_roots:
            g = got_scopes.get("scope:" + nid(old_root))
            if g is None:
                continue
            old_primary = ((state.get("scopes") or {}).get(f"scope:{old_root}") or {}).get("primarySurfaceId")
            want_primary = new_id("v_", ws, map_id, "surface", old_primary) if old_primary in kept else None
            if g.get("primarySurfaceId") != want_primary:
                bad("scope.primarySurface", f"{map_id}/{old_root}")
            if g.get("rootNodeIds") != [nid(old_root)] or g.get("label") != nodes[old_root].get("text"):
                bad("scope.fields", f"{map_id}/{old_root}")

        # ---- linear text ----
        want_lin = {}
        for key in sorted(state.get("linearNotesByScope") or {}):
            text = state["linearNotesByScope"][key]
            if not text:
                continue
            b = bare(key)
            target = nid(b) if b in scope_roots else None
            if target is not None and target not in want_lin:
                want_lin[target] = text
            else:
                want_lin[key] = text
        if (got.get("linearNotesByScope") or {}) != want_lin:
            g_lin = got.get("linearNotesByScope") or {}
            keys = sorted(k for k in set(g_lin) | set(want_lin) if g_lin.get(k) != want_lin.get(k))
            bad("linear.diff", map_id, ",".join(keys)[:160])

        # ---- annotations ----
        amap = idmap[("annotation", map_id)]
        annotations = state.get("annotations") or {}
        got_ann = got.get("annotations") or {}
        if len(got_ann) != len(annotations):
            bad("annotations.count", map_id)
        for old, ann in annotations.items():
            g = got_ann.get(amap.get(old, old))
            if g is None:
                bad("annotation.missing", f"{map_id}/{old}")
                continue
            want = {k: v for k, v in ann.items() if v is not None}
            want["id"] = amap.get(old, old)
            if "scopeId" in want and bare(want["scopeId"]) in scope_roots:
                want["scopeId"] = nid(bare(want["scopeId"]))
            if g != want:
                keys = sorted(k for k in set(g) | set(want) if g.get(k) != want.get(k))
                bad("annotation.diff", f"{map_id}/{old}", ",".join(keys))

        # ---- other top-level fields ----
        for key, value in state.items():
            if key in ("rootId", "nodes", "links", "surfaces", "linearNotesByScope", "annotations") or key in TOP_DROPPED or key in TOP_REBUILT:
                continue
            if value is not None and got.get(key) != value:
                bad("top.field", map_id, key)

    if len(restored) != count:
        bad("maps.count", ws, f"{len(restored)} vs {count}")
    total = sum(problems.values())
    print(f"workspace {ws}: restore {total} problem(s) over {count} map(s)")
    for rule, n in sorted(problems.items()):
        print(f"  [{rule}] {n}")
        for sample in samples[rule]:
            print(f"      {sample}")
    return 0 if total == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
