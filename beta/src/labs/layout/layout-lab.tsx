import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  layout,
  type LayoutBranchDirection,
  type LayoutDensity,
  type LayoutDepthAlign,
  type LayoutDirection,
  type LayoutMode,
  type LayoutOptions,
} from "../../shared/layout_port";
import {
  layoutSamples,
  summarizeLayout,
  toVisibleLayoutGraph,
  type LayoutSampleId,
} from "./layout_samples";
import "./layout-lab.css";

const modes: LayoutMode[] = ["tree", "mindmap", "logic-chart", "timeline"];
const directions: LayoutDirection[] = ["right", "left", "down", "up"];
const depthAligns: LayoutDepthAlign[] = ["packed", "aligned"];
const densities: LayoutDensity[] = ["compact", "balanced", "spacious"];
const branches: LayoutBranchDirection[] = ["both", "right", "left"];

function numberInput(value: number, setValue: (value: number) => void, min: number, max: number, step = 1): React.ReactNode {
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => setValue(Number(event.currentTarget.value))}
    />
  );
}

function App(): React.ReactElement {
  const [sampleId, setSampleId] = useState<LayoutSampleId>("tree-stress-30");
  const sample = layoutSamples.find((item) => item.sample_id === sampleId) || layoutSamples[0]!;
  const [mode, setMode] = useState<LayoutMode>(sample.input.mode);
  const [direction, setDirection] = useState<LayoutDirection>("right");
  const [depthAlign, setDepthAlign] = useState<LayoutDepthAlign>("packed");
  const [density, setDensity] = useState<LayoutDensity>("balanced");
  const [branchDirection, setBranchDirection] = useState<LayoutBranchDirection>("both");
  const [nodeGap, setNodeGap] = useState(14);
  const [levelGap, setLevelGap] = useState(112);
  const [padding, setPadding] = useState(92);
  const [zoom, setZoom] = useState(1);

  const graph = useMemo(() => toVisibleLayoutGraph(sample), [sample]);
  const options: LayoutOptions = {
    ...sample.input.options,
    structuredMode: mode === "tree" || mode === "mindmap" || mode === "logic-chart" || mode === "timeline" ? mode : "tree",
    direction,
    depthAlign,
    density,
    branchDirection,
    spacing: { nodeGap, levelGap, padding },
  };
  const result = layout(graph, sample.input.boxSizes, mode, options);
  const canvasWidth = Math.max(900, Math.ceil(result.totalWidth + 80));
  const canvasHeight = Math.max(640, Math.ceil(result.totalHeight + 80));
  const rootId = options.displayRootId || sample.input.graph.nodeIds[0];

  const edges = sample.input.graph.nodeIds.flatMap((sourceId) =>
    (sample.input.graph.children[sourceId] || []).map((targetId) => ({ sourceId, targetId })),
  );

  return (
    <main className="layout-lab">
      <aside className="lab-panel">
        <h1 className="lab-title">Layout Lab</h1>
        <div className="control-group">
          <label htmlFor="sample">Sample</label>
          <select
            id="sample"
            value={sampleId}
            onChange={(event) => {
              const next = event.currentTarget.value as LayoutSampleId;
              const nextSample = layoutSamples.find((item) => item.sample_id === next);
              setSampleId(next);
              if (nextSample) setMode(nextSample.input.mode);
            }}
          >
            {layoutSamples.map((item) => (
              <option key={item.sample_id} value={item.sample_id}>{item.sample_id}</option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="mode">Mode</label>
          <select id="mode" value={mode} onChange={(event) => setMode(event.currentTarget.value as LayoutMode)}>
            {modes.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="direction">Direction</label>
          <select id="direction" value={direction} onChange={(event) => setDirection(event.currentTarget.value as LayoutDirection)}>
            {directions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="depth-align">Depth Align</label>
          <select id="depth-align" value={depthAlign} onChange={(event) => setDepthAlign(event.currentTarget.value as LayoutDepthAlign)}>
            {depthAligns.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="density">Density</label>
          <select id="density" value={density} onChange={(event) => setDensity(event.currentTarget.value as LayoutDensity)}>
            {densities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="branch">Branch Direction</label>
          <select id="branch" value={branchDirection} onChange={(event) => setBranchDirection(event.currentTarget.value as LayoutBranchDirection)}>
            {branches.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="control-group">
          <label>Node Gap</label>
          {numberInput(nodeGap, setNodeGap, 0, 120)}
        </div>
        <div className="control-group">
          <label>Level Gap</label>
          {numberInput(levelGap, setLevelGap, 40, 360)}
        </div>
        <div className="control-group">
          <label>Side Padding</label>
          {numberInput(padding, setPadding, 20, 240)}
        </div>
        <div className="control-group">
          <div className="control-row">
            <label htmlFor="zoom">Zoom</label>
            <output htmlFor="zoom">{Math.round(zoom * 100)}%</output>
          </div>
          <input
            id="zoom"
            type="range"
            min={0.25}
            max={2}
            step={0.05}
            value={zoom}
            onChange={(event) => setZoom(Number(event.currentTarget.value))}
          />
          <button className="fit-button" type="button" onClick={() => setZoom(1)}>Fit</button>
        </div>
      </aside>
      <section className="stage">
        <svg
          width={`${zoom * 100}%`}
          height={`${zoom * 100}%`}
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Layout result"
        >
          {edges.map(({ sourceId, targetId }) => {
            const source = result.pos[sourceId];
            const target = result.pos[targetId];
            if (!source || !target) return null;
            return (
              <path
                key={`${sourceId}-${targetId}`}
                className="lab-edge"
                d={`M ${source.x + source.w} ${source.y} C ${source.x + source.w + 70} ${source.y}, ${target.x - 70} ${target.y}, ${target.x} ${target.y}`}
              />
            );
          })}
          {result.order.map((nodeId) => {
            const pos = result.pos[nodeId];
            if (!pos) return null;
            return (
              <g key={nodeId}>
                <title>{nodeId}</title>
                <rect className={`lab-node ${nodeId === rootId ? "root" : ""}`} x={pos.x} y={pos.y - pos.h / 2} width={pos.w} height={pos.h} rx={6} />
                <text className="lab-label" x={pos.x + 10} y={pos.y + 4}>{nodeId}</text>
              </g>
            );
          })}
        </svg>
      </section>
      <aside className="lab-panel right">
        <h2 className="lab-title">Snapshot</h2>
        <div className="snapshot-scroll">
          <div className="summary">{summarizeLayout(result)}</div>
          <div className="json-block">
            <pre>{JSON.stringify({ input: sample.input.graph, boxSizes: sample.input.boxSizes, options }, null, 2)}</pre>
          </div>
          <div className="json-block">
            <pre>{JSON.stringify({ order: result.order, totalWidth: result.totalWidth, totalHeight: result.totalHeight, pos: result.pos }, null, 2)}</pre>
          </div>
        </div>
      </aside>
    </main>
  );
}

const root = document.getElementById("layout-lab-root");
if (!root) {
  throw new Error("layout-lab-root not found");
}

createRoot(root).render(<App />);
