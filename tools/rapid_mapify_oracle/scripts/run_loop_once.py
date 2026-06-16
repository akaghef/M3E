#!/usr/bin/env python3
"""Generate a Codex task packet for one Rapid self-improvement iteration.

This script does not call Codex. It writes the task packet Codex should receive.
"""
from __future__ import annotations
import argparse, datetime, json
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("case", type=Path)
    ap.add_argument("--outdir", type=Path, default=None)
    args = ap.parse_args()
    case = json.loads(args.case.read_text(encoding="utf-8"))
    outdir = args.outdir or Path("runs") / (datetime.datetime.now().strftime("%Y%m%d_%H%M%S") + "_task_packet")
    outdir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "runId": outdir.name,
        "createdAt": datetime.datetime.now().isoformat(timespec="seconds"),
        "case": str(args.case),
        "opId": case["opId"],
        "selectedNodeId": case["selectedNodeId"],
        "codexTask": {
            "mission": "Implement or improve the M3E Rapid operation so candidate delta approaches the Mapify teacher trace.",
            "hardGuards": [
                "M3E AppState remains canonical",
                "Rapid operation must be local to selected node/subtree",
                "No whole-map regeneration",
                "No Mapify cookie extraction",
                "No unrelated dirty worktree changes"
            ],
            "requiredEvidence": ["AppState diff", "browser-visible delta", "grade_report.md", "commands run"]
        }
    }
    (outdir / "run_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    prompt = f"""# Codex task: {case['opId']}

Mission: make M3E Rapid match Mapify-like action quality for case `{case['caseId']}`.

Selected node ID: `{case['selectedNodeId']}`

Teacher delta: `{case['teacherDelta']}`
Candidate fixture: `{case['candidateDelta']}`
Rubric: `{case['rubric']}`

Hard guards:
- M3E AppState remains canonical.
- Implement local selected-node/subtree delta only.
- Do not create a new map/scope for Rapid.
- Do not extract Mapify cookies.
- Do not touch unrelated dirty worktree files.

Required output:
- patch summary
- AppState before/after diff
- browser-visible verification notes
- grade report
- failure classification if not passed
"""
    (outdir / "codex_task.md").write_text(prompt, encoding="utf-8")
    print(f"Wrote task packet: {outdir}")

if __name__ == "__main__":
    main()
