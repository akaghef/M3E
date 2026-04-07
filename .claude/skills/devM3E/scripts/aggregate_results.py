#!/usr/bin/env python3
"""
devM3E: 検証結果の集計スクリプト。
skill-creator の aggregate_benchmark.py に相当。

Usage:
    python aggregate_results.py <workspace-dir> [--output <path>]

<workspace-dir> 配下の各タスクディレクトリから verifier の出力 (verification.json) を
収集し、サマリーを生成する。
"""

import json
import sys
from pathlib import Path
from datetime import datetime


def collect_results(workspace: Path) -> list[dict]:
    """workspace 配下の verification.json を再帰的に収集する。"""
    results = []
    for f in sorted(workspace.rglob("verification.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            data["_source"] = str(f.relative_to(workspace))
            results.append(data)
        except (json.JSONDecodeError, OSError) as e:
            print(f"Warning: skipping {f}: {e}", file=sys.stderr)
    return results


def aggregate(results: list[dict]) -> dict:
    """結果リストからサマリーを計算する。"""
    total = len(results)
    if total == 0:
        return {"total": 0, "message": "No verification results found."}

    verdicts = {"green": 0, "yellow": 0, "red": 0}
    tsc_pass = 0
    test_pass = 0
    test_total = 0
    build_sizes = []

    for r in results:
        v = r.get("verdict", "red")
        verdicts[v] = verdicts.get(v, 0) + 1

        if r.get("tsc", {}).get("status") == "pass":
            tsc_pass += 1

        test_info = r.get("test", {})
        if test_info.get("status") == "pass":
            test_pass += 1
        test_total += test_info.get("total", 0)

        build_info = r.get("build", {})
        if build_info.get("size_kb"):
            build_sizes.append(build_info["size_kb"])

    return {
        "timestamp": datetime.now().isoformat(),
        "total_verifications": total,
        "verdicts": verdicts,
        "tsc_pass_rate": f"{tsc_pass}/{total}",
        "test_pass_rate": f"{test_pass}/{total}",
        "total_test_cases": test_total,
        "build_size_range_kb": {
            "min": min(build_sizes) if build_sizes else None,
            "max": max(build_sizes) if build_sizes else None,
        },
        "overall": "green" if verdicts.get("red", 0) == 0 and verdicts.get("yellow", 0) == 0
                   else "yellow" if verdicts.get("red", 0) == 0
                   else "red",
        "details": results,
    }


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <workspace-dir> [--output <path>]")
        sys.exit(1)

    workspace = Path(sys.argv[1])
    output_path = None
    if "--output" in sys.argv:
        idx = sys.argv.index("--output")
        if idx + 1 < len(sys.argv):
            output_path = Path(sys.argv[idx + 1])

    if not workspace.is_dir():
        print(f"Error: {workspace} is not a directory", file=sys.stderr)
        sys.exit(1)

    results = collect_results(workspace)
    summary = aggregate(results)

    output_json = json.dumps(summary, indent=2, ensure_ascii=False)

    if output_path:
        output_path.write_text(output_json, encoding="utf-8")
        print(f"Summary written to {output_path}")
    else:
        print(output_json)

    # Markdown summary to stdout
    print(f"\n## Verification Summary")
    print(f"- Total: {summary['total_verifications']}")
    print(f"- Overall: **{summary['overall']}**")
    print(f"- Verdicts: {summary['verdicts']}")
    print(f"- TSC: {summary['tsc_pass_rate']}")
    print(f"- Tests: {summary['test_pass_rate']} ({summary['total_test_cases']} cases)")


if __name__ == "__main__":
    main()
