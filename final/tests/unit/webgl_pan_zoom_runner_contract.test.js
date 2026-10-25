import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const runnerPath = path.resolve(here, "../../perf/run_webgl_pan_zoom.mjs");

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(stable(value), "utf8").digest("hex");
}

describe("WebGL pan/zoom performance runner", () => {
  test("uses one fixed page for all renderer runs and rejects headed mode", async () => {
    const source = await readFile(runnerPath, "utf8");
    expect(source).toContain("async function measureRenderer(page, browser");
    expect(source.match(/\.newPage\(/g)).toHaveLength(1);
    expect(source).toContain("one isolated context and one page for the complete experiment");
    expect(source).toContain("--headed is intentionally disabled");
    expect(source).not.toContain("fixture.sourceMapId");
    expect(source).toContain("historical provenance and may evolve");
  });

  test("does not depend on a live source map after fixture creation", async () => {
    const { verifyFixtureState } = await import("../../perf/run_webgl_pan_zoom.mjs");
    const canonical = { rootId: "root", nodes: { root: { text: "source label" }, child: { text: "stable" } }, links: [] };
    const renamedFixture = structuredClone(canonical);
    renamedFixture.nodes.root.text = "frozen fixture label";
    const manifest = {
      fixture: { label: "frozen fixture label", tags: ["frozen"] },
      integrity: {
        normalizedRootText: "source label",
        fixtureContentHash: hash(canonical),
        allowedMutableStatePaths: ["/nodes/root/text"],
        counts: { nodeCount: 2, linkCount: 0, scopeNodeCount: 2, scopeLinkCount: 0 },
      },
    };
    const scoped = structuredClone(renamedFixture);
    const liveSourceBefore = { nodes: { root: { text: "source label" } } };
    const liveSourceAfter = { nodes: { root: { text: "edited source label" }, another: { text: "new" } } };
    expect(liveSourceAfter).not.toEqual(liveSourceBefore);
    expect(() => verifyFixtureState(manifest, renamedFixture, scoped, { tags: ["frozen"] })).not.toThrow();
  });

  test("reports duration only from the probe window", async () => {
    const { summarizeProbe } = await import("../../perf/run_webgl_pan_zoom.mjs");
    const summary = summarizeProbe({
      startedAt: 10_000,
      endedAt: 10_042.5,
      frames: [16.6, 17.1],
      longTasks: [],
      longTaskSupported: true,
    });
    expect(summary.durationMs).toBe(42.5);
  });
});
