import type { GraphLinkLike, LayoutMode, LayoutNodeMetric, LayoutOptions } from "../../shared/layout_port";

const SYNTHETIC_SEED = 0x5a17_0100;

interface SyntheticLayoutInput {
  graph: {
    nodeIds: string[];
    children: Record<string, string[]>;
    graphLinks: GraphLinkLike[];
  };
  boxSizes: Record<string, LayoutNodeMetric>;
  mode: LayoutMode;
  options: LayoutOptions;
}

export interface LayoutSyntheticSample {
  schema_version: 1;
  sample_id: "synthetic-100-varied-boxes";
  source: {
    synthetic: true;
    seed: number;
    note: string;
  };
  input: SyntheticLayoutInput;
}

function createSeededPrng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function integerInRange(next: () => number, min: number, max: number): number {
  return min + Math.floor(next() * (max - min + 1));
}

function distributeChildren(next: () => number, total: number, parentCount: number, min: number, max: number): number[] {
  const counts = Array.from({ length: parentCount }, () => min);
  let remaining = total - min * parentCount;
  if (remaining < 0 || total > max * parentCount) {
    throw new Error(`Cannot distribute ${total} children across ${parentCount} parents`);
  }

  while (remaining > 0) {
    const ranked = counts
      .map((count, index) => ({ count, index, bias: next() + (parentCount - index) * 0.13 }))
      .filter((item) => item.count < max)
      .sort((a, b) => b.bias - a.bias);
    const target = ranked[0];
    if (!target) break;
    const add = Math.min(remaining, max - target.count, integerInRange(next, 1, 3));
    counts[target.index] += add;
    remaining -= add;
  }
  return counts;
}

function createSynthetic100Sample(): LayoutSyntheticSample {
  const next = createSeededPrng(SYNTHETIC_SEED);
  const nodeIds: string[] = ["syn-root"];
  const children: Record<string, string[]> = { "syn-root": [] };
  const boxSizes: Record<string, LayoutNodeMetric> = {
    "syn-root": { w: 236, h: 70, labelLines: ["synthetic 100", "varied boxes"], fontSize: 15 },
  };

  let serial = 1;
  const createNode = (depth: number): string => {
    const id = `syn-d${depth}-${String(serial).padStart(3, "0")}`;
    serial += 1;
    nodeIds.push(id);
    children[id] = [];
    boxSizes[id] = metricFor(id, depth, next);
    return id;
  };

  const attachLayer = (parents: string[], totalChildren: number, depth: number, minChildren: number): string[] => {
    const counts = distributeChildren(next, totalChildren, parents.length, minChildren, 8);
    const layer: string[] = [];
    parents.forEach((parentId, parentIndex) => {
      for (let i = 0; i < counts[parentIndex]!; i += 1) {
        const childId = createNode(depth);
        children[parentId]!.push(childId);
        layer.push(childId);
      }
    });
    return layer;
  };

  const depth1 = attachLayer(["syn-root"], 7, 1, 7);
  const depth2 = attachLayer(depth1, 24, 2, 1);
  const depth3 = attachLayer(depth2, 54, 3, 1);
  const depth4Parents = depth3
    .map((id) => ({ id, score: next() }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((item) => item.id);
  attachLayer(depth4Parents, 14, 4, 1);

  return {
    schema_version: 1,
    sample_id: "synthetic-100-varied-boxes",
    source: {
      synthetic: true,
      seed: SYNTHETIC_SEED,
      note: "Lab-only generated sample. Not captured from product path and intentionally has no expected LayoutResult.",
    },
    input: {
      graph: { nodeIds, children, graphLinks: [] },
      boxSizes,
      mode: "Tree",
      options: {
        displayRootId: "syn-root",
        structuredMode: "Tree",
        density: "balanced",
        depthAlign: "packed",
        direction: "right",
        spacing: { nodeGap: 14, levelGap: 112, padding: 92 },
        scatter: { seed: SYNTHETIC_SEED, edgeLength: 500 },
      },
    },
  };
}

function metricFor(id: string, depth: number, next: () => number): LayoutNodeMetric {
  const bucket = (integerInRange(next, 0, 99) + depth * 11) % 100;
  if (id.endsWith("007") || bucket < 9) {
    return { w: integerInRange(next, 32, 58), h: integerInRange(next, 34, 38), labelLines: ["x"], fontSize: 13 };
  }
  if (id.endsWith("018") || id.endsWith("063") || bucket < 26) {
    return {
      w: integerInRange(next, 260, 360),
      h: integerInRange(next, 38, 46),
      labelLines: ["long label / cross-facet routing candidate"],
      fontSize: 13,
    };
  }
  if (id.endsWith("031") || id.endsWith("082") || bucket < 43) {
    return {
      w: integerInRange(next, 140, 220),
      h: integerInRange(next, 82, 128),
      labelLines: ["multi-line", "scope note", "owner route", "status"],
      fontSize: 12,
    };
  }
  return {
    w: integerInRange(next, 118, 236),
    h: integerInRange(next, 34, 70),
    labelLines: [`node ${id}`],
    fontSize: integerInRange(next, 12, 15),
  };
}

export const syntheticLayoutSamples = [createSynthetic100Sample()] as const;
