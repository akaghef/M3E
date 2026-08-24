import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { layoutDisperse, type DisperseSubtype, type DisperseSpace, type EdgeAggregation, type SuperNodeFootprint } from "../../shared/disperse_layout";
import { layoutLabSamples, type LayoutLabSampleId } from "../layout/layout_samples";
import "../layout/layout-lab.css";
import "./disperse-lab.css";

const disperseSubtypes: DisperseSubtype[] = ["scatter", "cluster", "force"];
const spaces: DisperseSpace[] = ["tight", "normal", "loose"];

function savedPositionsFor(nodeIds: string[]): Record<string, { x: number; y: number }> {
  return Object.fromEntries(nodeIds.map((id, index) => [id, {
    x: 140 + (index % 10) * 250,
    y: 120 + Math.floor(index / 10) * 130,
  }]));
}

function labGraphLinks(sampleId: string, nodeIds: string[]): { id: string; sourceNodeId: string; targetNodeId: string }[] {
  if (sampleId !== "synthetic-100-varied-boxes") return [];
  return [
    ["syn-d1-001", "syn-d3-055"], ["syn-d1-002", "syn-d3-067"], ["syn-d2-015", "syn-d3-080"], ["syn-d2-020", "syn-d3-093"],
  ]
    .filter(([sourceNodeId, targetNodeId]) => nodeIds.includes(sourceNodeId) && nodeIds.includes(targetNodeId))
    .map(([sourceNodeId, targetNodeId], index) => ({ id: `lab-link-${index}`, sourceNodeId, targetNodeId }));
}

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
  const [sampleId, setSampleId] = useState<LayoutLabSampleId>("synthetic-100-varied-boxes");
  const [subtype, setSubtype] = useState<DisperseSubtype>("cluster");
  const [space, setSpace] = useState<DisperseSpace>("normal");
  const [boundaries, setBoundaries] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [footprint, setFootprint] = useState<SuperNodeFootprint>("descendant-area");
  const [aggregation, setAggregation] = useState<EdgeAggregation>("bundle");
  const [zoom, setZoom] = useState(1);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const sample = layoutLabSamples.find((item) => item.sample_id === sampleId) || layoutLabSamples[0]!;
  const rootId = sample.input.options.displayRootId || sample.input.graph.nodeIds[0];
  const collapseCandidate = sample.input.graph.nodeIds.find((id) => (sample.input.graph.children[id] || []).length > 0 && id !== rootId) || rootId;
  const graphLinks = labGraphLinks(sample.sample_id, sample.input.graph.nodeIds);
  const savedPositions = useMemo(() => savedPositionsFor(sample.input.graph.nodeIds), [sample]);
  const result = useMemo(() => layoutDisperse({
    nodeIds: sample.input.graph.nodeIds,
    childrenOf: (id) => sample.input.graph.children[id] || [],
    graphLinks,
  }, sample.input.boxSizes, {
    displayRootId: rootId,
    subtype,
    space,
    collapsedNodeIds: collapsed && collapseCandidate ? [collapseCandidate] : [],
    superNodeFootprint: footprint,
    edgeAggregation: aggregation,
    savedPositions,
  }), [sample, rootId, graphLinks, subtype, space, collapsed, collapseCandidate, footprint, aggregation, savedPositions]);
  const canvasWidth = Math.max(900, Math.ceil(result.totalWidth + 80));
  const canvasHeight = Math.max(640, Math.ceil(result.totalHeight + 80));
  const rootPos = rootId ? result.pos[rootId] : undefined;
  const zoomTransform = rootPos
    ? `translate(${rootPos.x} ${rootPos.y}) scale(${zoom}) translate(${-rootPos.x} ${-rootPos.y})`
    : undefined;

  return (
    <main className={`layout-lab disperse-lab${snapshotOpen ? " snapshot-open" : ""}`}>
      <aside className="lab-panel">
        <h1 className="lab-title">Disperse Lab</h1>
        <button className="snapshot-toggle" type="button" aria-expanded={snapshotOpen} onClick={() => setSnapshotOpen((open) => !open)}>
          {snapshotOpen ? "Hide Snapshot" : "Show Snapshot"}
        </button>
        <div className="control-group">
          <label htmlFor="sample">Sample</label>
          <select id="sample" value={sampleId} onChange={(event) => { setSampleId(event.currentTarget.value as LayoutLabSampleId); setCollapsed(false); }}>
            {layoutLabSamples.map((item) => <option key={item.sample_id} value={item.sample_id}>{item.sample_id}</option>)}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="subtype">Subtype</label>
          <select id="subtype" value={subtype} onChange={(event) => setSubtype(event.currentTarget.value as DisperseSubtype)}>
            {disperseSubtypes.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="space">Group separation</label>
          <select id="space" value={space} onChange={(event) => setSpace(event.currentTarget.value as DisperseSpace)}>
            {spaces.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="control-group">
          <div className="control-row"><label htmlFor="boundaries">Draw group boundaries</label><input id="boundaries" type="checkbox" checked={boundaries} onChange={(event) => setBoundaries(event.currentTarget.checked)} /></div>
        </div>
        <div className="control-group">
          <div className="control-row"><label htmlFor="collapsed">Collapse subtree at {collapseCandidate}</label><input id="collapsed" type="checkbox" checked={collapsed} onChange={(event) => setCollapsed(event.currentTarget.checked)} /></div>
        </div>
        <div className="control-group">
          <label htmlFor="footprint">Super-node footprint</label>
          <select id="footprint" value={footprint} onChange={(event) => setFootprint(event.currentTarget.value as SuperNodeFootprint)}><option value="descendant-area">reflect descendant area</option><option value="fixed">fixed size</option></select>
        </div>
        <div className="control-group">
          <label htmlFor="aggregation">Contracted edge aggregation</label>
          <select id="aggregation" value={aggregation} onChange={(event) => setAggregation(event.currentTarget.value as EdgeAggregation)}><option value="bundle">bundle multiple edges</option><option value="weighted">show weight in width</option><option value="hide-internal">hide internal edges</option></select>
        </div>
        <div className="control-group">
          <div className="control-row"><label htmlFor="zoom">Zoom</label><output htmlFor="zoom">{Math.round(zoom * 100)}%</output></div>
          <input id="zoom" type="range" min={0.25} max={2} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.currentTarget.value))} />
          <button className="fit-button" type="button" onClick={() => setZoom(1)}>Fit</button>
        </div>
      </aside>
      <section className="stage">
        <svg width="100%" height="100%" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Disperse layout result">
          <g transform={zoomTransform}>
            {boundaries && result.groups.map((group) => <rect key={group.id} className="disperse-group" x={group.x} y={group.y} width={group.w} height={group.h} rx="12" />)}
            {result.edges.filter((edge) => !edge.internal).map((edge) => {
              const source = result.pos[edge.sourceId];
              const target = result.pos[edge.targetId];
              if (!source || !target) return null;
              return <line key={edge.id} className="lab-edge" x1={source.x + source.w / 2} y1={source.y} x2={target.x + target.w / 2} y2={target.y} strokeWidth={aggregation === "weighted" ? 1 + edge.weight * 1.5 : 2} />;
            })}
            {result.order.map((id) => {
              const node = result.pos[id]!;
              return <g key={id}><title>{id}</title><rect className={`lab-node ${id === rootId ? "root" : ""} ${node.sourceNodeId ? "super" : ""}`} x={node.x} y={node.y - node.h / 2} width={node.w} height={node.h} rx="6" /><text className="lab-label" x={node.x + 8} y={node.y + 4}>{node.sourceNodeId ? `collapsed: ${node.sourceNodeId}` : sample.input.boxSizes[id]?.labelLines?.[0] || id}</text></g>;
            })}
          </g>
        </svg>
      </section>
      {snapshotOpen && <aside className="lab-panel right"><h2 className="lab-title">Snapshot</h2><div className="snapshot-scroll"><div className="summary">{metrics(result)}</div><div className="json-block"><pre>{JSON.stringify({ sampleId, graph: sample.input.graph, options: { subtype, space, collapsed, footprint, aggregation } }, null, 2)}</pre></div><div className="json-block"><pre>{JSON.stringify({ order: result.order, totalWidth: result.totalWidth, totalHeight: result.totalHeight, pos: result.pos, edges: result.edges }, null, 2)}</pre></div></div></aside>}
    </main>
  );
}

const root = document.getElementById("disperse-lab-root");
if (!root) throw new Error("disperse-lab-root not found");
createRoot(root).render(<App />);
