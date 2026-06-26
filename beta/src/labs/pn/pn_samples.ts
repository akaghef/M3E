import type { PnLayoutInput, PnNode, PnSafeZone } from "../../shared/pn_layout";

export type PnSampleId =
  | "gui-basic"
  | "view-layout-3rd-level"
  | "active-node-generation"
  | "safe-zone-collision"
  | "overflow-narrow"
  | "search-filter-keeps-path";

export interface PnLabSample {
  sample_id: PnSampleId;
  label: string;
  rootId: string;
  activeId: string;
  anchorRect: PnLayoutInput["anchorRect"];
  viewport: PnLayoutInput["viewport"];
  safeZones: PnSafeZone[];
  nodes: PnNode[];
}

export const guiNodes: PnNode[] = [
  { id: "gui", label: "[GUI]", hint: "overlay root" },
  { id: "board", label: "Board", hint: "file and board output", parentId: "gui" },
  { id: "view", label: "View", hint: "surface navigation", parentId: "gui" },
  { id: "scatter", label: "Scatter", hint: "scatter tools", parentId: "gui" },
  { id: "mindmap", label: "Mindmap", hint: "node and scope actions", parentId: "gui" },
  { id: "panel", label: "Panel", hint: "settings and help", parentId: "gui" },
  { id: "layout", label: "Layout", hint: "surface layout options", parentId: "view" },
  { id: "layout-direction", label: "Direction", hint: "layout growth axis", parentId: "layout" },
  { id: "layout-direction-right", label: "Right", hint: "grow right", parentId: "layout-direction", action: "command" },
  { id: "layout-direction-left", label: "Left", hint: "grow left", parentId: "layout-direction", action: "command" },
  { id: "layout-edge-route", label: "Edge Route", hint: "parent-child lines", parentId: "layout" },
  { id: "layout-edge-elbow", label: "Elbow", hint: "orthogonal tree edge", parentId: "layout-edge-route", action: "command" },
  { id: "layout-edge-bezier", label: "Bezier", hint: "curved tree edge", parentId: "layout-edge-route", action: "command" },
  { id: "import", label: "Import file", hint: "board input", parentId: "board", action: "command" },
  { id: "export-json", label: "Export JSON", hint: "download map JSON", parentId: "board", action: "command" },
];

export const activeNodeNodes: PnNode[] = [
  { id: "active-root", label: "Research Root", hint: "active node" },
  { id: "rapid-expand", label: "N2 Expand", hint: "open node/subtree", parentId: "active-root" },
  { id: "rapid-detail", label: "N3 Detail", hint: "generate", parentId: "rapid-expand", action: "generate" },
  { id: "rapid-examples", label: "N4 Examples", hint: "generate", parentId: "rapid-expand", action: "generate" },
  { id: "rapid-classify", label: "N5 Classify", hint: "generate", parentId: "rapid-expand", action: "generate" },
  { id: "rapid-related", label: "N6 Related topic", hint: "generate", parentId: "rapid-expand", action: "generate" },
  { id: "rapid-summary", label: "N7 Summary", hint: "compress", parentId: "active-root" },
  { id: "rapid-restructure", label: "N12 Restructure", hint: "organize", parentId: "active-root" },
];

const collisionZones: PnSafeZone[] = [
  { id: "canvas-selected", reason: "selected-node", weight: 10, rect: { x: 370, y: 120, w: 540, h: 420 } },
];

export const pnLabSamples: PnLabSample[] = [
  {
    sample_id: "gui-basic",
    label: "GUI basic",
    rootId: "gui",
    activeId: "view",
    anchorRect: { x: 48, y: 300, w: 44, h: 44 },
    viewport: { width: 1120, height: 680, zoom: 1 },
    safeZones: [],
    nodes: guiNodes,
  },
  {
    sample_id: "view-layout-3rd-level",
    label: "View > Layout > Direction",
    rootId: "gui",
    activeId: "layout-direction",
    anchorRect: { x: 48, y: 300, w: 44, h: 44 },
    viewport: { width: 1120, height: 680, zoom: 1 },
    safeZones: [],
    nodes: guiNodes,
  },
  {
    sample_id: "active-node-generation",
    label: "Active node generation",
    rootId: "active-root",
    activeId: "rapid-expand",
    anchorRect: { x: 250, y: 310, w: 180, h: 58 },
    viewport: { width: 1120, height: 680, zoom: 1 },
    safeZones: [{ id: "active-node", reason: "selected-node", weight: 10, rect: { x: 250, y: 310, w: 180, h: 58 } }],
    nodes: activeNodeNodes,
  },
  {
    sample_id: "safe-zone-collision",
    label: "Safe-zone collision",
    rootId: "gui",
    activeId: "layout-direction",
    anchorRect: { x: 300, y: 300, w: 44, h: 44 },
    viewport: { width: 1200, height: 760, zoom: 1 },
    safeZones: collisionZones,
    nodes: guiNodes,
  },
  {
    sample_id: "overflow-narrow",
    label: "Overflow narrow",
    rootId: "gui",
    activeId: "layout-direction-right",
    anchorRect: { x: 80, y: 180, w: 44, h: 44 },
    viewport: { width: 360, height: 300, zoom: 1 },
    safeZones: [],
    nodes: guiNodes,
  },
  {
    sample_id: "search-filter-keeps-path",
    label: "Search keeps path",
    rootId: "gui",
    activeId: "layout-direction",
    anchorRect: { x: 48, y: 300, w: 44, h: 44 },
    viewport: { width: 1120, height: 680, zoom: 1 },
    safeZones: [],
    nodes: guiNodes,
  },
];

export function pnNodeMetrics(nodes: PnNode[], rootId: string): PnLayoutInput["nodeMetrics"] {
  return Object.fromEntries(nodes.map((node) => [
    node.id,
    node.id === rootId ? { w: 44, h: 44 } : { w: 172, h: 47 },
  ]));
}

export function getPnLabSample(sampleId: PnSampleId): PnLabSample {
  const sample = pnLabSamples.find((item) => item.sample_id === sampleId);
  if (!sample) throw new Error(`Unknown PN lab sample: ${sampleId}`);
  return sample;
}
