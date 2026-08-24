import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  layout,
  type LayoutDepthAlign,
  type LayoutDirection,
  type LayoutMode,
  type LayoutOptions,
} from "../../shared/layout_port";
import {
  layoutLabSamples,
  summarizeLayout,
  toVisibleLayoutGraph,
  type LayoutLabSampleId,
} from "./layout_samples";
import { layoutLabEdgePath } from "./layout_edge_paths";
import type { EdgePath } from "../../shared/edge_route";
import "./layout-lab.css";

const modes: LayoutMode[] = ["Tree", "Radial", "Axial", "Disperse", "System"];
const directions = ["left/right", "left", "right", "up/down", "up", "down"] as const;
const depthAligns: LayoutDepthAlign[] = ["packed", "aligned"];

type CanonicalDirection = (typeof directions)[number];
type LayoutSpacing = LayoutOptions["spacing"] & { nodeGap: number; levelGap: number; padding: number };
const spacePresets = {
  tight: { nodeGap: 7, levelGap: 64, padding: 48 },
  normal: { nodeGap: 14, levelGap: 112, padding: 92 },
  loose: { nodeGap: 28, levelGap: 196, padding: 144 },
} as const;
type SpacePreset = keyof typeof spacePresets;
type SpaceSelection = SpacePreset | "custom";
type LayoutLabEdgeOutcome =
  | { sourceId: string; targetId: string; path: EdgePath }
  | { sourceId: string; targetId: string; error: string };

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
  const [sampleId, setSampleId] = useState<LayoutLabSampleId>("tree-stress-30");
  const sample = layoutLabSamples.find((item) => item.sample_id === sampleId) || layoutLabSamples[0]!;
  const [mode, setMode] = useState<LayoutMode>(sample.input.mode);
  const [direction, setDirection] = useState<CanonicalDirection>("left/right");
  const [depthAlign, setDepthAlign] = useState<LayoutDepthAlign>("packed");
  const [nodeGap, setNodeGap] = useState(14);
  const [levelGap, setLevelGap] = useState(112);
  const [padding, setPadding] = useState(92);
  const [space, setSpace] = useState<SpaceSelection>("normal");
  const [zoom, setZoom] = useState(1);
  const [snapshotOpen, setSnapshotOpen] = useState(false);

  const graph = useMemo(() => toVisibleLayoutGraph(sample), [sample]);
  const supportsDirection = mode !== "Disperse";
  const spacing: LayoutSpacing = { nodeGap, levelGap, padding };
  const { direction: _sampleDirection, ...sampleOptions } = sample.input.options;
  const options: LayoutOptions = {
    ...sampleOptions,
    structuredMode: mode === "Tree" || mode === "Radial" || mode === "Axial" ? mode : undefined,
    depthAlign,
    ...(supportsDirection ? { direction: direction as LayoutDirection } : {}),
    spacing,
  };
  let result: ReturnType<typeof layout> | undefined;
  let layoutError: string | undefined;
  try {
    result = layout(graph, sample.input.boxSizes, mode, options);
  } catch (error) {
    layoutError = error instanceof Error ? error.message : String(error);
  }
  const canvasWidth = Math.max(900, Math.ceil((result?.totalWidth || 0) + 80));
  const canvasHeight = Math.max(640, Math.ceil((result?.totalHeight || 0) + 80));
  const rootId = result?.order[0];
  const rootPos = rootId ? result?.pos[rootId] : undefined;
  const zoomTransform = rootPos
    ? `translate(${rootPos.x} ${rootPos.y}) scale(${zoom}) translate(${-rootPos.x} ${-rootPos.y})`
    : undefined;

  const edges = sample.input.graph.nodeIds.flatMap((sourceId) =>
    (sample.input.graph.children[sourceId] || []).map((targetId) => ({ sourceId, targetId })),
  );
  const edgePaths: LayoutLabEdgeOutcome[] = [];
  if (result) {
    edges.forEach(({ sourceId, targetId }) => {
      const source = result.pos[sourceId];
      const target = result.pos[targetId];
      if (!source || !target) return;
      try {
        edgePaths.push({ sourceId, targetId, path: layoutLabEdgePath(source, target, mode, supportsDirection ? direction : undefined) });
      } catch (error) {
        edgePaths.push({ sourceId, targetId, error: error instanceof Error ? error.message : String(error) });
      }
    });
  }
  const edgeErrors = edgePaths.filter((item): item is Extract<LayoutLabEdgeOutcome, { error: string }> => "error" in item);

  const selectSpace = (next: SpaceSelection): void => {
    setSpace(next);
    if (next === "custom") return;
    const preset = spacePresets[next];
    setNodeGap(preset.nodeGap);
    setLevelGap(preset.levelGap);
    setPadding(preset.padding);
  };

  const setCustomNodeGap = (value: number): void => { setSpace("custom"); setNodeGap(value); };
  const setCustomLevelGap = (value: number): void => { setSpace("custom"); setLevelGap(value); };
  const setCustomPadding = (value: number): void => { setSpace("custom"); setPadding(value); };

  return (
    <main className={`layout-lab${snapshotOpen ? " snapshot-open" : ""}`}>
      <aside className="lab-panel">
        <h1 className="lab-title">Layout Lab</h1>
        <button
          className="snapshot-toggle"
          type="button"
          aria-expanded={snapshotOpen}
          onClick={() => setSnapshotOpen((open) => !open)}
        >
          {snapshotOpen ? "Hide Snapshot" : "Show Snapshot"}
        </button>
        <div className="control-group">
          <label htmlFor="sample">Sample</label>
          <select
            id="sample"
            value={sampleId}
            onChange={(event) => {
              const next = event.currentTarget.value as LayoutLabSampleId;
              const nextSample = layoutLabSamples.find((item) => item.sample_id === next);
              setSampleId(next);
              if (nextSample) setMode(nextSample.input.mode);
            }}
          >
            {layoutLabSamples.map((item) => (
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
          <select id="direction" value={direction} disabled={!supportsDirection} onChange={(event) => setDirection(event.currentTarget.value as CanonicalDirection)}>
            {directions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          {!supportsDirection && <span className="control-note">Disperse selects edge ports from node-center vectors.</span>}
        </div>
        <div className="control-group">
          <label htmlFor="depth-align">Depth Align</label>
          <select id="depth-align" value={depthAlign} onChange={(event) => setDepthAlign(event.currentTarget.value as LayoutDepthAlign)}>
            {depthAligns.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="space">Space</label>
          <select id="space" value={space} onChange={(event) => selectSpace(event.currentTarget.value as SpaceSelection)}>
            {(Object.keys(spacePresets) as SpacePreset[]).map((item) => <option key={item} value={item}>{item}</option>)}
            <option value="custom">custom</option>
          </select>
        </div>
        <div className="control-group">
          <label>Node Gap</label>
          {numberInput(nodeGap, setCustomNodeGap, 0, 120)}
        </div>
        <div className="control-group">
          <label>Level Gap</label>
          {numberInput(levelGap, setCustomLevelGap, 40, 360)}
        </div>
        <div className="control-group">
          <label>Side Padding</label>
          {numberInput(padding, setCustomPadding, 20, 240)}
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
        {layoutError ? (
          <div className="lab-error" role="alert">Layout failed: {layoutError}</div>
        ) : result && (
          <>
            {edgeErrors.map((item) => <div className="lab-error" role="alert" key={`${item.sourceId}-${item.targetId}`}>Edge {item.sourceId} → {item.targetId} failed: {item.error}</div>)}
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Layout result"
            >
              <g transform={zoomTransform}>
                {edgePaths.map((item) => "path" in item ? (
                  <path key={`${item.sourceId}-${item.targetId}`} className="lab-edge" d={item.path.d} />
                ) : null)}
                {result.order.map((nodeId) => {
                  const pos = result.pos[nodeId];
                  if (!pos) return null;
                  return (
                    <g key={nodeId}>
                      <title>{nodeId}</title>
                      <rect className={`lab-node ${nodeId === rootId ? "root" : ""}`} x={pos.x} y={pos.y - pos.h / 2} width={pos.w} height={pos.h} rx={6} />
                      <text className="lab-label" x={pos.x + 10} y={pos.y + 4}>{pos.labelLines?.[0] || nodeId}</text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </>
        )}
      </section>
      {snapshotOpen && (
        <aside className="lab-panel right">
          <h2 className="lab-title">Snapshot</h2>
          <div className="snapshot-scroll">
            {result && <div className="summary">{summarizeLayout(result)}</div>}
            <div className="json-block">
              <pre>{JSON.stringify({ input: sample.input.graph, boxSizes: sample.input.boxSizes, mode, direction: supportsDirection ? direction : undefined, portOptions: options, layoutError }, null, 2)}</pre>
            </div>
            {result && <div className="json-block">
              <pre>{JSON.stringify({ order: result.order, totalWidth: result.totalWidth, totalHeight: result.totalHeight, pos: result.pos }, null, 2)}</pre>
            </div>}
          </div>
        </aside>
      )}
    </main>
  );
}

const root = document.getElementById("layout-lab-root");
if (!root) {
  throw new Error("layout-lab-root not found");
}

createRoot(root).render(<App />);
