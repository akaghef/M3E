import fs from "fs";
import path from "path";
import { layout, type LayoutMode, type LayoutNodeMetric, type LayoutOptions, type VisibleLayoutGraph } from "../shared/layout_port";

interface CliArgs {
  sample: string;
  out: string;
}

interface SeedSample {
  sample_id: string;
  product_path: "viewer.buildLayout" | "routingScopeSurface";
  input: {
    graph: {
      nodeIds: string[];
      children: Record<string, string[]>;
      graphLinks: [];
    };
    boxSizes: Record<string, LayoutNodeMetric>;
    mode: LayoutMode;
    options: LayoutOptions;
  };
}

const samples: Record<string, SeedSample> = {
  "tree-basic": {
    sample_id: "tree-basic",
    product_path: "viewer.buildLayout",
    input: {
      graph: {
        nodeIds: ["root", "a", "a1", "b"],
        children: { root: ["a", "b"], a: ["a1"], a1: [], b: [] },
        graphLinks: [],
      },
      boxSizes: {
        root: { w: 220, h: 70 },
        a: { w: 150, h: 40 },
        a1: { w: 120, h: 36 },
        b: { w: 130, h: 38 },
      },
      mode: "tree",
      options: { displayRootId: "root", structuredMode: "tree", density: "balanced", branchDirection: "both" },
    },
  },
  "mindmap-basic": {
    sample_id: "mindmap-basic",
    product_path: "viewer.buildLayout",
    input: {
      graph: {
        nodeIds: ["root", "a", "b", "c"],
        children: { root: ["a", "b", "c"], a: [], b: [], c: [] },
        graphLinks: [],
      },
      boxSizes: {
        root: { w: 220, h: 70 },
        a: { w: 140, h: 40 },
        b: { w: 150, h: 44 },
        c: { w: 120, h: 38 },
      },
      mode: "mindmap",
      options: { displayRootId: "root", structuredMode: "mindmap", density: "balanced", branchDirection: "both" },
    },
  },
  "scope-routing-basic": {
    sample_id: "scope-routing-basic",
    product_path: "routingScopeSurface",
    input: {
      graph: {
        nodeIds: ["scope-root", "scope-a", "scope-a1", "scope-b"],
        children: { "scope-root": ["scope-a", "scope-b"], "scope-a": ["scope-a1"], "scope-a1": [], "scope-b": [] },
        graphLinks: [],
      },
      boxSizes: {
        "scope-root": { w: 190, h: 58 },
        "scope-a": { w: 138, h: 38 },
        "scope-a1": { w: 118, h: 36 },
        "scope-b": { w: 126, h: 38 },
      },
      mode: "tree",
      options: { displayRootId: "scope-root", structuredMode: "tree", density: "balanced", branchDirection: "both" },
    },
  },
};

function parseArgs(argv: string[]): CliArgs {
  const args: Partial<CliArgs> = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--sample") args.sample = argv[++i];
    if (argv[i] === "--out") args.out = argv[++i];
  }
  if (!args.sample || !args.out) {
    throw new Error("Usage: npm run layout:capture -- --sample <tree-basic|mindmap-basic|scope-routing-basic> --out <path>");
  }
  return args as CliArgs;
}

function graphFor(sample: SeedSample): VisibleLayoutGraph {
  return {
    nodeIds: sample.input.graph.nodeIds,
    childrenOf: (nodeId) => sample.input.graph.children[nodeId] || [],
    graphLinks: [],
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const sample = samples[args.sample];
  if (!sample) {
    throw new Error(`Unknown sample: ${args.sample}`);
  }
  const payload = {
    schema_version: 1,
    sample_id: sample.sample_id,
    source: {
      product_path: sample.product_path,
      captured_at: new Date(0).toISOString(),
    },
    input: sample.input,
    expected: layout(graphFor(sample), sample.input.boxSizes, sample.input.mode, sample.input.options),
  };
  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

main();
