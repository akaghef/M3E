#!/usr/bin/env python3
"""Offline evaluator for M3E Rapid × Mapify teacher cases.

Usage:
    python3 scripts/evaluate_case.py fixtures/cases/biology_expand_animals.case.json
    python3 scripts/evaluate_case.py fixtures/cases/biology_expand_animals.case.json --candidate fixtures/biology/m3e_good_delta.json
"""
from __future__ import annotations
import argparse, json, math, re, sys, datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple, Set

JP_SENTENCE_HINTS = ("です", "ます", "とは", "について", "である", "を持つ", "は")
PUNCT_RE = re.compile(r"[。．.!?！？、,;；:：]")


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def resolve(base: Path, rel: str) -> Path:
    p = (base / rel).resolve()
    return p


def delta_nodes(delta: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for action in delta.get("actions", []):
        for n in action.get("nodes", []) or []:
            node = dict(n)
            node["_parentId"] = action.get("parentId")
            node["_actionType"] = action.get("type")
            out.append(node)
    return out


def subtree_ids(tree: Dict[str, Any], root_id: str) -> Set[str]:
    nodes = tree["nodes"]
    seen: Set[str] = set()
    stack = [root_id]
    while stack:
        nid = stack.pop()
        if nid in seen or nid not in nodes:
            continue
        seen.add(nid)
        stack.extend(nodes[nid].get("children", []))
    return seen


def text_set(nodes: List[Dict[str, Any]]) -> Set[str]:
    return {str(n.get("text", "")).strip() for n in nodes if str(n.get("text", "")).strip()}


def existing_texts(tree: Dict[str, Any], node_ids: Set[str]) -> Set[str]:
    return {tree["nodes"][nid].get("text", "") for nid in node_ids if nid in tree["nodes"]}


def label_is_map_native(text: str, max_chars: int = 12) -> bool:
    t = text.strip()
    if not t:
        return False
    if len(t) > max_chars:
        return False
    if PUNCT_RE.search(t):
        return False
    if any(h in t for h in JP_SENTENCE_HINTS):
        # Single-character は can appear in names, but in this benchmark it mainly indicates sentence labels.
        return False
    return True


def score_case(before: Dict[str, Any], teacher: Dict[str, Any], candidate: Dict[str, Any], selected: str, rubric: Dict[str, Any]) -> Dict[str, Any]:
    cand_nodes = delta_nodes(candidate)
    teach_nodes = delta_nodes(teacher)
    failures: List[str] = []
    recommendations: List[str] = []

    if not cand_nodes:
        failures.append("F1_NO_LOCAL_DELTA")
        recommendations.append("Ensure the Rapid command produces an appendChildren delta.")

    selected_subtree = subtree_ids(before, selected)
    allowed_parent = selected
    parents = [n.get("_parentId") for n in cand_nodes]
    if cand_nodes:
        locality = sum(1 for p in parents if p == allowed_parent) / len(cand_nodes)
    else:
        locality = 0.0
    if locality < 1.0:
        failures.append("F2_WRONG_TARGET")
        recommendations.append("Propagate selectedNodeId into the delta writer and append under the selected node only.")

    # Global contamination: any append action to root or non-selected node.
    root_id = before.get("rootId")
    if any(p == root_id and p != selected for p in parents):
        failures.append("F3_GLOBAL_CONTAMINATION")
        recommendations.append("Rapid operations must not append to root/global map unless explicitly requested.")

    label_scores = [1.0 if label_is_map_native(str(n.get("text", ""))) else 0.0 for n in cand_nodes]
    label_quality = sum(label_scores) / len(label_scores) if label_scores else 0.0
    if label_quality < rubric["dimensions"]["label_quality"]["pass"]:
        failures.append("F10_LABEL_SENTENCE_LIKE")
        recommendations.append("Apply a map-label formatter: short noun phrases, no explanations, no sentence endings.")

    # Sibling consistency: use semanticRole if present; penalize mixed roles.
    roles = [((n.get("attributes") or {}).get("semanticRole") or "unknown") for n in cand_nodes]
    if roles:
        most_common = max(set(roles), key=roles.count)
        sibling_consistency = roles.count(most_common) / len(roles)
    else:
        sibling_consistency = 0.0
    if sibling_consistency < rubric["dimensions"]["sibling_consistency"]["pass"]:
        failures.append("F11_SIBLING_TYPE_MIX")
        recommendations.append("Constrain a single Rapid run to one semanticRole, e.g. class OR example, not both.")

    existing = existing_texts(before, selected_subtree | {before.get("rootId")})
    duplicates = text_set(cand_nodes) & existing
    non_duplication = 1.0 - (len(duplicates) / len(cand_nodes) if cand_nodes else 1.0)
    if duplicates:
        failures.append("F12_DUPLICATE_EXISTING_NODE")
        recommendations.append(f"Filter existing labels before applying delta: {sorted(duplicates)}")

    teach_texts = text_set(teach_nodes)
    cand_texts = text_set(cand_nodes)
    if teach_texts or cand_texts:
        teacher_proximity = len(teach_texts & cand_texts) / len(teach_texts | cand_texts)
    else:
        teacher_proximity = 0.0

    # Delta discipline: only appendChildren, selected parent, no replacement/deletion/global operations.
    actions = candidate.get("actions", [])
    if actions:
        ok_actions = sum(1 for a in actions if a.get("type") == "appendChildren" and a.get("parentId") == selected)
        delta_discipline = ok_actions / len(actions)
    else:
        delta_discipline = 0.0

    dimensions = {
        "locality": round(locality, 4),
        "label_quality": round(label_quality, 4),
        "sibling_consistency": round(sibling_consistency, 4),
        "non_duplication": round(non_duplication, 4),
        "teacher_proximity": round(teacher_proximity, 4),
        "delta_discipline": round(delta_discipline, 4),
    }

    weighted = 0.0
    for k, v in dimensions.items():
        weighted += v * rubric["dimensions"][k]["weight"]

    critical = set(rubric.get("critical_failures", []))
    passed = weighted >= 0.80 and not (set(failures) & critical)

    return {
        "caseId": "",
        "score": round(weighted, 4),
        "passed": passed,
        "dimensions": dimensions,
        "failures": sorted(set(failures)),
        "recommendations": list(dict.fromkeys(recommendations)),
        "candidateLabels": sorted(cand_texts),
        "teacherLabels": sorted(teach_texts),
    }


def write_markdown_report(report: Dict[str, Any], out: Path) -> None:
    lines = []
    lines.append(f"# Grade report: {report['caseId']}")
    lines.append("")
    lines.append(f"- Score: `{report['score']}`")
    lines.append(f"- Passed: `{report['passed']}`")
    lines.append("")
    lines.append("## Dimensions")
    lines.append("")
    lines.append("| Dimension | Score |")
    lines.append("|---|---:|")
    for k, v in report["dimensions"].items():
        lines.append(f"| {k} | {v:.4f} |")
    lines.append("")
    lines.append("## Failures")
    lines.append("")
    if report["failures"]:
        for f in report["failures"]:
            lines.append(f"- `{f}`")
    else:
        lines.append("- none")
    lines.append("")
    lines.append("## Recommendations")
    lines.append("")
    if report["recommendations"]:
        for r in report["recommendations"]:
            lines.append(f"- {r}")
    else:
        lines.append("- none")
    lines.append("")
    lines.append("## Label comparison")
    lines.append("")
    lines.append(f"- Teacher: `{', '.join(report.get('teacherLabels', []))}`")
    lines.append(f"- Candidate: `{', '.join(report.get('candidateLabels', []))}`")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("case", type=Path)
    ap.add_argument("--candidate", type=Path, default=None, help="Override candidate delta path")
    ap.add_argument("--outdir", type=Path, default=None)
    args = ap.parse_args()

    case_path = args.case.resolve()
    case = load_json(case_path)
    base = case_path.parent
    before = load_json(resolve(base, case["before"]))
    teacher = load_json(resolve(base, case["teacherDelta"]))
    candidate_path = args.candidate.resolve() if args.candidate else resolve(base, case["candidateDelta"])
    candidate = load_json(candidate_path)
    rubric = load_json(resolve(base, case["rubric"]))

    report = score_case(before, teacher, candidate, case["selectedNodeId"], rubric)
    report["caseId"] = case["caseId"]
    report["candidatePath"] = str(candidate_path)
    report["generatedAt"] = datetime.datetime.now().isoformat(timespec="seconds")

    outdir = args.outdir or (Path("runs") / (datetime.datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + case["caseId"]))
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / "grade_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_markdown_report(report, outdir / "grade_report.md")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"\nWrote: {outdir / 'grade_report.md'}")
    return 0 if report["passed"] else 2

if __name__ == "__main__":
    raise SystemExit(main())
