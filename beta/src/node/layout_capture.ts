import fs from "fs";
import path from "path";
import {
  layout,
  type GraphLinkLike,
  type LayoutMode,
  type LayoutNodeMetric,
  type LayoutOptions,
  type VisibleLayoutGraph,
} from "../shared/layout_port";

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
      graphLinks: GraphLinkLike[];
    };
    boxSizes: Record<string, LayoutNodeMetric>;
    mode: LayoutMode;
    options: LayoutOptions;
  };
}

function metric(label: string, variant = 0): LayoutNodeMetric {
  return {
    w: Math.max(118, Math.min(236, 74 + label.length * 7 + variant * 9)),
    h: 34 + (variant % 3) * 4,
    labelLines: [label],
    fontSize: 13,
  };
}

function metricsFor(nodeIds: string[]): Record<string, LayoutNodeMetric> {
  return Object.fromEntries(nodeIds.map((id, index) => [id, metric(id.replace(/-/g, " "), index)]));
}

function graphLinks(...pairs: Array<[string, string, string]>): GraphLinkLike[] {
  return pairs.map(([sourceNodeId, targetNodeId, label], index) => ({
    id: `stress-link-${index + 1}`,
    sourceNodeId,
    targetNodeId,
    relationType: "reference",
    label,
    direction: "forward",
    style: "dashed",
    color: "#5f6f89",
  }));
}

const treeStressNodeIds = [
  "m3e-root",
  "strategy",
  "capture",
  "graph-model",
  "scope-sync",
  "layout",
  "vision",
  "priorities",
  "beta-focus",
  "final-guard",
  "risks",
  "flash-inbox",
  "vault-import",
  "frontmatter",
  "media-assets",
  "clipboard",
  "node-schema",
  "edge-schema",
  "graphlinks",
  "cross-scope-link",
  "alias-policy",
  "scope-lock",
  "push-queue",
  "conflict-backup",
  "audit-chain",
  "tree-mode",
  "radial-mode",
  "routing-scope",
  "route-preview",
  "edge-sanity",
];

const radialStressNodeIds = [
  "radial-root",
  "research",
  "product",
  "users",
  "data",
  "collaboration",
  "quality",
  "release",
  "learning",
  "papers",
  "experiments",
  "synthesis",
  "benchmark-notes",
  "editor",
  "navigation",
  "layout-lab",
  "stress-fixtures",
  "sanity-tests",
  "akaghef",
  "future-collab",
  "sqlite",
  "vault",
  "cloud-sync",
  "scope-push",
  "presence",
  "audit",
  "typecheck",
  "golden-parity",
  "dependency-gate",
  "beta-channel",
];

