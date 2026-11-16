#!/usr/bin/env python3
"""Acceptance judge for the one-time migration snapshot.

Reads the current workspace SQLite (read-only) and a portable snapshot (JSON
Lines) and checks every conversion rule of
.kiro/specs/rapid-persistence-redesign/snapshot-format.md independently of the
converter. It shares no code with the converter on purpose.

Exit status: 0 when there are no problems, 1 otherwise, 2 on usage errors.
The criteria here are owned by the spec owner; do not relax them to make a
converter pass.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import sqlite3
import sys

ID_OK = re.compile(r"^[A-Za-z0-9_.:\-]{1,64}$")
ORD_OK = re.compile(r"^[0-9a-z]+$")
NODE_KNOWN = {
    "id", "parentId", "children", "nodeType", "scopeId", "text", "collapsed",
    "details", "note", "attributes", "link", "targetNodeId", "aliasLabel",
    "access", "targetSnapshotLabel", "isBroken", "aliasOf",
}
LINK_KNOWN = {
    "id", "sourceNodeId", "targetNodeId", "relationType", "label", "direction",
    "style", "color", "sourcePort", "targetPort", "attributes",
}
TOP_KNOWN = {
    "rootId", "nodes", "links", "annotations", "scopes", "surfaces",
    "linearNotesByScope", "linearTextFontScale", "linearPanelWidth",
}
TOP_DROPPED = {"selectedId", "scopeId", "savedAt"}
EDGE_LABEL = "m3e:edge-label"


class Problems:
    def __init__(self, limit_per_rule: int = 20) -> None:
        self.count = collections.Counter()
        self.samples: dict[str, list[str]] = collections.defaultdict(list)
        self.limit = limit_per_rule

    def add(self, rule: str, where: str, detail: str = "") -> None:
        self.count[rule] += 1
        if len(self.samples[rule]) < self.limit:
            self.samples[rule].append(f"{where} {detail}".strip())

    def total(self) -> int:
        return sum(self.count.values())


def new_id(prefix: str, ws: str, map_id: str, kind: str, seed: str) -> str:
    digest = hashlib.sha256(f"{ws}|{map_id}|{kind}|{seed}".encode("utf-8")).hexdigest()
    return prefix + digest[:24]


def load_maps(db_path: str) -> list[dict]:
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    cols = {r[1] for r in con.execute("pragma table_info(maps)")}
    rows = []
    for r in con.execute("select * from maps order by id"):
        row = {c: r[c] for c in cols}
        row["state"] = json.loads(r["state_json"])
        rows.append(row)
    con.close()
    return rows


def load_snapshot(path: str, problems: Problems) -> dict[str, list[dict]]:
    by_kind: dict[str, list[dict]] = collections.defaultdict(list)
    with open(path, encoding="utf-8") as handle:
        for number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except ValueError as error:
                problems.add("file.json", f"line {number}", str(error))
                continue
            if not isinstance(record, dict) or "kind" not in record:
                problems.add("file.kind", f"line {number}")
                continue
            if number == 1 and record.get("kind") != "snapshot":
                problems.add("file.header", "line 1", "first record must be the snapshot header")
            by_kind[record["kind"]].append(record)
            walk_no_null(record, f"line {number}", problems)
    return by_kind


def walk_no_null(value, where: str, problems: Problems, inside_free: bool = False) -> None:
    # null is never written, except inside values carried over verbatim
    # (attributes values other than a top-level null, extra, annotation fields).
    if isinstance(value, dict):
        for key, item in value.items():
            free = inside_free or key in ("extra", "attributes")
            if item is None and not inside_free and key not in ("extra",):
                problems.add("file.null", where, key)
            walk_no_null(item, where, problems, free)
    elif isinstance(value, list):
        for item in value:
            walk_no_null(item, where, problems, inside_free)


def needs_new_id(node_id: str) -> bool:
    return not ID_OK.match(node_id)


def judge(ws: str, maps: list[dict], snap: dict[str, list[dict]], problems: Problems) -> dict:
    stats = collections.Counter()

    header = snap.get("snapshot", [])
    if len(header) != 1 or header[0].get("format") != 1 or header[0].get("workspaceId") != ws:
        problems.add("file.header", "snapshot", json.dumps(header)[:200])

    # ---- expected id mapping (rule 3.1), computed independently ----
    seen_ids: set[str] = set()
    node_new: dict[tuple[str, str], str] = {}
    link_new: dict[tuple[str, str], str] = {}
    ann_new: dict[tuple[str, str], str] = {}
    renumbered: set[tuple[str, str, str]] = set()
    for row in maps:  # already ordered by map id
        map_id = row["id"]
        for kind, prefix, table, source in (
            ("node", "n_", node_new, row["state"].get("nodes") or {}),
            ("graphlink", "c_", link_new, row["state"].get("links") or {}),
            ("annotation", "a_", ann_new, row["state"].get("annotations") or {}),
        ):
            for old in sorted(source):
                if needs_new_id(old) or old in seen_ids:
                    table[(map_id, old)] = new_id(prefix, ws, map_id, kind, old)
                    renumbered.add((kind, map_id, old))
                else:
                    table[(map_id, old)] = old
                    seen_ids.add(old)

    s_nodes = {r["id"]: r for r in snap.get("node", [])}
    if len(s_nodes) != len(snap.get("node", [])):
        problems.add("id.unique.node", "snapshot", "duplicate node id")
    s_details = {r["nodeId"]: r for r in snap.get("details", [])}
    s_conn = {r["id"]: r for r in snap.get("connection", [])}
    if len(s_conn) != len(snap.get("connection", [])):
        problems.add("id.unique.connection", "snapshot", "duplicate connection id")
    s_scopes = {r["id"]: r for r in snap.get("scope", [])}
    s_surfaces = {r["id"]: r for r in snap.get("surface", [])}
    s_maps = {r["id"]: r for r in snap.get("map", [])}
    s_idmap = {(r.get("recordKind"), r.get("mapId"), r.get("oldId")): r.get("newId") for r in snap.get("idMap", [])}
    edges_by_target: dict[str, list[dict]] = collections.defaultdict(list)
    edges_by_source: dict[str, list[dict]] = collections.defaultdict(list)
    links_by_map: dict[str, dict[str, dict]] = collections.defaultdict(dict)
    for c in s_conn.values():
        if c.get("type") == "edge":
            edges_by_target[c.get("target")].append(c)
            edges_by_source[c.get("source")].append(c)
        elif c.get("type") == "graphlink":
            links_by_map[c.get("mapId")][c["id"]] = c
        else:
            problems.add("connection.type", c["id"], str(c.get("type")))
    scope_by_root = {}
    for s in s_scopes.values():
        if s.get("rootNodeId") in scope_by_root:
            problems.add("scope.root.unique", s["id"], s.get("rootNodeId", ""))
        scope_by_root[s.get("rootNodeId")] = s
    lin_by_scope = {r["scopeId"]: r for r in snap.get("linearText", []) if "scopeId" in r}
    lin_orphans = {(r.get("mapId"), r.get("orphanKey")): r for r in snap.get("linearText", []) if "orphanKey" in r}
    views = {(r.get("surfaceId"), r.get("nodeId")): r for r in snap.get("nodeView", [])}
    annotations = {r.get("id"): r for r in snap.get("annotation", [])}

    expected_nodes = 0
    expected_edges = 0
    expected_links = 0
    expected_scopes = 0
    expected_details = 0
    expected_views = 0
    expected_lin = 0
    expected_ann = 0
    expected_surfaces = 0
    used_scope_ids: set[str] = set()
    used_surface_ids: set[str] = set()
    used_conn_ids: set[str] = set()

    for row in maps:
        map_id = row["id"]
        state = row["state"]
        nodes = state.get("nodes", {})
        nid = lambda old: node_new.get((map_id, old))  # noqa: E731
        stats["maps"] += 1

        # ---- map record ----
        m = s_maps.get(map_id)
        if m is None:
            problems.add("map.missing", map_id)
        else:
            if m.get("rootNodeId") != nid(state.get("rootId")):
                problems.add("map.root", map_id)
            for col, field in (("tags", "tags"), ("archived", "archived"), ("pinned", "pinned"),
                               ("source", "source"), ("version", "legacyVersion"), ("saved_at", "legacySavedAt")):
                if col in row and row[col] is not None and m.get(field) != row[col]:
                    problems.add("map.column", map_id, col)
            if m.get("rev") != 0:
                problems.add("map.rev", map_id)
            for key in ("linearTextFontScale", "linearPanelWidth"):
                if state.get(key) is not None and m.get(key) != state.get(key):
                    problems.add("map.field", map_id, key)
            extra = m.get("extra", {})
            for key, value in state.items():
                if key in TOP_KNOWN or key in TOP_DROPPED:
                    continue
                if value is not None and extra.get(key) != value:
                    problems.add("map.extra", map_id, key)

        # ---- nodes ----
        for old, node in nodes.items():
            expected_nodes += 1
            new = nid(old)
            rec = s_nodes.get(new)
            where = f"{map_id}/{old}"
            if rec is None:
                problems.add("node.missing", where)
                if node.get("parentId") is not None:
                    expected_edges += 1
                if node.get("details") or node.get("note") or node.get("link"):
                    expected_details += 1
                continue
            if ("node", map_id, old) in renumbered and s_idmap.get(("node", map_id, old)) != new:
                problems.add("node.idmap", where)
            if rec.get("mapId") != map_id:
                problems.add("node.mapId", where)
            if rec.get("text") != node.get("text"):
                problems.add("node.text", where)
            if bool(rec.get("collapsed", False)) != bool(node.get("collapsed", False)):
                problems.add("node.collapsed", where)
            if rec.get("collapsed") is False:
                problems.add("node.collapsed.default-written", where)
            old_type = node.get("nodeType")
            want_type = None if old_type in (None, "text", "folder", "leaf") else old_type
            if rec.get("nodeType") != want_type:
                problems.add("node.nodeType", where, f"{old_type!r} -> {rec.get('nodeType')!r}")
            # attributes
            want_attrs = {k: v for k, v in (node.get("attributes") or {}).items() if v is not None and k != EDGE_LABEL}
            if rec.get("attributes", {}) != want_attrs:
                problems.add("node.attributes", where)
            if "attributes" in rec and not rec["attributes"]:
                problems.add("node.attributes.empty-written", where)
            # alias
            want_alias = {}
            if node.get("targetNodeId") is not None:
                want_alias["target"] = nid(node["targetNodeId"]) or node["targetNodeId"]
            if node.get("aliasLabel") is not None:
                want_alias["label"] = node["aliasLabel"]
            if node.get("access") is not None:
                want_alias["access"] = node["access"]
            if node.get("targetSnapshotLabel") is not None:
                want_alias["snapshotLabel"] = node["targetSnapshotLabel"]
            if node.get("isBroken") is True:
                want_alias["broken"] = True
            if rec.get("alias", {}) != want_alias:
                problems.add("node.alias", where, json.dumps(rec.get("alias"), ensure_ascii=False)[:120])
            # extra
            want_extra = {k: v for k, v in node.items() if k not in NODE_KNOWN and v is not None}
            if rec.get("extra", {}) != want_extra:
                problems.add("node.extra", where, ",".join(sorted(want_extra)))
            if rec.get("rev") != 0:
                problems.add("node.rev", where)
            # details
            want_details = {}
            if node.get("details"):
                want_details["body"] = node["details"]
            if node.get("note"):
                want_details["note"] = node["note"]
            if node.get("link"):
                want_details["link"] = node["link"]
            drec = s_details.get(new)
            if want_details:
                expected_details += 1
                if drec is None:
                    problems.add("details.missing", where)
                else:
                    got = {k: drec[k] for k in ("body", "note", "link") if k in drec}
                    if got != want_details:
                        problems.add("details.content", where)
                    if drec.get("v") != 1 or drec.get("rev") != 0 or drec.get("mapId") != map_id:
                        problems.add("details.meta", where)
            elif drec is not None:
                problems.add("details.unexpected", where)

            # ---- edge into this node ----
            parent = node.get("parentId")
            incoming = edges_by_target.get(new, [])
            if parent is None:
                if incoming:
                    problems.add("edge.unexpected", where)
            else:
                expected_edges += 1
                if len(incoming) != 1:
                    problems.add("edge.count", where, str(len(incoming)))
                else:
                    edge = incoming[0]
                    used_conn_ids.add(edge["id"])
                    if edge.get("source") != nid(parent):
                        problems.add("edge.source", where)
                    if edge["id"] != new_id("c_", ws, map_id, "edge", new):
                        problems.add("edge.id", where, edge["id"])
                    if edge.get("mapId") != map_id or edge.get("rev") != 0:
                        problems.add("edge.meta", where)
                    label = (node.get("attributes") or {}).get(EDGE_LABEL)
                    want_label = label if isinstance(label, str) and label != "" else None
                    if edge.get("label") != want_label:
                        problems.add("edge.label", where)
                    if "relationType" in edge:
                        problems.add("edge.relationType.unexpected", where)
                    ord_key = edge.get("ord")
                    if not isinstance(ord_key, str) or not ORD_OK.match(ord_key) or ord_key.endswith("0"):
                        problems.add("edge.ord.form", where, repr(ord_key))

        # ---- sibling order ----
        for old, node in nodes.items():
            listed = [c for c in node.get("children", []) if c in nodes and nodes[c].get("parentId") == old]
            seen = set(listed)
            unlisted = sorted(
                (c for c, n in nodes.items() if n.get("parentId") == old and c not in seen),
                key=lambda c: nid(c),
            )
            want_order = [nid(c) for c in listed + unlisted]
            got_edges = sorted(edges_by_source.get(nid(old), []), key=lambda e: (e.get("ord", ""), e["id"]))
            got_order = [e.get("target") for e in got_edges]
            if got_order != want_order:
                problems.add("edge.order", f"{map_id}/{old}", f"{len(got_order)} vs {len(want_order)}")
            keys = [e.get("ord") for e in got_edges]
            if len(set(keys)) != len(keys):
                problems.add("edge.ord.duplicate", f"{map_id}/{old}")

        # ---- graph links ----
        for old_id, link in (state.get("links") or {}).items():
            expected_links += 1
            where = f"{map_id}/link/{old_id}"
            want_link_id = link_new[(map_id, old_id)]
            rec = links_by_map[map_id].get(want_link_id)
            if rec is None:
                problems.add("link.missing", where)
                continue
            if ("graphlink", map_id, old_id) in renumbered and s_idmap.get(("graphlink", map_id, old_id)) != want_link_id:
                problems.add("link.idmap", where)
            if rec.get("rev") != 0:
                problems.add("link.rev", where)
            used_conn_ids.add(rec["id"])
            if rec.get("source") != (nid(link.get("sourceNodeId")) or link.get("sourceNodeId")):
                problems.add("link.source", where)
            if rec.get("target") != (nid(link.get("targetNodeId")) or link.get("targetNodeId")):
                problems.add("link.target", where)
            for key in ("relationType", "label", "direction", "style", "color"):
                if link.get(key) != rec.get(key):
                    problems.add("link.field", where, key)
            for key in ("sourcePort", "targetPort"):
                want = link.get(key)
                if want == "auto":
                    want = None
                if rec.get(key) != want:
                    problems.add("link.port", where, key)
            want_attrs = {k: v for k, v in (link.get("attributes") or {}).items() if v is not None}
            if rec.get("attributes", {}) != want_attrs:
                problems.add("link.attributes", where)
            want_extra = {k: v for k, v in link.items() if k not in LINK_KNOWN and v is not None}
            if rec.get("extra", {}) != want_extra:
                problems.add("link.extra", where)

        # ---- scopes ----
        root = state.get("rootId")
        scope_roots = [old for old, n in nodes.items() if old == root or n.get("nodeType") == "folder"]
        old_scopes = state.get("scopes") or {}
        old_surfaces = state.get("surfaces") or {}
        surface_new: dict[str, str] = {}
        kept_surfaces: set[str] = set()
        for old_sid, surface in old_surfaces.items():
            scope_key = surface.get("scopeId", "")
            scope_root = scope_key[6:] if isinstance(scope_key, str) and scope_key.startswith("scope:") else scope_key
            if scope_root in scope_roots:
                kept_surfaces.add(old_sid)
                surface_new[old_sid] = new_id("v_", ws, map_id, "surface", old_sid)
        for old in scope_roots:
            expected_scopes += 1
            where = f"{map_id}/scope/{old}"
            want_id = new_id("s_", ws, map_id, "scope", nid(old))
            rec = s_scopes.get(want_id)
            if rec is None:
                problems.add("scope.missing", where)
                continue
            used_scope_ids.add(want_id)
            if rec.get("rootNodeId") != nid(old) or rec.get("mapId") != map_id or rec.get("rev") != 0:
                problems.add("scope.meta", where)
            if "label" in rec or "rootNodeIds" in rec or "relationIds" in rec:
                problems.add("scope.dropped-field-present", where)
            primary = (old_scopes.get(f"scope:{old}") or {}).get("primarySurfaceId")
            want_primary = surface_new.get(primary) if primary else None
            if rec.get("primarySurfaceId") != want_primary:
                problems.add("scope.primarySurface", where)

        def scope_id_for(key):
            if not isinstance(key, str):
                return None
            root_key = key[6:] if key.startswith("scope:") else key
            if root_key in scope_roots:
                return new_id("s_", ws, map_id, "scope", nid(root_key))
            return None

        # ---- linear text ----
        for key, text in (state.get("linearNotesByScope") or {}).items():
            if text is None or text == "":
                continue
            expected_lin += 1
            where = f"{map_id}/linear/{key}"
            sid = scope_id_for(key)
            rec = lin_by_scope.get(sid) if sid else lin_orphans.get((map_id, key))
            if rec is None:
                problems.add("linear.missing", where)
            elif rec.get("text") != text or rec.get("mapId") != map_id or rec.get("rev") != 0:
                problems.add("linear.content", where)
            elif not sid:
                bare = key[6:] if key.startswith("scope:") else key
                want_anchor = nid(bare) if bare in nodes else None
                if rec.get("anchorNodeId") != want_anchor:
                    problems.add("linear.anchor", where)

        # ---- surfaces and node views ----
        for old_sid in kept_surfaces:
            expected_surfaces += 1
            surface = old_surfaces[old_sid]
            where = f"{map_id}/surface/{old_sid}"
            rec = s_surfaces.get(surface_new[old_sid])
            if rec is None:
                problems.add("surface.missing", where)
                for node_old, view in (surface.get("nodeViews") or {}).items():
                    if node_old in nodes and isinstance(view, dict) and any(v is not None for v in view.values()):
                        expected_views += 1
                continue
            used_surface_ids.add(rec["id"])
            if s_idmap.get(("surface", map_id, old_sid)) != rec["id"]:
                problems.add("surface.idmap", where)
            if rec.get("scopeId") != scope_id_for(surface.get("scopeId")):
                problems.add("surface.scope", where)
            if rec.get("surfaceKind") != surface.get("kind") or rec.get("layout") != surface.get("layout"):
                problems.add("surface.kind", where)
            if rec.get("surfaceView") != surface.get("surfaceView"):
                problems.add("surface.view", where)
            for node_old, view in (surface.get("nodeViews") or {}).items():
                if node_old not in nodes or not isinstance(view, dict):
                    continue
                want = {k: v for k, v in view.items() if v is not None}
                if not want:
                    continue
                expected_views += 1
                vrec = views.get((rec["id"], nid(node_old)))
                if vrec is None:
                    problems.add("nodeView.missing", f"{where}/{node_old}")
                else:
                    got = {k: v for k, v in vrec.items() if k not in ("kind", "surfaceId", "nodeId", "mapId")}
                    if got != want:
                        problems.add("nodeView.content", f"{where}/{node_old}")

        # ---- annotations ----
        for old_id, ann in (state.get("annotations") or {}).items():
            expected_ann += 1
            where = f"{map_id}/annotation/{old_id}"
            rec = annotations.get(ann_new[(map_id, old_id)])
            if rec is None:
                problems.add("annotation.missing", where)
                continue
            if rec.get("mapId") != map_id or rec.get("rev") != 0:
                problems.add("annotation.meta", where)
            for key, value in ann.items():
                if key in ("id", "scopeId") or value is None:
                    continue
                # the current `kind` (pen / text) collides with the record kind
                if rec.get("annotationKind" if key == "kind" else key) != value:
                    problems.add("annotation.field", where, key)
            if ann.get("scopeId") is not None:
                sid = scope_id_for(ann["scopeId"])
                if sid:
                    if rec.get("scopeId") != sid:
                        problems.add("annotation.scope", where)
                elif "scopeId" in rec or (rec.get("extra") or {}).get("scopeId") != ann["scopeId"]:
                    problems.add("annotation.scope.unresolved", where)

    # ---- nothing extra ----
    counts = {
        "node": (len(s_nodes), expected_nodes),
        "details": (len(s_details), expected_details),
        "edge": (sum(1 for c in s_conn.values() if c.get("type") == "edge"), expected_edges),
        "graphlink": (sum(1 for c in s_conn.values() if c.get("type") == "graphlink"), expected_links),
        "scope": (len(s_scopes), expected_scopes),
        "surface": (len(s_surfaces), expected_surfaces),
        "nodeView": (len(views), expected_views),
        "linearText": (len(snap.get("linearText", [])), expected_lin),
        "annotation": (len(annotations), expected_ann),
        "map": (len(s_maps), len(maps)),
    }
    for kind, (got, want) in counts.items():
        stats[f"{kind}.snapshot"] = got
        stats[f"{kind}.expected"] = want
        if got != want:
            problems.add("count", kind, f"snapshot {got} expected {want}")

    # ---- structural invariants on the snapshot itself ----
    parent_of = {}
    for c in s_conn.values():
        if c.get("type") != "edge":
            if c.get("source") not in s_nodes and c.get("source") not in s_conn:
                problems.add("inv.link.endpoint", c["id"], "source")
            if c.get("target") not in s_nodes and c.get("target") not in s_conn:
                problems.add("inv.link.endpoint", c["id"], "target")
            continue
        if c.get("source") not in s_nodes or c.get("target") not in s_nodes:
            problems.add("inv.edge.endpoint", c["id"])
        if c.get("target") in parent_of:
            problems.add("inv.single-parent", c.get("target", ""))
        parent_of[c.get("target")] = c.get("source")
    roots = {m.get("rootNodeId") for m in s_maps.values()}
    for node_id in s_nodes:
        if node_id in roots:
            if node_id in parent_of:
                problems.add("inv.root-has-parent", node_id)
            continue
        if node_id not in parent_of:
            problems.add("inv.orphan", node_id)
    state_of: dict[str, int] = {}
    for start in s_nodes:
        path = []
        cur = start
        while cur is not None and state_of.get(cur) is None:
            state_of[cur] = 1
            path.append(cur)
            cur = parent_of.get(cur)
        if cur is not None and state_of.get(cur) == 1:
            problems.add("inv.cycle", cur)
        for item in path:
            state_of[item] = 2
    for rec in s_nodes.values():
        if rec.get("nodeType") == "alias":
            if rec["id"] in edges_by_source:
                problems.add("inv.alias-has-children", rec["id"])
            target = (rec.get("alias") or {}).get("target")
            if target in s_nodes and s_nodes[target].get("nodeType") == "alias" and not (rec.get("alias") or {}).get("broken"):
                problems.add("inv.alias-to-alias", rec["id"])
            if rec["id"] in scope_by_root:
                problems.add("inv.alias-scope-root", rec["id"])
    for s in s_scopes.values():
        if s.get("rootNodeId") not in s_nodes:
            problems.add("inv.scope.root-missing", s["id"])
    ids = collections.Counter()
    for group in (s_nodes, s_conn, s_scopes, s_surfaces, annotations):
        ids.update(group.keys())
    for value, n in ids.items():
        if n > 1:
            problems.add("inv.id.global-unique", value)

    # ---- seeded records ----
    names = {r.get("name") for r in snap.get("relationTypeDef", [])}
    for name in ("consist-of", "detail", "rdfs:subClassOf", "rdf:type"):
        if name not in names:
            problems.add("seed.relationTypeDef", name)
    if {r.get("prefix") for r in snap.get("prefix", [])} != {"rdf", "rdfs"}:
        problems.add("seed.prefix", "prefix")
    accounts = {r.get("id") for r in snap.get("account", [])}
    if "acct_migration" not in accounts:
        problems.add("seed.account", "acct_migration")
    commits = snap.get("commit", [])
    if len(commits) != 1 or commits[0].get("seq") != 0 or commits[0].get("issuer") not in accounts:
        problems.add("seed.commit", "seq 0")
    return dict(stats)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True, help="workspace SQLite (opened read-only)")
    parser.add_argument("--snapshot", required=True, help="portable snapshot (JSON Lines)")
    parser.add_argument("--workspace", required=True, help="workspace id used for the conversion")
    parser.add_argument("--json", action="store_true", help="print a JSON summary")
    args = parser.parse_args()

    problems = Problems()
    maps = load_maps(args.db)
    snap = load_snapshot(args.snapshot, problems)
    stats = judge(args.workspace, maps, snap, problems)
    summary = {
        "workspace": args.workspace,
        "problems": problems.total(),
        "byRule": dict(problems.count),
        "samples": problems.samples,
        "stats": stats,
    }
    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        print(f"workspace {args.workspace}: {problems.total()} problem(s)")
        for key in sorted(stats):
            print(f"  {key}: {stats[key]}")
        for rule, count in sorted(problems.count.items()):
            print(f"  [{rule}] {count}")
            for sample in problems.samples[rule]:
                print(f"      {sample}")
    return 0 if problems.total() == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
