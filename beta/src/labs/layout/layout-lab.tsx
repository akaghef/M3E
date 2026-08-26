import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  layout,
  type LayoutDepthAlign,
  type LayoutDirection,
  type LayoutMode,
  type LayoutOptions,
  type DisperseEdgeStyle,
} from "../../shared/layout_port";
import {
  layoutLabSamples,
  summarizeLayout,
  toVisibleLayoutGraph,
  type LayoutLabSampleId,
} from "./layout_samples";
import { layoutLabEdgePath } from "./layout_edge_paths";
import "./layout-lab.css";

const modes: LayoutMode[] = ["Tree", "Axial", "Disperse", "System"];
const directions = ["left/right", "left", "right", "up/down", "up", "down"] as const;
const depthAligns: LayoutDepthAlign[] = ["packed", "aligned"];
const disperseSubtypes = ["scatter", "cluster", "force"] as const;
const disperseEdgeStyles: DisperseEdgeStyle[] = ["line", "curve", "force-link"];

type CanonicalDirection = (typeof directions)[number];
type LayoutSpacing = LayoutOptions["spacing"] & { nodeGap: number; levelGap: number; padding: number };
const spacePresets = {
  tight: { nodeGap: 7, levelGap: 64, padding: 48 },
  normal: { nodeGap: 14, levelGap: 112, padding: 92 },
  loose: { nodeGap: 28, levelGap: 196, padding: 144 },
} as const;
type SpacePreset = keyof typeof spacePresets;
type SpaceSelection = SpacePreset | "custom";

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
  const [disperseSubtype, setDisperseSubtype] = useState<(typeof disperseSubtypes)[number]>("cluster");
  const [collapseEnabled, setCollapseEnabled] = useState(false);
  const [collapseTarget, setCollapseTarget] = useState("");
  const [superNodeFootprint, setSuperNodeFootprint] = useState<"descendant-area" | "fixed">("descendant-area");
  const [edgeAggregation, setEdgeAggregation] = useState<"bundle" | "weighted" | "hide-internal">("bundle");
  const [disperseEdgeStyle, setDisperseEdgeStyle] = useState<DisperseEdgeStyle>("force-link");
  const [boundaries, setBoundaries] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [snapshotOpen, setSnapshotOpen] = useState(false);

  const isDisperse = mode === "Disperse";
  const rootId = sample.input.options.displayRootId || sample.input.graph.nodeIds[0] || "";
  const collapseTargets = useMemo(() => sample.input.graph.nodeIds.filter((id) => id !== rootId && (sample.input.graph.children[id] || []).length > 0), [sample, rootId]);
  const effectiveCollapseTarget = collapseTargets.includes(collapseTarget) ? collapseTarget : collapseTargets[0];
  const collapsedNodeIds = collapseEnabled && effectiveCollapseTarget ? [effectiveCollapseTarget] : [];
  const graph = useMemo(() => toVisibleLayoutGraph(sample, isDisperse ? [] : collapsedNodeIds), [sample, isDisperse, collapsedNodeIds]);
  const spacing: LayoutSpacing = { nodeGap, levelGap, padding };
  const { direction: _sampleDirection, ...sampleOptions } = sample.input.options;
  const options: LayoutOptions = {
    ...sampleOptions,
    structuredMode: mode === "Tree" || mode === "Axial" ? mode : undefined,
    depthAlign,
    direction: direction as LayoutDirection,
    space: space === "custom" ? "normal" : space,
    spacing,
    disperse: {
      subtype: disperseSubtype,
      collapsedNodeIds,
      superNodeFootprint,
      edgeAggregation,
    },
  };
  const result = layout(graph, sample.input.boxSizes, mode, options);
  const canvasWidth = Math.max(900, Math.ceil(result.totalWidth + 80));
  const canvasHeight = Math.max(640, Math.ceil(result.totalHeight + 80));
  const resultRootId = result.order[0];
  const rootPos = resultRootId ? result.pos[resultRootId] : undefined;
  const zoomTransform = rootPos
    ? `translate(${rootPos.x} ${rootPos.y}) scale(${zoom}) translate(${-rootPos.x} ${-rootPos.y})`
    : undefined;

  const treeEdges = graph.nodeIds.flatMap((sourceId) =>
    graph.childrenOf(sourceId).map((targetId) => ({ sourceId, targetId })),
  );
  const renderEdges: Array<{ sourceId: string; targetId: string; weight?: number }> = isDisperse
    ? (result.edges || []).filter((edge) => !edge.internal)
    : treeEdges;

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
              setCollapseEnabled(false);
              setCollapseTarget("");
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
        {!isDisperse && <div className="control-group">
          <label htmlFor="direction">Direction</label>
          <select id="direction" value={direction} onChange={(event) => setDirection(event.currentTarget.value as CanonicalDirection)}>
            {directions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>}
        {!isDisperse && <div className="control-group">
          <label htmlFor="depth-align">Depth Align</label>
          <select id="depth-align" value={depthAlign} onChange={(event) => setDepthAlign(event.currentTarget.value as LayoutDepthAlign)}>
            {depthAligns.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>}
        <div className="control-group">
          <label htmlFor="space">Space</label>
          <select id="space" value={space} onChange={(event) => selectSpace(event.currentTarget.value as SpaceSelection)}>
            {(Object.keys(spacePresets) as SpacePreset[]).map((item) => <option key={item} value={item}>{item}</option>)}
            <option value="custom">custom</option>
          </select>
        </div>
        {!isDisperse && <div className="control-group">
          <label>Node Gap</label>
          {numberInput(nodeGap, setCustomNodeGap, 0, 120)}
        </div>}
        {isDisperse && <>
          <div className="control-group">
            <label htmlFor="disperse-subtype">Subtype</label>
            <select id="disperse-subtype" value={disperseSubtype} onChange={(event) => setDisperseSubtype(event.currentTarget.value as (typeof disperseSubtypes)[number])}>
              {disperseSubtypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="control-group">
            <label htmlFor="super-node-footprint">Super-node footprint</label>
            <select id="super-node-footprint" value={superNodeFootprint} onChange={(event) => setSuperNodeFootprint(event.currentTarget.value as "descendant-area" | "fixed")}>
              <option value="descendant-area">reflect descendant area</option><option value="fixed">fixed size</option>
            </select>
          </div>
          <div className="control-group">
            <label htmlFor="edge-aggregation">Edge aggregation</label>
            <select id="edge-aggregation" value={edgeAggregation} onChange={(event) => setEdgeAggregation(event.currentTarget.value as "bundle" | "weighted" | "hide-internal")}>
              <option value="bundle">bundle</option><option value="weighted">weight</option><option value="hide-internal">drop-internal</option>
            </select>
          </div>
          <div className="control-group">
            <label htmlFor="disperse-edge-style">Edge Style</label>
            <select id="disperse-edge-style" value={disperseEdgeStyle} onChange={(event) => setDisperseEdgeStyle(event.currentTarget.value as DisperseEdgeStyle)}>
              {disperseEdgeStyles.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="control-group"><div className="control-row"><label htmlFor="boundaries">Draw group boundaries</label><input id="boundaries" type="checkbox" checked={boundaries} onChange={(event) => setBoundaries(event.currentTarget.checked)} /></div></div>
        </>}
        <div className="control-group">
          <div className="control-row"><label htmlFor="collapse-enabled">Collapse subtree</label><input id="collapse-enabled" type="checkbox" checked={collapseEnabled} onChange={(event) => setCollapseEnabled(event.currentTarget.checked)} /></div>
          <select aria-label="Collapse target" value={effectiveCollapseTarget || ""} disabled={!collapseEnabled || collapseTargets.length === 0} onChange={(event) => setCollapseTarget(event.currentTarget.value)}>
            {collapseTargets.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </div>
        {!isDisperse && <div className="control-group">
          <label>Level Gap</label>
          {numberInput(levelGap, setCustomLevelGap, 40, 360)}
        </div>}
        {!isDisperse && <div className="control-group">
          <label>Side Padding</label>
          {numberInput(padding, setCustomPadding, 20, 240)}
        </div>}
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
          width="100%"
          height="100%"
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Layout result"
        >
          <g transform={zoomTransform}>
            {isDisperse && boundaries && result.groups?.map((group) => <rect key={group.id} className="disperse-group" x={group.x} y={group.y} width={group.w} height={group.h} rx="12" />)}
            {renderEdges.map((edge) => {
              const { sourceId, targetId } = edge;
              const source = result.pos[sourceId];
              const target = result.pos[targetId];
              if (!source || !target) return null;
              const path = isDisperse
                ? layoutLabEdgePath(source, target, mode, undefined, disperseEdgeStyle)
                : layoutLabEdgePath(source, target, mode, direction);
              return (
                <path
                  key={`${sourceId}-${targetId}`}
                  className="lab-edge"
                  d={path.d}
                  strokeWidth={isDisperse && edgeAggregation === "weighted" ? 1 + (edge.weight ?? 1) * 1.5 : undefined}
                />
              );
            })}
            {result.order.map((nodeId) => {
              const pos = result.pos[nodeId];
              if (!pos) return null;
              return (
                <g key={nodeId}>
                  <title>{nodeId}</title>
                  <rect className={`lab-node ${nodeId === resultRootId ? "root" : ""} ${"sourceNodeId" in pos && pos.sourceNodeId ? "super" : ""}`} x={pos.x} y={pos.y - pos.h / 2} width={pos.w} height={pos.h} rx={6} />
                  <text className="lab-label" x={pos.x + 10} y={pos.y + 4}>{"sourceNodeId" in pos && pos.sourceNodeId ? `collapsed: ${pos.sourceNodeId}` : sample.input.boxSizes[nodeId]?.labelLines?.[0] || nodeId}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </section>
      {snapshotOpen && (
        <aside className="lab-panel right">
          <h2 className="lab-title">Snapshot</h2>
          <div className="snapshot-scroll">
            <div className="summary">{summarizeLayout(result)}</div>
            <div className="json-block">
              <pre>{JSON.stringify({ input: sample.input.graph, boxSizes: sample.input.boxSizes, direction, options }, null, 2)}</pre>
            </div>
            <div className="json-block">
              <pre>{JSON.stringify({ order: result.order, totalWidth: result.totalWidth, totalHeight: result.totalHeight, pos: result.pos }, null, 2)}</pre>
            </div>
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