const routingStressNodeIds = [
  "route-root",
  "source-scope",
  "target-scope",
  "aliases",
  "guards",
  "execution",
  "telemetry",
  "source-root",
  "source-child-a",
  "source-child-b",
  "source-deep-a",
  "source-deep-b",
  "target-root",
  "target-child-a",
  "target-child-b",
  "target-deep-a",
  "target-deep-b",
  "alias-entry",
  "alias-target",
  "alias-preview",
  "alias-conflict",
  "scope-lock",
  "cycle-check",
  "permission-check",
  "conflict-backup",
  "dispatch",
  "layout-port",
  "save-result",
  "event-log",
  "diagnostics",
];

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
      mode: "Tree",
      options: { displayRootId: "root", structuredMode: "Tree", density: "balanced", branchDirection: "both" },
    },
  },
  "radial-basic": {
    sample_id: "radial-basic",
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
      mode: "Radial",
      options: { displayRootId: "root", structuredMode: "Radial", density: "balanced", branchDirection: "both" },
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
      mode: "Tree",
      options: { displayRootId: "scope-root", structuredMode: "Tree", density: "balanced", branchDirection: "both" },
    },
  },
  "tree-stress-30": {
    sample_id: "tree-stress-30",
    product_path: "viewer.buildLayout",
    input: {
      graph: {
        nodeIds: treeStressNodeIds,
        children: {
          "m3e-root": ["strategy", "capture", "graph-model", "scope-sync", "layout"],
          strategy: ["vision", "priorities", "risks"],
          priorities: ["beta-focus", "final-guard"],
          "beta-focus": [],
          "final-guard": [],
          vision: [],
          risks: [],
          capture: ["flash-inbox", "vault-import", "clipboard"],
          "vault-import": ["frontmatter", "media-assets"],
          "flash-inbox": [],
          frontmatter: [],
          "media-assets": [],
          clipboard: [],
          "graph-model": ["node-schema", "edge-schema", "graphlinks", "alias-policy"],
          graphlinks: ["cross-scope-link"],
          "node-schema": [],
          "edge-schema": [],
          "cross-scope-link": [],
          "alias-policy": [],
          "scope-sync": ["scope-lock", "push-queue", "conflict-backup", "audit-chain"],
          "scope-lock": [],
          "push-queue": [],
          "conflict-backup": [],
          "audit-chain": [],
          layout: ["tree-mode", "radial-mode", "routing-scope"],
          "routing-scope": ["route-preview"],
          "route-preview": ["edge-sanity"],
          "tree-mode": [],
          "radial-mode": [],
          "edge-sanity": [],
        },
        graphLinks: graphLinks(
          ["graphlinks", "routing-scope", "route surface"],
          ["conflict-backup", "audit-chain", "audit trail"],
          ["vault-import", "node-schema", "normalizes to"],
          ["alias-policy", "cross-scope-link", "constrains"],
        ),
      },
      boxSizes: metricsFor(treeStressNodeIds),
      mode: "Tree",
      options: { displayRootId: "m3e-root", structuredMode: "Tree", density: "balanced", branchDirection: "both" },
    },
  },
  "radial-stress-30": {
    sample_id: "radial-stress-30",
    product_path: "viewer.buildLayout",
    input: {
      graph: {
        nodeIds: radialStressNodeIds,
        children: {
          "radial-root": ["research", "product", "users", "data", "collaboration", "quality", "release", "learning"],
          research: ["papers", "experiments", "synthesis"],
          experiments: ["benchmark-notes"],
          papers: [],
          synthesis: [],
          "benchmark-notes": [],
          product: ["editor", "navigation", "layout-lab"],
          "layout-lab": ["stress-fixtures", "sanity-tests"],
          editor: [],
          navigation: [],
          "stress-fixtures": [],
          "sanity-tests": [],
          users: ["akaghef", "future-collab"],
          akaghef: [],
          "future-collab": [],
          data: ["sqlite", "vault", "cloud-sync"],
          sqlite: [],
          vault: [],
          "cloud-sync": [],
          collaboration: ["scope-push", "presence", "audit"],
          "scope-push": [],
          presence: [],
          audit: [],
          quality: ["typecheck", "golden-parity", "dependency-gate"],
          typecheck: [],
          "golden-parity": [],
          "dependency-gate": [],
          release: ["beta-channel"],
          "beta-channel": [],
          learning: [],
        },
        graphLinks: graphLinks(
          ["experiments", "stress-fixtures", "becomes"],
          ["sanity-tests", "golden-parity", "guards"],
          ["scope-push", "cloud-sync", "depends"],
          ["dependency-gate", "layout-lab", "protects"],
          ["akaghef", "beta-channel", "dogfoods"],
        ),
      },
      boxSizes: metricsFor(radialStressNodeIds),
      mode: "Radial",
      options: { displayRootId: "radial-root", structuredMode: "Radial", density: "balanced", branchDirection: "both" },
    },
  },
  "scope-routing-stress-30": {
    sample_id: "scope-routing-stress-30",
    product_path: "routingScopeSurface",
    input: {
      graph: {
        nodeIds: routingStressNodeIds,
        children: {
          "route-root": ["source-scope", "target-scope", "aliases", "guards", "execution", "telemetry"],
          "source-scope": ["source-root", "source-child-a", "source-child-b"],
          "source-root": ["source-deep-a", "source-deep-b"],
          "source-child-a": [],
          "source-child-b": [],
          "source-deep-a": [],
          "source-deep-b": [],
          "target-scope": ["target-root", "target-child-a", "target-child-b"],
          "target-root": ["target-deep-a", "target-deep-b"],
          "target-child-a": [],
          "target-child-b": [],
          "target-deep-a": [],
          "target-deep-b": [],
          aliases: ["alias-entry", "alias-target", "alias-preview", "alias-conflict"],
          "alias-entry": [],
          "alias-target": [],
          "alias-preview": [],
          "alias-conflict": [],
          guards: ["scope-lock", "cycle-check", "permission-check", "conflict-backup"],
          "scope-lock": [],
          "cycle-check": [],
          "permission-check": [],
          "conflict-backup": [],
          execution: ["dispatch", "layout-port", "save-result"],
          dispatch: [],
          "layout-port": [],
          "save-result": [],
          telemetry: ["event-log", "diagnostics"],
          "event-log": [],
          diagnostics: [],
        },
        graphLinks: graphLinks(
          ["alias-entry", "target-root", "points to"],
          ["source-deep-b", "alias-preview", "preview"],
          ["cycle-check", "source-root", "checks"],
          ["layout-port", "save-result", "returns"],
        ),
      },
      boxSizes: metricsFor(routingStressNodeIds),
      mode: "Tree",
      options: { displayRootId: "route-root", structuredMode: "Tree", density: "balanced", branchDirection: "both" },
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
    throw new Error(`Usage: npm run layout:capture -- --sample <${Object.keys(samples).join("|")}> --out <path>`);
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
