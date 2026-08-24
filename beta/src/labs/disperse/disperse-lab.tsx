import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { layoutDisperse, type DisperseSubtype, type DisperseSpace, type EdgeAggregation, type SuperNodeFootprint } from "../../shared/disperse_layout";
import { syntheticLayoutSamples } from "../layout/synthetic_layout_samples";
import "./disperse-lab.css";

const sample = syntheticLayoutSamples[0];
const collapseCandidate = sample.input.graph.nodeIds.find((id) => id.startsWith("syn-d2-"))!;
const graphLinks = [
  ["syn-d1-001", "syn-d3-055"], ["syn-d1-002", "syn-d3-067"], ["syn-d2-015", "syn-d3-080"], ["syn-d2-020", "syn-d3-093"],
].filter(([sourceNodeId, targetNodeId]) => sample.input.graph.nodeIds.includes(sourceNodeId) && sample.input.graph.nodeIds.includes(targetNodeId))
  .map(([sourceNodeId, targetNodeId], index) => ({ id: `lab-link-${index}`, sourceNodeId, targetNodeId }));
const savedPositions = Object.fromEntries(sample.input.graph.nodeIds.map((id, index) => [id, { x: 140 + (index % 10) * 250, y: 120 + Math.floor(index / 10) * 130 }]));

function metrics(result: ReturnType<typeof layoutDisperse>): string {
  const nodes = Object.values(result.pos);
  // WebCola may leave rectangles touching by an IEEE-754 epsilon. Touching is
  // permitted; only a material-area intersection is an overlap.
  const epsilon = 1e-6;
  let overlaps = 0;
  for (let i = 0; i < nodes.length; i += 1) for (let j = i + 1; j < nodes.length; j += 1) {
    const a = nodes[i]!, b = nodes[j]!;
    const overlapWidth = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const overlapHeight = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
    if (overlapWidth > epsilon && overlapHeight > epsilon) overlaps += 1;
  }
  const left = Math.min(...nodes.map((node) => node.x)); const top = Math.min(...nodes.map((node) => node.y - node.h / 2));
  const right = Math.max(...nodes.map((node) => node.x + node.w)); const bottom = Math.max(...nodes.map((node) => node.y + node.h / 2));
  const area = (right - left) * (bottom - top); const nodeArea = nodes.reduce((sum, node) => sum + node.w * node.h, 0);
  return `nodes ${nodes.length}\noverlap pairs ${overlaps}\nbbox ${Math.round(right - left)} × ${Math.round(bottom - top)}\naspect ${((right - left) / (bottom - top)).toFixed(3)}\nfill ${(nodeArea / area).toFixed(3)}\nedges ${result.edges.length}`;
}

function App(): React.ReactElement {
  const [subtype, setSubtype] = useState<DisperseSubtype>("cluster"); const [space, setSpace] = useState<DisperseSpace>("normal");
  const [boundaries, setBoundaries] = useState(true); const [collapsed, setCollapsed] = useState(false);
  const [footprint, setFootprint] = useState<SuperNodeFootprint>("descendant-area"); const [aggregation, setAggregation] = useState<EdgeAggregation>("bundle");
  const result = useMemo(() => layoutDisperse({ nodeIds: sample.input.graph.nodeIds, childrenOf: (id) => sample.input.graph.children[id] || [], graphLinks }, sample.input.boxSizes, {
    displayRootId: "syn-root", subtype, space, collapsedNodeIds: collapsed ? [collapseCandidate] : [], superNodeFootprint: footprint, edgeAggregation: aggregation, savedPositions,
  }), [subtype, space, collapsed, footprint, aggregation]);
  const width = Math.max(1400, result.totalWidth + 180), height = Math.max(1000, result.totalHeight + 180);
  return <main className="disperse-lab"><aside className="controls"><h1>Disperse Lab</h1><p className="hint">WebCola through the shared Disperse seam. The controls deliberately present alternatives; they do not choose a product answer.</p>
    <label>Subtype<select value={subtype} onChange={(event) => setSubtype(event.currentTarget.value as DisperseSubtype)}><option value="scatter">scatter — saved positions</option><option value="cluster">cluster — tree groups</option><option value="force">force — links and repulsion</option></select></label>
    <label>Group separation<select value={space} onChange={(event) => setSpace(event.currentTarget.value as DisperseSpace)}><option>tight</option><option>normal</option><option>loose</option></select></label>
    <label className="toggle">Draw group boundaries<input type="checkbox" checked={boundaries} onChange={(event) => setBoundaries(event.currentTarget.checked)} /></label>
    <label className="toggle">Collapse subtree at {collapseCandidate}<input type="checkbox" checked={collapsed} onChange={(event) => setCollapsed(event.currentTarget.checked)} /></label>
    <label>Super-node footprint<select value={footprint} onChange={(event) => setFootprint(event.currentTarget.value as SuperNodeFootprint)}><option value="descendant-area">reflect descendant area</option><option value="fixed">fixed size</option></select></label>
    <label>Contracted edge aggregation<select value={aggregation} onChange={(event) => setAggregation(event.currentTarget.value as EdgeAggregation)}><option value="bundle">bundle multiple edges</option><option value="weighted">show weight in width</option><option value="hide-internal">hide internal edges</option></select></label>
    <div className="metrics">{metrics(result)}</div></aside><section className="stage"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Disperse layout result">
      {boundaries && result.groups.map((group) => <rect key={group.id} className="group" x={group.x} y={group.y} width={group.w} height={group.h} rx="12" />)}
      {result.edges.filter((edge) => !edge.internal).map((edge) => { const source = result.pos[edge.sourceId], target = result.pos[edge.targetId]; if (!source || !target) return null; return <line key={edge.id} className="edge" x1={source.x + source.w / 2} y1={source.y} x2={target.x + target.w / 2} y2={target.y} strokeWidth={aggregation === "weighted" ? 1 + edge.weight * 1.5 : 2} />; })}
      {result.order.map((id) => { const node = result.pos[id]!; return <g key={id}><rect className={`node ${node.sourceNodeId ? "super" : ""}`} x={node.x} y={node.y - node.h / 2} width={node.w} height={node.h} rx="6" /><text className="label" x={node.x + 8} y={node.y + 4}>{node.sourceNodeId ? `collapsed: ${node.sourceNodeId}` : id}</text></g>; })}
    </svg></section></main>;
}
const root = document.getElementById("disperse-lab-root"); if (!root) throw new Error("disperse-lab-root not found"); createRoot(root).render(<App />);
